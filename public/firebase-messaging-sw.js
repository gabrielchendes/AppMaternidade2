// Import and configure the Firebase SDK
// These scripts are made available when the app is served or deployed on Firebase Hosting
// If you're not using Firebase Hosting, you must import the scripts from a CDN
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

console.log('[firebase-messaging-sw.js] SW Script loaded');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
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
  
  if (!payload.notification) {
    console.log('[firebase-messaging-sw.js] Message does not contain a notification field, possibly showing manual notification...');
    const notificationTitle = payload.data?.title || 'Novo aviso';
    const notificationOptions = {
      body: payload.data?.body || 'Você tem uma nova mensagem.',
      icon: '/icons/icon-192x192.png',
      data: payload.data
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Get the click_action URL from the notification data or use a default
  const urlToOpen = event.notification.data?.click_action || 
                    event.notification.click_action || 
                    '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
