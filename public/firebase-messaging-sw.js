// Import and configure the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

console.log('[firebase-messaging-sw.js] SW Script loaded');

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDjl30PtezVKv0eJvEnNJopGCHGGQGLiAg",
  authDomain: "app-maternidade.firebaseapp.com",
  projectId: "app-maternidade",
  storageBucket: "app-maternidade.firebasestorage.app",
  messagingSenderId: "669118811483",
  appId: "1:669118811483:web:0402740c397b1c7cb55e7e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // If the message already includes a notification payload, Firebase SDK automatically handles display.
  // We only display a manual notification if this is a data-only payload to avoid duplicate popups.
  if (!payload.notification && payload.data) {
    const notificationTitle = payload.data.title || 'Nova Notificação';
    const tag = payload.data.broadcast_id || payload.data.id || 'maternidade-push-notification';
    
    const notificationOptions = {
      body: payload.data.body || 'Você tem uma nova mensagem.',
      icon: payload.data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag,
      renotify: false,
      data: payload.data || {}
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url ||
                    event.notification.data?.click_action || 
                    event.notification.click_action || 
                    '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

