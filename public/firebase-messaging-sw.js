/*
* Background Service Worker for Firebase Cloud Messaging.
* This file is required to handle push notifications when the app is in the background.
*/

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// The app will send the config via a message since we can't use process.env here
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_CONFIG') {
    const config = event.data.config;
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
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
    }
  }
});
