import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_BRANCHES,
  NO_BRANCH,
  UNASSIGNED_BRANCH,
  unassignedCount,
  activeBranches,
  bestBranch,
  branchCode,
  branchName,
  branchShare,
  branchStats,
  receiptNameFor,
  scopeToBranch,
  suggestBranchCode,
} from '../src/core/branches';
import {
  assignMissingInvoiceNumbers,
  assignMissingInvoiceNumbersByBranch,
  buildPurchaseInvoice,
  buildSaleInvoice,
  formatInvoiceNo,
  invoiceText,
  lastInvoiceSeq,
  nextInvoiceNo,
} from '../src/core/invoice';
import { Branch, Expense, Purchase, Sale } from '../src/types';

const branches: Branch[] = [
  { id: 'b1', name: 'الفرع الرئيسي', code: 'KH1', phone: '0912345678' },
  { id: 'b2', name: 'فرع بحري', code: 'BH1', receiptName: 'مجوهرات الذهب — بحري' },
  { id: 'b3', name: 'فرع قديم', archived: true },
];

const purchase = (over: Partial<Purchase> = {}): Purchase => ({
  id: 'p1', date: '2026-10-01T09:00:00.000Z', units: 1000, purity: 21, amount: 900000,
  pendingAmount: 300000, seller: 'مورد', bankAccount: '', notes: '', payments: [], branchId: 'b1', ...over,
});

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 's1', date: '2026-10-02T09:00:00.000Z', units: 500, purity: 21, buyAmount: 450000,
  sellAmount: 520000, buyer: 'زبون', notes: '', paidAmount: 320000, pendingAmount: 200000,
  branchId: 'b1', ...over,
});

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1', date: '2026-10-02T09:00:00.000Z', amount: 50000, category: 'تشغيل', target: 'عام',
  name: 'كهرباء', notes: '', branchId: 'b1', ...over,
});

// ==================== الفروع ====================

test('activeBranches يستثني المؤرشف', () => {
  assert.deepEqual(activeBranches(branches).map((b) => b.id), ['b1', 'b2']);
});

test('scopeToBranch: كل الفروع تمرّر الكل', () => {
  const items = [purchase(), purchase({ id: 'p2', branchId: 'b2' }), purchase({ id: 'p3', branchId: undefined })];
  assert.equal(scopeToBranch(items, ALL_BRANCHES).length, 3);
  assert.equal(scopeToBranch(items, null).length, 3);
  assert.equal(scopeToBranch(items, undefined).length, 3);
});

test('scopeToBranch: فرع محدد يعزل سجلاته فقط', () => {
  const items = [purchase(), purchase({ id: 'p2', branchId: 'b2' }), purchase({ id: 'p3', branchId: undefined })];
  assert.deepEqual(scopeToBranch(items, 'b2').map((x) => x.id), ['p2']);
  assert.deepEqual(scopeToBranch(items, 'b1').map((x) => x.id), ['p1']);
  assert.deepEqual(scopeToBranch(items, 'b9').map((x) => x.id), []);
});

test('scopeToBranch: «بدون فرع» يعرض السجلات القديمة فقط', () => {
  const items = [purchase(), purchase({ id: 'p2', branchId: 'b2' }), purchase({ id: 'p3', branchId: undefined })];
  assert.deepEqual(scopeToBranch(items, UNASSIGNED_BRANCH).map((x) => x.id), ['p3']);
  assert.equal(unassignedCount(items), 1);
  assert.equal(branchName(branches, UNASSIGNED_BRANCH), NO_BRANCH);
  assert.equal(branchCode(branches, UNASSIGNED_BRANCH), undefined);
});

test('branchName و branchCode و receiptNameFor', () => {
  assert.equal(branchName(branches, 'b1'), 'الفرع الرئيسي');
  assert.equal(branchName(branches, ALL_BRANCHES), 'كل الفروع');
  assert.equal(branchName(branches, 'b7'), NO_BRANCH);
  assert.equal(branchCode(branches, 'b2'), 'BH1');
  assert.equal(branchCode(branches, ALL_BRANCHES), undefined);
  assert.equal(receiptNameFor(branches, 'b2'), 'مجوهرات الذهب — بحري');
  assert.equal(receiptNameFor(branches, 'b1'), 'الفرع الرئيسي');
});

test('suggestBranchCode ينشئ رمزاً غير مكرر', () => {
  const code = suggestBranchCode('فرع بحري', [{ id: 'x', name: 'أ', code: 'FR1' }]);
  assert.match(code, /^FR\d+$/);
  assert.notEqual(code, 'FR1');
});

test('branchStats يجمع المبيعات والمشتريات والمصروفات لكل فرع', () => {
  const stats = branchStats(
    [branches[0], branches[1]],
    [purchase(), purchase({ id: 'p2', branchId: 'b2', amount: 100 })],
    [sale(), sale({ id: 's2', branchId: 'b2', sellAmount: 10, buyAmount: 5, pendingAmount: 0 })],
    [expense(), expense({ id: 'e2', branchId: 'b2', amount: 7 })]
  );
  const b1 = stats.find((s) => s.branchId === 'b1')!;
  const b2 = stats.find((s) => s.branchId === 'b2')!;
  assert.equal(b1.salesAmount, 520000);
  assert.equal(b1.purchasesAmount, 900000);
  assert.equal(b1.pending, 500000); // 200,000 (بيع) + 300,000 (شراء)
  assert.equal(b2.salesAmount, 10);
  assert.equal(b2.operations, 3);
  assert.equal(bestBranch(stats)!.branchId, 'b1');
});

test('branchStats يضيف صف «بدون فرع» عند وجود سجلات بلا فرع', () => {
  const stats = branchStats([branches[0]], [purchase({ branchId: undefined })], [], []);
  assert.ok(stats.some((s) => s.name === NO_BRANCH));
});

test('branchShare يحسب النسب من الإجمالي', () => {
  const share = branchShare(branchStats([branches[0], branches[1]], [], [
    sale({ branchId: 'b1', sellAmount: 750 }),
    sale({ id: 's2', branchId: 'b2', sellAmount: 250 }),
  ], []));
  assert.equal(share.find((s) => s.name === 'الفرع الرئيسي')!.percent, 75);
  assert.equal(share.find((s) => s.name === 'فرع بحري')!.percent, 25);
});

// ==================== الفواتير ====================

test('formatInvoiceNo يضيف صفرات ورمز الفرع', () => {
  assert.equal(formatInvoiceNo('sale', 7), 'SAL-0007');
  assert.equal(formatInvoiceNo('purchase', 42, 'kh1'), 'PUR-KH1-0042');
});

test('lastInvoiceSeq يتجاهل أرقام الفروع الأخرى', () => {
  const items = [{ invoiceNo: 'SAL-0003' }, { invoiceNo: 'SAL-0011' }, { invoiceNo: 'SAL-KH1-0009' }, {}];
  assert.equal(lastInvoiceSeq(items, 'sale'), 11);
  assert.equal(lastInvoiceSeq(items, 'sale', 'KH1'), 9);
  assert.equal(lastInvoiceSeq(items, 'purchase'), 0);
});

test('nextInvoiceNo يبدأ من 1 ثم يتصاعد ويحترم العدّاد', () => {
  assert.equal(nextInvoiceNo([], 'sale'), 'SAL-0001');
  assert.equal(nextInvoiceNo([{ invoiceNo: 'SAL-0004' }], 'sale'), 'SAL-0005');
  assert.equal(nextInvoiceNo([{ invoiceNo: 'SAL-0004' }], 'sale', { counter: 20 }), 'SAL-0021');
  assert.equal(nextInvoiceNo([], 'purchase', { branchCode: 'BH1' }), 'PUR-BH1-0001');
});

test('assignMissingInvoiceNumbers يرقّم القديم بالترتيب الزمني ويحفظ الموجود', () => {
  const items = [
    { id: 'a', date: '2026-10-03T00:00:00Z' },
    { id: 'b', date: '2026-10-01T00:00:00Z', invoiceNo: 'SAL-0009' },
    { id: 'c', date: '2026-10-02T00:00:00Z' },
  ];
  const res = assignMissingInvoiceNumbers(items, 'sale');
  assert.equal(res.assigned, 2);
  assert.equal(res.nextCounter, 11);
  assert.equal(res.items[0].invoiceNo, 'SAL-0011'); // الأحدث
  assert.equal(res.items[1].invoiceNo, 'SAL-0009'); // محفوظ
  assert.equal(res.items[2].invoiceNo, 'SAL-0010');
  assert.deepEqual(res.items.map((i) => i.id), ['a', 'b', 'c']); // الترتيب الأصلي
});

test('buildSaleInvoice يحسب سعر الجرام والمتبقي ويحمل بيانات الفرع', () => {
  const inv = buildSaleInvoice(sale(), {
    storeName: 'مجوهرات الذهب',
    purityLabel: (k) => `${k}k`,
    weightLabel: (u) => `${u / 100} جرام`,
    invoiceNo: 'SAL-0001',
    branch: branches[1],
  });
  assert.equal(inv.invoiceNo, 'SAL-0001');
  assert.equal(inv.pricePerGram, 104000); // 520,000 / 5 جرام
  assert.equal(inv.pending, 200000);
  assert.equal(inv.partyLabel, 'الزبون');
  assert.equal(inv.branchName, 'مجوهرات الذهب — بحري');
  assert.equal(inv.title, 'فاتورة بيع');
});

test('buildPurchaseInvoice يحسب المدفوع من المتبقي', () => {
  const inv = buildPurchaseInvoice(purchase(), {
    storeName: 'مجوهرات الذهب',
    purityLabel: (k) => `${k}k`,
    weightLabel: (u) => `${u / 100} جرام`,
    invoiceNo: 'PUR-0001',
  });
  assert.equal(inv.amount, 900000);
  assert.equal(inv.paid, 600000);
  assert.equal(inv.pending, 300000);
  assert.equal(inv.pricePerGram, 90000); // 900,000 / 10 جرام
  assert.equal(inv.partyLabel, 'المورد / البائع');
});

test('invoiceText يحتوي الرقم والوزن والمبالغ والسطر الآجل', () => {
  const inv = buildSaleInvoice(sale({ dueDate: '2026-11-01T00:00:00Z' }), {
    storeName: 'مجوهرات الذهب',
    currency: 'ج.س',
    purityLabel: (k) => `${k}k`,
    weightLabel: (u) => `${u / 100} جرام`,
    invoiceNo: 'SAL-0003',
    branch: branches[0],
  });
  const txt = invoiceText(inv);
  assert.match(txt, /SAL-0003/);
  assert.match(txt, /الوزن: 5 جرام/);
  assert.match(txt, /الإجمالي: 520,000/);
  assert.match(txt, /المتبقي: 200,000/);
  assert.match(txt, /تاريخ الاستحقاق/);
  assert.match(txt, /الفرع: الفرع الرئيسي/);
});

test('assignMissingInvoiceNumbersByBranch يرقّم كل فرع بتسلسله الخاص', () => {
  const items: { id: string; date: string; branchId?: string; invoiceNo?: string }[] = [
    { id: 'a', date: '2026-10-01T00:00:00Z', branchId: 'b1' },
    { id: 'b', date: '2026-10-02T00:00:00Z', branchId: 'b2' },
    { id: 'c', date: '2026-10-03T00:00:00Z', branchId: 'b1' },
    { id: 'd', date: '2026-10-04T00:00:00Z' },
  ];
  const res = assignMissingInvoiceNumbersByBranch(items, 'sale', { branches });
  assert.equal(res.assigned, 4);
  const byId = Object.fromEntries(res.items.map((i) => [i.id, i.invoiceNo]));
  assert.equal(byId['a'], 'SAL-KH1-0001');
  assert.equal(byId['c'], 'SAL-KH1-0002');
  assert.equal(byId['b'], 'SAL-BH1-0001');
  assert.equal(byId['d'], 'SAL-0001');
  assert.equal(res.nextCounter, 2);
});

test('assignMissingInvoiceNumbersByBranch يحفظ الأرقام الموجودة', () => {
  const res = assignMissingInvoiceNumbersByBranch(
    [{ id: 'x', date: '2026-10-01T00:00:00Z', branchId: 'b1', invoiceNo: 'SAL-KH1-0009' }],
    'sale',
    { branches }
  );
  assert.equal(res.assigned, 0);
  assert.equal(res.items[0].invoiceNo, 'SAL-KH1-0009');
});
