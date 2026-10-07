/**
 * منطق الفروع — نقي بلا اعتماد على React أو الشبكة.
 * الفرع يُخزَّن داخل بيانات الحساب (branches) ويُزامَن مع Supabase
 * ضمن نفس الحِمل عبر /api/sync، كما يُدعم جدول branches المستقل.
 */
import { Branch, Expense, Purchase, Sale } from '../types';

/** قيمة تعني «كل الفروع» (عرض مجمّع) */
export const ALL_BRANCHES = 'all';

/** قيمة تعني «السجلات بلا فرع» — بيانات قديمة سُجّلت قبل إنشاء الفروع */
export const UNASSIGNED_BRANCH = 'none';

/** اسم يُعرض عند عدم تحديد فرع */
export const NO_BRANCH = 'بدون فرع';

export type BranchScoped = { branchId?: string };

/** الفروع غير المؤرشفة */
export function activeBranches(branches: Branch[] = []): Branch[] {
  return branches.filter((b) => !b.archived);
}

/**
 * تقييد سجل بالفرع المحدد.
 * - ALL_BRANCHES أو قيمة غير معروفة → كل السجلات (وضع «كل الفروع»).
 * - فرع محدد → سجلاته فقط، وتشمل السجلات القديمة بلا فرع
 *   عندما تكون face = main كذلك (لأنها غالباً سُجّلت قبل إنشاء الفروع).
 */
export function scopeToBranch<T extends BranchScoped>(items: T[], branchId?: string | null): T[] {
  if (!branchId || branchId === ALL_BRANCHES) return items;
  if (branchId === UNASSIGNED_BRANCH) return items.filter((x) => !x.branchId);
  return items.filter((x) => x.branchId === branchId);
}

/**
 * عدد السجلات المخفية بسبب الفرع النشط:
 * - فرع محدد → كل ما ليس منه (من فروع أخرى أو بلا فرع).
 * - «بلا فرع» → كل ما هو مسند لفرع.
 * - كل الفروع → صفر (لا شيء مخفي).
 */
export function hiddenByBranchCount(items: BranchScoped[] = [], branchId?: string | null): number {
  if (!branchId || branchId === ALL_BRANCHES) return 0;
  if (branchId === UNASSIGNED_BRANCH) return items.filter((x) => !!x.branchId).length;
  return items.filter((x) => x.branchId !== branchId).length;
}

/** عدد السجلات التي لم تُسند إلى أي فرع (بيانات قديمة) */
export function unassignedCount(items: BranchScoped[] = []): number {
  return items.filter((x) => !x.branchId).length;
}

/** اسم الفرع من المعرّف */
export function branchName(branches: Branch[] = [], branchId?: string | null): string {
  if (!branchId || branchId === ALL_BRANCHES) return 'كل الفروع';
  if (branchId === UNASSIGNED_BRANCH) return NO_BRANCH;
  return branches.find((b) => b.id === branchId)?.name || NO_BRANCH;
}

/** رمز الفرع المستخدم في أرقام الفواتير */
export function branchCode(branches: Branch[] = [], branchId?: string | null): string | undefined {
  if (!branchId || branchId === ALL_BRANCHES || branchId === UNASSIGNED_BRANCH) return undefined;
  const b = branches.find((x) => x.id === branchId);
  const code = (b?.code || '').trim();
  return code ? code.toUpperCase() : undefined;
}

/** اسم يظهر على الفاتورة المطبوعة */
export function receiptNameFor(branches: Branch[] = [], branchId?: string | null): string | undefined {
  if (!branchId || branchId === ALL_BRANCHES || branchId === UNASSIGNED_BRANCH) return undefined;
  const b = branches.find((x) => x.id === branchId);
  if (!b) return undefined;
  return (b.receiptName || '').trim() || b.name;
}

/** إنشاء رمز تلقائي للفرع من اسمه مثل «فرع الخرطوم» → FRKH1 */
export function suggestBranchCode(name: string, branches: Branch[] = []): string {
  const cleaned = (name || '').replace(/[^\u0621-\u064AA-Za-z0-9 ]/g, ' ').trim();
  const first = cleaned.split(/\s+/).find((w) => w.length > 1) || 'FR';
  let code = ('F' + (first[0] || 'F')).toUpperCase().slice(0, 3);
  if (/[\u0621-\u064A]/.test(code)) code = 'FR';
  let n = 1;
  const taken = new Set(branches.map((b) => (b.code || '').toUpperCase()));
  let candidate = `${code}${n}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${code}${n}`;
  }
  return candidate;
}

export type BranchStat = {
  branchId: string | null;
  name: string;
  salesAmount: number;
  salesProfit: number;
  purchasesAmount: number;
  expensesAmount: number;
  pending: number;
  operations: number;
};

/** ملخص ربحية كل فرع — يُستخدم في شاشة الفروع/التقارير */
export function branchStats(
  branches: Branch[],
  purchases: Purchase[],
  sales: Sale[],
  expenses: Expense[]
): BranchStat[] {
  const rows: BranchStat[] = [];
  const push = (branchId: string | null, name: string) => {
    const p = branchId ? purchases.filter((x) => x.branchId === branchId) : purchases.filter((x) => !x.branchId);
    const s = branchId ? sales.filter((x) => x.branchId === branchId) : sales.filter((x) => !x.branchId);
    const e = branchId ? expenses.filter((x) => x.branchId === branchId) : expenses.filter((x) => !x.branchId);
    const salesAmount = s.reduce((sum, x) => sum + (x.sellAmount || 0), 0);
    const salesProfit = s.reduce((sum, x) => sum + ((x.sellAmount || 0) - (x.buyAmount || 0)), 0);
    rows.push({
      branchId,
      name,
      salesAmount,
      salesProfit,
      purchasesAmount: p.reduce((sum, x) => sum + (x.amount || 0), 0),
      expensesAmount: e.reduce((sum, x) => sum + (x.amount || 0), 0),
      pending:
        s.reduce((sum, x) => sum + (x.pendingAmount || 0), 0) +
        p.reduce((sum, x) => sum + (x.pendingAmount || 0), 0),
      operations: p.length + s.length + e.length,
    });
  };

  for (const b of branches) push(b.id, b.name);
  const scoped: BranchScoped[] = [...purchases, ...sales, ...expenses];
  if (scoped.some((x) => !x.branchId)) push(null, NO_BRANCH);
  return rows;
}

/** أفضل فرع من ناحية إجمالي المبيعات */
export function bestBranch(stats: BranchStat[]): BranchStat | null {
  if (stats.length === 0) return null;
  return stats.reduce((best, row) => (row.salesAmount > best.salesAmount ? row : best), stats[0]);
}

/** نسبة كل فرع من إجمالي المبيعات (0–100) */
export function branchShare(stats: BranchStat[]): { name: string; percent: number }[] {
  const total = stats.reduce((s, r) => s + r.salesAmount, 0);
  if (total <= 0) return stats.map((r) => ({ name: r.name, percent: 0 }));
  return stats.map((r) => ({ name: r.name, percent: Math.round((r.salesAmount / total) * 1000) / 10 }));
}
