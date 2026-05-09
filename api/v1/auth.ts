import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
        return await handleMagicLink(req, res);
      case 'user-password-set':
        return await handlePasswordSet(req, res);
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error: any) {
    console.error(`[Auth API] Error in ${action}:`, error);
    return res.status(500).json({ error: error.message });
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

  if (profileError) throw profileError;

  let authUserId = profile?.id;
  
  if (!authUserId) {
    // Check Auth directly
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const users = listData?.users || [];
    const user = users.find((u: any) => u.email?.toLowerCase() === emailLower);
    
    if (user) {
      authUserId = user.id;
      // If user exists in Auth but not in profiles, sync it now
      await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        email: emailLower,
        is_admin: false // Default
      });
    } else {
      // SPECIAL CASE: Check if this is the Master Admin email from settings
      const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
      const masterEmail = settings?.admin_email?.toLowerCase() || 'gabrielchendes@gmail.com';
      
      if (emailLower === masterEmail || emailLower === 'gabrielchendes@gmail.com') {
        // Handle orphaned profile before creation to avoid UNIQUE constraint violation in trigger
        const { data: orphaned } = await supabaseAdmin.from('profiles').select('id').eq('email', emailLower).maybeSingle();
        if (orphaned) {
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
          return res.status(404).json({ error: 'Usuário não encontrado e falha ao criar admin mestre.' });
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
  const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).single();
  const masterEmail = settings?.admin_email?.toLowerCase() || 'gabrielchendes@gmail.com';
  const isMasterAdmin = emailLower === masterEmail || emailLower === 'gabrielchendes@gmail.com';

  // Only reset password to 'Wilson@2024' if NOT the master admin
  // This allows the master admin to use the custom password they set in the panel
  const tempPassword = 'Wilson@2024';
  
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
    message: isMasterAdmin ? 'Admin verificado' : 'Usuário verificado e senha temporária configurada' 
  });
}

async function handleMagicLink(req: VercelRequest, res: VercelResponse) {
  const { email } = req.body;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: process.env.VITE_APP_URL || 'https://ais-dev-ou4p52mfs5visl6qplallm-404064243999.us-east1.run.app' }
  });
  if (error) throw error;
  return res.status(200).json({ success: true, link: data.properties?.action_link });
}

async function handlePasswordSet(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  
  const { data: { user }, error: authError } = await createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceRoleKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  }).auth.getUser();

  if (authError || !user) return res.status(401).json({ error: 'Falha na autenticação' });

  const { password, newPassword } = req.body;
  const targetPassword = password || newPassword;
  
  if (!targetPassword) return res.status(400).json({ error: 'Senha é obrigatória' });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: targetPassword });
  if (error) throw error;
  return res.status(200).json({ success: true });
}
