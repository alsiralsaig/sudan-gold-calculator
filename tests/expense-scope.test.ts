import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  accountingExpenses,
  visibleExpenses,
  computeFinancials,
  partnerShares,
  summarizeRange,
} from '../src/core/accounting';
import { Expense, Partner } from '../src/types';

/**
 * القاعدة النهائية (بكلام التاجر): «أي شيء يُخصم يفضل مخصوماً حتى بعد الأرشفة».
 * الأرشفة لا تُلغي الخصم ولا تُضاعفه.
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
  assert.equal(nag.netShare, 500_000 - 500_000 - 500_000);
});

test('بعد الأرشفة: نفس الأرقام بالظبط — لا يتشال الخصم', () => {
  const live = [liveGeneral, livePrivate];
  const archived = [{ ...liveGeneral, archived: true }, { ...livePrivate, archived: true }];

  const finLive = computeFinancials([], [], live, partners);
  const finArch = computeFinancials([], [], archived, partners);
  assert.equal(finArch.generalExpenses, finLive.generalExpenses, 'العام لا يتغيّر');
  assert.equal(finArch.privateExpenses, finLive.privateExpenses, 'الخاص لا يتغيّر');

  const nagLive = partnerShares(partners, live, 1_000_000, 27_101_000).find((s) => s.partner.name === 'ناجو')!;
  const nagArch = partnerShares(partners, archived, 1_000_000, 27_101_000).find((s) => s.partner.name === 'ناجو')!;
  assert.equal(nagArch.privateExpenses, nagLive.privateExpenses);
  assert.equal(nagArch.generalExpenses, nagLive.generalExpenses);
  assert.equal(nagArch.netShare, nagLive.netShare, 'مستحق الشريك لا يتغيّر بعد الأرشفة');

  const summaryLive = summarizeRange([], [], live, from, to);
  const summaryArch = summarizeRange([], [], archived, from, to);
  assert.equal(summaryArch.expenses, summaryLive.expenses);
});

test('حالة التاجر بالحرف: 12,000 يفضل مخصوماً بعد الأرشفة (لا يرجع)', () => {
  const p: Partner[] = [{ id: 'p', name: 'السر الصائغ', capital: -1_000_000, profitPercent: 100, phone: '', notes: '' }];
  const meal: Expense = {
    id: 'f', date: '2026-11-02T09:10:00.000Z', amount: 12_000,
    category: 'منصرفات عامة', target: 'عام', name: 'فطور', notes: '',
  };

  const live = partnerShares(p, [meal], 0, -1_000_000)[0];
  assert.equal(live.generalExpenses, 12_000);
  assert.equal(live.partner.capital + live.netShare, -1_012_000, 'العجز 1,012,000');

  const archived = partnerShares(p, [{ ...meal, archived: true }], 0, -1_000_000)[0];
  assert.equal(archived.generalExpenses, 12_000, 'يفضل مخصوماً');
  assert.equal(archived.partner.capital + archived.netShare, -1_012_000, 'لا يرجع إلى 1,000,000');
});

test('لا مضاعفة: المؤرشف يُحسب مرة واحدة فقط', () => {
  const rows = [livePrivate, { ...livePrivate, id: 'e2b', archived: true }];
  const fin = computeFinancials([], [], rows, partners);
  assert.equal(fin.privateExpenses, 1_000_000, 'سجلان = 500,000 لكل واحد، لا أكثر');
});

test('الاستعادة لا تضيف خصماً جديداً', () => {
  const archived = [{ ...livePrivate, archived: true }];
  const restored = [{ ...livePrivate, archived: false }];
  assert.equal(
    computeFinancials([], [], archived, partners).privateExpenses,
    computeFinancials([], [], restored, partners).privateExpenses
  );
  assert.equal(accountingExpenses(archived).length, 1, 'المؤرشف داخل الحساب');
});

test('حذف المصروف من الأرشيف: يختفي من القوائم وخصمه يبقى كما هو', () => {
  const meal: Expense = {
    id: 'x', date: '2026-11-02T09:10:00.000Z', amount: 12_000,
    category: 'منصرفات عامة', target: 'عام', name: 'فطور', notes: '',
  };
  const partner: Partner[] = [{ id: 'p', name: 'السر الصائغ', capital: -1_000_000, profitPercent: 100, phone: '', notes: '' }];

  const archivedRow = { ...meal, archived: true };
  const lockedRow = { ...meal, archived: true, locked: true }; // أُرشف ثم حُذف من الأرشيف

  const beforeDelete = partnerShares(partner, [archivedRow], 0, -1_000_000)[0];
  const afterDelete = partnerShares(partner, [lockedRow], 0, -1_000_000)[0];

  assert.equal(afterDelete.generalExpenses, beforeDelete.generalExpenses, 'الخصم لا يتغيّر');
  assert.equal(
    afterDelete.partner.capital + afterDelete.netShare,
    beforeDelete.partner.capital + beforeDelete.netShare,
    'الصافي كما هو (‑1,012,000)'
  );
  assert.equal(accountingExpenses([lockedRow]).length, 1, 'المقفول يبقى داخل الحساب');
  assert.equal(visibleExpenses([lockedRow]).length, 0, 'المقفول لا يظهر في أي قائمة');
});

test('الحذف قبل الأرشفة: المصروف يُحذف فعلاً ويخرج من الحساب', () => {
  const meal: Expense = {
    id: 'y', date: '2026-11-02T09:10:00.000Z', amount: 12_000,
    category: 'منصرفات عامة', target: 'عام', name: 'فطور', notes: '',
  };
  // الحذف الفعلي = السجل يختفي من المصفوفة (لا يوجد نسخة مقفولة)
  const fin = computeFinancials([], [], [], []);
  assert.equal(fin.generalExpenses, 0);

  // وقبل الحذف كان محسوباً مرة واحدة
  assert.equal(computeFinancials([], [], [meal], []).generalExpenses, 12_000);
});
