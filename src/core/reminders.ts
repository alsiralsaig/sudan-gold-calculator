import { Purchase, Sale } from '../types';
import { purchasePending, salePending } from './accounting';
import { daysBetween, startOfDay, toDateInputValue } from './dates';

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later' | 'nodate';

export interface DueItem {
  id: string;
  /** receivable = لنا عند الزبون / payable = علينا للمورد */
  kind: 'receivable' | 'payable';
  /** مصدر الاستحقاق: فاتورة بيع، فاتورة شراء، أو سلفة */
  source?: 'sale' | 'purchase' | 'loan';
  party: string;
  phone?: string;
  amount: number;
  total: number;
  date: string;
  dueDate?: string;
  /** موجب = متأخر بعدد أيام، صفر = يستحق اليوم، سالب = لم يستحق بعد */
  daysOverdue: number;
  status: DueStatus;
  notes?: string;
}

export interface DueSummary {
  items: DueItem[];
  overdue: DueItem[];
  dueToday: DueItem[];
  upcoming: DueItem[];
  withoutDate: DueItem[];
  receivablesTotal: number;
  payablesTotal: number;
  overdueTotal: number;
}

const SOON_DAYS = 7;

export function statusOf(daysOverdue: number, hasDueDate: boolean, soonDays = SOON_DAYS): DueStatus {
  if (!hasDueDate) return 'nodate';
  if (daysOverdue > 0) return 'overdue';
  if (daysOverdue === 0) return 'today';
  if (Math.abs(daysOverdue) <= soonDays) return 'soon';
  return 'later';
}

const ORDER: Record<DueStatus, number> = { overdue: 0, today: 1, soon: 2, later: 3, nodate: 4 };

/**
 * يستخرج المتأخرات: ذمم الزبائن (لنا) والديون للموردين (علينا).
 * @param today تاريخ "اليوم" — يُمرَّر للاختبارات
 */
export function computeDues(
  sales: Sale[],
  purchases: Purchase[],
  today: Date = new Date(),
  soonDays = SOON_DAYS
): DueSummary {
  const base = startOfDay(today);
  const items: DueItem[] = [];

  (sales || []).forEach((sale) => {
    if (sale.archived) return;
    const pending = salePending(sale);
    if (pending <= 0) return;
    const daysOverdue = sale.dueDate ? daysBetween(sale.dueDate, base) : 0;
    items.push({
      id: sale.id,
      kind: 'receivable',
      source: 'sale',
      party: sale.buyer || 'زبون عام',
      phone: sale.buyerPhone,
      amount: pending,
      total: sale.sellAmount || 0,
      date: sale.date,
      dueDate: sale.dueDate,
      daysOverdue,
      status: statusOf(daysOverdue, Boolean(sale.dueDate), soonDays),
      notes: sale.notes,
    });
  });

  (purchases || []).forEach((purchase) => {
    if (purchase.archived) return;
    const pending = purchasePending(purchase);
    if (pending <= 0) return;
    const daysOverdue = purchase.dueDate ? daysBetween(purchase.dueDate, base) : 0;
    items.push({
      id: purchase.id,
      kind: 'payable',
      source: 'purchase',
      party: purchase.seller || 'مورد عام',
      phone: purchase.sellerPhone,
      amount: pending,
      total: purchase.amount || 0,
      date: purchase.date,
      dueDate: purchase.dueDate,
      daysOverdue,
      status: statusOf(daysOverdue, Boolean(purchase.dueDate), soonDays),
      notes: purchase.notes,
    });
  });

  items.sort((a, b) => {
    const byStatus = ORDER[a.status] - ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.status === 'overdue') return b.daysOverdue - a.daysOverdue;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return b.amount - a.amount;
  });

  const overdue = items.filter((i) => i.status === 'overdue');
  const dueToday = items.filter((i) => i.status === 'today');
  const upcoming = items.filter((i) => i.status === 'soon' || i.status === 'later');
  const withoutDate = items.filter((i) => i.status === 'nodate');

  return {
    items,
    overdue,
    dueToday,
    upcoming,
    withoutDate,
    receivablesTotal: items.filter((i) => i.kind === 'receivable').reduce((s, i) => s + i.amount, 0),
    payablesTotal: items.filter((i) => i.kind === 'payable').reduce((s, i) => s + i.amount, 0),
    overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
  };
}

/** اقتراح تاريخ استحقاق افتراضي (بعد 30 يوماً) */
export function suggestedDueDate(from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 30);
  // بالتوقيت المحلي — toISOString (UTC) كان يُنقص يوماً في السودان بين 12 و2 بعد منتصف الليل
  return toDateInputValue(d);
}

/**
 * دمج ملخصات الاستحقاق (المبيعات/المشتريات + السلف) في ملخص واحد
 * حتى تظهر كلها في شاشة التنبيهات وشارة الجرس بدون تكرار المنطق.
 */
export function mergeDueSummaries(...summaries: DueSummary[]): DueSummary {
  const valid = (summaries || []).filter(Boolean);
  if (valid.length === 0) {
    return {
      items: [],
      overdue: [],
      dueToday: [],
      upcoming: [],
      withoutDate: [],
      receivablesTotal: 0,
      payablesTotal: 0,
      overdueTotal: 0,
    };
  }
  if (valid.length === 1) return valid[0];

  const items = valid.flatMap((s) => s.items || []);
  const order: Record<DueStatus, number> = { overdue: 0, today: 1, soon: 2, later: 3, nodate: 4 };
  items.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    if (a.status === 'overdue' && b.status === 'overdue') return b.daysOverdue - a.daysOverdue;
    return (b.amount || 0) - (a.amount || 0);
  });

  return {
    items,
    overdue: items.filter((i) => i.status === 'overdue'),
    dueToday: items.filter((i) => i.status === 'today'),
    upcoming: items.filter((i) => i.status === 'soon' || i.status === 'later'),
    withoutDate: items.filter((i) => i.status === 'nodate'),
    receivablesTotal: valid.reduce((sum, s) => sum + (s.receivablesTotal || 0), 0),
    payablesTotal: valid.reduce((sum, s) => sum + (s.payablesTotal || 0), 0),
    overdueTotal: valid.reduce((sum, s) => sum + (s.overdueTotal || 0), 0),
  };
}
