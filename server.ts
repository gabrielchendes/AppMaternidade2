import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import crypto from 'crypto';

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
  let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccount && serviceAccount !== 'undefined' && serviceAccount.trim() !== '') {
    console.log('📦 FIREBASE_SERVICE_ACCOUNT found (Length:', serviceAccount.length, ')');
    firebaseAdmin = (admin as any).default || admin;
    
    let parsedAccount;
    try {
      // 1. Clean string (sometimes there are weird chars from pasting)
      let cleanVal = serviceAccount.trim();
      
      // 2. Handle potential Base64 encoding
      if (!cleanVal.startsWith('{')) {
        try {
          const decoded = Buffer.from(cleanVal, 'base64').toString('utf-8');
          if (decoded.startsWith('{')) {
            console.log('🔓 Decoded Firebase secret from Base64');
            cleanVal = decoded;
          }
        } catch(e) {}
      }
      
      parsedAccount = JSON.parse(cleanVal);
      console.log('✅ Firebase JSON parsed successfully');
    } catch (parseErr) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr);
      parsedAccount = null;
    }
    
    if (parsedAccount && firebaseAdmin.apps.length === 0) {
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(parsedAccount)
      });
      console.log('🚀 Firebase Admin initialized successfully');
    } else if (firebaseAdmin.apps.length > 0) {
      firebaseAdminApp = firebaseAdmin.apps[0];
    }
  } else {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT environment variable is empty or missing');
  }
} catch (err: any) {
  console.error('🔥 Error initializing Firebase Admin:', err);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

if (supabaseAdmin) {
  console.log('Supabase Admin client initialized');
} else {
  console.warn('Supabase Admin client NOT initialized (missing URL or Key)');
}

const app = express();
export { app };

const API_PREFIX = '/api/v1';

// Middleware global para parsing de JSON - Increased limit for large notifications
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Servir arquivos estáticos da pasta public explicitamente
app.use(express.static(path.join(process.cwd(), 'public')));

// Route específica para o manifest para garantir o Content-Type correto e evitar o fallback SPA
app.get('/manifest.json', (req, res) => {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    res.setHeader('Content-Type', 'application/json');
    return res.sendFile(manifestPath);
  }
  res.status(404).send('Not found');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development', time: new Date().toISOString() });
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

app.post(`${API_PREFIX}/login-verify`, async (req, res) => {
  const { email } = req.body;
  if (!email || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

  try {
    const cleanEmail = email.trim().toLowerCase();
    console.log('🔎 Passwordless login request for:', cleanEmail);
    
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });
      
      if (listError) throw listError;

      const user = (users as any[]).find(u => u.email?.toLowerCase() === cleanEmail);
      if (!user) {
        const { data: settings } = await supabaseAdmin
          .from('app_settings')
          .select('custom_texts')
          .eq('id', 1)
          .maybeSingle();
        
        const errorMsg = settings?.custom_texts?.['auth.user_not_found'] || 'Usuário não encontrado.';
        return res.status(404).json({ error: errorMsg });
      }

      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: tempPassword
      });
      if (updateError) throw updateError;

      res.json({ success: true, tempPassword });
    } catch (err: any) {
      console.error('Direct login error:', err);
      res.status(500).json({ error: err.message || 'Erro ao realizar login direto' });
    }
  });

  app.get('/api/debug-logs', (req, res) => {
    res.json(debugLogs);
  });

  const adminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-S-Engine', 'Express');
    const authHeader = req.headers.authorization;
    addLog('ADMIN_AUTH_START', { path: req.path, hasAuth: !!authHeader });
    
    if (!authHeader || !supabaseAdmin) {
      addLog('ADMIN_AUTH_FAIL', { reason: !authHeader ? 'No auth header' : 'SupabaseAdmin not initialized' });
      return res.status(401).json({ error: 'Unauthorized: Missing credentials' });
    }

    try {
      const token = authHeader.split(' ')[1];
      if (!token || token === 'undefined' || token === 'null') {
        addLog('ADMIN_AUTH_FAIL', { reason: 'Invalid token format', token });
        return res.status(401).json({ error: 'Invalid token format' });
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        addLog('ADMIN_AUTH_FAIL', { reason: 'Supabase auth error or no user', error });
        return res.status(403).json({ error: 'Forbidden: Invalid user session' });
      }
      
      const userEmail = data.user.email?.toLowerCase();
      addLog('ADMIN_AUTH_USER', { email: userEmail });

      // Fetch admin email from settings
      const { data: settings, error: settingsError } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).maybeSingle();
      if (settingsError) {
        addLog('ADMIN_AUTH_SETTINGS_ERROR', { error: settingsError });
      }

      const adminEmail = settings?.admin_email?.toLowerCase() || 'gabrielchendes@gmail.com';
      addLog('ADMIN_AUTH_ADMIN_EMAIL', { adminEmail });
      
      if (userEmail !== adminEmail) {
        addLog('ADMIN_AUTH_DENIED', { userEmail, adminEmail });
        console.error(`🚨 Access denied in adminAuth: User ${userEmail} is not admin ${adminEmail}`);
        return res.status(403).json({ error: `Access denied: ${userEmail} is not authorized.` });
      }

      (req as any).user = data.user;
      addLog('ADMIN_AUTH_SUCCESS', { userEmail });
      next();
    } catch (err: any) { 
      addLog('ADMIN_AUTH_EXCEPTION', { message: err.message });
      console.error('🚨 Error in adminAuth middleware:', err);
      res.status(401).json({ error: 'Authentication failed: ' + (err.message || 'Unknown error') }); 
    }
  };

  app.get(`${API_PREFIX}/ping`, (req, res) => {
    res.json({ pong: true, time: new Date().toISOString(), engine: 'Express v2' });
  });

  app.get(`${API_PREFIX}/info`, adminAuth, async (req, res) => {
    res.json({ 
      initialized: !!firebaseAdminApp,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      appsCount: firebaseAdmin?.apps?.length || 0
    });
  });

  app.get(`${API_PREFIX}/users-list`, adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    try {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000
      });
      if (error) throw error;
      
      // Fetch user IDs that have push tokens
      const { data: tokens } = await supabaseAdmin.from('push_tokens').select('user_id');
      const tokenUserIds = new Set(tokens?.map(t => t.user_id) || []);
      
      // Map users to include push_enabled flag
      const enrichedUsers = users.map(u => ({
        ...u,
        push_enabled: tokenUserIds.has(u.id)
      }));

      res.json(enrichedUsers || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${API_PREFIX}/u-data/:userId`, adminAuth, async (req, res) => {
    const { userId } = req.params;
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
    if (!email || !password || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { 
          full_name: fullName,
          phone: phone
        }
      });

      if (error) throw error;
      
      if (data.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email?.toLowerCase(),
          full_name: fullName || email.split('@')[0]
        });
      }

      res.json({ success: true, user: data.user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(`${API_PREFIX}/user-delete/:id`, adminAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

    try {
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

  app.post(`${API_PREFIX}/user-password-set`, adminAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });
    
    try {
      const { data: settings } = await supabaseAdmin.from('app_settings').select('admin_email').eq('id', 1).maybeSingle();
      const adminEmail = settings?.admin_email || 'gabrielchendes@gmail.com';
      
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
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

  app.get(`${API_PREFIX}/purchases-list`, adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    
    try {
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
        const { data: simplePurchases, error: simpleError } = await supabaseAdmin
          .from('purchases')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (simpleError) throw simpleError;
        return res.json(simplePurchases || []);
      }
      res.json(purchases || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${API_PREFIX}/sub-topic`, async (req, res) => {
    const { token, topic } = req.body;
    if (!token || !topic || !firebaseAdminApp) return res.status(400).json({ error: 'Missing data' });
    
    try {
      await firebaseAdminApp.messaging().subscribeToTopic(token, topic);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${API_PREFIX}/notification-push`, adminAuth, async (req, res) => {
    const { title, body, type, userIds, exclusionCourseId, isBroadcast } = req.body;
    if (!title || !body || !type || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

  try {
    const broadcastId = crypto.randomUUID();
    const targetUserIds = Array.isArray(userIds) ? userIds : [];

    if (targetUserIds.length === 0 && !isBroadcast) {
      return res.status(400).json({ error: 'Nenhum usuário alvo especificado' });
    }

    // 1. Log the broadcast
    const { error: bError } = await supabaseAdmin.from('notification_broadcasts').insert({
      id: broadcastId,
      title,
      body,
      type,
      target_count: targetUserIds.length,
      exclusion_course_id: exclusionCourseId || null,
      created_by: (req as any).user?.id
    });
      
      if (bError) {
        console.error('Error logging broadcast:', bError);
        throw new Error(`Erro ao registrar broadcast no banco: ${bError.message}. Verifique se as tabelas foram criadas.`);
      }

      // 2. Internal Notifications
      if (type === 'in_app' || type === 'both') {
        const notifications = targetUserIds.map((uid: string) => ({
          user_id: uid,
          broadcast_id: broadcastId,
          title,
          body,
          message: body,
          is_read: false
        }));

        for (let i = 0; i < notifications.length; i += 500) {
          const batch = notifications.slice(i, i + 500);
          const { error: nError } = await supabaseAdmin.from('notifications').insert(batch);
          if (nError) {
            console.error('Error batch inserting notifications:', nError);
          }
        }
      }

      // 3. Push Notifications
      let pushMessageId = null;
      if (type === 'push' || type === 'both') {
        if (firebaseAdminApp) {
          try {
            if (!isBroadcast && targetUserIds.length > 0) {
              console.log(`🎯 Sending targeted push to ${targetUserIds.length} users. Filter: ${exclusionCourseId || 'none'}`);
              // Targeted sending using specific tokens for users who passed the filter
              const tokens: string[] = [];
              
              // Fetch tokens in batches to avoid URL length limits
              for (let i = 0; i < targetUserIds.length; i += 1000) {
                const batchIds = targetUserIds.slice(i, i + 1000);
                const { data: tokensData } = await supabaseAdmin
                  .from('push_tokens')
                  .select('token')
                  .in('user_id', batchIds);
                
                if (tokensData) {
                  tokens.push(...tokensData.map(t => t.token));
                }
              }
              
              if (tokens.length > 0) {
                // Send in chunks of 500 (Firebase limit for multicast)
                for (let i = 0; i < tokens.length; i += 500) {
                  const batch = tokens.slice(i, i + 500);
                  await firebaseAdminApp.messaging().sendEachForMulticast({
                    tokens: batch,
                    notification: { title, body },
                    webpush: {
                      fcmOptions: { link: '/' },
                      notification: {
                        icon: '/firebase-logo.svg',
                        badge: '/firebase-logo.svg',
                        data: { url: '/' }
                      }
                    }
                  });
                }
                pushMessageId = `tokens_${tokens.length}`;
              } else {
                console.log('⚠️ No tokens found for targeted users');
                pushMessageId = 'no_tokens_found';
              }
            } else {
              console.log(`📡 Sending broadcast push to topic "all". isBroadcast=${isBroadcast}, targetUserIds=${targetUserIds.length}`);
              // Generic broadcast to everyone via topic 'all'
              pushMessageId = await firebaseAdminApp.messaging().send({
                topic: 'all',
                notification: { title, body },
                webpush: {
                  fcmOptions: { link: '/' },
                  notification: {
                    icon: '/firebase-logo.svg',
                    badge: '/firebase-logo.svg',
                    data: { url: '/' }
                  }
                }
              });
            }
          } catch (e) {
            console.error('Push error in msg-send:', e);
          }
        }
      }

      res.json({ success: true, broadcastId, pushMessageId });
    } catch (err: any) {
      console.error('Msg Send API Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${API_PREFIX}/notification-history`, adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'DB not available' });
    try {
      // Fetch builds and join with read counts from notifications
      const { data: broadcasts, error: bError } = await supabaseAdmin
        .from('notification_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (bError) throw bError;

      // For each broadcast, get the read count from notifications table
      const history = await Promise.all((broadcasts || []).map(async (b) => {
        const { count, error: cError } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('broadcast_id', b.id)
          .eq('is_read', true);
        
        return {
          ...b,
          read_count: count || 0
        };
      }));

      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${API_PREFIX}/notification-details/:id`, adminAuth, async (req, res) => {
    const { id } = req.params;
    if (!supabaseAdmin) return res.status(500).json({ error: 'DB not available' });
    try {
      // First, let's try to get notifications without the complex join to see if data exists
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('user_id, is_read, read_at')
        .eq('broadcast_id', id);
      
      if (error) throw error;

      if (!data || data.length === 0) {
        return res.json([]);
      }

      // Now enrichment with profile data manually to be safe
      const userIds = [...new Set(data.map(n => n.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const enriched = data.map(n => ({
        ...n,
        profiles: profiles?.find(p => p.id === n.user_id) || null
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${API_PREFIX}/msg-all`, adminAuth, async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message || !supabaseAdmin) return res.status(400).json({ error: 'Missing data' });

    try {
      const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('id');
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
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${API_PREFIX}/msg-out`, adminAuth, async (req, res) => {
    const { title, body } = req.body;
    if (!title || !body || !firebaseAdminApp) return res.status(400).json({ error: 'Missing data' });

    try {
      const response = await firebaseAdminApp.messaging().send({
        topic: 'all',
        notification: { title, body },
        webpush: {
          fcmOptions: { link: '/' },
          notification: {
            icon: '/firebase-logo.svg',
            badge: '/firebase-logo.svg',
            tag: 'maternidade-premium',
            renotify: true,
            data: { url: '/' }
          }
        }
      });
      res.json({ success: true, messageId: response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(`${API_PREFIX}/user-access-toggle`, adminAuth, async (req, res) => {
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

  app.delete(`${API_PREFIX}/notification-clear`, adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'DB not available' });
    try {
      const { error: d1 } = await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
      if (d1) throw d1;

      const { error: d2 } = await supabaseAdmin.from('notification_broadcasts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (d2) throw d2;

      res.json({ success: true });
    } catch (err: any) {
      console.error('Clear Notification History Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Export app for serverless environments (like Vercel)
  export default app;

  async function startServer() {
    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      
      app.use('*', async (req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/internal/')) return next();
        
        // Evitar que arquivos de assets (js, css, etc) retornem o index.html (SPA fallback)
        const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|webmanifest|woff|woff2|ttf|otf)$/.test(req.path);
        if (isAsset) {
          return res.status(404).send('Not found');
        }

        try {
          const html = await vite.transformIndexHtml(req.originalUrl, await fs.promises.readFile(path.join(process.cwd(), 'index.html'), 'utf-8'));
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) { next(e); }
      });
    } else {
      // Production serving of static files
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/internal/')) return;
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  // Only start server if not in a serverless environment or if running this file directly
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    startServer();
  }
