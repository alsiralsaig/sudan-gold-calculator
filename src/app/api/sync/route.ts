import { NextResponse } from 'next/server';
import { currentUserId } from '../../../lib/auth';
import { ensureSchema, getDb } from '../../../lib/db';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  await ensureSchema();
  const db = getDb();
  const { data, error } = await db.from('app_user_data').select('payload,updated_at').eq('user_id', userId).maybeSingle();
  if (error) return NextResponse.json({ message: 'تعذر قراءة بيانات السحابة' }, { status: 500 });
  return NextResponse.json({ payload: data?.payload || null, updatedAt: data?.updated_at || null });
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  const payload = await request.json();
  await ensureSchema();
  const db = getDb();
  const { error } = await db.from('app_user_data').upsert({ user_id: userId, payload, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ message: 'تعذر حفظ بيانات السحابة' }, { status: 500 });
  return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
}
