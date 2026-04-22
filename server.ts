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
  if (serviceAccount && serviceAccount !== 'undefined') {
    firebaseAdmin = (admin as any).default || admin;
    let parsedAccount;
    try {
      if (typeof serviceAccount === 'string') {
        if (serviceAccount.trim() === 'undefined' || serviceAccount.trim() === '') {
          throw new Error('FIREBASE_SERVICE_ACCOUNT is "undefined" or empty string');
        }
        console.log("Parsing FIREBASE_SERVICE_ACCOUNT...");
        parsedAccount = JSON.parse(serviceAccount);
      } else {
        parsedAccount = serviceAccount;
      }
    } catch (parseErr) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT. Ensure it is a valid JSON string:', parseErr);
      // Don't throw here, just don't initialize firebaseAdminApp
      parsedAccount = null;
    }
    
    if (parsedAccount && firebaseAdmin.apps.length === 0) {
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(parsedAccount)
      });
    } else if (firebaseAdmin.apps.length > 0) {
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

  app.get('/api/admin/firebase-status', adminAuth, async (req, res) => {
    res.json({ 
      initialized: !!firebaseAdminApp,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      appsCount: firebaseAdmin?.apps?.length || 0
    });
  });

  app.get('/api/admin/users', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    res.json(users || []);
  });

  app.post('/api/admin/create-user', adminAuth, async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });

      if (error) throw error;
      
      // Also create a profile entry to avoid FK issues later
      if (data.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName || email.split('@')[0]
        });
      }

      res.json({ success: true, user: data.user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

    try {
      // Clean up public data first to avoid FK violations
      await supabaseAdmin.from('purchases').delete().eq('user_id', id);
      await supabaseAdmin.from('notifications').delete().eq('user_id', id);
      await supabaseAdmin.from('profiles').delete().eq('id', id);
      
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete User Error:', err);
      res.status(500).json({ error: err.message });
    }
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

  app.get('/api/admin/purchases', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    
    try {
      console.log('🔎 Querying purchases with joins...');
      const { data: purchases, error } = await supabaseAdmin
        .from('purchases')
        .select(`
          id,
          created_at,
          user_id,
          product_id,
          is_manual,
          profiles!user_id(full_name, email),
          courses!product_id(title, cover_url, price)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase join error in purchases (Attempt 1):', error);
        
        // Fallback 1: Try without explicit hints if hints failed
        const { data: altPurchases, error: altError } = await supabaseAdmin
          .from('purchases')
          .select('*, profiles:user_id(full_name, email), courses:product_id(title, price)')
          .order('created_at', { ascending: false });

        if (!altError) return res.json(altPurchases || []);

        console.error('Supabase join error (Attempt 2):', altError);

        // Fallback 2: fetch without joins if all join attempts fail
        const { data: simplePurchases, error: simpleError } = await supabaseAdmin
          .from('purchases')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (simpleError) throw simpleError;
        return res.json(simplePurchases || []);
      }
      res.json(purchases || []);
    } catch (err: any) {
      console.error('API Purchases Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Route to subscribe a token to a topic
  app.post('/api/admin/subscribe-topic', async (req, res) => {
    const { token, topic } = req.body;
    if (!token || !topic || !firebaseAdminApp) return res.status(400).json({ error: 'Missing data' });
    
    try {
      await firebaseAdminApp.messaging().subscribeToTopic(token, topic);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/broadcast-notification', adminAuth, async (req, res) => {
    const { title, message } = req.body;
    
    if (!title || !message || !supabaseAdmin) {
      return res.status(400).json({ error: 'Missing data' });
    }

    try {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id');

      if (profileError) throw profileError;

      if (profiles && profiles.length > 0) {
        const notifications = profiles.map(p => ({
          user_id: p.id,
          title,
          message,
          body: message,
          read: false
        }));

        for (let i = 0; i < notifications.length; i += 500) {
          const batch = notifications.slice(i, i + 500);
          await supabaseAdmin.from('notifications').insert(batch);
        }
      }

      res.json({ success: true, count: profiles?.length || 0 });
    } catch (err: any) {
      console.error('Broadcast Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/send-push', adminAuth, async (req, res) => {
    const { title, body } = req.body;
    console.log('📬 Admin pushing to TOPIC: all');
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Missing title or body' });
    }

    if (!firebaseAdminApp) {
      return res.status(500).json({ error: 'Firebase Admin not initialized.' });
    }

    try {
      // Send to TOPIC instead of individual tokens
      const response = await firebaseAdminApp.messaging().send({
        topic: 'all',
        notification: { title, body },
        webpush: {
          fcmOptions: { link: '/' },
          notification: {
            icon: '/firebase-logo.png',
            badge: '/firebase-logo.png',
            data: { url: '/' }
          }
        }
      });

      console.log('✅ Send to topic response:', response);
      res.json({ success: true, messageId: response });
    } catch (err: any) {
      console.error('Error sending push to topic:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/toggle-access', adminAuth, async (req, res) => {
    const { userId, courseId, action } = req.body;
    if (!userId || !courseId || !action || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
    
    try {
      if (action === 'grant') {
        // 1. Ensure profile exists - vital for users without history
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError) throw userError;
        
        await supabaseAdmin.from('profiles').upsert({
          id: userId,
          email: userData.user.email,
          full_name: userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0]
        });

        const { error: insertError } = await supabaseAdmin.from('purchases').insert({ 
          user_id: userId, 
          product_id: courseId,
          is_manual: true // Mark as manual grant
        });
        if (insertError && insertError.code !== '23505') throw insertError; // Ignore if already exists
      } else if (action === 'revoke') {
        const { error } = await supabaseAdmin.from('purchases').delete().eq('user_id', userId).eq('product_id', courseId);
        if (error) throw error;
      }
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('Toggle Access API Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // (Other admin routes omitted for brevity in this dev server, but you can add them back if needed)
  // For now, let's just make sure the core works.

  // Vite middleware for development
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      hmr: false
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  
  app.use('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    
    // Evitar que arquivos de assets (js, css, etc) retornem o index.html (SPA fallback)
    // Isso previne o erro "unsupported MIME type ('text/html')" quando um asset não é encontrado
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|otf)$/.test(req.path);
    if (isAsset) {
      return res.status(404).send('Not found');
    }

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
