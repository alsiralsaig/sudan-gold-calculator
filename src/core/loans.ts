/**
 * السلف النقدية (الديون بين الأشخاص) — منطق نقي قابل للاختبار.
 *
 * القاعدة المحاسبية:
 *  - السلفة ليست مصروفاً ولا إيراداً ⇒ لا تدخل في حساب الربح إطلاقاً.
 *  - الإقراض: النقد ينقص وذمة «لنا» تزيد.
 *  - السداد: النقد يزيد وذمة «لنا» تنقص (بدون أي قيد ربح).
 *  - الاستلاف (علينا): العكس تماماً.
 */
import { Loan, LoanDirection, Payment } from '../types';
import { daysBetween, relativeDays, startOfDay } from './dates';
import { DueItem, DueStatus, statusOf } from './reminders';

export const LOAN_LABELS: Record<LoanDirection, string> = {
  lent: 'لنا على الآخرين',
  borrowed: 'علينا للآخرين',
};

export const LOAN_DIRECTION_HINT: Record<LoanDirection, string> = {
  lent: 'سلّفنا شخصاً — مبلغ يُنتظر رجوعه',
  borrowed: 'استلفنا من شخص — مبلغ علينا سداده',
};

/** فروق أقل من نصف جنيه تُعتبر صفراً (كسور التقريب) */
const EPSILON = 0.5;

/** إجمالي ما سُدِّد من السلفة */
export function loanPaid(loan: Loan): number {
  return (loan.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
}

/** المتبقي على السلفة */
export function loanPending(loan: Loan): number {
  const pending = (loan.amount || 0) - loanPaid(loan);
  return pending > EPSILON ? pending : 0;
}

/** هل اكتمل السداد؟ */
export function isLoanSettled(loan: Loan): boolean {
  return loanPending(loan) <= 0;
}

/** نسبة السداد (0–100) */
export function loanProgress(loan: Loan): number {
  const amount = loan.amount || 0;
  if (amount <= 0) return 100;
  const percent = (loanPaid(loan) / amount) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export type LoanSummary = {
  /** إجمالي المتبقي لنا على الآخرين */
  lentOutstanding: number;
  /** إجمالي المتبقي علينا للآخرين */
  borrowedOutstanding: number;
  /** صافي المركز: لنا − علينا (موجب = لنا) */
  netOutstanding: number;
  /** إجمالي ما سلّفناه (المبالغ الأصلية) */
  lentTotal: number;
  borrowedTotal: number;
  openCount: number;
  settledCount: number;
  lentCount: number;
  borrowedCount: number;
  /** نسبة المُسدَّد من إجمالي السلف */
  collectedPercent: number;
};

/** ملخص السلف النشطة (غير المؤرشفة) */
export function summarizeLoans(loans: Loan[] = []): LoanSummary {
  const activeLoans = (loans || []).filter((l) => !l.archived);
  const lent = activeLoans.filter((l) => l.direction === 'lent');
  const borrowed = activeLoans.filter((l) => l.direction === 'borrowed');

  const lentOutstanding = lent.reduce((sum, l) => sum + loanPending(l), 0);
  const borrowedOutstanding = borrowed.reduce((sum, l) => sum + loanPending(l), 0);
  const lentTotal = lent.reduce((sum, l) => sum + (l.amount || 0), 0);
  const borrowedTotal = borrowed.reduce((sum, l) => sum + (l.amount || 0), 0);
  const repaid = lent.reduce((sum, l) => sum + loanPaid(l), 0);

  return {
    lentOutstanding,
    borrowedOutstanding,
    netOutstanding: lentOutstanding - borrowedOutstanding,
    lentTotal,
    borrowedTotal,
    openCount: activeLoans.filter((l) => loanPending(l) > 0).length,
    settledCount: (loans || []).filter((l) => l.archived).length,
    lentCount: lent.length,
    borrowedCount: borrowed.length,
    collectedPercent: lentTotal > 0 ? Math.round((repaid / lentTotal) * 100) : 0,
  };
}

export interface LoanDueItem extends DueItem {
  source: 'loan';
  direction: LoanDirection;
  paid: number;
  progress: number;
}

export interface LoanDueSummary {
  items: LoanDueItem[];
  overdue: LoanDueItem[];
  dueToday: LoanDueItem[];
  upcoming: LoanDueItem[];
  withoutDate: LoanDueItem[];
  receivablesTotal: number;
  payablesTotal: number;
  overdueTotal: number;
}

const ORDER: Record<DueStatus, number> = { overdue: 0, today: 1, soon: 2, later: 3, nodate: 4 };

/**
 * سلف لم تُسدَّد بعد، مع تصنيف الاستحقاق — بنفس شكل ذمم المبيعات والمشتريات
 * حتى تُدمج معها في شاشة التنبيهات.
 */
export function computeLoanDues(
  loans: Loan[] = [],
  today: Date = new Date(),
  soonDays = 7
): LoanDueSummary {
  const base = startOfDay(today);
  const items: LoanDueItem[] = [];

  (loans || []).forEach((loan) => {
    if (loan.archived) return;
    const pending = loanPending(loan);
    if (pending <= 0) return;
    const daysOverdue = loan.dueDate ? daysBetween(loan.dueDate, base) : 0;
    items.push({
      id: loan.id,
      kind: loan.direction === 'lent' ? 'receivable' : 'payable',
      source: 'loan',
      direction: loan.direction,
      party: loan.person || 'غير محدد',
      phone: loan.phone,
      amount: pending,
      total: loan.amount || 0,
      date: loan.date,
      dueDate: loan.dueDate,
      daysOverdue,
      status: statusOf(daysOverdue, Boolean(loan.dueDate), soonDays),
      notes: loan.notes,
      paid: loanPaid(loan),
      progress: loanProgress(loan),
    });
  });

  items.sort((a, b) => {
    const orderDiff = ORDER[a.status] - ORDER[b.status];
    if (orderDiff !== 0) return orderDiff;
    if (a.status === 'overdue' && b.status === 'overdue') return b.daysOverdue - a.daysOverdue;
    return (b.amount || 0) - (a.amount || 0);
  });

  const receivablesTotal = items
    .filter((i) => i.kind === 'receivable')
    .reduce((sum, i) => sum + i.amount, 0);
  const payablesTotal = items.filter((i) => i.kind === 'payable').reduce((sum, i) => sum + i.amount, 0);

  return {
    items,
    overdue: items.filter((i) => i.status === 'overdue'),
    dueToday: items.filter((i) => i.status === 'today'),
    upcoming: items.filter((i) => i.status === 'soon' || i.status === 'later'),
    withoutDate: items.filter((i) => i.status === 'nodate'),
    receivablesTotal,
    payablesTotal,
    overdueTotal: items
      .filter((i) => i.status === 'overdue')
      .reduce((sum, i) => sum + i.amount, 0),
  };
}

/** سطر وصف قصير لحالة السلفة */
export function loanStatusLabel(loan: Loan): string {
  const pending = loanPending(loan);
  if (pending <= 0) {
    const when = loan.payments?.length ? loan.payments[loan.payments.length - 1].date : loan.date;
    return `مسددة — ${relativeDays(daysBetween(when, startOfDay(new Date())))}`;
  }
  if (!loan.dueDate) return `متبقٍ ${Math.round(pending).toLocaleString('en-US')}`;
  const days = daysBetween(loan.dueDate, startOfDay(new Date()));
  if (days > 0) return `متأخرة ${relativeDays(-days)}`;
  if (days === 0) return 'تستحق اليوم';
  return `تستحق ${relativeDays(days)}`;
}

export const loanCurrencyHint = (direction: LoanDirection): string =>
  direction === 'lent' ? 'مبلغ خرج من الدرج — سيُرجَع لاحقاً' : 'مبلغ دخل الدرج — سنُرجِعه لاحقاً';

/** نص مشاركة السلفة على واتساب */
export function loanText(loan: Loan, storeName: string, currency = 'ج.س'): string {
  const isLent = loan.direction === 'lent';
  const pending = loanPending(loan);
  const paid = loanPaid(loan);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const lines: string[] = [];
  lines.push(`*${storeName}*`);
  lines.push(isLent ? '*سلفة — لنا على الآخرين*' : '*سلفة — علينا للآخرين*');
  lines.push('—————————————');
  lines.push(`الاسم: ${loan.person}`);
  lines.push(`المبلغ الأصلي: ${fmt(loan.amount)} ${currency}`);
  if (paid > 0) lines.push(`المسدَّد: ${fmt(paid)} ${currency}`);
  lines.push(`المتبقي: ${fmt(pending)} ${currency}`);
  if (loan.dueDate) lines.push(`تاريخ الاستحقاق: ${relativeDays(daysBetween(loan.dueDate, startOfDay(new Date())))}`);
  if (loan.notes) lines.push(`ملاحظات: ${loan.notes}`);
  lines.push('—————————————');
  lines.push(isLent ? 'نرجو التكرم بالسداد عند الاستحقاق 🙏' : 'سنحرص على السداد في الموعد بإذن الله 🤝');
  return lines.join('\n');
}

/** إشعار استلام دفعة سداد */
export function loanReceiptText(
  loan: Loan,
  payment: Omit<Payment, 'id'>,
  storeName: string,
  currency = 'ج.س'
): string {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const remaining = Math.max(0, loanPending(loan) - (payment.amount || 0));
  const lines: string[] = [];
  lines.push(`*${storeName}*`);
  lines.push(loan.direction === 'lent' ? '*إشعار استلام دفعة*' : '*إشعار سداد دفعة*');
  lines.push('—————————————');
  lines.push(`الاسم: ${loan.person}`);
  lines.push(`المبلغ المستلم: ${fmt(payment.amount)} ${currency}`);
  lines.push(`المتبقي بعد هذه الدفعة: ${fmt(remaining)} ${currency}`);
  if (remaining <= 0) lines.push('✅ تم السداد بالكامل — شكراً لك');
  if (payment.note) lines.push(`ملاحظة: ${payment.note}`);
  return lines.join('\n');
}
