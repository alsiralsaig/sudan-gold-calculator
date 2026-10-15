import { Expense, GoldRates, Partner, Purchase, Sale } from '../types';
import { K21_FINENESS, purityToFineness, toK21Ratio, unitsToK21 } from './purity';

export const UNITS_PER_GRAM = 100;

export interface KaratStock {
  purity: number; // القيمة كما أُدخلت (عيار أو نقاوة)
  units: number; // الوحدات الخام
  grams: number;
  unitsK21: number; // معادل عيار 21
}

export interface Inventory {
  /** إجمالي الوحدات الخام (مجموع كل العيارات) - للعرض فقط */
  totalUnits: number;
  totalGrams: number;
  /** معادل عيار 21 — هذا هو الأساس في التسعير */
  unitsK21: number;
  gramsK21: number;
  /** تكلفة المخزون المتبقي */
  costBasis: number;
  /** القيمة السوقية بأسعار اليوم (على أساس عيار 21) */
  marketValue: number;
  /** ربح غير محقّق تقديري = القيمة السوقية - التكلفة */
  unrealizedProfit: number;
  /** متوسط تكلفة جرام معادل 21 */
  avgCostPerGramK21: number;
  byKarat: KaratStock[];
  /** عيارات ظهر فيها عجز (بيع أكثر من الشراء) */
  negativeKarats: number[];
  hasData: boolean;
}

export interface Financials {
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  generalExpenses: number;
  privateExpenses: number;
  netProfit: number;
  /** المتبقي على الزبائن (ذمم مدينة) */
  receivables: number;
  /** المتبقي للبائعين (ذمم دائنة) */
  payables: number;
  totalCapital: number;
  activePurchasesCount: number;
  activeSalesCount: number;
  activeExpensesCount: number;
  archivedCount: number;
  profitMarginPercent: number;
  /** عدد عمليات البيع الآجل غير المسددة */
  openCreditSales: number;
}

export interface PartnerShare {
  partner: Partner;
  profitShare: number;
  privateExpenses: number;
  /** نصيب هذا الشريك من المنصرفات العامة (بالتسمية أو بنسبة الربح) */
  generalExpenses: number;
  netShare: number;
  capitalPercent: number;
  /** عدد عمليات المسحوبات الخاصة لهذا الشريك */
  privateExpensesCount: number;
}

function active<T extends { archived?: boolean }>(rows: T[] | undefined): T[] {
  return (rows || []).filter((r) => !r.archived);
}

/** المبلغ المتبقي على الزبون في عملية بيع */
export function salePending(sale: Sale): number {
  if (typeof sale.pendingAmount === 'number') return Math.max(0, sale.pendingAmount);
  const paid = typeof sale.paidAmount === 'number' ? sale.paidAmount : (sale.sellAmount || 0);
  return Math.max(0, (sale.sellAmount || 0) - paid);
}

/** المبلغ المتبقي للبائع في عملية شراء */
export function purchasePending(purchase: Purchase): number {
  if (typeof purchase.pendingAmount === 'number') return Math.max(0, purchase.pendingAmount);
  const paid = (purchase.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  return Math.max(0, (purchase.amount || 0) - paid);
}

/**
 * حساب المخزون: لكل عيار على حدة، مع معادل عيار 21 (أساس التسعير الرسمي).
 */
export function computeInventory(
  purchases: Purchase[],
  sales: Sale[],
  rates?: GoldRates
): Inventory {
  const activePurchases = active(purchases);
  const activeSales = active(sales);

  const unitsByPurity = new Map<number, number>();
  const add = (purity: number, units: number) => {
    // المفتاح = النقاوة بالألف بدقة منزلتين حتى لا يتشوّه العيار عند التدوير
    const key = Math.round(purityToFineness(purity) * 100) / 100;
    unitsByPurity.set(key, (unitsByPurity.get(key) || 0) + units);
  };

  activePurchases.forEach((p) => add(p.purity, p.units || 0));
  activeSales.forEach((s) => add(s.purity, -(s.units || 0)));

  const byKarat: KaratStock[] = [];
  let totalUnits = 0;
  let unitsK21 = 0;
  const negativeKarats: number[] = [];

  Array.from(unitsByPurity.entries())
    .sort((a, b) => b[0] - a[0])
    .forEach(([fineness, units]) => {
      const rounded = Math.round(units * 1000) / 1000;
      if (Math.abs(rounded) < 0.001) return;
      const karat = (fineness / 1000) * 24;
      byKarat.push({
        purity: Math.round(karat * 100) / 100,
        units: rounded,
        grams: rounded / UNITS_PER_GRAM,
        unitsK21: unitsToK21(rounded, fineness),
      });
      totalUnits += rounded;
      unitsK21 += unitsToK21(rounded, fineness);
      if (rounded < -0.001) negativeKarats.push(Math.round(karat * 100) / 100);
    });

  let costBasis = 0;
  activePurchases.forEach((p) => {
    costBasis += p.amount || 0;
  });
  activeSales.forEach((s) => {
    costBasis -= s.buyAmount || 0;
  });
  costBasis = Math.max(0, costBasis);

  const price21 = rates?.karat21 || 0;
  const gramsK21 = unitsK21 / UNITS_PER_GRAM;
  const marketValue = gramsK21 * price21;
  const unrealizedProfit = marketValue - costBasis;

  return {
    totalUnits,
    totalGrams: totalUnits / UNITS_PER_GRAM,
    unitsK21,
    gramsK21,
    costBasis,
    marketValue,
    unrealizedProfit,
    avgCostPerGramK21: gramsK21 > 0 ? costBasis / gramsK21 : 0,
    byKarat,
    negativeKarats,
    hasData: byKarat.length > 0,
  };
}

export function computeFinancials(
  purchases: Purchase[],
  sales: Sale[],
  expenses: Expense[],
  partners: Partner[]
): Financials {
  const activeSales = active(sales);
  const activePurchases = active(purchases);
  const activeExpenses = active(expenses);
  const activePartners = active(partners);

  const totalSales = activeSales.reduce((sum, s) => sum + (s.sellAmount || 0), 0);
  const totalCost = activeSales.reduce((sum, s) => sum + (s.buyAmount || 0), 0);
  const grossProfit = totalSales - totalCost;

  const generalExpenses = activeExpenses
    .filter((e) => e.target === 'عام' || !e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const privateExpenses = activeExpenses
    .filter((e) => e.target !== 'عام' && Boolean(e.target))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const receivables = activeSales.reduce((sum, s) => sum + salePending(s), 0);
  const payables = activePurchases.reduce((sum, p) => sum + purchasePending(p), 0);

  const archivedCount =
    (purchases || []).filter((p) => p.archived).length +
    (sales || []).filter((s) => s.archived).length +
    (expenses || []).filter((e) => e.archived).length +
    (partners || []).filter((p) => p.archived).length;

  return {
    totalSales,
    totalCost,
    grossProfit,
    generalExpenses,
    privateExpenses,
    /**
     * صافي الربح = إجمالي الربح. المنصرفات العامة **ما تُخصم هنا** لأنها
     * مُوزّعة على الشركاء بالاسم وتُخصم من صافي المستحق لكل شريك — وإلا
     * اتحسبت مرتين (مرة في الوعاء ومرة على الشريك).
     */
    netProfit: grossProfit,
    receivables,
    payables,
    totalCapital: activePartners.reduce((sum, p) => sum + (p.capital || 0), 0),
    activePurchasesCount: activePurchases.length,
    activeSalesCount: activeSales.length,
    activeExpensesCount: activeExpenses.length,
    archivedCount,
    profitMarginPercent: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
    openCreditSales: activeSales.filter((s) => salePending(s) > 0).length,
  };
}

/**
 * تجهيز رقم الربح للعرض — **الربح ما ينفعش يكون بالسالب**.
 *
 * القاعدة: لو النتيجة سالبة فدي «خسارة» — تُعرض موجبة وباللون الأحمر، لأن رقم
 * سالب تحت عنوان «ربح» مستحيل. والخسارة تتوزّع على الشركاء بنسب الربح،
 * فكل شريك يشوف «نصيب الخسارة» موجباً.
 *
 * القيمة الأصلية بإشارتها محفوظة في `signed` للحسابات، و`amount` دايماً ≥ 0 للعرض.
 */
export interface ProfitDisplay {
  /** الرقم كما يُعرض — دايماً موجب أو صفر */
  amount: number;
  /** ربح أم خسارة */
  kind: 'profit' | 'loss';
  /** التسمية الصحيحة: «صافي الربح» أو «صافي الخسارة» */
  label: string;
  /** القيمة الموقّعة كما تُستخدم في الحساب */
  signed: number;
  /** توضيح سبب الخسارة */
  note?: string;
}

const n = (v: number) => Math.round(v).toLocaleString('en');

export function profitDisplay(input: { netProfit: number }): ProfitDisplay {
  const { netProfit } = input;

  if (netProfit < 0) {
    return {
      amount: Math.abs(netProfit),
      kind: 'loss',
      label: 'صافي الخسارة',
      signed: netProfit,
      note: `تكلفة المبيعات أكبر من قيمتها — الخسارة (${n(
        Math.abs(netProfit)
      )}) تتوزّع على الشركاء بنسب الربح`,
    };
  }

  return { amount: netProfit, kind: 'profit', label: 'صافي الربح', signed: netProfit };
}

/**
 * توزيع المنصرفات العامة على الشركاء — **نفس نظام المنصرف الخاص** لكن لأكتر من شريك.
 *
 * كل منصرف عام يتحدد عليه الشركاء الذين يتحمّلونه (Expense.partnerNames):
 *  - لو محددين (شريك أو أكتر) → المبلغ يتقسم بينهم بنسب الربح،
 *    ولو نسبهم صفر يتقسم بينهم بالتساوي.
 *  - لو ما محددش حد (منصرف قديم) → يتوزّع على كل الشركاء بنسب الربح.
 *
 * الناتج: { اسم الشريك → المبلغ الذي يُخصم منه }
 */
export function allocateGeneralExpenses(
  expenses: Expense[],
  partners: Partner[]
): Record<string, number> {
  const out: Record<string, number> = {};
  const activePartners = active(partners);
  if (activePartners.length === 0) return out;

  const activeExpenses = active(expenses).filter(
    (e) => e.target === 'عام' || !e.target
  );

  for (const e of activeExpenses) {
    const amount = e.amount || 0;
    if (amount === 0) continue;

    // الشركاء المحددين على المنصرف — ولو ما فيش، كل الشركاء
    const picked = (e.partnerNames || [])
      .map((n) => activePartners.find((p) => p.name === n))
      .filter((p): p is Partner => Boolean(p));
    const bearers = picked.length > 0 ? picked : activePartners;

    // الوزن = نسبة الربح، ولو كل النسب صفر → بالتساوي
    const weights = bearers.map((p) => Math.max(0, p.profitPercent || 0));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let assigned = 0;
    bearers.forEach((p, i) => {
      const w = totalWeight > 0 ? weights[i] / totalWeight : 1 / bearers.length;
      // آخر شريك يستلم الباقي عشان الكسور ما تضيعش
      const share =
        i === bearers.length - 1 ? amount - assigned : Math.round(amount * w);
      assigned += share;
      out[p.name] = (out[p.name] || 0) + share;
    });
  }

  return out;
}

export function partnerShares(
  partners: Partner[],
  expenses: Expense[],
  netProfit: number,
  totalCapital: number
): PartnerShare[] {
  const activePartners = active(partners);
  const activeExpenses = active(expenses);
  const generalAllocation = allocateGeneralExpenses(expenses, partners);

  return activePartners.map((partner) => {
    const profitShare = (netProfit * (partner.profitPercent || 0)) / 100;
    const partnerExpenses = activeExpenses.filter((e) => e.target === partner.name);
    const privExp = partnerExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const genExp = generalAllocation[partner.name] || 0;
    return {
      partner,
      profitShare,
      privateExpenses: privExp,
      generalExpenses: genExp,
      privateExpensesCount: partnerExpenses.length,
      netShare: profitShare - privExp - genExp,
      capitalPercent: totalCapital > 0 ? ((partner.capital || 0) / totalCapital) * 100 : 0,
    };
  });
}

export interface PeriodSummary {
  purchasesCount: number;
  purchasesUnits: number;
  purchasesAmount: number;
  salesCount: number;
  salesUnits: number;
  salesAmount: number;
  salesCost: number;
  profit: number;
  expenses: number;
  net: number;
  collected: number;
  credit: number;
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= from && d <= to;
}

export function summarizeRange(
  purchases: Purchase[],
  sales: Sale[],
  expenses: Expense[],
  from: Date,
  to: Date
): PeriodSummary {
  const inPurchases = active(purchases).filter((p) => inRange(p.date, from, to));
  const inSales = active(sales).filter((s) => inRange(s.date, from, to));
  const inExpenses = active(expenses).filter((e) => inRange(e.date, from, to));

  const salesAmount = inSales.reduce((sum, s) => sum + (s.sellAmount || 0), 0);
  const salesCost = inSales.reduce((sum, s) => sum + (s.buyAmount || 0), 0);
  const expAmount = inExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = salesAmount - salesCost;

  return {
    purchasesCount: inPurchases.length,
    purchasesUnits: inPurchases.reduce((sum, p) => sum + (p.units || 0), 0),
    purchasesAmount: inPurchases.reduce((sum, p) => sum + (p.amount || 0), 0),
    salesCount: inSales.length,
    salesUnits: inSales.reduce((sum, s) => sum + (s.units || 0), 0),
    salesAmount,
    salesCost,
    profit,
    expenses: expAmount,
    net: profit - expAmount,
    collected: inSales.reduce((sum, s) => sum + ((s.sellAmount || 0) - salePending(s)), 0),
    credit: inSales.reduce((sum, s) => sum + salePending(s), 0),
  };
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** النقاوة المرجعية الرسمية للتداول */
export const OFFICIAL_KARAT = 21;
export const OFFICIAL_FINENESS = K21_FINENESS;

export { toK21Ratio, purityToFineness, unitsToK21 };
