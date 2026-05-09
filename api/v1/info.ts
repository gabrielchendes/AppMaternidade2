import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const hasUrl = !!process.env.VITE_SUPABASE_URL;
  const hasAnonKey = !!process.env.VITE_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return res.status(200).json({
    initialized: true,
    hasUrl,
    hasAnonKey,
    hasServiceKey,
    supabaseUrl: process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL.substring(0, 15)}...` : null,
    env: process.env.NODE_ENV,
    time: new Date().toISOString()
  });
}
