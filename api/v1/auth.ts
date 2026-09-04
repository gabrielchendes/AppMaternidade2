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
      ? 'Não foi possível conectar ao banco de dados Supabase. Verifique se as variáveis SUPABASE_URL e VITE_SUPABASE_URL estão corretas.'
      : ((error as any)?.message || 'Erro interno no servidor de autenticação');

    return res.status(statusCode).json({ 
      error: errorMessage,
      details: (error as any)?.details || null
    });
  }
}

async function handleLoginVerify(req: VercelRequest, res: VercelResponse) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

  const emailLower = email.toLowerCase();

  // Try to find profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('email', emailLower)
    .maybeSingle();

  if (profileError && profileError.code !== '42P01') {
    console.error('[Auth API] Profile fetch error:', profileError);
    if (profileError.message?.includes('fetch failed') || profileError.message?.includes('ENOTFOUND')) {
      return res.status(503).json({
        error: 'Serviço do Supabase temporariamente indisponível ou URL inválida. Verifique a conexão com o Supabase.',
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
      // If service role is invalid, we can't do auto-admin-creation, but maybe we can proceed if it's just a regular user?
      // Actually regular users should already have a profile if they were created via standard signup.
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
        if (!sError && settings?.admin_email) masterEmail = settings.admin_email.toLowerCase();
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
          return res.status(404).json({ error: 'Usuário não encontrado. O banco de dados Supabase pode não estar configurado corretamente (RLS ou tabelas ausentes). Verifique o console do servidor.' });
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
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
    }
  }

  // Get master email to check if we should skip password reset
  let masterEmail = 'gabrielchendes@gmail.com';
  try {
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
    if (settings?.admin_email) masterEmail = settings.admin_email.toLowerCase();
  } catch (e) {}
  
  const isMasterAdmin = emailLower === masterEmail || emailLower === 'gabrielchendes@gmail.com';

  // Only reset password to '123456' if NOT the master admin
  // This allows the master admin to use the custom password they set in the panel
  const tempPassword = '123456';
  
  if (!isMasterAdmin) {
    try {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: tempPassword });
      if (updateError) {
        console.error(`[Auth API] Error updating password for ${emailLower}:`, updateError);
      }
    } catch (err) {
      console.error(`[Auth API] Exception updating password for ${emailLower}:`, err);
    }
  }

  return res.status(200).json({ 
    success: true, 
    tempPassword: isMasterAdmin ? undefined : tempPassword, 
    message: isMasterAdmin ? 'Admin verificado' : 'Usuário verificado e senha padrão configurada' 
  });
}

async function handleMagicLink(req: VercelRequest, res: VercelResponse) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });

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
  const encodedEmail = Buffer.from(email.toLowerCase()).toString('base64');
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
    return res.status(401).json({ error: 'Falha na autenticação' });
  }

  const { password, newPassword } = req.body;
  const targetPassword = password || newPassword;
  
  if (!targetPassword) return res.status(400).json({ error: 'Senha é obrigatória' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: targetPassword });
  if (error) throw error;
  return res.status(200).json({ success: true });
}
