import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    message: 'Health check passed',
    env: process.env.NODE_ENV,
    time: new Date().toISOString()
  });
}
