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

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

  try {
    // 1. Verificar se o usuário existe na tabela profiles (que deve estar espelhada com auth.users)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      // Se não estiver no profiles, tentar buscar no Auth directly (fallback para 50 primeiros por desencargo)
      const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      const user = (userList.users as any[]).find(u => u.email?.toLowerCase() === (email as string).toLowerCase());
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado em nossa base de dados.' });
      }
    }

    // 2. Garantir que o usuário tenha essa senha no Auth (Reset via Admin)
    const tempPassword = 'Maternidade@2024';
    
    // Buscar o ID do usuário se não tiver vindo do profile (fallback Auth)
    let authUserId = profile?.id;
    if (!authUserId) {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const user = (userList.users as any[]).find(u => u.email?.toLowerCase() === (email as string).toLowerCase());
      if (user) authUserId = user.id;
    }

    if (authUserId) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: tempPassword
      });
      if (updateError) console.error('[LOGIN-VERIFY] Falha ao atualizar senha:', updateError);
    }

    return res.status(200).json({ 
      success: true, 
      tempPassword,
      message: 'Usuário verificado' 
    });
  } catch (error: any) {
    console.error('[LOGIN-VERIFY] Erro:', error);
    return res.status(500).json({ error: 'Erro interno ao verificar usuário: ' + error.message });
  }
}
