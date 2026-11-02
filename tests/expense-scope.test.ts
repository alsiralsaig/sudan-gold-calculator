import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  accountingExpenses,
  computeFinancials,
  partnerShares,
  summarizeRange,
} from '../src/core/accounting';
import { Expense, Partner } from '../src/types';

/**
 * القاعدة النهائية: «يُحسب المرة الأولى فقط، وبعد الأرشفة يختفي تماماً
 * — لا بخصم ولا بزيادة». هذه الاختبارات تمنع أي انحراف مستقبلي.
 */

const partners: Partner[] = [
  { id: 'p1', name: 'ناجو', capital: 2_020_000, profitPercent: 50, phone: '', notes: '' },
  { id: 'p2', name: 'تاجو', capital: 25_081_000, profitPercent: 50, phone: '', notes: '' },
];

const liveGeneral: Expense = {
  id: 'e1', date: '2026-11-01T10:00:00.000Z', amount: 1_000_000,
  category: 'منصرفات عامة', target: 'عام', name: 'إيجار', notes: '',
};
const livePrivate: Expense = {
  id: 'e2', date: '2026-11-01T10:05:00.000Z', amount: 500_000,
  category: 'مسحوبات شريك', target: 'ناجو', name: 'سحب', notes: '',
};
const archivedGeneral: Expense = { ...liveGeneral, id: 'e3', amount: 3_000_000, archived: true, name: 'أرشيف عام' };
const archivedPrivate: Expense = { ...livePrivate, id: 'e4', amount: 9_000_000, archived: true, name: 'أرشيف خاص' };

const from = new Date('2026-11-01T00:00:00Z');
const to = new Date('2026-11-01T23:59:59Z');

test('المصروف الحيّ يُحسب مرة واحدة', () => {
  const rows = [liveGeneral, livePrivate];
  const fin = computeFinancials([], [], rows, partners);
  assert.equal(fin.generalExpenses, 1_000_000);
  assert.equal(fin.privateExpenses, 500_000);

  const nag = partnerShares(partners, rows, 1_000_000, 27_101_000).find((s) => s.partner.name === 'ناجو')!;
  assert.equal(nag.privateExpenses, 500_000);
  assert.equal(nag.generalExpenses, 500_000);
});

test('بعد الأرشفة: لا خصم ولا زيادة — صفر في كل مكان', () => {
  const rows = [
    { ...liveGeneral, archived: true },
    { ...livePrivate, archived: true },
  ];
  const fin = computeFinancials([], [], rows, partners);
  assert.equal(fin.generalExpenses, 0);
  assert.equal(fin.privateExpenses, 0);

  const nag = partnerShares(partners, rows, 1_000_000, 27_101_000).find((s) => s.partner.name === 'ناجو')!;
  assert.equal(nag.privateExpenses, 0);
  assert.equal(nag.generalExpenses, 0);
  assert.equal(nag.netShare, 500_000, 'المستحق = ربح فقط، لا خصم من مؤرشف');

  const summary = summarizeRange([], [], rows, from, to);
  assert.equal(summary.expenses, 0);
  assert.equal(summary.net, summary.profit, 'صافي الفترة لا يتأثر بأي مؤرشف');
});

test('الاستعادة ترجّع الحساب مرة واحدة فقط — لا مضاعفة', () => {
  const restored = [
    { ...liveGeneral, archived: false },
    { ...livePrivate, archived: false },
  ];
  const fin = computeFinancials([], [], restored, partners);
  assert.equal(fin.generalExpenses, 1_000_000, 'مرة واحدة، مش مرتين');
  assert.equal(fin.privateExpenses, 500_000);
});

test('خلط حيّ + مؤرشف: المؤرشف لا يظهر إطلاقاً', () => {
  const rows = [liveGeneral, livePrivate, archivedGeneral, archivedPrivate];
  const fin = computeFinancials([], [], rows, partners);
  assert.equal(fin.generalExpenses, 1_000_000, 'المؤرشف العام لا يزيد الرقم');
  assert.equal(fin.privateExpenses, 500_000, 'المؤرشف الخاص لا يزيد الرقم');
  assert.equal(accountingExpenses(rows).length, 2);
});

test('حالة التاجر: أرشيف قبل الحساب ثم استعادة = خصم واحد فقط', () => {
  // المصروف كان مؤرشفاً قبل أي حساب ⇒ لم يُخصم
  const beforeRestore = computeFinancials([], [], [{ ...livePrivate, archived: true }], partners);
  assert.equal(beforeRestore.privateExpenses, 0);

  // بعد الاستعادة يُخصم مرة واحدة بالظبط
  const afterRestore = computeFinancials([], [], [{ ...livePrivate, archived: false }], partners);
  assert.equal(afterRestore.privateExpenses, 500_000);
});
