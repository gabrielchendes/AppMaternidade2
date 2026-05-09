import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  // Determine App URL for redirect
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
  
  if (!appUrl && host) {
    appUrl = `https://${host}`;
  }

  const redirectTo = appUrl ? `${appUrl.replace(/\/$/, '')}/dashboard` : 'https://app-maternidade2.vercel.app/dashboard';

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo }
    });

    if (error) throw error;
    return res.status(200).json({ link: data.properties.action_link });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
