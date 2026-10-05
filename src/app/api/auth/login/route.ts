import { NextResponse } from 'next/server';
import { ensureSchema, getDb } from '../../../../lib/db';
import { setSession, verifyPassword } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`SELECT id, email, password_hash FROM app_users WHERE email = ${String(email || '').trim().toLowerCase()} LIMIT 1`;
    if (!rows[0] || !verifyPassword(String(password || ''), rows[0].password_hash)) return NextResponse.json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة' }, { status: 401 });
    await setSession(rows[0].id);
    return NextResponse.json({ success: true, email: rows[0].email });
  } catch { return NextResponse.json({ success: false, message: 'تعذر تسجيل الدخول' }, { status: 500 }); }
}
