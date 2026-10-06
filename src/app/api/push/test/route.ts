import { NextResponse } from 'next/server';
import { currentUserId } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { MISSING_TABLE_REASON, isMissingTable, isPushConfigured, sendToSubscriptions } from '../../../../lib/push';

/**
 * إشعار تجريبي لهذا الحساب — للتأكد أن الإشعارات تصل والتطبيق مقفول.
 */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ ok: false, reason: 'unconfigured' });

  try {
    const db = getDb();
    const { data, error } = await db
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('user_id', userId);

    if (error) {
      if (isMissingTable(error.message)) {
        return NextResponse.json({ ok: false, reason: MISSING_TABLE_REASON });
      }
      return NextResponse.json({ message: 'تعذر قراءة الاشتراكات' }, { status: 500 });
    }

    const subs = (data || []).map((row: { endpoint: string; p256dh: string | null; auth: string | null }) => ({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh || undefined, auth: row.auth || undefined },
    }));

    if (subs.length === 0) {
      return NextResponse.json({ ok: false, reason: 'no-subscriptions' });
    }

    const result = await sendToSubscriptions(subs, {
      title: '🔔 إشعار تجريبي — حاسبة الذهب',
      body: 'إذا وصلتك هذه الرسالة والتطبيق مقفول فالإشعارات تعمل بنجاح. ستصلك تنبيهات الأسعار والعمليات والذمم.',
      tab: 'dashboard',
      tag: 'test',
    });

    return NextResponse.json({ ok: result.sent > 0, ...result });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unconfigured' });
  }
}
