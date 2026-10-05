import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { ensureSchema, getDb } from '../../../../lib/db';
import { hashPassword, setSession } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || String(password || '').length < 6) return NextResponse.json({ success: false, message: 'البريد وكلمة المرور غير صحيحة' }, { status: 400 });
    await ensureSchema();
    const sql = getDb();
    const id = randomUUID();
    await sql`INSERT INTO app_users (id, email, password_hash) VALUES (${id}, ${normalized}, ${hashPassword(password)})`;
    await setSession(id);
    return NextResponse.json({ success: true, email: normalized });
  } catch (e: any) {
    const duplicate = String(e?.message || '').toLowerCase().includes('unique');
    return NextResponse.json({ success: false, message: duplicate ? 'البريد مستخدم بالفعل' : 'تعذر إنشاء الحساب' }, { status: duplicate ? 409 : 500 });
  }
}
