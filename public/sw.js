/**
 * Service Worker — يعمل في نسخة الإنتاج فقط.
 *
 * الهدف: التطبيق يفتح ويعمل بلا إنترنت.
 *  - التنقل (فتح الصفحة): network-first ثم الكاش.
 *  - نقاط /api (GET): network-first ثم آخر استجابة محفوظة (مثل آخر سعر ذهب).
 *  - ملفات ثابتة (_next/static، صور): cache-first مع تحديث بالخلفية.
 */

const VERSION = 'sgc-v6.16';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** تحميل من الشبكة مع حفظ نسخة، والرجوع للكاش عند الفشل */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

/** تحميل من الكاش فوراً ثم تحديثه بالخلفية */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchAndUpdate = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    fetchAndUpdate.catch(() => undefined);
    return cached;
  }

  const response = await fetchAndUpdate;
  if (response) return response;
  throw new Error('offline');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // الموارد الخارجية تمر كما هي

  // فتح صفحة/تنقل
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(request)) || (await cache.match('/')) || Response.error();
      })
    );
    return;
  }

  // واجهات الـ API (أسعار/جلسة/مزامنة) — آخر استجابة ناجحة تُستخدم عند الانقطاع
  if (url.pathname.startsWith('/api/')) {
    // طلبات المزامنة (PUT) لا تُخزَّن — لا نتدخل فيها
    event.respondWith(networkFirst(request, API_CACHE).catch(() => Response.error()));
    return;
  }

  // ملفات ثابتة
  if (url.pathname.startsWith('/_next/static') || /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE).catch(() => Response.error()));
    return;
  }

  // الباقي: شبكة ثم كاش
  event.respondWith(networkFirst(request, RUNTIME_CACHE).catch(() => Response.error()));
});

/** رسالة من التطبيق لمسح الكاش عند الحاجة */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/* =========================================================
   الإشعارات (Web Push + إشعارات النظام)
   - push: استقبال إشعار من السيرفر (يعمل حتى لو التطبيق مقفول)
   - notificationclick: فتح التطبيق على الشاشة المعنية
   - message: إشعار محلي يطلبه التطبيق أثناء التشغيل
   ========================================================= */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'حاسبة الذهب', body: event.data ? event.data.text() : 'لديك تحديث جديد' };
  }

  const title = data.title || 'حاسبة الذهب';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    vibrate: [80, 40, 80],
    data: { tab: data.tab || 'dashboard', url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.tab) || 'dashboard';
  const url = `/?tab=${encodeURIComponent(target)}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            client.postMessage({ type: 'notification-click', tab: target });
          } catch (_) {
            /* تجاهل */
          }
          return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(url).catch(() => c) : c));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// إشعار محلي من التطبيق نفسه (بدون سيرفر) — يُستخدم للتنبيه الفوري
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'show-notification') return;
  event.waitUntil(
    self.registration.showNotification(data.title || 'حاسبة الذهب', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'sgc-local',
      data: { tab: data.tab || 'dashboard' },
    })
  );
});
