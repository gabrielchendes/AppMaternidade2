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

  const urlParts = req.url?.split('/') || [];
  const action = urlParts.pop()?.split('?')[0];

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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (profileError) throw profileError;

  let authUserId = profile?.id;
  if (!authUserId) {
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const user = (userList.users as any[]).find(u => u.email?.toLowerCase() === (email as string).toLowerCase());
    if (user) authUserId = user.id;
    else return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const tempPassword = 'Maternidade@2024';
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: tempPassword });
  
  if (updateError) throw updateError;

  return res.status(200).json({ success: true, tempPassword, message: 'Usuário verificado' });
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
  const { userId, password } = req.body;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
  return res.status(200).json({ success: true });
}
