import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterExpenses,
  matchesPeriod,
  partnerExpenseText,
  summarizeExpenses,
} from '../src/core/expenseSummary';
import { Expense } from '../src/types';

const NOW = new Date('2026-10-07T12:00:00Z');
const iso = (daysAgo: number, hour = 10) =>
  new Date(NOW.getTime() - daysAgo * 86400000).setHours(hour, 0, 0, 0) && new Date(NOW.getTime() - daysAgo * 86400000).toISOString();

const exp = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(36).slice(2),
  date: iso(1),
  amount: 1000,
  category: 'منصرفات عامة',
  target: 'عام',
  name: 'مصروف',
  notes: '',
  ...over,
});

/* ------------------------------ التجميع ------------------------------ */

test('summarizeExpenses: يجمع كل شريك بإجماليه وعدده دفعة واحدة', () => {
  const expenses: Expense[] = [
    exp({ target: 'أحمد', amount: 15000 }),
    exp({ target: 'أحمد', amount: 25000 }),
    exp({ target: 'أحمد', amount: 10000 }),
    exp({ target: 'تاج السر', amount: 8000 }),
    exp({ target: 'عام', amount: 40000 }),
  ];
  const s = summarizeExpenses(expenses, { now: NOW });
  const ahmed = s.partners.find((p) => p.target === 'أحمد');
  assert.ok(ahmed, 'أحمد موجود في التجميع');
  assert.equal(ahmed?.count, 3, 'ثلاث عمليات لأحمد');
  assert.equal(ahmed?.total, 50000, 'إجمالي أحمد = 50,000 بلا جمع يدوي');
  assert.equal(s.partners.find((p) => p.target === 'تاج السر')?.total, 8000);
  assert.equal(s.general?.total, 40000);
  assert.equal(s.total, 98000);
  assert.equal(s.privateTotal, 58000);
  assert.equal(s.count, 5);
});

test('summarizeExpenses: النسب من الإجمالي وتُرتب تنازلياً', () => {
  const expenses: Expense[] = [
    exp({ target: 'أحمد', amount: 75000 }),
    exp({ target: 'تاج السر', amount: 25000 }),
  ];
  const s = summarizeExpenses(expenses, { now: NOW });
  assert.equal(s.byTarget[0].target, 'أحمد');
  assert.equal(s.byTarget[0].percent, 75);
  assert.equal(s.byTarget[1].percent, 25);
});

test('summarizeExpenses: المصروف بلا target يُعتبر عاماً', () => {
  const s = summarizeExpenses([exp({ target: '' as unknown as string, amount: 5000 })], { now: NOW });
  assert.equal(s.general?.total, 5000);
  assert.equal(s.partners.length, 0);
});

test('summarizeExpenses: الأرشيف لا يدخل في التجميع', () => {
  const s = summarizeExpenses(
    [exp({ target: 'أحمد', amount: 10000 }), exp({ target: 'أحمد', amount: 99999, archived: true })],
    { now: NOW }
  );
  assert.equal(s.partners[0].total, 10000);
  assert.equal(s.partners[0].count, 1);
});

test('summarizeExpenses: يتتبع أول وآخر تاريخ للشريك', () => {
  const expenses: Expense[] = [
    exp({ target: 'أحمد', amount: 100, date: iso(10) }),
    exp({ target: 'أحمد', amount: 100, date: iso(2) }),
    exp({ target: 'أحمد', amount: 100, date: iso(5) }),
  ];
  const s = summarizeExpenses(expenses, { now: NOW, period: 'all' });
  const ahmed = s.partners[0];
  assert.equal(ahmed.firstDate, iso(10), 'أقدم تاريخ');
  assert.equal(ahmed.lastDate, iso(2), 'أحدث تاريخ');
});

test('summarizeExpenses: بلا مصروفات → أصفار بلا انهيار', () => {
  const s = summarizeExpenses([], { now: NOW });
  assert.equal(s.total, 0);
  assert.equal(s.partners.length, 0);
  assert.equal(s.general, null);
});

/* ------------------------------ الفلترة ------------------------------ */

test('filterExpenses: فلترة بشريك معيّن', () => {
  const expenses: Expense[] = [
    exp({ target: 'أحمد', amount: 1 }),
    exp({ target: 'تاج السر', amount: 2 }),
    exp({ target: 'عام', amount: 3 }),
  ];
  const onlyAhmed = filterExpenses(expenses, { target: 'أحمد', now: NOW });
  assert.equal(onlyAhmed.length, 1);
  assert.equal(onlyAhmed[0].amount, 1);

  const onlyGeneral = filterExpenses(expenses, { target: 'عام', now: NOW });
  assert.equal(onlyGeneral.length, 1);
  assert.equal(onlyGeneral[0].amount, 3);

  assert.equal(filterExpenses(expenses, { target: 'all', now: NOW }).length, 3);
});

test('filterExpenses: يجمع فلتر الشريك مع الفترة والبحث', () => {
  const expenses: Expense[] = [
    exp({ target: 'أحمد', amount: 500, date: iso(1), name: 'بنزين' }),
    exp({ target: 'أحمد', amount: 700, date: iso(20), name: 'بنزين' }),
    exp({ target: 'أحمد', amount: 900, date: iso(1), name: 'شاي' }),
  ];
  const r = filterExpenses(expenses, { target: 'أحمد', period: '7days', query: 'بنزين', now: NOW });
  assert.equal(r.length, 1);
  assert.equal(r[0].amount, 500);

  const summary = summarizeExpenses(expenses, { target: 'أحمد', period: '7days', now: NOW });
  assert.equal(summary.partners[0].total, 1400, '500 + 900 لهذا الأسبوع');
});

test('matchesPeriod: اليوم / أسبوع / شهر', () => {
  assert.equal(matchesPeriod(iso(0), 'today', NOW), true);
  assert.equal(matchesPeriod(iso(1), 'today', NOW), false);
  assert.equal(matchesPeriod(iso(3), '7days', NOW), true);
  assert.equal(matchesPeriod(iso(9), '7days', NOW), false);
  assert.equal(matchesPeriod(iso(2), 'month', NOW), true, 'نفس الشهر');
  assert.equal(matchesPeriod('2026-09-15T10:00:00.000Z', 'month', NOW), false, 'شهر سابق');
  assert.equal(matchesPeriod('تاريخ غير صالح', '7days', NOW), false);
  assert.equal(matchesPeriod('2020-01-01T00:00:00.000Z', 'all', NOW), true);
});

/* ------------------------------ المشاركة ------------------------------ */

test('partnerExpenseText: نص عربي واضح لمشاركة تجميع الشريك', () => {
  const text = partnerExpenseText('مجوهرات الذهب', {
    target: 'أحمد',
    isGeneral: false,
    count: 3,
    total: 50000,
    percent: 86.2,
    firstDate: iso(10),
    lastDate: iso(1),
  }, 'هذا الشهر');
  assert.match(text, /منصرفات أحمد/);
  assert.match(text, /هذا الشهر/);
  assert.match(text, /عدد العمليات: 3/);
  assert.match(text, /50,000 ج\.س/);
});

test('filterExpenses: «خاصة» تجمع كل الشركاء معاً', () => {
  const expenses: Expense[] = [
    exp({ target: 'أحمد', amount: 100 }),
    exp({ target: 'تاج السر', amount: 200 }),
    exp({ target: 'عام', amount: 300 }),
  ];
  const priv = filterExpenses(expenses, { target: 'خاصة', now: NOW });
  assert.equal(priv.length, 2);
  const s = summarizeExpenses(expenses, { target: 'خاصة', now: NOW });
  assert.equal(s.privateTotal, 300);
  assert.equal(s.generalTotal, 0);
});

test('partnerShares: عدد المسحوبات لكل شريك (لجدول التقارير)', async () => {
  const { partnerShares } = await import('../src/core/accounting');
  const partners = [
    { id: 'p1', name: 'أحمد', capital: 100, profitPercent: 50, updatedAt: '' },
    { id: 'p2', name: 'تاج السر', capital: 100, profitPercent: 50, updatedAt: '' },
  ] as never[];
  const expenses = [
    exp({ target: 'أحمد', amount: 1000 }),
    exp({ target: 'أحمد', amount: 2000 }),
    exp({ target: 'تاج السر', amount: 500 }),
    exp({ target: 'عام', amount: 9999 }),
  ];
  const shares = partnerShares(partners, expenses, 10000, 200);
  const ahmed = shares.find((x) => x.partner.name === 'أحمد');
  assert.equal(ahmed?.privateExpenses, 3000);
  assert.equal(ahmed?.privateExpensesCount, 2);
  assert.equal(ahmed?.netShare, 2000, '5000 نصيب − 3000 مسحوبات');
  const taj = shares.find((x) => x.partner.name === 'تاج السر');
  assert.equal(taj?.privateExpensesCount, 1);
});
