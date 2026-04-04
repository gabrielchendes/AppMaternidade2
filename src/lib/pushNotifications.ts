import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from './supabase';
import { toast } from 'sonner';

// Firebase configuration (Replace with your own config from Firebase Console)
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
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

/**
 * Requests permission for push notifications and saves the token to Supabase
 */
export async function requestNotificationPermission(userId: string) {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BGNNXxZmddn3ZCpHjQKCGBy4rGlsyC-e2CNhYb-j5pfeXXHhmrTEGLk3L6r-7PMNNHVdYwNhyJBpzMvRg7LjTfQ' // Get this from Firebase Console > Project Settings > Cloud Messaging
      });

      if (token) {
        // Save token to Supabase
        const { error } = await supabase.from('push_tokens').upsert({
          user_id: userId,
          token: token
        }, { onConflict: 'user_id, token' });

        if (error) throw error;
        console.log('Push token saved successfully');
        return true;
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
  return false;
}

/**
 * Listens for foreground messages
 */
export function onForegroundMessage() {
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
