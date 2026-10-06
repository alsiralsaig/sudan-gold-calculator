/**
 * إشعارات النظام في المتصفح — تعمل في المتصفح فقط (كل الدوال تتحقق أولاً).
 *
 * المسارات:
 *  1) إشعار محلي فوري عبر Service Worker (يعمل أثناء تشغيل التطبيق حتى لو في الخلفية).
 *  2) اشتراك Web Push عبر /api/push/subscribe — يجعل الإشعارات تصل
 *     والتطبيق مقفول تماماً (يحتاج VAPID keys على السيرفر).
 *
 * ملاحظات توافق:
 *  - أندرويد/كروم: تعمل الإشعارات كاملة بعد إضافة التطبيق للشاشة الرئيسية.
 *  - آيفون (iOS 16.4+): لا تعمل إشعارات الويب إلا إذا أُضيف التطبيق للشاشة الرئيسية أولاً.
 *  - سطح المكتب: تعمل في كروم/إيدج/فايرفوكس.
 */

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return notificationsSupported() && 'PushManager' in window;
}

export function permissionState(): PermissionState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission as PermissionState;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** طلب إذن الإشعارات */
export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch {
    return 'denied';
  }
}

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * إظهار إشعار نظام فوري.
 * يُرسل للـ Service Worker إن أمكن (يعمل في الخلفية)، وإلا يستخدم Notification مباشرة.
 */
export async function showSystemNotification(
  title: string,
  body: string,
  options: { tab?: string; tag?: string } = {}
): Promise<boolean> {
  if (permissionState() !== 'granted') return false;
  const { tab = 'dashboard', tag } = options;
  try {
    const reg = await swRegistration();
    if (reg && reg.active) {
      reg.active.postMessage({ type: 'show-notification', title, body, tab, tag });
      return true;
    }
    new Notification(title, { body, dir: 'rtl', lang: 'ar', icon: '/pwa-192x192.png' });
    return true;
  } catch {
    return false;
  }
}

/* ============================ Web Push ============================ */

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return buffer;
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unconfigured' | 'error'; message?: string };

/** مفتاح VAPID العام من السيرفر (null = السيرفر غير مهيّأ للإشعارات) */
export async function fetchVapidKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/subscribe', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.publicKey || null;
  } catch {
    return null;
  }
}

/** تسجيل الجهاز لاستقبال إشعارات Web Push */
export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (permissionState() !== 'granted') return { ok: false, reason: 'denied' };

  const publicKey = await fetchVapidKey();
  if (!publicKey) return { ok: false, reason: 'unconfigured' };

  try {
    const reg = await swRegistration();
    if (!reg) return { ok: false, reason: 'error' };

    const existing = await reg.pushManager.getSubscription();
    const subscription =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, device: isIOS() ? 'ios' : 'other' }),
    });
    if (!res.ok) return { ok: false, reason: 'error' };

    const data = await res.json();
    if (data?.ok === false && data?.reason === 'missing-table') {
      return { ok: false, reason: 'unconfigured', message: 'جدول الاشتراكات غير منشأ في Supabase' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** إلغاء اشتراك الجهاز */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await swRegistration();
    const subscription = await reg?.pushManager.getSubscription();
    if (!subscription) return true;
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/** هل هذا الجهاز مشترك فعلاً؟ */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await swRegistration();
    const subscription = await reg?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

/** إشعار تجريبي من السيرفر (للتأكد أن الإشعارات تصل والتطبيق مقفول) */
export async function sendTestPush(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/push/test', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data?.message || 'تعذر إرسال الإشعار التجريبي' };
    if (data?.ok === false) {
      return {
        ok: false,
        message:
          data.reason === 'unconfigured'
            ? 'السيرفر غير مهيّأ بمفاتيح VAPID'
            : data.reason === 'missing-table'
            ? 'جدول الاشتراكات غير منشأ في Supabase'
            : 'لم يصل الإشعار — تأكد من تفعيل الإشعارات على الجهاز',
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'تعذر الاتصال بالسيرفر' };
  }
}
