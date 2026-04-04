import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

console.log('SERVER.TS IS STARTING UP...');
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
    
    // Check if app already initialized
    if (firebaseAdmin.apps.length === 0) {
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(parsedAccount)
      });
    } else {
      firebaseAdminApp = firebaseAdmin.apps[0];
    }
    console.log('Firebase Admin initialized successfully');
    addLog('firebase_admin_init', { success: true });
  } else {
    console.log('FIREBASE_SERVICE_ACCOUNT not found, using legacy FCM fallback');
    addLog('firebase_admin_init', { success: false, reason: 'missing_service_account' });
  }
} catch (err: any) {
  console.error('Error initializing Firebase Admin:', err);
  addLog('firebase_admin_init', { success: false, error: err.message });
}

console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_KEY: !!process.env.STRIPE_SECRET_KEY,
  WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
  APP_URL: !!process.env.APP_URL
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Supabase Config Check:', {
  hasUrl: !!supabaseUrl,
  urlPrefix: supabaseUrl.substring(0, 15) + '...',
  hasKey: !!supabaseServiceRoleKey,
  keyPrefix: supabaseServiceRoleKey.substring(0, 10) + '...'
});

const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

if (supabaseAdmin) {
  addLog('supabase_admin_init', { 
    success: true, 
    url: supabaseUrl.substring(0, 20) + '...',
    keyPrefix: supabaseServiceRoleKey.substring(0, 10) + '...'
  });
} else {
  addLog('supabase_admin_init', { success: false, reason: 'missing_config', hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceRoleKey });
}

console.log('Supabase Admin initialized:', !!supabaseAdmin);

async function startServer() {
  console.log('Starting server in mode:', process.env.NODE_ENV || 'development');
  const app = express();
  const PORT = 3000;

  // Request Logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/admin/')) {
      addLog('admin_request', { method: req.method, path: req.path });
    }
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // Health check for ais-pre testing
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  // Webhook endpoint (must be before express.json())
  // Added support for trailing slash and GET for testing
  const webhookHandler = async (req: express.Request, res: express.Response) => {
    if (req.method === 'GET') {
      return res.send('Webhook endpoint is active. Please use POST from Stripe.');
    }

    const sig = req.headers['stripe-signature'] as string;
    console.log('Webhook received! Signature presence:', !!sig);
    addLog('webhook_received', { signature: !!sig });
    let event;

    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
      console.log('Webhook Secret check:', {
        length: webhookSecret.length,
        prefix: webhookSecret.substring(0, 5) + '...',
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body)
      });
      addLog('webhook_debug', { 
        secretLength: webhookSecret.length, 
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body)
      });

      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
      addLog('webhook_event', { type: event.type });
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      addLog('webhook_error', { message: err.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const productId = session.metadata?.productId;

      console.log('Webhook: Checkout completed!', { userId, productId });
      addLog('checkout_completed', { userId, productId });

      if (userId && productId && supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('purchases')
          .insert({ user_id: userId, product_id: productId })
          .select();
        
        if (error) {
          console.error('Webhook: Error inserting purchase:', error);
          addLog('db_error', { error });
        } else {
          console.log('Webhook: Purchase inserted successfully!', data);
          addLog('db_success', { data });
        }
      } else {
        console.warn('Webhook: Missing data or supabaseAdmin not initialized', { userId, productId, hasAdmin: !!supabaseAdmin });
        addLog('webhook_skipped', { userId, productId, hasAdmin: !!supabaseAdmin });
      }
    }

    res.json({ received: true });
  };

  app.post('/api/webhook', express.raw({ type: 'application/json' }), webhookHandler);
  app.get('/api/webhook', webhookHandler);
  app.post('/api/webhook/', express.raw({ type: 'application/json' }), webhookHandler);

  // External access endpoint for Cloudflare Worker
  app.post('/api/external/grant-access', express.json(), async (req, res) => {
    const secret = req.headers['x-internal-secret'];
    const internalSecret = process.env.INTERNAL_API_SECRET;

    console.log('External access request received', { 
      hasSecret: !!secret, 
      match: secret === internalSecret,
      userId: req.body.userId,
      productId: req.body.productId
    });

    if (!internalSecret || secret !== internalSecret) {
      addLog('external_auth_error', { received: secret, expected: !!internalSecret });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, productId } = req.body;
    if (!userId || !productId || !supabaseAdmin) {
      addLog('external_data_error', { userId, productId, hasAdmin: !!supabaseAdmin });
      return res.status(400).json({ error: 'Missing data' });
    }

    const { data, error } = await supabaseAdmin
      .from('purchases')
      .insert({ user_id: userId, product_id: productId })
      .select();

    if (error) {
      console.error('External access: DB Error', error);
      addLog('external_db_error', { error });
      return res.status(500).json({ error: error.message });
    }

    console.log('External access: Success', data);
    addLog('external_success', { userId, productId });
    res.json({ success: true, data });
  });

  app.use(express.json());

  // Admin Middleware
  const adminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !supabaseAdmin) {
      addLog('admin_auth_failed', { reason: 'missing_header_or_supabase_admin', hasHeader: !!authHeader, hasAdmin: !!supabaseAdmin });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const token = authHeader.split(' ')[1];
      if (!token || token === 'undefined' || token === 'null') {
        addLog('admin_auth_failed', { reason: 'invalid_token_format', tokenValue: token });
        return res.status(401).json({ error: 'Invalid token format' });
      }

      // Log token prefix for debugging (safe)
      console.log(`AdminAuth: Verifying token starting with ${token.substring(0, 15)}...`);

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      const user = data?.user;
      
      if (error || !user) {
        addLog('admin_auth_failed', { 
          reason: 'supabase_error', 
          error: error?.message || 'No user returned', 
          tokenPrefix: token.substring(0, 15),
          supabaseUrl: process.env.VITE_SUPABASE_URL?.substring(0, 20) + '...'
        });
        return res.status(403).json({ error: error?.message || 'Forbidden' });
      }

      const adminEmail = 'gabrielchendes@gmail.com';
      if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
        addLog('admin_auth_failed', { reason: 'not_admin_email', email: user.email, expected: adminEmail });
        return res.status(403).json({ error: `Acesso negado: ${user.email} não é um administrador.` });
      }
      
      next();
    } catch (err: any) {
      addLog('admin_auth_error', { error: err.message });
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Admin API: List Users
  app.get('/api/admin/users', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    try {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Create User
  app.post('/api/admin/users', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { email, password, full_name } = req.body;
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Delete User
  app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Delete Community Post
  app.delete('/api/admin/community/posts/:id', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { id } = req.params;
    try {
      // Delete likes and comments first (cascade should handle it, but let's be explicit)
      await supabaseAdmin.from('post_likes').delete().eq('post_id', id);
      await supabaseAdmin.from('post_comments').delete().eq('post_id', id);
      
      const { error } = await supabaseAdmin.from('community_posts').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Delete Community Comment
  app.delete('/api/admin/community/comments/:id', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { id } = req.params;
    try {
      const { error } = await supabaseAdmin.from('post_comments').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin API: Send Broadcast
  app.post('/api/admin/broadcast', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { title, message, type } = req.body;
    addLog('broadcast_request', { title, type });
    
    try {
      // 1. Get all users
      addLog('fcm_fetching_users', { start: true });
      const { data, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) {
        addLog('fcm_users_error', { error: usersError.message });
        throw usersError;
      }
      
      const users = data?.users || [];
      addLog('fcm_users_found', { count: users.length });
      const userIds = users.map(u => u.id);

      // 2. In-App Notifications
      if (type === 'both' || type === 'in-app') {
        const notifications = userIds.map(uid => ({
          user_id: uid,
          title,
          message,
          read: false
        }));

        const { error: notifError } = await supabaseAdmin.from('notifications').insert(notifications);
        if (notifError) throw notifError;
      }

      // 3. Push Notifications
      let pushResults: any[] = [];
      if (type === 'both' || type === 'push') {
        const { data: tokens, error: tokensError } = await supabaseAdmin
          .from('push_tokens')
          .select('token, user_id')
          .order('created_at', { ascending: false });

        if (!tokensError && tokens && tokens.length > 0) {
          // Keep only the most recent token per user to avoid double notifications on same device
          const userTokenMap = new Map();
          tokens.forEach(t => {
            if (t.user_id && !userTokenMap.has(t.user_id)) {
              userTokenMap.set(t.user_id, t.token);
            }
          });
          
          // Ensure tokens are globally unique across all users (in case multiple users share a token)
          const uniqueTokens = Array.from(new Set(userTokenMap.values()));
          console.log(`FCM: Filtered to ${uniqueTokens.length} unique user devices (from ${tokens.length} total tokens)`);
          
          // Log the user IDs we are sending to
          const targetUserIds = Array.from(userTokenMap.keys());
          console.log(`FCM: Target User IDs: ${targetUserIds.join(', ')}`);
          addLog('fcm_tokens_prepared', { 
            totalTokens: tokens.length, 
            uniqueTokens: uniqueTokens.length,
            userIds: targetUserIds
          });
          uniqueTokens.forEach((t: any, i: number) => {
            console.log(`Token ${i}: ${t.substring(0, 15)}...`);
          });
          addLog('fcm_tokens_prepared', { 
            totalTokens: tokens.length, 
            uniqueTokens: uniqueTokens.length,
            tokenSamples: uniqueTokens.map((t: any) => t.substring(0, 10))
          });
          
          if (firebaseAdminApp && firebaseAdmin) {
            // Use Firebase Admin SDK (Modern HTTP v1)
            console.log(`FCM: Sending to ${uniqueTokens.length} devices via Firebase Admin SDK (HTTP v1)`);
            addLog('fcm_send_start', { tokenCount: uniqueTokens.length });
            
            const messagePayload = {
              webpush: {
                notification: {
                  title,
                  body: message,
                  icon: '/firebase-logo.png',
                  click_action: process.env.APP_URL || `https://${req.get('host')}`,
                  tag: 'broadcast-notification', // This collapses multiple notifications into one
                  renotify: false // Don't vibrate/sound if a notification with same tag is already there
                },
                fcm_options: {
                  link: process.env.APP_URL || `https://${req.get('host')}`
                }
              },
              tokens: uniqueTokens
            };

            try {
              addLog('fcm_admin_sdk_attempt', { tokenCount: uniqueTokens.length });
              const response = await firebaseAdmin.messaging(firebaseAdminApp).sendEachForMulticast(messagePayload);
              pushResults = response.responses.map((res: any, idx: number) => ({
                token: uniqueTokens[idx],
                success: res.success,
                error: res.error?.message,
                errorCode: res.error?.code
              }));
              addLog('fcm_send_complete', { 
                successCount: response.successCount, 
                failureCount: response.failureCount,
                results: pushResults.map(r => ({ success: r.success, error: r.error, token: r.token.substring(0, 10) }))
              });
            } catch (err: any) {
              addLog('fcm_admin_sdk_error', { error: err.message });
              pushResults = [{ error: err.message }];
            }
          } else {
            // Legacy FCM Fallback
            const serverKey = process.env.FIREBASE_SERVER_KEY;
            console.log(`FCM: Attempting to send to ${uniqueTokens.length} devices via Legacy API. Server Key present: ${!!serverKey}`);
            
            if (!serverKey) {
              addLog('fcm_legacy_skip', { reason: 'missing_server_key' });
              pushResults = [{ error: 'FIREBASE_SERVER_KEY not configured' }];
            } else {
              addLog('fcm_legacy_attempt', { tokenCount: uniqueTokens.length });
              const pushPromises = uniqueTokens.map(async (token) => {
                try {
                  // Ensure URL is correct and use a more robust fetch
                  const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
                  const response = await fetch(fcmUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `key=${serverKey}`
                    },
                    body: JSON.stringify({
                      registration_ids: [token],
                      notification: {
                        title,
                        body: message,
                        icon: '/firebase-logo.png',
                        click_action: process.env.APP_URL || `https://${req.get('host')}`
                      }
                    })
                  });
                  
                  const contentType = response.headers.get('content-type');
                  if (contentType && contentType.includes('application/json')) {
                    const json = await response.json();
                    return { token, result: json };
                  } else {
                    const text = await response.text();
                    addLog('fcm_legacy_error', { token: token.substring(0, 10), status: response.status, body: text.substring(0, 100) });
                    return { token, error: 'FCM returned non-JSON response', status: response.status, body: text.substring(0, 100) };
                  }
                } catch (err: any) {
                  addLog('fcm_legacy_token_error', { token: token.substring(0, 10), error: err.message });
                  return { token, error: err.message };
                }
              });
              
              pushResults = await Promise.all(pushPromises);
              addLog('fcm_legacy_complete', { count: pushResults.length });
            }
          }
        } else {
          pushResults = [{ error: 'No push tokens found in database' }];
        }
      }
      
      addLog('broadcast_complete', { 
        userIds: userIds.length, 
        pushResultCount: pushResults.length,
        errors: pushResults.filter(r => r.error).length
      });
      res.json({ success: true, count: userIds.length, pushResults });
    } catch (error: any) {
      addLog('broadcast_error', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Debug: Check purchases
  app.get('/api/debug/purchases/:userId', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    
    const { data, error } = await supabaseAdmin
      .from('purchases')
      .select('*')
      .eq('user_id', req.params.userId);
      
    res.json({ data, error });
  });

  // Debug: Force add purchase
  app.post('/api/debug/add-purchase', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    const { userId, productId } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('purchases')
      .insert({ user_id: userId, product_id: productId })
      .select();
      
    res.json({ data, error });
  });

  // Debug: Get push tokens
  app.get('/api/admin/debug-tokens', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    try {
      const { data: tokens, error } = await supabaseAdmin
        .from('push_tokens')
        .select('*, user:user_id(email)');
      res.json({ tokens, error });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Debug: Clear all tokens (use with caution)
  app.post('/api/admin/clear-tokens', adminAuth, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin not initialized' });
    try {
      const { error } = await supabaseAdmin.from('push_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      res.json({ success: !error, error });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Debug: Get logs
  app.get('/api/debug/logs', (req, res) => {
    res.json(debugLogs);
  });

  // Debug: Clear logs
  app.post('/api/debug/clear-logs', (req, res) => {
    debugLogs.length = 0;
    res.json({ success: true });
  });

  // API: Create Checkout Session
  app.post('/api/create-checkout-session', async (req, res) => {
    const { productId, userId } = req.body;

    if (!supabaseAdmin) {
      addLog('checkout_error', { reason: 'supabase_admin_not_initialized' });
      return res.status(500).json({ error: 'Supabase Admin not configured' });
    }

    try {
      addLog('checkout_request', { productId, userId });
      
      if (!productId) {
        throw new Error('Product ID is required');
      }

      // Fetch product details from DB to get the correct price
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('title, price')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        const errorMsg = productError ? `Supabase error: ${productError.message} (${productError.code})` : 'Product not found in database';
        addLog('checkout_error', { reason: 'product_not_found', productId, error: errorMsg });
        return res.status(404).json({ error: errorMsg });
      }

      const successUrl = `${process.env.APP_URL}/?success=true`;
      const cancelUrl = `${process.env.APP_URL}/?canceled=true`;
      console.log('Stripe URLs (using APP_URL for browser redirect):', { successUrl, cancelUrl });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: product.title,
              },
              unit_amount: product.price || 9700, // Use price from DB
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          productId,
        },
      });

      addLog('checkout_session_created', { sessionId: session.id });
      res.json({ url: session.url });
    } catch (error: any) {
      addLog('checkout_error', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // Explicit fallback for SPA in development if Vite middleware doesn't catch it
    app.use('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      // If it looks like a file (has an extension), don't serve index.html
      if (req.path.includes('.') && !req.path.endsWith('.html')) return next();
      
      try {
        const html = await vite.transformIndexHtml(req.originalUrl, await fs.promises.readFile(path.join(process.cwd(), 'index.html'), 'utf-8'));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('SERVER ERROR:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack 
    });
  });

  // Process error handlers
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    addLog('uncaught_exception', { error: err.message, stack: err.stack });
  });
  
  process.on('unhandledRejection', (reason: any, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    addLog('unhandled_rejection', { reason: reason?.message || String(reason) });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
