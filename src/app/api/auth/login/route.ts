import { NextResponse } from 'next/server';
import { ensureSchema, getDb } from '../../../../lib/db';
import { AuthConfigError, isAuthConfigured, setSession, verifyPassword } from '../../../../lib/auth';
import { checkRateLimit, clientIp, registerFailure, registerSuccess } from '../../../../lib/rateLimit';

export async function POST(request: Request) {
  const ip = clientIp(request);
  let email = '';

  try {
    const body = await request.json();
    email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    const limit = checkRateLimit(ip, email);
    if (!limit.allowed) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return NextResponse.json(
        { success: false, message: `محاولات كثيرة خاطئة. حاول بعد ${minutes} دقيقة.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال البريد وكلمة المرور' },
        { status: 400 }
      );
    }

    await ensureSchema();
    const db = getDb();
    const { data, error } = await db
      .from('app_users')
      .select('id,email,password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error || !data || !verifyPassword(password, data.password_hash)) {
      registerFailure(ip, email);
      return NextResponse.json(
        { success: false, message: 'البريد أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    registerSuccess(ip, email);
    await setSession(data.id);
    return NextResponse.json({ success: true, email: data.email });
  } catch (error: any) {
    console.error('Login error:', error?.message || error);
    if (error instanceof AuthConfigError || !isAuthConfigured()) {
      return NextResponse.json(
        {
          success: false,
          code: 'server-not-configured',
          message: 'الخادم غير مهيّأ للمزامنة: مفتاح AUTH_SECRET ناقص في إعدادات Vercel',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'تعذر تسجيل الدخول. تحقق من إعدادات الخادم.' },
      { status: 500 }
    );
  }
}
