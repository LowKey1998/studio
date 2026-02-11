// Standard Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Configuration will be populated by the client side upon registration
// but the background handler needs this file to exist at the root.
firebase.initializeApp({
  apiKey: true, // Messaging doesn't strictly need these for bg handlers if tokens are managed
  messagingSenderId: "103953800507" // Replace with your actual Sender ID from Firebase console
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
