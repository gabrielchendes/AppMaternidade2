import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { initNodeWarningHandler } from '../../src/serverUtils/nodeWarningHandler';

initNodeWarningHandler();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

function parseBody(req: VercelRequest): Record<string, any> {
  let body = req.body;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? body : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const queryAction = req.query?.action as string;
  const urlParts = req.url?.split('/') || [];
  const urlAction = urlParts.pop()?.split('?')[0];
  const action = queryAction || urlAction;

  try {
    switch (action) {
      case 'login-verify':
        return await handleLoginVerify(req, res);
      case 'user-magic-link':
      case 'generate-magic-link':
        return await handleMagicLink(req, res);
      case 'user-password-set':
        return await handlePasswordSet(req, res);
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error: any) {
    console.error(`[Auth API] Error in ${action} details:`, {
      message: (error as any)?.message,
      code: (error as any)?.code,
      details: (error as any)?.details,
      stack: (error as any)?.stack
    });

    const isFetchError = error?.message?.includes('fetch failed') || error?.message?.includes('ENOTFOUND');
    const statusCode = isFetchError ? 503 : 500;
    const errorMessage = isFetchError
      ? 'Could not connect to Supabase database. Please check your SUPABASE_URL and VITE_SUPABASE_URL configuration.'
      : ((error as any)?.message || 'Internal authentication server error');

    return res.status(statusCode).json({ 
      error: errorMessage,
      details: (error as any)?.details || null
    });
  }
}

async function handleLoginVerify(req: VercelRequest, res: VercelResponse) {
  const body = parseBody(req);
  const email = body.email || (req.query?.email as string);
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const emailLower = email.toLowerCase().trim();

  // Try to find profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', emailLower)
    .maybeSingle();

  if (profileError && profileError.code !== '42P01') {
    console.error('[Auth API] Profile fetch error:', profileError);
    if (profileError.message?.includes('fetch failed') || profileError.message?.includes('ENOTFOUND')) {
      return res.status(503).json({
        error: 'Supabase service temporarily unavailable or invalid URL. Please check database connection.',
        details: profileError.message
      });
    }
  }

  let authUserId = profile?.id;
  
  if (!authUserId) {
    // Check Auth directly
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('[Auth API] Auth list error:', listError);
    }
    const users = listData?.users || [];
    const user = users.find((u: any) => u.email?.toLowerCase() === emailLower);
    
    if (user) {
      authUserId = user.id;
      // If user exists in Auth but not in profiles, sync it now
      const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        email: emailLower,
        is_admin: false // Default
      });
      if (upsertError && upsertError.code !== '42P01') console.error('[Auth API] Profile sync error:', upsertError);
    } else {
      // SPECIAL CASE: Check if this is the Master Admin email from settings
      let masterEmail = 'gabrielchendes@gmail.com';
      try {
        const { data: settings, error: sError } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
        if (!sError && settings?.admin_email) masterEmail = settings.admin_email.toLowerCase().trim();
      } catch (settingsErr) {
        console.warn('[Auth API] Could not fetch master email from settings, using hardcoded default');
      }
      
      if (emailLower === masterEmail || emailLower === 'gabrielchendes@gmail.com') {
        // Handle orphaned profile before creation to avoid UNIQUE constraint violation in trigger
        const { data: orphaned, error: orphanedError } = await supabaseAdmin.from('profiles').select('id').eq('email', emailLower).maybeSingle();
        if (orphaned && !orphanedError) {
          console.log(`[Auth API] Deleting orphaned profile for ${emailLower}`);
          await supabaseAdmin.from('profiles').delete().eq('id', orphaned.id);
        }

        // Automatically create the Super Admin account if it's missing
        console.log(`[Auth API] Creating missing Super Admin: ${emailLower}`);
        const tempPwd = 'Wilson@' + Math.random().toString(36).substring(2, 6);
        const { data: neo, error: neoError } = await supabaseAdmin.auth.admin.createUser({
          email: emailLower,
          password: tempPwd,
          email_confirm: true,
          user_metadata: { full_name: 'Super Admin' }
        });
        
        if (neoError) {
          console.error('[Auth API] Failed to create Super Admin:', neoError);
          return res.status(404).json({ error: 'User not found. Database configuration check required.' });
        }
        
        authUserId = neo.user?.id;
        if (authUserId) {
          await supabaseAdmin.from('profiles').upsert({
            id: authUserId,
            email: emailLower,
            is_admin: true,
            full_name: 'Super Admin'
          });
        }
      } else {
        return res.status(404).json({ error: 'User not found.' });
      }
    }
  }

  // Get master email to check if we should skip password reset
  let masterEmail = 'gabrielchendes@gmail.com';
  try {
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
    if (settings?.admin_email) masterEmail = settings.admin_email.toLowerCase().trim();
  } catch (e) {}
  
  const isMasterAdmin = emailLower === masterEmail || emailLower === 'gabrielchendes@gmail.com';

  // Only reset password to '123456' if NOT the master admin
  const tempPassword = '123456';
  
  if (!isMasterAdmin) {
    if (!supabaseServiceRoleKey) {
      console.error('[Auth API] SUPABASE_SERVICE_ROLE_KEY is missing in environment variables!');
      return res.status(500).json({
        error: 'Missing SUPABASE_SERVICE_ROLE_KEY in environment variables. Please check your Vercel Project Settings.'
      });
    }

    try {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: tempPassword });
      if (updateError) {
        console.warn(`[Auth API] Error updating password for ${emailLower}:`, updateError.message);
        // If the user does not exist in auth.users yet (e.g. was only created in profiles table), create them now
        if (updateError.message?.toLowerCase().includes('not found') || updateError.message?.toLowerCase().includes('user not found')) {
          console.log(`[Auth API] User ${emailLower} not found in auth.users, creating auth record...`);
          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            id: authUserId,
            email: emailLower,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: profile?.full_name || 'Aluno' }
          });
          if (createError) {
            console.error(`[Auth API] Failed to create auth user for ${emailLower}:`, createError);
          }
        }
      }
    } catch (err) {
      console.error(`[Auth API] Exception updating password for ${emailLower}:`, err);
    }
  }

  return res.status(200).json({ 
    success: true, 
    tempPassword: isMasterAdmin ? undefined : tempPassword, 
    message: isMasterAdmin ? 'Admin verified' : 'User verified and access configured' 
  });
}

async function handleMagicLink(req: VercelRequest, res: VercelResponse) {
  const body = parseBody(req);
  const email = body.email || (req.query?.email as string);
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Determine dynamic base URL for redirection after login
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let baseUrl = process.env.VITE_APP_URL || process.env.APP_URL;

  // Try to get custom app URL from settings
  try {
    const { data: settings } = await supabaseAdmin.from('app_settings').select('app_url').eq('id', 1).single();
    if (settings?.app_url) {
      baseUrl = settings.app_url;
    }
  } catch (e) {}

  if (!baseUrl && host) {
    baseUrl = `https://${host}`;
  }

  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = 'https://app-maternidade2.vercel.app';
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');

  // Generate robust, custom Base64 magic link
  const encodedEmail = Buffer.from(email.toLowerCase().trim()).toString('base64');
  const customMagicLink = `${cleanBaseUrl}/?magic=${encodedEmail}`;

  return res.status(200).json({ success: true, link: customMagicLink });
}

async function handlePasswordSet(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    if (authError) {
      console.error('[Auth API] auth.getUser error:', {
        message: authError.message,
        status: authError.status,
        token_preview: token.substring(0, 10) + '...'
      });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const body = parseBody(req);
  const { password, newPassword } = body;
  const targetPassword = password || newPassword;
  
  if (!targetPassword) return res.status(400).json({ error: 'Password is required' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: targetPassword });
  if (error) throw error;
  return res.status(200).json({ success: true });
}
