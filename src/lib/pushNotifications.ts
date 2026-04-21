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
 * Requests permission for push notifications and saves the token to Supabase
 */
export async function requestNotificationPermission(userId: string) {
  const messaging = await getMessagingInstance();
  
  if (!messaging) {
    console.log('Firebase Messaging not available.');
    return false;
  }

  try {
    console.log('🔔 Notification Setup - User:', userId);
    
    let permission = Notification.permission;
    
    // If permission is not already granted, request it
    if (permission !== 'granted') {
      console.log('🔔 Requesting permission via browser dialog...');
      permission = await Notification.requestPermission();
    }

    console.log('🔔 Final permission status:', permission);
    
    if (permission === 'granted') {
      // Get token - this will use the service worker registered in public/firebase-messaging-sw.js
      const token = await getToken(messaging, {
        vapidKey: 'BGNNXxZmddn3ZCpHjQKCGBy4rGlsyC-e2CNhYb-j5pfeXXHhmrTEGLk3L6r-7PMNNHVdYwNhyJBpzMvRg7LjTfQ' 
      });

      if (token) {
        console.log('🔑 Push Token generated:', token);
        
        // 1. Subscribe to the 'all' topic via backend
        try {
          await fetch('/api/admin/subscribe-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, topic: 'all' })
          });
          console.log('📡 Subscribed to "all" topic');
        } catch (e) {
          console.error('❌ Failed to subscribe to topic:', e);
        }

        // 2. Fallback: Save to Supabase (only as a backup)
        await supabase.from('push_tokens').upsert({
          user_id: userId,
          token: token
        }, { onConflict: 'user_id, token' });

        return true;
      } else {
        console.warn('⚠️ No token returned from Firebase');
      }
    } else {
      console.warn('⚠️ Notification permission was denied or dismissed');
    }
  } catch (error) {
    console.error('❌ Fatal error in push notification setup:', error);
  }
  return false;
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
