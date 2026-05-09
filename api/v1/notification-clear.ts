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

  try {
    const { error } = await supabaseAdmin
      .from('notification_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error && error.code !== '42P01') throw error;
    
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
