import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabase';
import { toast } from 'sonner';
import { showToast } from './customToast';
import { safeFetch } from './utils';

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
export async function setupPushInBackground(userId: string, messaging: any): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Register service worker with explicit root scope
    let registration: ServiceWorkerRegistration | undefined;
    try {
      if ('serviceWorker' in navigator) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      }
    } catch (swError: any) {
      console.warn('⚠️ Service Worker registration error:', swError);
      return { success: false, error: 'Falha ao registrar Service Worker: ' + (swError?.message || swError) };
    }

    if (!registration) {
      console.warn('⚠️ No active service worker registration found for push.');
      return { success: false, error: 'Service Worker não disponível neste navegador.' };
    }

    // Get token
    try {
      const token = await getToken(messaging, {
        vapidKey: 'BGNNXxZmddn3ZCpHjQKCGBy4rGlsyC-e2CNhYb-j5pfeXXHhmrTEGLk3L6r-7PMNNHVdYwNhyJBpzMvRg7LjTfQ',
        serviceWorkerRegistration: registration
      });

      if (token) {
        // 1. Subscribe to topic & notify backend API
        safeFetch('/api/v1/notifications?action=sub-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, token, topic: 'all' })
        }).catch(e => console.warn('⚠️ Push sub-topic notification notice:', e));

        // 2. Save token to Supabase push_tokens table
        try {
          const { error: upsertErr } = await supabase.from('push_tokens').upsert({
            user_id: userId,
            token: token,
            platform: 'web'
          }, { onConflict: 'token' });

          if (!upsertErr) {
            console.log('✅ Push token saved to Supabase');
          } else {
            console.warn('⚠️ Supabase push_token upsert warning:', upsertErr.message);
          }
        } catch (dbErr) {
          console.warn('⚠️ Push token db error:', dbErr);
        }

        return { success: true, token };
      } else {
        return { success: false, error: 'Token FCM não foi gerado pelo navegador.' };
      }
    } catch (tokenError: any) {
      console.warn('⚠️ Push subscription token error:', tokenError);
      return { success: false, error: tokenError?.message || 'Erro ao obter token FCM' };
    }
  } catch (error: any) {
    console.error('❌ Unexpected background push setup error:', error);
    return { success: false, error: error?.message || 'Erro inesperado' };
  }
}

/**
 * Checks current push notification permission and registered status
 */
export async function getPushStatus(userId?: string) {
  const isSupportedBrowser = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  
  let hasTokenInDb = false;
  let totalRegisteredDevices = 0;

  if (userId) {
    try {
      const { data } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', userId);
      hasTokenInDb = !!(data && data.length > 0);
    } catch (e) {}
  }

  try {
    const { count } = await supabase
      .from('push_tokens')
      .select('*', { count: 'exact', head: true });
    totalRegisteredDevices = count || 0;
  } catch (e) {}

  return {
    isSupportedBrowser,
    permission,
    hasTokenInDb,
    totalRegisteredDevices
  };
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
      showToast.info(payload.notification.title || 'Nova Notificação', {
        description: payload.notification.body
      });
    }
  });
}
