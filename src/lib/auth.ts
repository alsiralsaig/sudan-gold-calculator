import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'gold_session';
const secret = () => process.env.AUTH_SECRET || 'change-me-in-vercel';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
export function createSession(userId: string) {
  const body = `${userId}.${Date.now() + 1000 * 60 * 60 * 24 * 30}`;
  const sig = createHmac('sha256', secret()).update(body).digest('hex');
  return `${body}.${sig}`;
}
export function readSession(value?: string) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiry, sig] = parts;
  const body = `${userId}.${expiry}`;
  const expected = createHmac('sha256', secret()).update(body).digest('hex');
  if (sig !== expected || Number(expiry) < Date.now()) return null;
  return userId;
}
export async function currentUserId() {
  const store = await cookies();
  return readSession(store.get(COOKIE)?.value);
}
export async function setSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, createSession(userId), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}
export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}
