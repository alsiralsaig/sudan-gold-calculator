/**
 * الإشعارات — منطق نقي قابل للاختبار (بلا React وبلا شبكة).
 *
 * نوعان من الإشعارات:
 *  1. إشعارات داخل التطبيق (مركز الإشعارات) — تعمل دائماً.
 *  2. إشعارات النظام (متصفح/جوال) عبر Service Worker + Web Push —
 *     تظهر حتى لو التطبيق مقفول (بشرط تفعيلها ومنح الإذن).
 *
 * كل بناء إشعار دوال نقية تُرجع كائن أو null، والتخزين والدمج في المتجر.
 */
import { Expense, Loan, Purchase, Sale } from '../types';
import { DueItem, DueSummary } from './reminders';
import { unitsToGhJ, fmtNum } from './format';

export type NotificationKind =
  | 'price'
  | 'sale'
  | 'purchase'
  | 'expense'
  | 'loan'
  | 'payment'
  | 'dues'
  | 'partner'
  | 'sync'
  | 'system';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'danger';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** وقت الحدث (ISO) */
  at: string;
  /** وقت القراءة — undefined = غير مقروء */
  readAt?: string;
  level: NotificationLevel;
  /** الشاشة التي يفتحها المستخدم عند الضغط */
  tab?: string;
  amount?: number;
  /** هل أُرسل كإشعار نظام (متصفح)؟ */
  pushed?: boolean;
  /** معرّف المنع (لمنع التكرار — مثل متأخرات نفس الفاتورة) */
  dedupeKey?: string;
}

export interface NotificationPrefs {
  /** إشعارات النظام (المتصفح/الجوال) */
  enabled: boolean;
  priceEnabled: boolean;
  /** نسبة تغيّر سعر عيار 21 التي تستحق إشعاراً */
  priceChangePercent: number;
  operationsEnabled: boolean;
  paymentsEnabled: boolean;
  duesEnabled: boolean;
  loansEnabled: boolean;
  /** ملخصات الشركاء */
  partnerDigestEnabled: boolean;
  /** أقصى عدد إشعارات محفوظة على الجهاز */
  keepMax: number;
  /** حد المبلغ لأهمية العملية (0 = كل العمليات) */
  minAmount: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  priceEnabled: true,
  priceChangePercent: 2,
  operationsEnabled: true,
  paymentsEnabled: true,
  duesEnabled: true,
  loansEnabled: true,
  partnerDigestEnabled: true,
  keepMax: 80,
  minAmount: 0,
};

/* ============================ أدوات عامة ============================ */

export function notificationId(prefix: string, seed: string | number): string {
  return `${prefix}-${String(seed)}`;
}

export function unreadCount(list: AppNotification[] = []): number {
  return (list || []).filter((n) => !n.readAt).length;
}

export function sortNotifications(list: AppNotification[] = []): AppNotification[] {
  return [...(list || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** كل مفاتيح إشعار واحد: المفتاح الثابت + المعرّف (للمطابقة الكاملة عند الحذف) */
export function notificationKeys(notification: AppNotification): string[] {
  const keys = new Set<string>();
  if (notification?.dedupeKey) keys.add(notification.dedupeKey);
  if (notification?.id) keys.add(notification.id);
  return Array.from(keys);
}

/** إضافة مفاتيح إلى سجل المحذوفات مع حد أقصى (الأحدث يُحتفظ بها) */
export function withDismissed(current: string[], keys: string[], keepMax = 400): string[] {
  const seen = new Set(current || []);
  (keys || []).forEach((k) => {
    if (k) seen.add(k);
  });
  const list = Array.from(seen);
  return list.length > keepMax ? list.slice(list.length - keepMax) : list;
}

export function pruneNotifications(list: AppNotification[] = [], keepMax = 80): AppNotification[] {
  return sortNotifications(list).slice(0, Math.max(5, keepMax));
}

export function markRead(list: AppNotification[], id: string, at = new Date().toISOString()): AppNotification[] {
  return (list || []).map((n) => (n.id === id && !n.readAt ? { ...n, readAt: at } : n));
}

/** المفتاح الموحّد لمنع تكرار الإشعار (dedupeKey إن وُجد وإلا المعرّف) */
export function notificationKey(notification: AppNotification): string {
  return notification?.dedupeKey || notification?.id || '';
}

export function markAllRead(list: AppNotification[], at = new Date().toISOString()): AppNotification[] {
  return (list || []).map((n) => (n.readAt ? n : { ...n, readAt: at }));
}

/** دمج إشعار جديد مع القائمة: يمنع التكرار بنفس dedupeKey ويحافظ على الحد الأقصى */
export function pushNotification(
  list: AppNotification[],
  notification: AppNotification,
  keepMax = 80,
  /** مفاتيح محذوفة نهائياً — لا يُعاد إشعار حُذف سابقاً أبداً */
  dismissed: string[] = []
): AppNotification[] {
  if (!notification) return list;
  const key = notificationKey(notification);
  if (key && dismissed.includes(key)) return list;
  // توافق: إشعارات قديمة حُذفت بمعرّفها قبل وجود المفاتيح الثابتة
  if (notification.id && dismissed.includes(notification.id)) return list;
  if (key && (list || []).some((n) => notificationKey(n) === key)) return list;
  if ((list || []).some((n) => n.id === notification.id)) return list;
  return pruneNotifications([notification, ...(list || [])], keepMax);
}

/** صياغة عربية للوقت النسبي */
export function relativeArabic(at: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(at).getTime();
  const minutes = Math.floor(diff / 60000);
  if (isNaN(minutes)) return '';
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days < 30) return `قبل ${days} يوماً`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'قبل شهر' : `قبل ${months} أشهر`;
}

/* ============================ بناء الإشعارات ============================ */

/** تغيّر سعر جرام عيار 21 — أهم إشعار للسوق */
export function priceNotification(
  previous: number,
  next: number,
  thresholdPercent: number,
  at: string = new Date().toISOString()
): AppNotification | null {
  if (!previous || !next || previous <= 0) return null;
  const change = ((next - previous) / previous) * 100;
  if (Math.abs(change) < Math.abs(thresholdPercent || 0)) return null;
  const up = change > 0;
  const rounded = Math.round(Math.abs(change) * 10) / 10;
  return {
    id: notificationId('price', `${previous}-${next}-${at.slice(0, 13)}`),
    kind: 'price',
    title: up ? `📈 ارتفاع سعر الذهب عيار 21 بنسبة ${rounded}%` : `📉 انخفاض سعر الذهب عيار 21 بنسبة ${rounded}%`,
    body: `السعر الآن ${fmtNum(next)} ج.س للجرام (كان ${fmtNum(previous)}). ${up ? 'وقت مناسب للبيع أو تحصيل الذمم.' : 'وقت مناسب للشراء أو التزويد.'}`,
    at,
    level: up ? 'success' : 'warning',
    tab: 'gold_price',
    amount: next,
    dedupeKey: `price:${Math.round(next)}`,
  };
}

function amountPasses(amount: number, minAmount: number): boolean {
  if (!minAmount || minAmount <= 0) return true;
  return (amount || 0) >= minAmount;
}

export function saleNotification(sale: Sale, at: string = new Date().toISOString()): AppNotification | null {
  const pending = (sale.sellAmount || 0) - (sale.paidAmount ?? sale.sellAmount ?? 0);
  const profit = (sale.sellAmount || 0) - (sale.buyAmount || 0);
  return {
    id: notificationId('sale', sale.id),
    kind: 'sale',
    title: `🧾 عملية بيع جديدة: ${fmtNum(sale.sellAmount)} ج.س`,
    body: `الزبون: ${sale.buyer || 'زبون عام'} • الوزن: ${unitsToGhJ(sale.units)} • العيار: ${sale.purity}k • الربح: ${fmtNum(profit)}${
      pending > 0 ? ` • آجل: ${fmtNum(pending)}` : ' • مدفوع بالكامل'
    }`,
    at,
    level: 'success',
    tab: 'sales',
    amount: sale.sellAmount || 0,
    dedupeKey: `sale:${sale.id}`,
  };
}

export function purchaseNotification(
  purchase: Purchase,
  at: string = new Date().toISOString()
): AppNotification | null {
  return {
    id: notificationId('purchase', purchase.id),
    kind: 'purchase',
    title: `🛍️ عملية شراء جديدة: ${fmtNum(purchase.amount)} ج.س`,
    body: `المورد: ${purchase.seller || 'بائع عام'} • الوزن: ${unitsToGhJ(purchase.units)} • العيار: ${purchase.purity}k${
      (purchase.pendingAmount || 0) > 0 ? ` • متبقٍ للسداد: ${fmtNum(purchase.pendingAmount)}` : ' • مدفوع بالكامل'
    }`,
    at,
    level: 'info',
    tab: 'purchases',
    amount: purchase.amount || 0,
    dedupeKey: `purchase:${purchase.id}`,
  };
}

export function expenseNotification(
  expense: Expense,
  at: string = new Date().toISOString()
): AppNotification | null {
  const isPrivate = Boolean(expense.target) && expense.target !== 'عام';
  return {
    id: notificationId('expense', expense.id),
    kind: 'expense',
    title: `💸 مصروف جديد: ${fmtNum(expense.amount)} ج.س`,
    body: `${expense.name} • ${isPrivate ? `مسحوبات ${expense.target}` : 'مصروف عام'}${
      expense.notes ? ` • ${expense.notes}` : ''
    }`,
    at,
    level: 'warning',
    tab: 'expenses',
    amount: expense.amount || 0,
    dedupeKey: `expense:${expense.id}`,
  };
}

export function loanNotification(loan: Loan, at: string = new Date().toISOString()): AppNotification | null {
  const isLent = loan.direction === 'lent';
  return {
    id: notificationId('loan', loan.id),
    kind: 'loan',
    title: isLent
      ? `🤝 سلفة جديدة لـ ${loan.person}: ${fmtNum(loan.amount)} ج.س`
      : `🤝 سلفة جديدة من ${loan.person}: ${fmtNum(loan.amount)} ج.س`,
    body: isLent
      ? `مبلغ خرج من الدرج وسيُرجَع لاحقاً — لا يؤثر على الربح${
          loan.dueDate ? ` • الاستحقاق بعد ${Math.max(0, Math.round((new Date(loan.dueDate).getTime() - Date.now()) / 86400000))} يوم` : ''
        }`
      : 'مبلغ دخل الدرج وسنرجعه لاحقاً — لا يؤثر على الربح',
    at,
    level: 'info',
    tab: 'loans',
    amount: loan.amount || 0,
    dedupeKey: `loan:${loan.id}`,
  };
}

export function paymentNotification(
  kind: 'sale' | 'purchase' | 'loan',
  party: string,
  amount: number,
  at: string = new Date().toISOString()
): AppNotification {
  const label =
    kind === 'sale' ? 'تحصيل من زبون' : kind === 'purchase' ? 'سداد لمورد' : 'سداد سلفة';
  return {
    id: notificationId('payment', `${kind}-${party}-${amount}-${at.slice(0, 16)}`),
    kind: 'payment',
    title: `💰 ${label}: ${fmtNum(amount)} ج.س`,
    body: `${party} • تم تحديث المتبقي في الحساب`,
    at,
    level: 'success',
    tab: kind === 'sale' ? 'sales' : kind === 'purchase' ? 'purchases' : 'loans',
    amount,
    dedupeKey: `payment:${kind}:${party}:${amount}:${at.slice(0, 16)}`,
  };
}

export function loanSettledNotification(loan: Loan, at: string = new Date().toISOString()): AppNotification {
  return {
    id: notificationId('loan-settled', loan.id),
    kind: 'loan',
    title: `✅ اكتمل سداد سلفة ${loan.person}`,
    body: `المبلغ ${fmtNum(loan.amount)} ج.س — نُقلت السجل إلى الأرشيف تلقائياً والربح لم يتأثر`,
    at,
    level: 'success',
    tab: 'loans',
    amount: loan.amount || 0,
  };
}

/** إشعارات المتأخرات — تُبنى من ملخص الاستحقاق، وتُمنع تكراراً بنفس اليوم */
export function dueNotifications(
  dues: DueSummary,
  now: Date = new Date()
): AppNotification[] {
  const day = now.toISOString().slice(0, 10);
  const items: DueItem[] = [...(dues?.overdue || []), ...(dues?.dueToday || [])];
  return items
    .slice(0, 8)
    .map((item) => {
      const overdue = item.status === 'overdue';
      return {
        id: notificationId('due', `${item.id}-${day}`),
        kind: 'dues' as NotificationKind,
        title: overdue
          ? `⏰ متأخر ${item.daysOverdue} يوم على ${item.party}`
          : `🔔 يستحق اليوم على ${item.party}`,
        body: `${item.source === 'loan' ? 'سلفة' : item.kind === 'receivable' ? 'فاتورة بيع آجلة' : 'فاتورة شراء آجلة'} بمبلغ ${fmtNum(
          item.amount
        )} ج.س${item.phone ? ` • هاتف: ${item.phone}` : ''}`,
        at: now.toISOString(),
        level: overdue ? ('danger' as NotificationLevel) : ('warning' as NotificationLevel),
        tab: 'reminders',
        amount: item.amount,
        dedupeKey: `due:${item.id}:${day}`,
      };
    });
}

/** إشعار ملخص الأعمال (للشركاء) */
export function digestNotification(input: {
  salesAmount: number;
  profit: number;
  expenses: number;
  net: number;
  duesTotal: number;
  loansOutstanding: number;
  dateLabel: string;
  at?: string;
}): AppNotification {
  const at = input.at || new Date().toISOString();
  return {
    id: notificationId('digest', input.dateLabel),
    kind: 'partner',
    title: `📊 ملخص ${input.dateLabel}`,
    body: `المبيعات ${fmtNum(input.salesAmount)} • الربح ${fmtNum(input.profit)} • المصروفات ${fmtNum(
      input.expenses
    )} • الصافي ${fmtNum(input.net)} • ذمم ${fmtNum(input.duesTotal)} • سلف ${fmtNum(input.loansOutstanding)}`,
    at,
    level: 'info',
    tab: 'reports',
  };
}

/** إشعار واحد مختصر عند وصول دفعة عمليات كبيرة من جهاز آخر (بدل طوفان إشعارات) */
export function batchSyncNotification(
  counts: { sales: number; purchases: number; expenses: number; loans: number },
  at: string = new Date().toISOString()
): AppNotification {
  const parts: string[] = [];
  if (counts.sales) parts.push(`${counts.sales} بيع`);
  if (counts.purchases) parts.push(`${counts.purchases} شراء`);
  if (counts.expenses) parts.push(`${counts.expenses} مصروف`);
  if (counts.loans) parts.push(`${counts.loans} سلفة`);
  const total = counts.sales + counts.purchases + counts.expenses + counts.loans;
  return {
    id: notificationId('sync-batch', at.slice(0, 13)),
    kind: 'sync',
    title: `🔄 وصلت ${total} عملية جديدة من جهاز آخر`,
    body: `${parts.join(' • ')} — فتحت السجلات ومراجعتها من قسم الحسابات`,
    at,
    level: 'info',
    tab: 'dashboard',
    // مفتاح لكل ساعة: لا يتكرر نفس الإشعار عند كل مزامنة
    dedupeKey: `syncbatch:${at.slice(0, 13)}`,
  };
}

export function syncNotification(message: string, level: NotificationLevel = 'warning'): AppNotification {
  const at = new Date().toISOString();
  return {
    id: notificationId('sync', at.slice(0, 16)),
    kind: 'sync',
    title: '☁️ مزامنة الحسابات',
    body: message,
    at,
    level,
    tab: 'settings',
  };
}

/* ============================ ملخص الشركاء ============================ */

export interface PartnerDigestInput {
  storeName: string;
  periodLabel: string;
  salesAmount: number;
  profit: number;
  expenses: number;
  net: number;
  capital: number;
  partners: { name: string; percent: number; netShare: number }[];
  duesTotal: number;
  loansOutstanding: number;
  price21: number;
}

/** نص جاهز للإرسال للشركاء على واتساب */
export function partnerDigestText(input: PartnerDigestInput): string {
  const lines: string[] = [];
  lines.push(`*${input.storeName}*`);
  lines.push(`*ملخص الشركاء — ${input.periodLabel}*`);
  lines.push('—————————————');
  lines.push(`المبيعات: ${fmtNum(input.salesAmount)} ج.س`);
  lines.push(`الربح الإجمالي: ${fmtNum(input.profit)} ج.س`);
  lines.push(`المصروفات العامة: ${fmtNum(input.expenses)} ج.س`);
  lines.push(`صافي الربح: ${fmtNum(input.net)} ج.س`);
  lines.push(`رأس المال: ${fmtNum(input.capital)} ج.س`);
  if (input.partners.length > 0) {
    lines.push('—————————————');
    lines.push('*نصيب كل شريك:*');
    input.partners.forEach((p) => {
      lines.push(`• ${p.name} (${p.percent}%): ${fmtNum(p.netShare)} ج.س`);
    });
  }
  lines.push('—————————————');
  lines.push(`ذمم على الزبائن: ${fmtNum(input.duesTotal)} ج.س`);
  if (input.loansOutstanding !== 0) {
    lines.push(`سلف قائمة: ${fmtNum(input.loansOutstanding)} ج.س`);
  }
  lines.push(`سعر جرام عيار 21 الآن: ${fmtNum(input.price21)} ج.س`);
  lines.push('');
  lines.push('_إشعار آلي من تطبيق حاسبة الذهب_');
  return lines.join('\n');
}

/** نص ملخص إشعار النظام القصير */
export function systemNotificationPayload(n: AppNotification): { title: string; body: string } {
  return { title: `${n.title}`, body: n.body };
}
