import { NextResponse } from 'next/server';
import { ensureSchema, getDb } from '../../../../lib/db';
import { setSession, verifyPassword } from '../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    await ensureSchema();
    const db = getDb();
    const { data, error } = await db.from('app_users').select('id,email,password_hash').eq('email', String(email || '').trim().toLowerCase()).maybeSingle();
    if (error || !data || !verifyPassword(String(password || ''), data.password_hash)) return NextResponse.json({ success: false, message: 'البريد أو كلمة المرور غير صحيحة' }, { status: 401 });
    await setSession(data.id);
    return NextResponse.json({ success: true, email: data.email });
  } catch { return NextResponse.json({ success: false, message: 'تعذر تسجيل الدخول' }, { status: 500 }); }
}
