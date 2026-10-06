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
  netShare: number;
  capitalPercent: number;
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
    netProfit: grossProfit - generalExpenses,
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

export function partnerShares(
  partners: Partner[],
  expenses: Expense[],
  netProfit: number,
  totalCapital: number
): PartnerShare[] {
  const activePartners = active(partners);
  const activeExpenses = active(expenses);

  return activePartners.map((partner) => {
    const profitShare = (netProfit * (partner.profitPercent || 0)) / 100;
    const privExp = activeExpenses
      .filter((e) => e.target === partner.name)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    return {
      partner,
      profitShare,
      privateExpenses: privExp,
      netShare: profitShare - privExp,
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
