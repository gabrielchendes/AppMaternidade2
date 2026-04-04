import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

console.log('LOCAL DEV SERVER IS STARTING UP...');
dotenv.config();

// Debug: Log buffer
const debugLogs: any[] = [];
const addLog = (type: string, data: any) => {
  debugLogs.unshift({ timestamp: new Date().toISOString(), type, data });
  if (debugLogs.length > 20) debugLogs.pop();
};

// Initialize Firebase Admin if service account is provided
let firebaseAdminApp: any = null;
let firebaseAdmin: any = null;
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    firebaseAdmin = (admin as any).default || admin;
    const parsedAccount = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
    
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(parsedAccount)
      });
    } else {
      firebaseAdminApp = firebaseAdmin.apps[0];
    }
    console.log('Firebase Admin initialized successfully');
  }
} catch (err: any) {
  console.error('Error initializing Firebase Admin:', err);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: 'development', time: new Date().toISOString() });
  });

  const webhookHandler = async (req: express.Request, res: express.Response) => {
    if (req.method === 'GET') return res.send('Webhook endpoint active');
    const sig = req.headers['stripe-signature'] as string;
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;
        if (userId && productId && supabaseAdmin) {
          await supabaseAdmin.from('purchases').insert({ user_id: userId, product_id: productId });
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  };

  app.post('/api/webhook', express.raw({ type: 'application/json' }), webhookHandler);

  app.post('/api/external/grant-access', express.json(), async (req, res) => {
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.INTERNAL_API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, productId } = req.body;
    if (userId && productId && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('purchases').insert({ user_id: userId, product_id: productId }).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, data });
    }
    res.status(400).json({ error: 'Missing data' });
  });

  app.use(express.json());

  const adminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const token = authHeader.split(' ')[1];
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) return res.status(403).json({ error: 'Forbidden' });
      const adminEmail = 'gabrielchendes@gmail.com';
      if (data.user.email?.toLowerCase() !== adminEmail.toLowerCase()) return res.status(403).json({ error: 'Access denied' });
      next();
    } catch (err) { res.status(401).json({ error: 'Invalid token' }); }
  };

  app.get('/api/admin/users', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    res.json(users);
  });

  // (Other admin routes omitted for brevity in this dev server, but you can add them back if needed)
  // For now, let's just make sure the core works.

  app.post('/api/create-checkout-session', async (req, res) => {
    const { productId, userId } = req.body;
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase Admin not configured' });
    try {
      const { data: product } = await supabaseAdmin.from('products').select('title, price').eq('id', productId).single();
      if (!product) return res.status(404).json({ error: 'Product not found' });
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'brl', product_data: { name: product.title }, unit_amount: product.price || 9700 }, quantity: 1 }],
        mode: 'payment',
        success_url: `${process.env.APP_URL}/?success=true`,
        cancel_url: `${process.env.APP_URL}/?canceled=true`,
        metadata: { userId, productId },
      });
      res.json({ url: session.url });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  
  app.use('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, await fs.promises.readFile(path.join(process.cwd(), 'index.html'), 'utf-8'));
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) { next(e); }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dev server running on http://localhost:${PORT}`);
  });
}

startServer();
