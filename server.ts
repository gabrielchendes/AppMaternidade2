import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
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

  app.post('/api/auth/direct', express.json(), async (req, res) => {
    const { email } = req.body;
    if (!email || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

    try {
      // Check if user exists
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const user = (users as any[]).find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado. Entre em contato com o suporte.' });
      }

      // Generate a temporary random password for this login session
      // This avoids all redirect issues with magic links in proxied environments
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: tempPassword
      });

      if (updateError) throw updateError;

      // Return the temporary password to the frontend
      res.json({ success: true, tempPassword });
    } catch (err: any) {
      console.error('Direct login error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.use(express.json());

  const adminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !supabaseAdmin) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const token = authHeader.split(' ')[1];
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) return res.status(403).json({ error: 'Forbidden' });
      
      // Fetch admin email from settings
      const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).maybeSingle();
      const adminEmail = settings?.admin_email || 'gabrielchendes@gmail.com';
      
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

  app.post('/api/admin/update-password', adminAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
    
    try {
      const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).maybeSingle();
      const adminEmail = settings?.admin_email || 'gabrielchendes@gmail.com';
      
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const adminUser = users.find((u: any) => u.email?.toLowerCase() === adminEmail.toLowerCase());
      
      if (!adminUser) return res.status(404).json({ error: 'Admin user not found' });

      const { error } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
        password: newPassword
      });

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // (Other admin routes omitted for brevity in this dev server, but you can add them back if needed)
  // For now, let's just make sure the core works.

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
