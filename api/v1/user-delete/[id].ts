import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing user ID' });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id as string);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
