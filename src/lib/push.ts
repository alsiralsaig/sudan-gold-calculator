import webpush from 'web-push';
import { getDb } from './db';

/**
 * إشعارات Web Push من السيرفر (تعمل والتطبيق مقفول).
 *
 * الإعداد (متغيرات بيئة):
 *  - VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *  - VAPID_PRIVATE_KEY
 *  - VAPID_SUBJECT (mailto: أو رابط الموقع)
 *
 * توليد المفاتيح مرة واحدة:
 *   npx web-push generate-vapid-keys
 */

export type PushSubscriptionInput = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
};

export type PushPayload = {
  title: string;
  body: string;
  tab?: string;
  tag?: string;
  url?: string;
};

export function vapidPublicKey(): string | null {
  return (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    null
  );
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;

function ensureConfigured(): boolean {
  if (!isPushConfigured()) return false;
  if (!configured) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:support@sudan-gold-calculator.app',
        vapidPublicKey() as string,
        process.env.VAPID_PRIVATE_KEY as string
      );
      configured = true;
    } catch {
      return false;
    }
  }
  return true;
}

/** قناة الإشعارات محجوزة للمزامنة السحابية */
export async function pushTableExists(): Promise<boolean> {
  try {
    const db = getDb();
    const { error } = await db.from('push_subscriptions').select('endpoint').limit(1);
    if (!error) return true;
    return !isMissingTable(error.message);
  } catch {
    return false;
  }
}

export function isMissingTable(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  );
}

export const MISSING_TABLE_REASON = 'missing-table';

export type SendResult = { sent: number; failed: number; removed: number };

/**
 * إرسال إشعار لمجموعة اشتراكات.
 * الاشتراكات المنتهية (404/410) تُحذف تلقائياً من القاعدة.
 */
export async function sendToSubscriptions(
  subscriptions: { endpoint: string; keys?: { p256dh?: string; auth?: string } }[],
  payload: PushPayload
): Promise<SendResult> {
  if (!ensureConfigured()) return { sent: 0, failed: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    (subscriptions || []).map(async (sub) => {
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          body,
          { TTL: 60 * 60, urgency: 'normal' }
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) expired.push(sub.endpoint);
      }
    })
  );

  if (expired.length > 0) {
    try {
      const db = getDb();
      await db.from('push_subscriptions').delete().in('endpoint', expired);
    } catch {
      /* تجاهل — سيُعاد تنظيفها في مرة قادمة */
    }
  }

  return { sent, failed, removed: expired.length };
}
