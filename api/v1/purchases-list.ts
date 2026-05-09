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

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    
    // Create a client for verification with the token in global headers
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

    const { data: { user }, error: authError } = await supabaseVerify.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: 'Auth failed', details: authError?.message });

    const { data, error } = await supabaseAdmin
      .from('purchases')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
