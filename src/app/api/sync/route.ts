import { NextResponse } from 'next/server';
import { currentUserId, isAuthConfigured } from '../../../lib/auth';
import { ensureSchema, getDb } from '../../../lib/db';

/** رد موحّد عندما ينقص مفتاح الجلسة على الخادم */
function notConfigured() {
  return NextResponse.json(
    {
      ok: false,
      code: 'server-not-configured',
      message: 'الخادم غير مهيّأ للمزامنة: مفتاح AUTH_SECRET ناقص في إعدادات Vercel',
    },
    { status: 503 }
  );
}

function guard() {
  return isAuthConfigured() ? null : notConfigured();
}

export async function GET() {
  const blocked = guard();
  if (blocked) return blocked;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { data, error } = await db.from('app_user_data').select('payload,updated_at').eq('user_id', userId).maybeSingle();
  if (error) return NextResponse.json({ message: 'تعذر قراءة بيانات السحابة' }, { status: 500 });
  return NextResponse.json({ payload: data?.payload || null, updatedAt: data?.updated_at || null });
}

export async function PUT(request: Request) {
  const blocked = guard();
  if (blocked) return blocked;
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  const payload = await request.json();
  await ensureSchema();
  const db = getDb();
  const { error } = await db.from('app_user_data').upsert({ user_id: userId, payload, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ message: 'تعذر حفظ بيانات السحابة' }, { status: 500 });
  return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
}
