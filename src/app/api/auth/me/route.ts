import { NextResponse } from 'next/server';
import { currentUserId, isAuthConfigured } from '../../../../lib/auth';

export async function GET() {
  try {
    const userId = await currentUserId();
    return NextResponse.json({ authenticated: Boolean(userId), configured: isAuthConfigured() });
  } catch {
    return NextResponse.json({ authenticated: false, configured: isAuthConfigured() });
  }
}
