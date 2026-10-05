import { NextResponse } from 'next/server';
import { currentUserId } from '../../../lib/auth';
import { ensureSchema, getDb } from '../../../lib/db';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT payload, updated_at FROM app_user_data WHERE user_id = ${userId} LIMIT 1`;
  return NextResponse.json({ payload: rows[0]?.payload || null, updatedAt: rows[0]?.updated_at || null });
}
export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  const payload = await request.json();
  await ensureSchema();
  const sql = getDb();
  await sql`INSERT INTO app_user_data (user_id, payload, updated_at) VALUES (${userId}, ${JSON.stringify(payload)}::jsonb, NOW()) ON CONFLICT (user_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`;
  return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
}
