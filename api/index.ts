import express from 'express';
import path from 'path';
import fs from 'fs';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

console.log('PRODUCTION API IS STARTING UP...');
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

const app = express();

// Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date().toISOString() });
});

// Webhook handler
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

app.use(express.json());

// Admin Middleware
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

// Admin API: List Users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    res.json(users);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Admin API: Create User
app.post('/api/admin/users', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  const { email, password, full_name } = req.body;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error) throw error;
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Admin API: Delete User
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Admin API: Send Broadcast
app.post('/api/admin/broadcast', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  const { title, message, type } = req.body;
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const userIds = (data?.users || []).map(u => u.id);
    if (type === 'both' || type === 'in-app') {
      await supabaseAdmin.from('notifications').insert(userIds.map(uid => ({ user_id: uid, title, message, read: false })));
    }
    res.json({ success: true, count: userIds.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// API: Create Checkout Session
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

// Production static serving
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export default app;
