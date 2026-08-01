import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Firebase Admin
if (getApps().length === 0) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      let parsedServiceAccount;
      if (typeof serviceAccount === 'string') {
        const cleaned = serviceAccount.trim();
        parsedServiceAccount = JSON.parse(cleaned);
      } else {
        parsedServiceAccount = serviceAccount;
      }

      // Fix private key formatting if it was escaped or has literal '\n'
      if (parsedServiceAccount && parsedServiceAccount.private_key) {
        parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
      }

      initializeApp({
        credential: cert(parsedServiceAccount)
      });
      console.log('[Notifications API] Firebase Admin initialized successfully');
    } else {
      console.warn('[Notifications API] FIREBASE_SERVICE_ACCOUNT is missing. Push notifications will be skipped.');
    }
  } catch (e) {
    console.error('[Notifications API] Error initializing Firebase Admin:', e);
  }
}

if (!supabaseUrl) {
  console.error('[Notifications API] CRITICAL: Supabase URL is missing');
}
if (!supabaseServiceRoleKey && !supabaseAnonKey) {
  console.error('[Notifications API] CRITICAL: Supabase keys are missing');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

if (!supabaseServiceRoleKey) {
  console.warn('[Notifications API] SUPABASE_SERVICE_ROLE_KEY is missing. Operations on behalf of other users may fail due to RLS.');
}

async function checkAdmin(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    if (error) {
      console.error('[Notifications API] auth.getUser error:', {
        message: error.message,
        status: error.status,
        token_preview: token.substring(0, 10) + '...'
      });
    }
    return false;
  }

  // Check profile and app_settings
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
  const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
  
  const isHardcodedAdmin = user.email?.toLowerCase() === 'gabrielchendes@gmail.com';
  const isSuperAdmin = (settings?.admin_email && user.email?.toLowerCase() === settings.admin_email.toLowerCase()) || isHardcodedAdmin;
  
  return !!profile?.is_admin || !!isSuperAdmin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const queryAction = req.query?.action as string;
  const urlParts = req.url?.split('/') || [];
  const urlAction = urlParts.pop()?.split('?')[0];
  const action = queryAction || urlAction;

  console.log(`[Notifications API] Request: ${req.method} ${req.url} | Action: ${action}`);

  // Sensitive actions requiring admin
  const adminActions = ['notification-history', 'notification-clear', 'notification-details'];
  if (adminActions.includes(action)) {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Acesso negado: Apenas administradores' });
  }

  // Specialized check for notification-push: 
  // Admins can do anything. 
  // Regular users can only notify a single other user (peer-to-peer/interaction)
  if (action === 'notification-push') {
    const userIds = req.body?.userIds;
    if (userIds && Array.isArray(userIds) && userIds.length > 1) {
      const isAdmin = await checkAdmin(req);
      if (!isAdmin) return res.status(403).json({ error: 'Acesso negado: Broadcats exigem privilégios de administrador' });
    }
  }

  try {
    switch (action) {
      case 'notification-push':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return await handlePush(req, res);
      
      case 'notify-admin':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return await handleNotifyAdmin(req, res);
      
      case 'notification-history':
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        return await handleHistory(req, res);
      
      case 'notification-clear':
        if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
        return await handleClear(req, res);
        
      case 'notification-details':
        const id = (req.query?.id as string) || urlParts[urlParts.length - 1];
        return await handleDetails(req, res, id);

      case 'sub-topic':
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        return await handleSubTopic(req, res);

      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error: any) {
    console.error(`[Notifications API] Error in ${action} details:`, {
      message: (error as any).message,
      code: (error as any).code,
      details: (error as any).details,
      stack: (error as any).stack
    });
    return res.status(500).json({ 
      error: (error as any).message || 'Erro interno no servidor de notificações',
      details: (error as any).details || null
    });
  }
}

async function sendPushNotification(userIds: string[], title: string, body: string) {
  if (getApps().length === 0) {
    return { success: false, reason: 'Firebase Admin not initialized' };
  }
  
  if (!userIds.length) {
    return { success: false, reason: 'No user IDs' };
  }

  try {
    // 1. Get tokens for users
    const { data: tokens, error } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    if (error) {
      console.error('[Notifications API] Supabase error fetching tokens:', error);
      throw error;
    }
    
    if (!tokens || tokens.length === 0) {
      return { success: false, reason: 'No registered push tokens found in database' };
    }

    const registrationTokens = tokens.map(t => t.token);

    // 2. Send multicast
    const message = {
      notification: { title, body },
      tokens: registrationTokens,
    };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);
    
    // Optional: cleanup failed tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (error?.code === 'messaging/invalid-registration-token' ||
              error?.code === 'messaging/registration-token-not-registered') {
            failedTokens.push(registrationTokens[idx]);
          }
        }
      });
      
      if (failedTokens.length > 0) {
        const { error: deleteError } = await supabaseAdmin.from('push_tokens').delete().in('token', failedTokens);
        if (deleteError) {
          console.error('[Notifications API] Error cleaning up failed tokens:', deleteError);
        }
      }
    }

    return { success: true, count: response.successCount };
  } catch (e: any) {
    console.error('[Notifications API] Error sending push notification:', e);
    return { success: false, error: e?.message || e, reason: 'Exception in sendPushNotification' };
  }
}

async function handlePush(req: VercelRequest, res: VercelResponse) {
  const { title, body, userIds, type = 'both', skipPush = false } = req.body;
  
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'No userIds provided' });
  }

  // Create internal notifications for each user
  const notificationRows = userIds.map(uid => ({
    user_id: uid,
    title,
    body,
    message: body, // Compatibility
    is_read: false,
    read: false, // Compatibility
    created_at: new Date().toISOString()
  }));

  try {
    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationRows);
    
    if (insertError) {
      console.error('[Notifications API] Error inserting internal notifications:', insertError);
    }
  } catch (err) {
    console.error('[Notifications API] Exception during notification insert:', err);
  }

  // Log to history asynchronously
  supabaseAdmin.from('notification_history').insert({
    title,
    body,
    target_count: userIds.length,
    status: 'sent',
    type: skipPush ? 'in_app' : type
  }).then(({ error }) => {
    if (error) console.error('[Notifications API] Error logging history:', error);
  });
    
  // Send background push if not skipped and not only in_app
  if (!skipPush && type !== 'in_app') {
    sendPushNotification(userIds, title, body).catch(err => {
      console.error('[Notifications API] Background push failed:', err);
    });
  }

  return res.status(200).json({ success: true, count: userIds.length });
}

async function handleNotifyAdmin(req: VercelRequest, res: VercelResponse) {
  const { title, body } = req.body;
  
  // 1. Find all admins
  let adminIds: string[] = [];
  let adminEmails: string[] = [];

  try {
    // Primary: Profiles explicitly marked as admin
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('is_admin', true);
    
    if (profileError) console.error('[Notifications API] Error fetching admin profiles:', profileError);
    if (profiles) {
      adminIds = profiles.map(p => p.id);
      adminEmails = profiles.map(p => p.email).filter(Boolean) as string[];
    }

    // Secondary: Master admin from settings
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
    
    // Hardcoded fallback
    const masterEmails = ['gabrielchendes@gmail.com'];
    if (settings?.admin_email) masterEmails.push(settings.admin_email.toLowerCase());

    // If we have no admins found yet (maybe RLS issue), we MUST find them by email
    // This is more likely to work if we know the emails
    const { data: masterProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('email', masterEmails);

    if (masterProfiles) {
      masterProfiles.forEach(p => {
        if (!adminIds.includes(p.id)) {
          adminIds.push(p.id);
          if (p.email) adminEmails.push(p.email);
        }
      });
    }
  } catch (err) {
    console.error('[Notifications API] Exception identifying admins:', err);
  }

  // deduplicate
  adminIds = [...new Set(adminIds.filter(id => !!id))];
  adminEmails = [...new Set(adminEmails.map(e => e.toLowerCase()))];

  if (adminIds.length === 0) {
    return res.status(200).json({ success: true, message: 'No admins found' });
  }

  // Safety cap
  if (adminIds.length > 20) adminIds = adminIds.slice(0, 20);

  // 2. Create notifications for each admin (Internal)
  const notificationRows = adminIds.map(uid => ({
    user_id: uid,
    title: title || 'Nova Dúvida Aula',
    body: body || 'Alguém enviou uma pergunta no curso.',
    message: body || 'Alguém enviou uma pergunta no curso.',
    is_read: false,
    read: false,
    created_at: new Date().toISOString()
  }));

  try {
    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationRows);

    if (insertError) {
      console.error('[Notifications API] Error inserting internal notifications for admins:', insertError);
    }
  } catch (err) {
    console.error('[Notifications API] Exception inserting admin notifications:', err);
  }

  // 3. Send Push Notification to admins
  sendPushNotification(adminIds, title || 'Nova Dúvida Aula', body || 'Alguém enviou uma pergunta no curso.')
    .catch(err => {
      console.error('[Notifications API] Background push to admins failed with error:', err);
    });

  return res.status(200).json({ success: true, adminCount: adminIds.length, notifyEmails: adminEmails });
}

async function handleHistory(req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('notification_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
     if (error.code === '42P01' || error.message?.includes('schema cache')) return res.status(200).json([]);
     throw error;
  }
  return res.status(200).json(data || []);
}

async function handleClear(req: VercelRequest, res: VercelResponse) {
  const { error } = await supabaseAdmin
    .from('notification_history')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error && error.code !== '42P01') throw error;
  return res.status(200).json({ success: true });
}

async function handleSubTopic(req: VercelRequest, res: VercelResponse) {
  const { userId, topic, action } = req.body;
  if (!userId || !topic) return res.status(400).json({ error: 'Missing parameters' });
  
  // Logic for topic subscription...
  return res.status(200).json({ success: true, action });
}

async function handleDetails(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id) return res.status(400).json({ error: 'Missing id' });
  
  // Try to find the broadcast and its direct targets
  // This depends on how notification_history is structured. 
  // For now returning empty or basic details.
  return res.status(200).json([]);
}
