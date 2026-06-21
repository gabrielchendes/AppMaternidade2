import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabase';
import { toast } from 'sonner';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDjl30PtezVKv0eJvEnNJopGCHGGQGLiAg",
  authDomain: "app-maternidade.firebaseapp.com",
  projectId: "app-maternidade",
  storageBucket: "app-maternidade.firebasestorage.app",
  messagingSenderId: "669118811483",
  appId: "1:669118811483:web:0402740c397b1c7cb55e7e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Helper to check messaging support (Messaging requires Service Workers, which are disabled in Private/Incognito modes)
async function getMessagingInstance() {
  if (typeof window === 'undefined') return null;
  
  // Check if browser supports messaging (checks for Service Workers and Push API)
  const supported = await isSupported();
  if (!supported) {
    console.log('⚠️ Firebase Messaging is not supported in this browser or private mode.');
    return null;
  }
  
  try {
    return getMessaging(app);
  } catch (error) {
    console.error('❌ Failed to initialize messaging:', error);
    return null;
  }
}

/**
 * Requests permission for push notifications and handles the background registration
 */
export async function requestNotificationPermission(userId: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  try {
    let permission = Notification.permission;
    
    // If permission is not already granted, request it
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (err) {
        permission = await new Promise((resolve) => {
          Notification.requestPermission((p) => resolve(p));
        });
      }
    }

    if (permission === 'granted') {
      // Do the registration in the background without blocking the UI
      const messaging = await getMessagingInstance();
      if (messaging) {
        setupPushInBackground(userId, messaging);
      }
      return true;
    }
  } catch (error) {
    console.error('❌ Error requesting permission:', error);
  }
  return false;
}

/**
 * Handles the heavy lifting of registration in the background
 */
async function setupPushInBackground(userId: string, messaging: any) {
  // Prevent push notification setup in known restricted environments like iframes
  if (window.self !== window.top) {
    console.log('ℹ️ Push notifications setup skipped: Application is running in an iframe.');
    return;
  }

  try {
    // Register service worker
    let registration;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (swError) {
      console.warn('⚠️ Service Worker registration failed (this is expected in some development environments):', swError);
      return; // Stop if SW fails
    }

    // Get token
    try {
      const token = await getToken(messaging, {
        vapidKey: 'BGNNXxZmddn3ZCpHjQKCGBy4rGlsyC-e2CNhYb-j5pfeXXHhmrTEGLk3L6r-7PMNNHVdYwNhyJBpzMvRg7LjTfQ',
        serviceWorkerRegistration: registration
      });

      if (token) {
        // 1. Subscribe to topic
        fetch('/api/v1/notifications?action=sub-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, token, topic: 'all' })
        }).catch(e => console.error('❌ Failed to subscribe to topic:', e));

        // 2. Save to Supabase
        supabase.from('push_tokens').upsert({
          user_id: userId,
          token: token
        }, { onConflict: 'token' }).then(({ error }) => {
          if (!error) console.log('✅ Token saved to Supabase');
        }).catch(e => console.error('❌ Supabase error:', e));
      }
    } catch (tokenError) {
      // Be silent if push fails in development/preview
      console.warn('⚠️ Push subscription failed (Registration might not be possible in this environment):', tokenError);
    }
  } catch (error) {
    console.error('❌ Unexpected background push setup error:', error);
  }
}

/**
 * Listens for foreground messages
 */
export async function onForegroundMessage() {
  const messaging = await getMessagingInstance();
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    if (payload.notification) {
      toast(payload.notification.title || 'Nova Notificação', {
        description: payload.notification.body,
        icon: '🔔',
      });
    }
  });
}
