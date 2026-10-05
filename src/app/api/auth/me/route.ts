import { NextResponse } from 'next/server';
import { currentUserId } from '../../../../lib/auth';
export async function GET() { return NextResponse.json({ authenticated: Boolean(await currentUserId()) }); }
