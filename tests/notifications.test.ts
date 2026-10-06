import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AppNotification,
  DEFAULT_NOTIFICATION_PREFS,
  batchSyncNotification,
  digestNotification,
  dueNotifications,
  expenseNotification,
  loanNotification,
  loanSettledNotification,
  markAllRead,
  markRead,
  notificationId,
  notificationKey,
  notificationKeys,
  partnerDigestText,
  paymentNotification,
  priceNotification,
  pruneNotifications,
  purchaseNotification,
  pushNotification,
  relativeArabic,
  saleNotification,
  sortNotifications,
  unreadCount,
  withDismissed,
} from '../src/core/notifications';
import { computeDues } from '../src/core/reminders';
import { Expense, Loan, Purchase, Sale } from '../src/types';

const AT = '2026-10-06T12:00:00.000Z';

const sale: Sale = {
  id: 's1', date: '2026-10-06T10:00:00Z', units: 500, purity: 21, buyAmount: 450000,
  sellAmount: 520000, buyer: 'عثمان', buyerPhone: '0912345678', notes: '',
  paidAmount: 320000, pendingAmount: 200000, dueDate: '2026-10-01T00:00:00Z',
};

const purchase: Purchase = {
  id: 'p1', date: '2026-10-06T10:00:00Z', units: 1000, purity: 21, amount: 900000,
  pendingAmount: 300000, seller: 'مورد الخرطوم', bankAccount: '', notes: '', payments: [],
};

const expense: Expense = {
  id: 'e1', date: '2026-10-06T10:00:00Z', amount: 50000, category: 'منصرفات عامة',
  target: 'عام', name: 'كهرباء', notes: '',
};

const loan: Loan = {
  id: 'l1', date: '2026-10-06T10:00:00Z', person: 'الصادق', amount: 300000,
  direction: 'lent', payments: [], notes: '', dueDate: '2026-11-05T00:00:00Z',
};

// ==================== الأدوات ====================

test('unreadCount و markRead و markAllRead', () => {
  const a: AppNotification = { id: '1', kind: 'sale', title: 'أ', body: '', at: AT, level: 'info' };
  const b: AppNotification = { id: '2', kind: 'sale', title: 'ب', body: '', at: AT, level: 'info' };
  assert.equal(unreadCount([a, b]), 2);
  const oneRead = markRead([a, b], '1', AT);
  assert.equal(unreadCount(oneRead), 1);
  assert.equal(oneRead[0].readAt, AT);
  assert.equal(unreadCount(markAllRead([a, b], AT)), 0);
});

test('sortNotifications يرتّب الأحدث أولاً', () => {
  const older: AppNotification = { id: 'x', kind: 'sale', title: 'قديم', body: '', at: '2026-10-01T00:00:00Z', level: 'info' };
  const newer: AppNotification = { id: 'y', kind: 'sale', title: 'جديد', body: '', at: '2026-10-06T00:00:00Z', level: 'info' };
  assert.deepEqual(sortNotifications([older, newer]).map((n) => n.id), ['y', 'x']);
});

test('pushNotification يمنع التكرار ويحترم الحد الأقصى', () => {
  const n = (id: string, key?: string): AppNotification => ({
    id, kind: 'sale', title: id, body: '', at: AT, level: 'info', dedupeKey: key,
  });
  let list = pushNotification([], n('1', 'k1'));
  assert.equal(list.length, 1);
  list = pushNotification(list, n('2', 'k1')); // نفس المنع
  assert.equal(list.length, 1);
  list = pushNotification(list, n('3', 'k3'));
  assert.equal(list.length, 2);

  let many: AppNotification[] = [];
  for (let i = 0; i < 30; i++) many = pushNotification(many, n(`n${i}`), 10);
  assert.equal(many.length, 10);
});

test('pruneNotifications يحتفظ بالحد الأدنى', () => {
  const list = Array.from({ length: 3 }, (_, i) => ({
    id: `n${i}`, kind: 'sale' as const, title: '', body: '', at: AT, level: 'info' as const,
  }));
  assert.equal(pruneNotifications(list, 1).length, 3); // 5 كحد أدنى داخلي
});

test('relativeArabic يصوغ الوقت بالعربي', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  assert.equal(relativeArabic('2026-10-06T11:59:30Z', now), 'الآن');
  assert.equal(relativeArabic('2026-10-06T11:30:00Z', now), 'قبل 30 دقيقة');
  assert.equal(relativeArabic('2026-10-06T09:00:00Z', now), 'قبل 3 ساعة');
  assert.equal(relativeArabic('2026-10-05T12:00:00Z', now), 'أمس');
  assert.equal(relativeArabic('2026-10-03T12:00:00Z', now), 'قبل 3 يوماً');
});

// ==================== إشعار السعر ====================

test('priceNotification: لا إشعار دون العتبة', () => {
  assert.equal(priceNotification(1000000, 1010000, 2, AT), null); // +1%
});

test('priceNotification: ارتفاع يستحق إشعاراً', () => {
  const n = priceNotification(1000000, 1030000, 2, AT);
  assert.ok(n);
  assert.match(n!.title, /ارتفاع/);
  assert.match(n!.title, /3%/);
  assert.equal(n!.level, 'success');
  assert.equal(n!.tab, 'gold_price');
  assert.match(n!.body, /1,030,000/);
});

test('priceNotification: انخفاض يستحق إشعاراً بلهجة تحذيرية', () => {
  const n = priceNotification(1000000, 970000, 2, AT);
  assert.ok(n);
  assert.match(n!.title, /انخفاض/);
  assert.equal(n!.level, 'warning');
  assert.match(n!.body, /للشراء أو التزويد/);
});

// ==================== إشعارات العمليات ====================

test('saleNotification يوضح الزبون والوزن والربح والآجل', () => {
  const n = saleNotification(sale, AT)!;
  assert.match(n.title, /عملية بيع جديدة/);
  assert.match(n.title, /520,000/);
  assert.match(n.body, /عثمان/);
  assert.match(n.body, /5\.0\.0/);
  assert.match(n.body, /الربح: 70,000/);
  assert.match(n.body, /آجل: 200,000/);
  assert.equal(n.tab, 'sales');
});

test('purchaseNotification يوضح المورد والمتبقي', () => {
  const n = purchaseNotification(purchase, AT)!;
  assert.match(n.title, /عملية شراء جديدة/);
  assert.match(n.body, /مورد الخرطوم/);
  assert.match(n.body, /متبقٍ للسداد: 300,000/);
  assert.equal(n.tab, 'purchases');
});

test('expenseNotification يفرّق بين العام ومسحوبات الشريك', () => {
  assert.match(expenseNotification(expense, AT)!.body, /مصروف عام/);
  const priv = expenseNotification({ ...expense, target: 'السر الصائغ', category: 'مسحوبات شريك' }, AT)!;
  assert.match(priv.body, /مسحوبات السر الصائغ/);
  assert.equal(priv.level, 'warning');
});

test('loanNotification يوضح الاتجاه وأنه لا يؤثر على الربح', () => {
  const lent = loanNotification(loan, AT)!;
  assert.match(lent.title, /سلفة جديدة لـ الصادق/);
  assert.match(lent.body, /لا يؤثر على الربح/);
  assert.equal(lent.tab, 'loans');

  const borrowed = loanNotification({ ...loan, direction: 'borrowed', person: 'التاجر' }, AT)!;
  assert.match(borrowed.title, /سلفة جديدة من التاجر/);
});

test('paymentNotification للتحصيل والسداد والسلف', () => {
  assert.match(paymentNotification('sale', 'عثمان', 200000, AT).title, /تحصيل من زبون/);
  assert.match(paymentNotification('purchase', 'مورد', 100000, AT).title, /سداد لمورد/);
  const loanPay = paymentNotification('loan', 'الصادق', 50000, AT);
  assert.match(loanPay.title, /سداد سلفة/);
  assert.equal(loanPay.tab, 'loans');
});

test('loanSettledNotification يعلن الأرشفة التلقائية', () => {
  const n = loanSettledNotification(loan, AT);
  assert.match(n.title, /اكتمل سداد سلفة الصادق/);
  assert.match(n.body, /الأرشيف تلقائياً/);
});

// ==================== المتأخرات والملخص ====================

test('dueNotifications تُنتج إشعاراً لكل متأخر ومستحق اليوم مع منع التكرار', () => {
  const dues = computeDues([sale], [purchase], new Date('2026-10-06T10:00:00Z'));
  const list = dueNotifications(dues, new Date('2026-10-06T10:00:00Z'));
  assert.ok(list.length >= 1);
  const overdue = list.find((n) => n.level === 'danger');
  assert.ok(overdue);
  assert.match(overdue!.title, /متأخر/);
  assert.match(overdue!.body, /1,200,000|200,000/); // المتبقي على الزبون
  assert.equal(overdue!.dedupeKey?.includes('2026-10-06'), true);
});

test('digestNotification يجمع أرقام الأعمال في سطر واحد', () => {
  const n = digestNotification({
    salesAmount: 1000000, profit: 120000, expenses: 40000, net: 80000,
    duesTotal: 300000, loansOutstanding: 150000, dateLabel: 'يوم 6 أكتوبر 2026', at: AT,
  });
  assert.match(n.title, /ملخص يوم 6 أكتوبر 2026/);
  assert.match(n.body, /المبيعات 1,000,000/);
  assert.match(n.body, /سلف 150,000/);
});

test('partnerDigestText نص جاهز للشركاء على واتساب', () => {
  const text = partnerDigestText({
    storeName: 'مجوهرات الذهب',
    periodLabel: 'شهر أكتوبر 2026',
    salesAmount: 5000000,
    profit: 600000,
    expenses: 150000,
    net: 450000,
    capital: 8000000,
    partners: [
      { name: 'السر', percent: 60, netShare: 270000 },
      { name: 'محمد', percent: 40, netShare: 180000 },
    ],
    duesTotal: 400000,
    loansOutstanding: 250000,
    price21: 1008893,
  });
  assert.match(text, /ملخص الشركاء — شهر أكتوبر 2026/);
  assert.match(text, /• السر \(60%\): 270,000/);
  assert.match(text, /• محمد \(40%\): 180,000/);
  assert.match(text, /سلف قائمة: 250,000/);
  assert.match(text, /سعر جرام عيار 21 الآن: 1,008,893/);
});

test('notificationId يبني معرّفاً ثابتاً', () => {
  assert.equal(notificationId('sale', 'abc'), 'sale-abc');
});

test('الإعدادات الافتراضية: الإشعارات مغلقة حتى يمنح المستخدم الإذن', () => {
  assert.equal(DEFAULT_NOTIFICATION_PREFS.enabled, false);
  assert.equal(DEFAULT_NOTIFICATION_PREFS.priceChangePercent, 2);
  assert.equal(DEFAULT_NOTIFICATION_PREFS.keepMax, 80);
});

/* ------------------- الحذف النهائي (لا تعود الإشعارات) ------------------- */

test('notificationKey: يستخدم dedupeKey إن وُجد وإلا المعرّف', () => {
  assert.equal(notificationKey({ id: 'n1' } as AppNotification), 'n1');
  assert.equal(notificationKey({ id: 'n1', dedupeKey: 'sale:s1' } as AppNotification), 'sale:s1');
});

test('pushNotification: لا يعيد إشعاراً محذوفاً نهائياً', () => {
  const incoming = purchaseNotification(
    { id: 'pu1', date: '2026-10-06', amount: 1000, seller: 'مورد', purity: 21, units: 5 } as never,
    '2026-10-06T10:00:00Z'
  )!;
  const key = notificationKey(incoming);

  const list = pushNotification([], incoming, 80, []);
  assert.equal(list.length, 1, 'يُضاف عند عدم وجوده في سجل الحذف');

  // محاكاة الحذف: يُرفع من القائمة ويُسجَّل مفتاحه في سجل الحذف
  const removed = list.filter((n) => notificationKey(n) !== key);
  assert.equal(removed.length, 0, 'حُذف فعلاً');

  const afterDelete = pushNotification(removed, incoming, 80, [key]);
  assert.equal(afterDelete.length, 0, 'لا يُعاد بعد حذفه');

  const again = pushNotification(afterDelete, incoming, 80, [key]);
  assert.equal(again.length, 0, 'ويبقى محذوفاً مهما تكررت المحاولة');
});

test('pushNotification: dedupeKey ثابت لكل عملية (لا تكرار من نفس السجل)', () => {
  const purchase = { id: 'pu9', date: '2026-10-06', amount: 500, purity: 21, units: 2 } as never;
  const a = purchaseNotification(purchase, '2026-10-06T09:00:00Z')!;
  const b = purchaseNotification(purchase, '2026-10-06T12:00:00Z')!;
  assert.equal(notificationKey(a), notificationKey(b), 'نفس المفتاح مهما تغيّر الوقت');
  const list = pushNotification(pushNotification([], a, 80, []), b, 80, []);
  assert.equal(list.length, 1, 'لا يتكرر نفس السجل');
});

test('withDismissed: يمنع التكرار ويحترم الحد الأقصى', () => {
  const first = withDismissed([], ['a', 'b', 'a']);
  assert.deepEqual(first, ['a', 'b']);
  const second = withDismissed(first, ['c']);
  assert.deepEqual(second, ['a', 'b', 'c']);
  const many = Array.from({ length: 12 }, (_, i) => `k${i}`);
  const capped = withDismissed(many, ['k12'], 10);
  assert.equal(capped.length, 10, 'يحافظ على 10 فقط');
  assert.ok(capped.includes('k12'), 'الأحدث محفوظ');
  assert.ok(!capped.includes('k0'), 'الأقدم أُسقط');
});

test('مفاتيح العمليات والدُفعات والمتأخرات ثابتة وقابلة للتتبع', () => {
  const sale = { id: 's1', date: '2026-10-06', sellAmount: 5000, buyer: 'ز', purity: 21, units: 3 } as never;
  assert.equal(saleNotification(sale, '2026-10-06')!.dedupeKey, 'sale:s1');

  const loan = { id: 'lon1', date: '2026-10-06', amount: 900, person: 'أ', direction: 'lent' } as never;
  assert.equal(loanNotification(loan, '2026-10-06')!.dedupeKey, 'loan:lon1');

  const pay = paymentNotification('sale', 'زبون', 250, '2026-10-06T10:30:00Z');
  assert.ok(pay.dedupeKey?.startsWith('payment:sale:زبون:250:'));
});

test('notificationKeys: يجمع المفتاح والمعرّف (توافق الإشعارات القديمة)', () => {
  const n = { id: 'purchase-pu1', dedupeKey: 'purchase:pu1' } as AppNotification;
  const keys = notificationKeys(n);
  assert.ok(keys.includes('purchase:pu1'));
  assert.ok(keys.includes('purchase-pu1'));

  // إشعار قديم بلا مفتاح ثابت
  const legacy = { id: 'purchase-pu2' } as AppNotification;
  assert.deepEqual(notificationKeys(legacy), ['purchase-pu2']);
});

test('pushNotification: يحترم المعرّف القديم في سجل الحذف', () => {
  const incoming = { id: 'purchase-pu5', dedupeKey: 'purchase:pu5', kind: 'purchase' } as AppNotification;
  const blocked = pushNotification([], incoming, 80, ['purchase-pu5']);
  assert.equal(blocked.length, 0, 'لا يعود إشعار حُذف بمعرّفه القديم');
});

test('batchSyncNotification: إشعار واحد بدل طوفان عند وصول دفعة كبيرة', () => {
  const n = batchSyncNotification({ sales: 1, purchases: 70, expenses: 4, loans: 1 });
  assert.equal(n.kind, 'sync');
  assert.ok(n.title.includes('76'));
  assert.ok(n.body.includes('70 شراء'));
  const same = batchSyncNotification({ sales: 0, purchases: 1, expenses: 0, loans: 0 }, n.at);
  assert.equal(n.dedupeKey, same.dedupeKey, 'مفتاح واحد لكل ساعة');
});
