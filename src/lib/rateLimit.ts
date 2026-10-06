/**
 * حد بسيط لمحاولات الدخول لمنع التخمين (Brute force).
 * يعمل داخل نسخة الخادم الواحدة؛ ويُستخدم معه تأخير في الواجهة أيضاً.
 */

interface Attempt {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}

const attempts = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60 * 1000; // نافذة 15 دقيقة
const MAX_ATTEMPTS = 8; // بعد 8 محاولات فاشلة يتم الحظر
const BLOCK_MS = 15 * 60 * 1000;

function keyOf(ip: string, email: string): string {
  return `${ip}::${(email || '').toLowerCase()}`;
}

export function checkRateLimit(ip: string, email: string): { allowed: boolean; retryAfterSeconds: number } {
  const key = keyOf(ip, email);
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) return { allowed: true, retryAfterSeconds: 0 };

  if (record.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function registerFailure(ip: string, email: string): void {
  const key = keyOf(ip, email);
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now, blockedUntil: 0 });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS;
  }
  attempts.set(key, record);
}

export function registerSuccess(ip: string, email: string): void {
  attempts.delete(keyOf(ip, email));
}

export function clientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/** للاختبارات */
export function __resetRateLimit(): void {
  attempts.clear();
}
