import express from 'express';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import crypto from 'crypto';

dotenv.config();

console.log('🚀 Server starting sequence initialized');

// Global Process Error Logging
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const API_PREFIX = '/api/v1';

// Test Route (Public)
app.get('/api/test', (req, res) => {
  res.json({ ok: true, message: 'Server is reachable', env: process.env.NODE_ENV });
});

// VERY PUBLIC DEBUG (Safe info only)
app.get('/api/env-status', async (req, res) => {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  const su = !!process.env.VITE_SUPABASE_URL;
  const sk = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let supabaseTest = 'Not attempted';
  if (su && sk) {
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        const { error } = await sb.from('app_settings').select('id').limit(1);
        supabaseTest = error ? `Error: ${error.message}` : 'Connected';
      } else {
        supabaseTest = 'Admin client initialization failed';
      }
    } catch (e: any) {
      supabaseTest = `Crash: ${e.message}`;
    }
  }

  res.json({
    supabase_connected: supabaseTest,
    supabase_url_exists: su,
    supabase_key_exists: sk,
    firebase_sa_provided: !!sa,
    firebase_sa_len: sa.length,
    node_version: process.version,
    env: process.env.NODE_ENV,
    time: new Date().toISOString()
  });
});

// Debug: Log buffer (ephemeral in serverless)
const debugLogs: any[] = [];
const addLog = (type: string, data: any) => {
  debugLogs.unshift({ timestamp: new Date().toISOString(), type, data });
  if (debugLogs.length > 20) debugLogs.pop();
};

// Lazy Initialization for Supabase Admin
let supabaseAdminInstance: any = null;
const getSupabaseAdmin = () => {
  if (supabaseAdminInstance) return supabaseAdminInstance;
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.warn('⚠️ Supabase Admin NOT initialized (missing URL or Key)');
    return null;
  }
  try {
    supabaseAdminInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase Admin client initialized');
    return supabaseAdminInstance;
  } catch (err) {
    console.error('🔥 Error initializing Supabase Admin:', err);
    return null;
  }
};

// Lazy Initialization for Firebase Admin
let firebaseAdminApp: any = null;
let lastFirebaseError: string | null = null;

const getFirebaseAdmin = (): any => {
  if (firebaseAdminApp) return firebaseAdminApp;
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount || serviceAccount === 'undefined' || serviceAccount.trim() === '') {
      lastFirebaseError = 'FIREBASE_SERVICE_ACCOUNT is missing or empty';
      return null;
    }

    let cleanVal = serviceAccount.trim();

    if (!cleanVal.startsWith('{')) {
      try {
        const decoded = Buffer.from(cleanVal, 'base64').toString('utf-8');
        if (decoded.trim().startsWith('{')) cleanVal = decoded.trim();
      } catch (e) {
        console.error('⚠️ Firebase Admin: Base64 decode failed');
      }
    }
    
    if (!cleanVal.startsWith('{')) {
      lastFirebaseError = 'Service Account string is not JSON';
      console.error('⚠️ Firebase Admin:', lastFirebaseError);
      return null;
    }

    const parsedAccount = JSON.parse(cleanVal);
    // Fix for private key newlines
    if (parsedAccount.private_key) {
      parsedAccount.private_key = parsedAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!parsedAccount.project_id || !parsedAccount.private_key) {
      lastFirebaseError = 'JSON missing project_id or private_key';
      console.error('⚠️ Firebase Admin:', lastFirebaseError);
      return null;
    }

    const apps = getApps();
    
    if (apps.length === 0) {
      firebaseAdminApp = initializeApp({
        credential: cert(parsedAccount)
      });
      console.log('✅ Firebase Admin initialized');
    } else {
      firebaseAdminApp = apps[0];
    }
    return firebaseAdminApp;
  } catch (err: any) {
    lastFirebaseError = err.message || 'Unknown Init Error';
    console.error('🔥 Firebase Init Error:', lastFirebaseError);
    return null;
  }
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const adminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    console.log(`🔐 adminAuth attempt: ${req.method} ${req.path}`);
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('❌ server.ts: Supabase Admin client is NULL');
      return res.status(500).json({ error: 'Database service unavailable' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn('⚠️ adminAuth: No authorization header');
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.warn('⚠️ adminAuth: Invalid token format in header');
      return res.status(401).json({ error: 'Token missing' });
    }

    // Use token to get user
    console.log('🔎 adminAuth: Verifying token with Supabase...');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.warn('⚠️ adminAuth: Supabase rejection:', authError?.message || 'No user found');
      return res.status(403).json({ error: 'Session invalid or expired' });
    }

    const email = user.email?.toLowerCase();
    const userId = user.id;
    console.log(`👤 adminAuth: Authenticated user ${email} (${userId})`);
    
    // 1. Hardcoded super-admin check
    if (email === 'gabrielchendes@gmail.com') {
      console.log(`✅ adminAuth: Super-admin access granted to ${email}`);
      (req as any).user = user;
      return next();
    }

    // 2. Database check for other admins
    try {
      console.log('🔎 adminAuth: Checking database for admin privileges...');
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('app_settings')
        .select('admin_email')
        .eq('id', 1)
        .maybeSingle();

      if (settingsError) {
        console.error('❌ adminAuth: Error fetching settings:', settingsError);
      }

      const adminEmail = settings?.admin_email?.toLowerCase();
      
      if (email && adminEmail && email === adminEmail) {
        console.log(`✅ adminAuth: Admin access granted to ${email}`);
        (req as any).user = user;
        return next();
      }
    } catch (e) {
      console.error('❌ adminAuth: Settings check crash:', e);
    }

    console.warn(`🛑 adminAuth: Access denied for ${email}`);
    res.status(403).json({ error: 'Administrative privileges required' });
  } catch (err: any) { 
    console.error('🔥 adminAuth FATAL EXCEPTION:', err);
    res.status(500).json({ 
      error: 'Authorization service failure', 
      details: err.message,
      stack: err.stack
    }); 
  }
};

// Routes
app.get('/manifest.json', (req, res) => {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(manifestPath);
  }
  res.status(404).send('Not found');
});

app.get('/api/health', (req, res) => {
  const firebaseAdminApp = getFirebaseAdmin();
  const supabaseAdmin = getSupabaseAdmin();
  res.json({ 
    status: 'ok', 
    env: process.env.NODE_ENV || 'development', 
    firebase: !!firebaseAdminApp,
    supabase: !!supabaseAdmin,
    time: new Date().toISOString() 
  });
});

app.get('/api/debug-logs', (req, res) => {
  res.json(debugLogs);
});

app.post('/api/external/grant-access', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, productId } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (userId && productId && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.from('purchases').insert({ user_id: userId, product_id: productId }).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(400).json({ error: 'Missing data' });
});

// Status Route (Public)
app.get(`${API_PREFIX}/public-status`, async (req, res) => {
  const fApp = getFirebaseAdmin();
  const sApp = getSupabaseAdmin();
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  
  res.json({ 
    firebase: {
      initialized: !!fApp,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      saLength: sa.length,
      appsCount: getApps().length,
      lastError: lastFirebaseError
    },
    supabase: {
      initialized: !!sApp,
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    node: process.version,
    env: process.env.NODE_ENV
  });
});

app.get(`${API_PREFIX}/info`, adminAuth, async (req, res) => {
  const fApp = getFirebaseAdmin();
  res.json({ 
    initialized: !!fApp,
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    appsCount: getApps().length,
    lastError: lastFirebaseError
  });
});

app.get(`${API_PREFIX}/ping`, (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

app.post(`${API_PREFIX}/login-verify`, async (req, res) => {
  const { email } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!email || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const user = (users as any[]).find(u => u.email?.toLowerCase() === cleanEmail);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    await supabaseAdmin.auth.admin.updateUserById(user.id, { password: tempPassword });
    res.json({ success: true, tempPassword });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications
app.post(`${API_PREFIX}/notification-push`, adminAuth, async (req, res) => {
  const { title, body, type, userIds, exclusionCourseId, isBroadcast } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!title || !body || !type || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

  try {
    const firebaseAdminApp = getFirebaseAdmin();
    const broadcastId = crypto.randomUUID();
    const targetUserIds = Array.isArray(userIds) ? userIds : [];
    if (targetUserIds.length === 0 && !isBroadcast) return res.status(400).json({ error: 'No targets' });

    await supabaseAdmin.from('notification_broadcasts').insert({
      id: broadcastId, title, body, type, target_count: targetUserIds.length,
      exclusion_course_id: exclusionCourseId || null, created_by: (req as any).user?.id
    });

    if (type === 'in_app' || type === 'both') {
      const notifications = targetUserIds.map((uid: string) => ({
        user_id: uid, broadcast_id: broadcastId, title, body, message: body, is_read: false
      }));
      for (let i = 0; i < notifications.length; i += 500) {
        await supabaseAdmin.from('notifications').insert(notifications.slice(i, i + 500));
      }
    }

    let pushMessageId = null;
    if ((type === 'push' || type === 'both') && firebaseAdminApp) {
      const messaging = getMessaging(firebaseAdminApp);
      if (!isBroadcast && targetUserIds.length > 0) {
        const tokens: string[] = [];
        for (let i = 0; i < targetUserIds.length; i += 1000) {
          const { data } = await supabaseAdmin.from('push_tokens').select('token').in('user_id', targetUserIds.slice(i, i + 1000));
          if (data) tokens.push(...data.map((t: any) => t.token));
        }
        if (tokens.length > 0) {
          for (let i = 0; i < tokens.length; i += 500) {
            await messaging.sendEachForMulticast({
              tokens: tokens.slice(i, i + 500),
              notification: { title, body },
              webpush: { fcmOptions: { link: '/' }, notification: { icon: '/firebase-logo.svg', badge: '/firebase-logo.svg' } }
            });
          }
          pushMessageId = `tokens_${tokens.length}`;
        }
      } else {
        pushMessageId = await messaging.send({
          topic: 'all', notification: { title, body },
          webpush: { fcmOptions: { link: '/' }, notification: { icon: '/firebase-logo.svg', badge: '/firebase-logo.svg' } }
        });
      }
    }
    res.json({ success: true, broadcastId, pushMessageId });
  } catch (err: any) {
    console.error('Push Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_PREFIX}/notification-history`, adminAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not available' });
  try {
    const { data: broadcasts, error } = await supabaseAdmin.from('notification_broadcasts').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    const history = await Promise.all((broadcasts || []).map(async (b: any) => {
      const { count } = await supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true }).eq('broadcast_id', b.id).eq('is_read', true);
      return { ...b, read_count: count || 0 };
    }));
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_PREFIX}/notification-details/:id`, adminAuth, async (req, res) => {
  const { id } = req.params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not available' });
  try {
    const { data, error } = await supabaseAdmin.from('notifications').select('user_id, is_read, read_at').eq('broadcast_id', id);
    if (error) throw error;
    if (!data || data.length === 0) return res.json([]);
    const userIds = [...new Set(data.map((n: any) => n.user_id))];
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email, full_name').in('id', userIds);
    res.json(data.map((n: any) => ({ ...n, profiles: profiles?.find((p: any) => p.id === n.user_id) || null })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_PREFIX}/notification-clear`, adminAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'DB not available' });
  try {
    await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('notification_broadcasts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Management
app.get(`${API_PREFIX}/users-list`, adminAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const { data: tokens } = await supabaseAdmin.from('push_tokens').select('user_id');
    const tokenUserIds = new Set(tokens?.map((t: any) => t.user_id) || []);
    res.json(users.map(u => ({ ...u, push_enabled: tokenUserIds.has(u.id) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_PREFIX}/u-data/:userId`, adminAuth, async (req, res) => {
  const { userId } = req.params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!userId || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw error;
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_PREFIX}/user-create`, adminAuth, async (req, res) => {
  const { email, password, fullName, phone } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!email || !password || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(), password, email_confirm: true, user_metadata: { full_name: fullName, phone }
    });
    if (error) throw error;
    if (data.user) {
      await supabaseAdmin.from('profiles').upsert({ id: data.user.id, email: data.user.email?.toLowerCase(), full_name: fullName || email.split('@')[0] });
    }
    res.json({ success: true, user: data.user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${API_PREFIX}/user-delete/:id`, adminAuth, async (req, res) => {
  const { id } = req.params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!id || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    await supabaseAdmin.from('purchases').delete().eq('user_id', id);
    await supabaseAdmin.from('notifications').delete().eq('user_id', id);
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${API_PREFIX}/purchases-list`, adminAuth, async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
  try {
    const { data, error } = await supabaseAdmin.from('purchases').select('id, created_at, user_id, product_id, is_manual, profiles!user_id(full_name, email), courses!product_id(title, cover_url, price)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_PREFIX}/user-access-toggle`, adminAuth, async (req, res) => {
  const { userId, courseId, action } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!userId || !courseId || !action || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    if (action === 'grant') {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError) throw userError;
      await supabaseAdmin.from('profiles').upsert({ id: userId, email: userData.user.email, full_name: userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] });
      await supabaseAdmin.from('purchases').insert({ user_id: userId, product_id: courseId, is_manual: true });
    } else {
      await supabaseAdmin.from('purchases').delete().eq('user_id', userId).eq('product_id', courseId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_PREFIX}/user-password-set`, adminAuth, async (req, res) => {
  const { newPassword } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!newPassword || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).maybeSingle();
    const adminEmail = settings?.admin_email || 'gabrielchendes@gmail.com';
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const adminUser = users.find((u: any) => u.email?.toLowerCase() === adminEmail.toLowerCase());
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, { password: newPassword });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_PREFIX}/sub-topic`, async (req, res) => {
  const { token, topic } = req.body;
  const fApp = getFirebaseAdmin();
  if (!token || !topic || !fApp) return res.status(400).json({ error: 'Messaging not available', detail: lastFirebaseError });
  try {
    const messaging = getMessaging(fApp);
    await messaging.subscribeToTopic(token, topic);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_PREFIX}/msg-all`, adminAuth, async (req, res) => {
  const { title, message } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!title || !message || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    const { data: profiles, error } = await supabaseAdmin.from('profiles').select('id');
    if (error) throw error;
    if (profiles && profiles.length > 0) {
      const notifications = profiles.map((p: any) => ({ user_id: p.id, title, message, body: message, is_read: false }));
      for (let i = 0; i < notifications.length; i += 500) {
        await supabaseAdmin.from('notifications').insert(notifications.slice(i, i + 500));
      }
    }
    res.json({ success: true, count: profiles?.length || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(`${API_PREFIX}/msg-out`, adminAuth, async (req, res) => {
  const { title, body } = req.body;
  const fApp = getFirebaseAdmin();
  if (!title || !body || !fApp) return res.status(400).json({ error: 'Messaging not available', detail: lastFirebaseError });
  try {
    const messaging = getMessaging(fApp);
    const resp = await messaging.send({
      topic: 'all', notification: { title, body },
      webpush: { fcmOptions: { link: '/' }, notification: { icon: '/firebase-logo.svg', badge: '/firebase-logo.svg' } }
    });
    res.json({ success: true, messageId: resp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// App Settings
app.post(`${API_PREFIX}/settings/update`, adminAuth, async (req, res) => {
  const { settings } = req.body;
  const supabaseAdmin = getSupabaseAdmin();
  if (!settings || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
  try {
    const { error } = await supabaseAdmin.from('app_settings').update(settings).eq('id', 1);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Static / Vite
const startServer = async () => {
  try {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      console.log('📦 Setting up Vite middleware...');
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({ server: { middlewareMode: true, hmr: false }, appType: 'spa' });
      app.use(vite.middlewares);
      app.use('*', async (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        try {
          const templatePath = path.join(process.cwd(), 'index.html');
          if (!fs.existsSync(templatePath)) return res.status(404).send('index.html not found');
          const template = await fs.promises.readFile(templatePath, 'utf-8');
          const html = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) { next(e); }
      });
    } else if (!process.env.VERCEL) {
      console.log('📦 Serving static files from dist...');
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
      } else {
        console.warn('⚠️ Dist path not found at startup');
      }
    }
    
    if (!process.env.VERCEL) {
      const PORT = 3000;
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('🔥 CRITICAL FAILURE in startServer:', err);
  }
};

startServer().catch(err => {
  console.error('🔥 CRITICAL FAILURE starting server:', err);
});

export default app;
export { app };
