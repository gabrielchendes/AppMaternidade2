import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

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

async function checkAdmin(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  }).auth.getUser();
  
  if (error || !user) return false;

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

  // Sensitive actions requiring admin
  const adminActions = ['notification-push', 'notification-history', 'notification-clear', 'notification-details'];
  if (adminActions.includes(action)) {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Acesso negado: Apenas administradores' });
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
    console.error(`[Notifications API] Error in ${action}:`, error);
    return res.status(500).json({ error: error.message });
  }
}

async function handlePush(req: VercelRequest, res: VercelResponse) {
  const { title, body, userIds, type = 'both' } = req.body;
  
  // Log to history
  const { data: broadcast } = await supabaseAdmin
    .from('notification_history')
    .insert({
      title,
      body,
      target_count: userIds?.length || 0,
      status: 'sent',
      type
    })
    .select()
    .single();

  // Create internal notifications for each user
  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    const notificationRows = userIds.map(uid => ({
      user_id: uid,
      title,
      body,
      broadcast_id: broadcast?.id || null
    }));

    await supabaseAdmin
      .from('notifications')
      .insert(notificationRows);
  }

  return res.status(200).json({ success: true, count: userIds?.length || 0 });
}

async function handleNotifyAdmin(req: VercelRequest, res: VercelResponse) {
  const { title, body } = req.body;
  
  // 1. Find all admins
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_admin', true);
  const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
  
  let adminIds: string[] = profiles?.map(p => p.id) || [];
  
  if (settings?.admin_email) {
    const { data: fallbackProfiles } = await supabaseAdmin.from('profiles').select('id').eq('email', settings.admin_email.toLowerCase());
    if (fallbackProfiles) {
      fallbackProfiles.forEach(p => {
        if (!adminIds.includes(p.id)) adminIds.push(p.id);
      });
    }
  }

  if (adminIds.length === 0) {
    return res.status(200).json({ success: true, message: 'No admins to notify' });
  }

  // 2. Create notifications for each admin
  const notificationRows = adminIds.map(uid => ({
    user_id: uid,
    title,
    body,
    broadcast_id: null
  }));

  await supabaseAdmin
    .from('notifications')
    .insert(notificationRows);

  return res.status(200).json({ success: true, adminCount: adminIds.length });
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
