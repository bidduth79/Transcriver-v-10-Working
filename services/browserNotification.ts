// System notifications for long jobs (e.g. a batch), shown only while the user is in another tab or app

const isSupported = () => typeof window !== 'undefined' && 'Notification' in window;

// Asks once, from a user action such as starting a batch; a refusal or a blocked frame is ignored
export const requestNotificationPermission = () => {
  if (!isSupported() || Notification.permission !== 'default') return;
  Notification.requestPermission().catch(() => {});
};

export const notifyWhenHidden = (title: string, body: string) => {
  if (!isSupported() || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    new Notification(title, { body, icon: '/pwa-192x192.png', tag: 'transcriver-batch' });
  } catch (err) {
    // Some browsers only allow notifications from a service worker
    console.warn('Notification not shown:', err);
  }
};
