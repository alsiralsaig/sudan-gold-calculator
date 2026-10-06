import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LOAN_LABELS,
  computeLoanDues,
  isLoanSettled,
  loanPaid,
  loanPending,
  loanProgress,
  loanReceiptText,
  loanStatusLabel,
  loanText,
  summarizeLoans,
} from '../src/core/loans';
import { Loan } from '../src/types';

const TODAY = new Date('2026-10-06T10:00:00Z');

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  date: '2026-09-01T09:00:00Z',
  person: 'عثمان',
  amount: 500000,
  direction: 'lent',
  notes: '',
  payments: [],
  ...over,
});

const payment = (amount: number, date = '2026-09-20T09:00:00Z') => ({
  id: `p${amount}`,
  amount,
  date,
  note: '',
});

// ==================== الحسابات الأساسية ====================

test('loanPaid يجمع الدفعات و loanPending يطرحها', () => {
  const l = loan({ payments: [payment(100000), payment(50000)] });
  assert.equal(loanPaid(l), 150000);
  assert.equal(loanPending(l), 350000);
});

test('loanPending لا ينزل تحت الصفر', () => {
  assert.equal(loanPending(loan({ amount: 100, payments: [payment(200)] })), 0);
  assert.equal(isLoanSettled(loan({ amount: 100, payments: [payment(100)] })), true);
  assert.equal(isLoanSettled(loan()), false);
});

test('loanProgress يحسب نسبة السداد', () => {
  assert.equal(loanProgress(loan({ payments: [payment(125000)] })), 25);
  assert.equal(loanProgress(loan({ amount: 0 })), 100);
});

test('سلفة علينا: نفس الحساب مع اتجاه معاكس', () => {
  const l = loan({ direction: 'borrowed', amount: 200000, payments: [payment(50000)] });
  assert.equal(loanPending(l), 150000);
  assert.equal(LOAN_LABELS[l.direction], 'علينا للآخرين');
});

// ==================== الملخص ====================

test('summarizeLoans: لنا وعلينا والصافي والنسب', () => {
  const summary = summarizeLoans([
    loan({ id: 'a', amount: 500000, payments: [payment(200000)] }), // لنا 300,000
    loan({ id: 'b', direction: 'borrowed', amount: 400000 }), // علينا 400,000
    loan({ id: 'c', amount: 100000, payments: [payment(100000)], archived: true }), // مسددة
  ]);
  assert.equal(summary.lentOutstanding, 300000);
  assert.equal(summary.borrowedOutstanding, 400000);
  assert.equal(summary.netOutstanding, -100000); // علينا أكثر
  assert.equal(summary.lentCount, 1);
  assert.equal(summary.borrowedCount, 1);
  assert.equal(summary.openCount, 2);
  assert.equal(summary.settledCount, 1);
  assert.equal(summary.collectedPercent, 40); // 200,000 مُسدَّد من 500,000 للنشطة فقط (المؤرشفة مستثناة)
});

test('summarizeLoans تُهمل المؤرشفة في الإجماليات', () => {
  const summary = summarizeLoans([loan({ archived: true, amount: 999 })]);
  assert.equal(summary.lentOutstanding, 0);
  assert.equal(summary.lentCount, 0);
});

// ==================== الاستحقاق والتنبيهات ====================

test('computeLoanDues: التصنيف بحسب تاريخ الاستحقاق', () => {
  const dues = computeLoanDues(
    [
      loan({ id: 'over', dueDate: '2026-10-01T00:00:00Z' }), // متأخرة 5 أيام
      loan({ id: 'today', dueDate: '2026-10-06T00:00:00Z' }),
      loan({ id: 'soon', dueDate: '2026-10-10T00:00:00Z' }),
      loan({ id: 'nodate' }),
    ],
    TODAY
  );
  assert.equal(dues.overdue.length, 1);
  assert.equal(dues.overdue[0].id, 'over');
  assert.equal(dues.overdue[0].daysOverdue, 5);
  assert.equal(dues.dueToday.length, 1);
  assert.equal(dues.upcoming.length, 1);
  assert.equal(dues.withoutDate.length, 1);
  assert.equal(dues.overdueTotal, 500000);
  assert.equal(dues.receivablesTotal, 2000000);
});

test('computeLoanDues: المسدَّد بالكامل لا يظهر', () => {
  const dues = computeLoanDues([loan({ payments: [payment(500000)] })], TODAY);
  assert.equal(dues.items.length, 0);
  assert.equal(dues.receivablesTotal, 0);
});

test('computeLoanDues: سلفة «علينا» تُصنّف payable', () => {
  const dues = computeLoanDues([loan({ direction: 'borrowed', dueDate: '2026-10-01T00:00:00Z' })], TODAY);
  assert.equal(dues.items[0].kind, 'payable');
  assert.equal(dues.payablesTotal, 500000);
  assert.equal(dues.receivablesTotal, 0);
});

test('computeLoanDues: يحمل مصدر السلفة والتقدم', () => {
  const dues = computeLoanDues([loan({ payments: [payment(250000)] })], TODAY);
  assert.equal(dues.items[0].source, 'loan');
  assert.equal(dues.items[0].amount, 250000);
  assert.equal(dues.items[0].paid, 250000);
  assert.equal(dues.items[0].progress, 50);
});

// ==================== النصوص ====================

test('loanStatusLabel يوضح الحالة بالعربي', () => {
  assert.match(loanStatusLabel(loan({ payments: [payment(500000)] })), /مسددة/);
  assert.equal(loanStatusLabel(loan()), 'متبقٍ 500,000');
  assert.match(loanStatusLabel(loan({ dueDate: '2026-10-01T00:00:00Z' })), /متأخرة/);
  assert.equal(loanStatusLabel(loan({ dueDate: '2026-10-06T00:00:00Z' })), 'تستحق اليوم');
});

test('loanText يحتوي المتبقي والإجمالي', () => {
  const text = loanText(loan({ payments: [payment(150000)], dueDate: '2026-10-20T00:00:00Z' }), 'مجوهرات الذهب');
  assert.match(text, /سلفة — لنا على الآخرين/);
  assert.match(text, /عثمان/);
  assert.match(text, /المبلغ الأصلي: 500,000/);
  assert.match(text, /المسدَّد: 150,000/);
  assert.match(text, /المتبقي: 350,000/);
});

test('loanReceiptText يوضح المتبقي بعد الدفعة ويعلن الإكمال', () => {
  const l = loan({ payments: [payment(100000)] });
  const partial = loanReceiptText(l, { amount: 50000, date: '2026-10-06T00:00:00Z', note: 'كاش' }, 'مجوهرات الذهب');
  assert.match(partial, /المتبقي بعد هذه الدفعة: 350,000/);
  assert.doesNotMatch(partial, /تم السداد بالكامل/);

  const full = loanReceiptText(l, { amount: 400000, date: '2026-10-06T00:00:00Z', note: '' }, 'مجوهرات الذهب');
  assert.match(full, /تم السداد بالكامل/);
});
