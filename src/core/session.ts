/**
 * جلسة الحساب السحابي على الجهاز + لقطة ما قبل الخروج.
 *
 * نقي بلا اعتماد على React أو التخزين — التخزين يتولاه طبقة السياق.
 * الهدف: عند تسجيل الخروج أو الدخول بحساب مختلف لا تضيع البيانات:
 * تُحفظ لقطة كاملة أولاً، ثم يُنظَّف الجهاز لصاحبه الجديد.
 */

export interface SnapshotCounts {
  purchases: number;
  sales: number;
  expenses: number;
  partners: number;
  loans: number;
  branches: number;
}

export interface SessionSnapshotMeta {
  /** بريد الحساب الذي كانت له هذه البيانات */
  email: string;
  /** اسم المحل وقت اللقطة */
  storeName: string;
  /** وقت اللقطة (ISO) */
  at: string;
  counts: SnapshotCounts;
}

const len = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

/** عدّ السجلات في حِمل بيانات (لقطة أو نسخة احتياطية) */
export function countRecords(db: any): SnapshotCounts {
  return {
    purchases: len(db?.purchases),
    sales: len(db?.sales),
    expenses: len(db?.expenses),
    partners: len(db?.partners),
    loans: len(db?.loans),
    branches: len(db?.branches),
  };
}

/** إجمالي السجلات (بدون الفروع — الفروع إعداد لا سجل) */
export function totalRecords(db: any): number {
  const c = countRecords(db);
  return c.purchases + c.sales + c.expenses + c.partners + c.loans;
}

export function isEmptyDb(db: any): boolean {
  return totalRecords(db) === 0;
}

/**
 * هل هذا تبديل حساب؟
 * نعم إذا كان هناك حساب مسجّل سابقاً (بريد غير فارغ) والبريد الجديد مختلف.
 * أول حساب على الجهاز ليس تبديلاً — بيانات الجهاز تُرفع له بشكل طبيعي.
 */
export function isAccountSwitch(prevEmail?: string | null, nextEmail?: string | null): boolean {
  const prev = String(prevEmail || '').trim().toLowerCase();
  const next = String(nextEmail || '').trim().toLowerCase();
  if (!prev || !next) return false;
  return prev !== next;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** تاريخ مقروء عربي مختصر لوقت اللقطة */
export function snapshotDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** وصف اللقطة للعرض: سطر عنوان + سطر تفصيل */
export function describeSnapshot(meta: SessionSnapshotMeta): { title: string; breakdown: string } {
  const c = meta?.counts || ({} as SnapshotCounts);
  const total =
    (c.purchases || 0) + (c.sales || 0) + (c.expenses || 0) + (c.partners || 0) + (c.loans || 0);
  const parts = [
    `مشتريات ${c.purchases || 0}`,
    `مبيعات ${c.sales || 0}`,
    `مصروفات ${c.expenses || 0}`,
    `سلف ${c.loans || 0}`,
  ];
  if (c.partners) parts.push(`شركاء ${c.partners}`);
  if (c.branches) parts.push(`فروع ${c.branches}`);
  const title = `${total.toLocaleString('en-US')} سجل • ${snapshotDateLabel(meta?.at || '')}${
    meta?.email ? ` • ${meta.email}` : ''
  }`;
  return { title, breakdown: parts.join(' • ') };
}
