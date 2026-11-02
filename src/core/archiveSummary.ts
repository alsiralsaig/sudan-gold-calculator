/**
 * وصف سجل مؤرشف بشكل مقروء: اسم + نوع + مبلغ + تفاصيل كاملة.
 *
 * المشكلة التي يحلّها هذا الملف: كان الأرشيف يعرض «رقم كبير» وبجانبه بيان
 * ناقص — المصروف الخاص كان يظهر كـ «8,685,500 ج.س» بدون اسم الشريك،
 * والمصروف العام بدون بيانه (سبب الصرف). والقاعدة الآن: كل سجل مؤرشف
 * يظهر بعنوان واضح (بيان المصروف أو اسم الشخص/الشريك) وبجانبه كل تفاصيله.
 *
 * المنطق هنا نقي (بلا React) ومُختبر في tests/archive-summary.test.ts.
 */
import { Expense, Loan, Partner, Purchase, Sale } from '../types';
import { fmtNum, formatDateWithTime, unitsToGhJ } from './format';
import { purityLabel, unitsToK21 } from './purity';
import { loanPending } from './loans';
import { purchasePending, salePending } from './accounting';

export type ArchiveItemKind = 'purchase' | 'sale' | 'expense' | 'loan' | 'partner';

export type ArchiveTone = 'amber' | 'emerald' | 'rose' | 'cyan' | 'slate' | 'violet';

export interface ArchiveField {
  label: string;
  value: string;
  tone?: ArchiveTone;
}

export interface ArchiveItemView {
  /** شارة النوع: عام / خاص / مسدّد / متبقي ... */
  badge: { text: string; tone: ArchiveTone };
  /** العنوان الرئيسي: بيان المصروف أو اسم الشريك/المورد/الشخص */
  title: string;
  /** المبلغ بالصيغة المعروضة */
  amount: string;
  /** سطر توضيحي تحت العنوان: النوع + التاريخ والوقت */
  subtitle: string;
  /** تفاصيل إضافية تُعرض في صفوف صغيرة */
  fields: ArchiveField[];
  /** ملاحظة تشغيلية (مثل: غير محسوب في الإجماليات) */
  note?: string;
}

export interface ArchiveContext {
  /** أسماء الفروع لتحويل branchId إلى اسم مقروء */
  branches?: { id: string; name: string }[];
}

/** هل المصروف عام (على المحل) أم خاص بشريك؟ */
export function isGeneralExpense(expense: Expense): boolean {
  return !expense.target || expense.target === 'عام';
}

/** الشركاء الذين يتحمّلون مصروفاً عاماً — أو نص «كل الشركاء» لو غير محددين */
export function expenseBearers(expense: Expense): string {
  const names = (expense.partnerNames || []).filter((n) => Boolean(n && n.trim()));
  return names.length ? names.join('، ') : 'كل الشركاء بنسب الربح';
}

function branchName(id: string | undefined, ctx: ArchiveContext): string {
  if (!id) return '';
  const b = (ctx.branches || []).find((x) => x.id === id);
  return b?.name || '';
}

function joinSubtitle(parts: (string | undefined | null)[]): string {
  return parts.filter((p) => Boolean(p && String(p).trim())).join(' • ');
}

/** رصيد السلفة: المستحق مقابل المسدَّد */
export function describeLoan(loan: Loan, ctx: ArchiveContext = {}): ArchiveItemView {
  const pending = loanPending(loan);
  const paid = Math.max(0, (loan.amount || 0) - pending);
  const isLent = loan.direction === 'lent';
  const fields: ArchiveField[] = [
    { label: isLent ? 'لنا على' : 'علينا لـ', value: loan.person || 'غير محدد', tone: 'cyan' },
    { label: 'المسدَّد', value: `${fmtNum(paid)} ج.س`, tone: 'emerald' },
    { label: 'المتبقي', value: `${fmtNum(pending)} ج.س`, tone: pending > 0 ? 'rose' : 'slate' },
  ];
  if (loan.phone) fields.push({ label: 'الهاتف', value: loan.phone });
  if (loan.notes) fields.push({ label: 'ملاحظات', value: loan.notes });
  const branch = branchName(loan.branchId, ctx);
  if (branch) fields.push({ label: 'الفرع', value: branch });

  return {
    badge: isLent ? { text: 'سلفة لنا', tone: 'emerald' } : { text: 'سلفة علينا', tone: 'rose' },
    title: loan.person?.trim() || 'شخص غير محدد',
    amount: `${fmtNum(loan.amount)} ج.س`,
    subtitle: joinSubtitle([isLent ? 'سلّفنا شخصاً' : 'استلفنا من شخص', formatDateWithTime(loan.date)]),
    fields,
    note: pending === 0 ? 'السلفة مكتملة السداد' : undefined,
  };
}

/**
 * وصف مصروف مؤرشف: **كل تفاصيل سجل المنصرفات** تنتقل معه للأرشيف.
 * ------------------------------------------------------------------
 * المطلوب صريح: «إيجار أو عشاء» مش كفاية — لازم يبان:
 *   • البيان (سبب الصرف كما كُتب في المنصرفات)
 *   • النوع: عام (على المحل) ولا خاص بشريك + **اسم الشريك**
 *   • المبلغ والتاريخ والوقت
 *   • التصنيف، الملاحظات، الفرع، وقت الأرشفة
 * والسجل المؤرشف **ما يُحسبش ولا يُخصم تاني** — خصمُه حصل مرة واحدة وقت
 * التسجيل، والأرشفة تُخرجه من كل الإجماليات.
 */
export function describeExpense(expense: Expense, ctx: ArchiveContext = {}): ArchiveItemView {
  const general = isGeneralExpense(expense);
  const partnerName = (expense.target || '').trim();
  /** الجهة بصيغة صريحة: عام/المحل، أو «خاص: اسم الشريك» */
  const party = general ? 'عام (على المحل)' : `خاص — ${partnerName || 'شريك غير محدد'}`;
  const bearer = general ? expenseBearers(expense) : partnerName || 'شريك غير محدد';

  const fields: ArchiveField[] = [
    { label: 'النوع', value: general ? 'منصرف عام' : 'منصرف خاص (مسحوبات شريك)', tone: general ? 'amber' : 'cyan' },
    { label: general ? 'يتحمّله' : 'على الشريك', value: bearer, tone: general ? 'amber' : 'cyan' },
    { label: 'المبلغ', value: `${fmtNum(expense.amount)} ج.س`, tone: 'rose' },
    { label: 'التاريخ', value: formatDateWithTime(expense.date) },
  ];
  if (expense.category) fields.push({ label: 'التصنيف', value: expense.category });
  if (expense.notes) fields.push({ label: 'الملاحظات', value: expense.notes });
  const branch = branchName(expense.branchId, ctx);
  fields.push({ label: 'الفرع', value: branch || 'كل الفروع (غير محدد)' });
  if (expense.updatedAt) fields.push({ label: 'أُرشف في', value: formatDateWithTime(expense.updatedAt) });

  return {
    badge: general
      ? { text: 'عام', tone: 'amber' }
      : { text: `خاص: ${partnerName || 'شريك'}`, tone: 'cyan' },
    // البيان هو اللي التاجر بيدوّر عليه — لو فاضي نبيّن السبب صريح بدل سطر أرقام
    title: expense.name?.trim() || 'بدون بيان',
    amount: `${fmtNum(expense.amount)} ج.س`,
    subtitle: joinSubtitle([party, formatDateWithTime(expense.date)]),
    fields,
    note: `حُسب مرة واحدة فقط (${fmtNum(expense.amount)} ج.س) قبل الأرشفة — وهو الآن خارج الحساب تماماً: لا خصم ولا إضافة. الاستعادة لا تضيف خصماً جديداً.`,
  };
}

/** وصف عملية شراء مؤرشفة */
export function describePurchase(purchase: Purchase, ctx: ArchiveContext = {}): ArchiveItemView {
  const pending = purchasePending(purchase);
  const paid = Math.max(0, (purchase.amount || 0) - pending);
  const fields: ArchiveField[] = [
    { label: 'الوزن', value: `${unitsToGhJ(purchase.units)} جم`, tone: 'emerald' },
    { label: 'العيار', value: purchase.purity > 0 ? `عيار ${purityLabel(purchase.purity)}` : 'بدون عيار' },
    { label: 'معادل 21', value: `${unitsToGhJ(unitsToK21(purchase.units, purchase.purity))} جم` },
    { label: 'المدفوع', value: `${fmtNum(paid)} ج.س`, tone: 'emerald' },
    { label: 'المتبقي للمورد', value: `${fmtNum(pending)} ج.س`, tone: pending > 0 ? 'rose' : 'slate' },
  ];
  if (purchase.sellerPhone) fields.push({ label: 'هاتف المورد', value: purchase.sellerPhone });
  if (purchase.invoiceNo) fields.push({ label: 'رقم الفاتورة', value: purchase.invoiceNo });
  if (purchase.dueDate) fields.push({ label: 'تاريخ الاستحقاق', value: formatDateWithTime(purchase.dueDate) });
  if (purchase.notes) fields.push({ label: 'ملاحظات', value: purchase.notes });
  const branch = branchName(purchase.branchId, ctx);
  if (branch) fields.push({ label: 'الفرع', value: branch });

  return {
    badge: pending > 0 ? { text: 'عليه متبقي', tone: 'rose' } : { text: 'مسدّد', tone: 'emerald' },
    title: purchase.seller?.trim() || 'مورد عام',
    amount: `${fmtNum(purchase.amount)} ج.س`,
    subtitle: joinSubtitle([
      `شراء ${unitsToGhJ(purchase.units)} جم عيار ${purchase.purity > 0 ? purityLabel(purchase.purity) : '—'}`,
      formatDateWithTime(purchase.date),
    ]),
    fields,
  };
}

/** وصف عملية بيع مؤرشفة */
export function describeSale(sale: Sale, ctx: ArchiveContext = {}): ArchiveItemView {
  const pending = salePending(sale);
  const collected = Math.max(0, (sale.sellAmount || 0) - pending);
  const profit = (sale.sellAmount || 0) - (sale.buyAmount || 0);
  const fields: ArchiveField[] = [
    { label: 'الوزن', value: `${unitsToGhJ(sale.units)} جم`, tone: 'emerald' },
    { label: 'العيار', value: sale.purity > 0 ? `عيار ${purityLabel(sale.purity)}` : 'بدون عيار' },
    { label: 'المحصَّل', value: `${fmtNum(collected)} ج.س`, tone: 'emerald' },
    { label: 'المتبقي على الزبون', value: `${fmtNum(pending)} ج.س`, tone: pending > 0 ? 'rose' : 'slate' },
    { label: 'ربح العملية', value: `${fmtNum(profit)} ج.س`, tone: profit >= 0 ? 'emerald' : 'rose' },
  ];
  if (sale.buyerPhone) fields.push({ label: 'هاتف الزبون', value: sale.buyerPhone });
  if (sale.invoiceNo) fields.push({ label: 'رقم الفاتورة', value: sale.invoiceNo });
  if (sale.notes) fields.push({ label: 'ملاحظات', value: sale.notes });
  const branch = branchName(sale.branchId, ctx);
  if (branch) fields.push({ label: 'الفرع', value: branch });

  return {
    badge: pending > 0 ? { text: 'عليه متبقي', tone: 'rose' } : { text: 'محصَّل', tone: 'emerald' },
    title: sale.buyer?.trim() || 'مشتري عام',
    amount: `${fmtNum(sale.sellAmount)} ج.س`,
    subtitle: joinSubtitle([
      `بيع ${unitsToGhJ(sale.units)} جم عيار ${sale.purity > 0 ? purityLabel(sale.purity) : '—'}`,
      formatDateWithTime(sale.date),
    ]),
    fields,
  };
}

/** وصف شريك مؤرشف */
export function describePartner(partner: Partner, _ctx: ArchiveContext = {}): ArchiveItemView {
  const fields: ArchiveField[] = [
    { label: 'رأس المال', value: `${fmtNum(partner.capital)} ج.س`, tone: 'amber' },
    { label: 'نسبة الربح', value: `${partner.profitPercent || 0}%`, tone: 'emerald' },
  ];
  if (partner.phone) fields.push({ label: 'الهاتف', value: partner.phone });
  if (partner.notes) fields.push({ label: 'ملاحظات', value: partner.notes });

  return {
    badge: { text: 'شريك مؤرشف', tone: 'amber' },
    title: partner.name?.trim() || 'شريك بدون اسم',
    amount: `${fmtNum(partner.capital)} ج.س`,
    subtitle: joinSubtitle(['رأس المال المسجّل', partner.updatedAt ? formatDateWithTime(partner.updatedAt) : '']),
    fields,
    note: 'غير محسوب في نسب الشركاء ولا توزيع الأرباح — استعادة ترجّعه',
  };
}

/** توجيه عام حسب التبويب */
export function describeArchiveItem(
  kind: ArchiveItemKind,
  item: Purchase | Sale | Expense | Partner | Loan,
  ctx: ArchiveContext = {}
): ArchiveItemView {
  if (kind === 'purchase') return describePurchase(item as Purchase, ctx);
  if (kind === 'sale') return describeSale(item as Sale, ctx);
  if (kind === 'expense') return describeExpense(item as Expense, ctx);
  if (kind === 'loan') return describeLoan(item as Loan, ctx);
  return describePartner(item as Partner, ctx);
}

export interface ArchiveTotals {
  count: number;
  amount: number;
  units: number;
}

/** إجمالي التبويب الحالي (المعروض بعد البحث) */
export function archiveTotals(
  kind: ArchiveItemKind,
  items: (Purchase | Sale | Expense | Partner | Loan)[]
): ArchiveTotals {
  let amount = 0;
  let units = 0;
  items.forEach((item) => {
    if (kind === 'purchase') {
      amount += (item as Purchase).amount || 0;
      units += (item as Purchase).units || 0;
    } else if (kind === 'sale') {
      amount += (item as Sale).sellAmount || 0;
      units += (item as Sale).units || 0;
    } else if (kind === 'expense') amount += (item as Expense).amount || 0;
    else if (kind === 'loan') amount += (item as Loan).amount || 0;
    else amount += (item as Partner).capital || 0;
  });
  return { count: items.length, amount, units };
}

/** نص البحث الكامل للسجل (الاسم + البيان + الملاحظات + الفرع) */
export function archiveSearchText(
  kind: ArchiveItemKind,
  item: Purchase | Sale | Expense | Partner | Loan,
  ctx: ArchiveContext = {}
): string {
  const parts: string[] = [];
  if (kind === 'expense') {
    const e = item as Expense;
    parts.push(e.name, e.notes, e.target, expenseBearers(e), e.category, String(e.amount));
  } else if (kind === 'purchase') {
    const p = item as Purchase;
    parts.push(p.seller, p.notes, p.invoiceNo || '', String(p.amount));
  } else if (kind === 'sale') {
    const s = item as Sale;
    parts.push(s.buyer, s.notes, s.invoiceNo || '', String(s.sellAmount));
  } else if (kind === 'loan') {
    const l = item as Loan;
    parts.push(l.person, l.notes || '', l.phone || '', String(l.amount));
  } else {
    const p = item as Partner;
    parts.push(p.name, p.notes || '', p.phone || '', String(p.capital));
  }
  const branch = branchName((item as { branchId?: string }).branchId, ctx);
  if (branch) parts.push(branch);
  return parts.filter(Boolean).join(' ');
}
