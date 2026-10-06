import { NextResponse } from 'next/server';
import { currentUserId } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import {
  MISSING_TABLE_REASON,
  PushSubscriptionInput,
  isMissingTable,
  isPushConfigured,
  vapidPublicKey,
} from '../../../../lib/push';

/**
 * اشتراك الجهاز في إشعارات Web Push.
 *  GET    → المفتاح العام (VAPID) وحالة التهيئة — يستخدمه العميل قبل الاشتراك.
 *  POST   → حفظ/تحديث اشتراك الجهاز.
 *  DELETE → إلغاء اشتراك الجهاز.
 */

export async function GET() {
  return NextResponse.json({
    publicKey: vapidPublicKey(),
    configured: isPushConfigured(),
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });

  let body: { subscription?: PushSubscriptionInput; device?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'بيانات غير صالحة' }, { status: 400 });
  }

  const sub = body?.subscription;
  if (!sub?.endpoint) {
    return NextResponse.json({ message: 'اشتراك غير صالح' }, { status: 400 });
  }

  try {
    const db = getDb();
    const { error } = await db.from('push_subscriptions').upsert(
      {
        endpoint: sub.endpoint,
        user_id: userId,
        p256dh: sub.keys?.p256dh || null,
        auth: sub.keys?.auth || null,
        device: body.device || 'other',
        user_agent: request.headers.get('user-agent') || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      if (isMissingTable(error.message)) {
        return NextResponse.json({ ok: false, reason: MISSING_TABLE_REASON });
      }
      return NextResponse.json({ message: 'تعذر حفظ الاشتراك' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unconfigured' });
  }
}

export async function DELETE(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'بيانات غير صالحة' }, { status: 400 });
  }
  if (!body?.endpoint) return NextResponse.json({ ok: true });

  try {
    const db = getDb();
    await db.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unconfigured' });
  }
}
