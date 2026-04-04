import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// 1. Configuração Inicial
dotenv.config();
const app = express();

// 2. Inicialização do Firebase Admin (Sem duplicidade)
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount && admin.apps.length === 0) {
    const parsedAccount = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(parsedAccount)
    });
    console.log('Firebase Admin OK');
  }
} catch (err) {
  console.error('Firebase Admin Error:', err);
}

// 3. Inicialização do Supabase Admin
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// 4. Rotas da API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.2',
    time: new Date().toISOString(),
    config: {
      hasSupabase: !!process.env.VITE_SUPABASE_URL,
      hasSupabaseAdmin: !!supabaseAdmin,
      hasStripe: !!process.env.STRIPE_SECRET_KEY,
      hasFirebase: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// Webhook do Stripe
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
});

app.use(express.json());

// Middleware de Autenticação Admin
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

// API Admin: Listar Usuários
app.get('/api/admin/users', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    res.json(users);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// API Admin: Criar Usuário
app.post('/api/admin/users', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  const { email, password, full_name } = req.body;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error) throw error;
    res.json(data);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// API Admin: Deletar Usuário
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// API: Checkout do Stripe
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

// Exportar para Vercel
export default app;
