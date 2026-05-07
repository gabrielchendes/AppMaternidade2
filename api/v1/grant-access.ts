import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, productId } = req.body;
  if (!userId || !productId) return res.status(400).json({ error: 'Missing userId or productId' });

  try {
    const { data, error } = await supabaseAdmin
      .from('purchases')
      .insert({ user_id: userId, product_id: productId })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
