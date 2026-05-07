import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ 
    ok: true, 
    env: process.env.NODE_ENV,
    time: new Date().toISOString(),
    message: 'Vercel Serverless Function is working!'
  });
}
