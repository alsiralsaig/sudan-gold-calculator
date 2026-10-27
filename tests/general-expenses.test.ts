import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allocateGeneralExpenses, partnerShares } from '../src/core/accounting';
import type { Expense, Partner } from '../src/types';

const now = '2026-10-15T10:00:00.000Z';

const partners: Partner[] = [
  { id: 'p1', name: 'ناجو', capital: 2_020_000, profitPercent: 50, phone: '', notes: '' },
  { id: 'p2', name: 'تاجو', capital: 9_581_000, profitPercent: 50, phone: '', notes: '' },
  { id: 'p3', name: 'والي الدين', capital: 2_230_000, profitPercent: 0, phone: '', notes: '' },
];

const general = (amount: number, partnerNames?: string[]): Expense => ({
  id: `e${amount}-${(partnerNames || []).join()}`,
  date: now,
  amount,
  category: 'منصرفات عامة',
  target: 'عام',
  partnerNames,
  name: 'إيجار',
  notes: '',
});

const priv = (amount: number, target: string): Expense => ({
  id: `p${amount}`,
  date: now,
  amount,
  category: 'مسحوبات شريك',
  target,
  name: 'سحب',
  notes: '',
});

test('المنصرف العام يتوزّع على الشركاء المحددين بالاسم', () => {
  const out = allocateGeneralExpenses([general(26_000, ['ناجو', 'تاجو'])], partners);
  assert.equal(out['ناجو'], 13_000);
  assert.equal(out['تاجو'], 13_000);
  assert.equal(out['والي الدين'], undefined, 'غير محدد → ما يتحمّلش حاجة');
});

test('تحديد شريك واحد: يتحمّل المبلغ كامل', () => {
  const out = allocateGeneralExpenses([general(26_000, ['ناجو'])], partners);
  assert.equal(out['ناجو'], 26_000);
  assert.equal(out['تاجو'], undefined);
});

test('بدون تحديد: يتوزّع على الكل بنسب الربح (50/50/0)', () => {
  const out = allocateGeneralExpenses([general(26_000)], partners);
  assert.equal(out['ناجو'], 13_000);
  assert.equal(out['تاجو'], 13_000);
  assert.equal(out['والي الدين'], 0, 'نسبة ربحه 0%');
});

test('تحديد التلاتة: النسب صفر لواحد منهم → ما ياخدش حاجة', () => {
  const out = allocateGeneralExpenses([general(26_000, ['ناجو', 'تاجو', 'والي الدين'])], partners);
  assert.equal(out['ناجو'], 13_000);
  assert.equal(out['تاجو'], 13_000);
  assert.equal(out['والي الدين'], 0);
});

test('لو كل المحددين نسبهم صفر → يتقسم بالتساوي', () => {
  const out = allocateGeneralExpenses([general(30_000, ['والي الدين', 'ناجو'])], [
    { id: 'a', name: 'والي الدين', capital: 1, profitPercent: 0, phone: '', notes: '' },
    { id: 'b', name: 'ناجو', capital: 1, profitPercent: 0, phone: '', notes: '' },
  ]);
  assert.equal(out['والي الدين'], 15_000);
  assert.equal(out['ناجو'], 15_000);
});

test('أكتر من منصرف: المبالغ تتراكم على الشريك', () => {
  const out = allocateGeneralExpenses(
    [general(26_000, ['ناجو', 'تاجو']), general(10_000, ['ناجو'])],
    partners
  );
  assert.equal(out['ناجو'], 13_000 + 10_000);
  assert.equal(out['تاجو'], 13_000);
});

test('الكسور ما تضيعش: آخر شريك يستلم الباقي', () => {
  const out = allocateGeneralExpenses([general(100, ['ناجو', 'تاجو', 'والي الدين'])], [
    { id: 'a', name: 'ناجو', capital: 1, profitPercent: 1, phone: '', notes: '' },
    { id: 'b', name: 'تاجو', capital: 1, profitPercent: 1, phone: '', notes: '' },
    { id: 'c', name: 'والي الدين', capital: 1, profitPercent: 1, phone: '', notes: '' },
  ]);
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  assert.equal(total, 100, 'المجموع يفضل 100 بالظبط');
});

test('المنصرفات الخاصة ما تتأثرش بتوزيع العامة', () => {
  const out = allocateGeneralExpenses([general(26_000, ['ناجو', 'تاجو']), priv(44_500, 'ناجو')], partners);
  assert.equal(out['ناجو'], 13_000, 'الخاصة ما دخلتش في توزيع العامة');
});

test('صافي المستحق = رأس المال + نصيب الربح − الخاصة − نصيبه من العامة', () => {
  const expenses = [general(26_000, ['ناجو', 'تاجو']), priv(44_500, 'ناجو'), priv(14_000, 'تاجو')];
  const shares = partnerShares(partners, expenses, 0, 13_831_000);
  const by = Object.fromEntries(shares.map((s) => [s.partner.name, s]));

  assert.equal(by['ناجو'].generalExpenses, 13_000);
  assert.equal(by['ناجو'].netShare, -13_000 - 44_500);
  assert.equal(by['ناجو'].partner.capital + by['ناجو'].netShare, 1_962_500, '2,020,000 − 13,000 − 44,500');

  assert.equal(by['تاجو'].generalExpenses, 13_000);
  assert.equal(by['تاجو'].partner.capital + by['تاجو'].netShare, 9_554_000, '9,581,000 − 13,000 − 14,000');

  assert.equal(by['والي الدين'].generalExpenses, 0);
  assert.equal(by['والي الدين'].partner.capital + by['والي الدين'].netShare, 2_230_000, 'ما اتأثرش');
});

test('المنصرف العام المأرشف يفضل مخصوم من رأس المال والمستحق', () => {
  const archivedGeneral: Expense = { ...general(26_000, ['ناجو', 'تاجو']), archived: true };
  const out = allocateGeneralExpenses([archivedGeneral], partners);
  assert.equal(out['ناجو'], 13_000, 'الأرشفة ما ترجع الفلوس لرأس المال');
  assert.equal(out['تاجو'], 13_000);

  const shares = partnerShares(partners, [archivedGeneral, { ...priv(44_500, 'ناجو'), archived: true }], 0, 13_831_000);
  const by = Object.fromEntries(shares.map((s) => [s.partner.name, s]));
  assert.equal(by['ناجو'].generalExpenses, 13_000);
  assert.equal(by['ناجو'].privateExpenses, 44_500);
  assert.equal(by['ناجو'].partner.capital + by['ناجو'].netShare, 1_962_500);
});

test('المنصرفات العامة ما تخصمش مرتين: وعاء الربح يفضل إجمالي الربح', () => {
  // وعاء الربح = إجمالي الربح، والعامة تُخصم على مستوى الشريك بس
  const grossProfit = 1_000_000;
  const shares = partnerShares(partners, [general(26_000, ['ناجو', 'تاجو'])], grossProfit, 13_831_000);
  const totalShares = shares.reduce((s, x) => s + x.profitShare, 0);
  assert.equal(totalShares, grossProfit, 'نصيب الشركاء = إجمالي الربح كامل');
  assert.equal(shares[0].profitShare, 500_000);

  const totalGeneral = shares.reduce((s, x) => s + x.generalExpenses, 0);
  assert.equal(totalGeneral, 26_000, 'والعامة مخصومة على الشركاء');
});
