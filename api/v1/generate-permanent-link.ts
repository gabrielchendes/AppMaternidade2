import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // 1. Get user ID from Auth
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) throw userError;
    
    const user = (users as any[]).find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2. Generate token
    const token = crypto.randomBytes(32).toString('hex');

    // 3. Save to magic_login_tokens
    const { error: insertError } = await supabaseAdmin
      .from('magic_login_tokens')
      .insert({
        user_id: user.id,
        token: token,
        active: true
      });

    if (insertError) throw insertError;

    // 4. Construct response link
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let baseUrl = process.env.VITE_APP_URL || process.env.APP_URL;
    
    if (!baseUrl && host) {
      baseUrl = `https://${host}`;
    }

    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = 'https://app-maternidade2.vercel.app';
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const finalLink = `${cleanBaseUrl}/api/magic-login?token=${token}`;

    return res.status(200).json({ link: finalLink });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
