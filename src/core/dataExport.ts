/**
 * تصدير البيانات (CSV يفتح في Excel/Sheets) — مرتّب ومجمَّع.
 *
 * الترتيب المطلوب في السوق: كل نوع في قسم لوحده، وبعد كل قسم مجاميعه،
 * وداخل كل قسم الأحدث أولاً. التواريخ بصيغة YYYY-MM-DD حتى تكون قابلة
 * للترتيب في Excel، والأرقام خام (بلا فواصل) حتى تُحسب مباشرة.
 *
 * نقي بلا React ولا DOM — مُختبر.
 */
import { Branch, Expense, Loan, Purchase, Sale } from '../types';
import { branchName } from './branches';
import { salePending } from './accounting';
import { loanPaid, loanPending } from './loans';
import { unitsToGhJ } from './format';

export const EXPORT_COLUMNS: string[] = [
  'النوع',
  'التاريخ',
  'الفرع',
  'رقم الفاتورة',
  'الوزن (ج.ح.ز)',
  'الجرام',
  'النقاوة',
  'المبلغ',
  'المسدد',
  'المتبقي',
  'الطرف',
  'ملاحظات',
];

export interface ExportInput {
  storeName: string;
  exportedAt?: Date;
  branches?: Branch[];
  purchases?: Purchase[];
  sales?: Sale[];
  expenses?: Expense[];
  loans?: Loan[];
}

const timeOf = (d?: string): number => {
  const t = new Date(d || '').getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** الأحدث أولاً — لا نلمس المصفوفة الأصلية */
function newestFirst<T extends { date?: string }>(items: T[] = []): T[] {
  return [...items].sort((a, b) => timeOf(b.date) - timeOf(a.date));
}

/** تاريخ قابل للترتيب في Excel (YYYY-MM-DD) */
function isoDay(d?: string): string {
  const t = new Date(d || '');
  if (Number.isNaN(t.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

function clean(v?: string | null): string {
  return String(v ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** رقم خام للحساب في Excel */
const num = (n?: number | null): string => String(Math.round(Number(n) || 0));

const gramsOf = (units?: number): string => ((Number(units) || 0) / 100).toFixed(2);

const blankRow = (): string[] => new Array(EXPORT_COLUMNS.length).fill('');

/** اسم الفرع — السجلات القديمة بلا فرع تُكتب «بدون فرع» لا «كل الفروع» */
function branchLabel(branches: Branch[], branchId?: string): string {
  if (!branchId) return 'بدون فرع';
  return branchName(branches, branchId);
}

/** صف مجموع قسم */
function subtotalRow(label: string, count: number, amount: number, paid: number, pending: number | null): string[] {
  const r = blankRow();
  r[0] = `إجمالي ${label} (${count})`;
  r[7] = num(amount);
  r[8] = num(paid);
  r[9] = pending === null ? '' : num(pending);
  return r;
}

/**
 * جدول التصدير كاملاً: ترويسة معلومات + رأس الأعمدة + الأقسام ومجاميعها.
 * كل الصفوف بنفس عدد الأعمدة (EXPORT_COLUMNS.length) حتى لا يختلّ Excel.
 */
export function buildExportTable(input: ExportInput): string[][] {
  const {
    storeName,
    exportedAt = new Date(),
    branches = [],
    purchases = [],
    sales = [],
    expenses = [],
    loans = [],
  } = input;

  const rows: string[][] = [];
  const info = (label: string, value: string): string[] => {
    const r = blankRow();
    r[0] = label;
    r[1] = value;
    return r;
  };

  const total = purchases.length + sales.length + expenses.length + loans.length;

  // ترويسة معلومات (تُقرأ قبل الجدول)
  rows.push(info(`${storeName} — تصدير البيانات`, `تاريخ التصدير: ${isoDay(exportedAt.toISOString())}`));
  rows.push(
    info(
      'الملخص',
      `مشتريات ${purchases.length} • مبيعات ${sales.length} • مصروفات ${expenses.length} • سلف ${loans.length} • الإجمالي ${total} سجل`
    )
  );
  rows.push(blankRow());

  // رأس الأعمدة
  rows.push([...EXPORT_COLUMNS]);

  // 1) المشتريات — الأحدث أولاً
  const purchaseItems = newestFirst(purchases);
  let pAmount = 0;
  let pPending = 0;
  purchaseItems.forEach((p) => {
    const amount = Number(p.amount) || 0;
    const pending = Number(p.pendingAmount) || 0;
    pAmount += amount;
    pPending += pending;
    rows.push([
      'شراء',
      isoDay(p.date),
      branchLabel(branches, p.branchId),
      clean(p.invoiceNo),
      unitsToGhJ(Number(p.units) || 0),
      gramsOf(p.units),
      String(p.purity ?? ''),
      num(amount),
      num(amount - pending),
      num(pending),
      clean(p.seller),
      clean(p.notes),
    ]);
  });
  rows.push(subtotalRow('مشتريات', purchaseItems.length, pAmount, pAmount - pPending, pPending));
  rows.push(blankRow());

  // 2) المبيعات — الأحدث أولاً
  const saleItems = newestFirst(sales);
  let sAmount = 0;
  let sPending = 0;
  saleItems.forEach((s) => {
    const amount = Number(s.sellAmount) || 0;
    const pending = salePending(s);
    sAmount += amount;
    sPending += pending;
    rows.push([
      'بيع',
      isoDay(s.date),
      branchLabel(branches, s.branchId),
      clean(s.invoiceNo),
      unitsToGhJ(Number(s.units) || 0),
      gramsOf(s.units),
      String(s.purity ?? ''),
      num(amount),
      num(amount - pending),
      num(pending),
      clean(s.buyer),
      clean(s.notes),
    ]);
  });
  rows.push(subtotalRow('مبيعات', saleItems.length, sAmount, sAmount - sPending, sPending));
  rows.push(blankRow());

  // 3) المصروفات — الأحدث أولاً
  const expenseItems = newestFirst(expenses);
  let eAmount = 0;
  expenseItems.forEach((e) => {
    const amount = Number(e.amount) || 0;
    eAmount += amount;
    rows.push([
      'مصروف',
      isoDay(e.date),
      branchLabel(branches, e.branchId),
      '',
      '',
      '',
      '',
      num(amount),
      num(amount),
      '',
      clean(e.target),
      clean(e.name) + (clean(e.category) ? ` — ${clean(e.category)}` : ''),
    ]);
  });
  rows.push(subtotalRow('مصروفات', expenseItems.length, eAmount, eAmount, null));
  rows.push(blankRow());

  // 4) السلف — الأحدث أولاً
  const loanItems = newestFirst(loans);
  let lAmount = 0;
  let lPaid = 0;
  let lPending = 0;
  loanItems.forEach((l) => {
    const amount = Number(l.amount) || 0;
    const paid = loanPaid(l);
    const pending = loanPending(l);
    lAmount += amount;
    lPaid += paid;
    lPending += pending;
    rows.push([
      l.direction === 'lent' ? 'سلفة لنا' : 'سلفة علينا',
      isoDay(l.date),
      branchLabel(branches, l.branchId),
      '',
      '',
      '',
      '',
      num(amount),
      num(paid),
      num(pending),
      clean(l.person),
      clean(l.notes) + (l.dueDate ? ` — الاستحقاق: ${isoDay(l.dueDate)}` : ''),
    ]);
  });
  rows.push(subtotalRow('سلف', loanItems.length, lAmount, lPaid, lPending));

  return rows;
}

/** CSV نصي: BOM للعربية + تهريب الاقتباسات حتى لا تنكسر الأعمدة */
export function buildCsv(rows: string[][]): string {
  const escape = (c: string) => `"${String(c ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + rows.map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n';
}

/** اسم ملف التصدير */
export function exportFileName(at: Date = new Date()): string {
  return `Gold_Export_${isoDay(at.toISOString())}.csv`;
}
