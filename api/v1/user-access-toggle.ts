import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    const supabaseVerify = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceRoleKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    const { data: { user }, error: authVerifyError } = await supabaseVerify.auth.getUser();
    
    if (authVerifyError || !user) {
      console.error('[API DEBUG] Auth error in user-access-toggle:', authVerifyError);
      return res.status(401).json({ error: 'Não autorizado: Token inválido ou expirado' });
    }
    const { userId, courseId, action } = req.body;
    if (!userId || !courseId || !action) return res.status(400).json({ error: 'Missing parameters' });

    if (action === 'grant') {
      const { error } = await supabaseAdmin
        .from('purchases')
        .upsert({ user_id: userId, product_id: courseId });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('purchases')
        .delete()
        .match({ user_id: userId, product_id: courseId });
      if (error) throw error;
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
