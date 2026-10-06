import { NextResponse } from 'next/server';
import { currentUserId } from '../../../lib/auth';
import { ensureSchema, getDb } from '../../../lib/db';
import { Branch } from '../../../types';

/**
 * جدول الفروع في Supabase.
 *
 * - الحِمل الكامل لبيانات الحساب (بما فيه الفروع) يُزامَن عبر /api/sync.
 * - هذا المسار يحفظ الفروع في جدول `branches` المستقل أيضاً، فيمكن قراءتها
 *   من لوحة Supabase أو من أي أداة أخرى، ويبقى الجدول مرآةً للفروع المحلية.
 * - إن لم يكن الجدول موجوداً بعد، يرجع المسار بنجاح مع reason = 'missing-table'
 *   حتى لا يتعطّل التطبيق (راجع ملف supabase/branches.sql).
 */

type BranchRow = {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  phone: string | null;
  address: string | null;
  receipt_name: string | null;
  notes: string | null;
  archived: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function toRow(userId: string, b: Branch): BranchRow {
  return {
    id: b.id,
    user_id: userId,
    name: b.name,
    code: b.code ?? null,
    phone: b.phone ?? null,
    address: b.address ?? null,
    receipt_name: b.receiptName ?? null,
    notes: b.notes ?? null,
    archived: Boolean(b.archived),
    created_at: b.createdAt ?? null,
    updated_at: b.updatedAt ?? new Date().toISOString(),
  };
}

function fromRow(row: BranchRow): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    receiptName: row.receipt_name ?? undefined,
    notes: row.notes ?? undefined,
    archived: Boolean(row.archived),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** رسائل الخطأ التي تعني أن الجدول غير منشأ بعد */
function isMissingTable(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  );
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });
  await ensureSchema();

  try {
    const db = getDb();
    const { data, error } = await db
      .from('branches')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true });

    if (error) {
      if (isMissingTable(error.message)) {
        return NextResponse.json({ ok: false, reason: 'missing-table', branches: [] });
      }
      return NextResponse.json({ message: 'تعذر قراءة الفروع' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      branches: (data as BranchRow[] | null)?.map(fromRow) || [],
    });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unconfigured', branches: [] });
  }
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ message: 'غير مسجل الدخول' }, { status: 401 });

  let payload: { branches?: Branch[] };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: 'بيانات غير صالحة' }, { status: 400 });
  }

  const branches = Array.isArray(payload?.branches)
    ? payload.branches.filter((b) => b && b.id && b.name)
    : [];
  if (branches.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  await ensureSchema();
  try {
    const db = getDb();
    const rows = branches.map((b) => toRow(userId, b));
    const { error } = await db.from('branches').upsert(rows, { onConflict: 'id' });

    if (error) {
      if (isMissingTable(error.message)) {
        return NextResponse.json({ ok: false, reason: 'missing-table', saved: 0 });
      }
      return NextResponse.json({ message: 'تعذر حفظ الفروع في Supabase' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: rows.length, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unconfigured', saved: 0 });
  }
}
