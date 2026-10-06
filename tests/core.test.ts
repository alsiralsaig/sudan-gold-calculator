import test from 'node:test';
import assert from 'node:assert/strict';

import { purityToFineness, unitsToK21, priceForKarat, purityLabel } from '../src/core/purity';
import { computeInventory, computeFinancials, salePending, summarizeRange } from '../src/core/accounting';
import { mergeRecordsWithTombstones } from '../src/core/merge';
import type { Expense, Partner, Purchase, Sale } from '../src/types';

/* ------------------------------- العيار والنقاوة ------------------------------- */

test('purityToFineness: العيار 21 يساوي نقاوة 875', () => {
  assert.equal(purityToFineness(21), 875);
  assert.equal(purityToFineness(24), 1000);
  assert.equal(purityToFineness(18), 750);
});

test('purityToFineness: النقاوة المباشرة تُقبل كما هي', () => {
  assert.equal(purityToFineness(650), 650);
  assert.equal(purityToFineness(875), 875);
});

test('unitsToK21: العيار 21 هو المرجع (لا تغيير)', () => {
  assert.equal(unitsToK21(1000, 21), 1000);
});

test('unitsToK21: 100 جرام خالص = 114.29 جرام معادل 21', () => {
  const k21 = unitsToK21(10000, 24); // 100 جرام
  assert.equal(Math.round((k21 / 100) * 100) / 100, 114.29);
});

test('unitsToK21: 100 جرام عيار 18 = 85.71 جرام معادل 21', () => {
  const k21 = unitsToK21(10000, 18);
  assert.equal(Math.round((k21 / 100) * 100) / 100, 85.71);
});

test('unitsToK21: النقاوة 650 تعطي معادل أقل من عيار 21', () => {
  const k21 = unitsToK21(10000, 650);
  assert.equal(Math.round((k21 / 100) * 100) / 100, 74.29);
});

test('priceForKarat: سعر عيار 24 = سعر 21 × 1000/875', () => {
  assert.equal(Math.round(priceForKarat(1_000_000, 24)), Math.round(1_000_000 * (1000 / 875)));
});

test('purityLabel: يعرض العيار أو النقاوة', () => {
  assert.equal(purityLabel(21), '21');
  assert.equal(purityLabel(650), '650');
});

/* --------------------------------- المخزون --------------------------------- */

const purchase = (over: Partial<Purchase>): Purchase => ({
  id: 'p1',
  date: '2026-01-01T00:00:00.000Z',
  units: 10000, // 100 جرام
  purity: 21,
  amount: 50_000_000,
  pendingAmount: 0,
  seller: 'بائع',
  bankAccount: '',
  notes: '',
  payments: [],
  ...over,
});

const sale = (over: Partial<Sale>): Sale => ({
  id: 's1',
  date: '2026-01-02T00:00:00.000Z',
  units: 1000, // 10 جرام
  purity: 21,
  buyAmount: 5_000_000,
  sellAmount: 6_000_000,
  buyer: 'زبون',
  notes: '',
  ...over,
});

test('computeInventory: يفرّق بين العيارات ويحوّل لمعادل 21', () => {
  const inv = computeInventory(
    [
      purchase({ id: 'p1', units: 10000, purity: 18, amount: 30_000_000 }), // 100g 18k
      purchase({ id: 'p2', units: 5000, purity: 24, amount: 25_000_000 }), // 50g 24k
    ],
    [sale({ units: 1000, purity: 21 })], // 10g 21k
    { karat21: 1_000_000 } as any
  );

  // 100g@18 = 85.714g21 ، 50g@24 = 57.143g21 ، ناقص 10g21 = 132.857g21
  assert.equal(Math.round((inv.unitsK21 / 100) * 100) / 100, 132.86);
  assert.ok(inv.byKarat.some((k) => k.purity === 18));
  assert.ok(inv.byKarat.some((k) => k.purity === 24));
});

test('computeInventory: يكتشف العجز في عيار لم يُشتر منه', () => {
  const inv = computeInventory([purchase({ purity: 21 })], [sale({ purity: 22 })]);
  assert.deepEqual(inv.negativeKarats, [22]);
});

test('computeInventory: يحسب الربح غير المحقق من الفرق بين القيمة والتكلفة', () => {
  const inv = computeInventory(
    [purchase({ units: 10000, purity: 21, amount: 100_000_000 })],
    [],
    { karat21: 1_200_000 } as any
  );
  // 100g21 × 1,200,000 = 120,000,000 والتكلفة 100,000,000
  assert.equal(inv.marketValue, 120_000_000);
  assert.equal(inv.unrealizedProfit, 20_000_000);
  assert.equal(inv.avgCostPerGramK21, 1_000_000);
});

test('computeInventory: يستثني السجلات المؤرشفة', () => {
  const inv = computeInventory([purchase({ archived: true })], []);
  assert.equal(inv.unitsK21, 0);
  assert.equal(inv.hasData, false);
});

/* ------------------------------- الذمم والأرباح ------------------------------- */

test('salePending: يحسب المتبقي من البيع الآجل', () => {
  assert.equal(salePending(sale({ sellAmount: 10_000_000, paidAmount: 4_000_000 })), 6_000_000);
  assert.equal(salePending(sale({ sellAmount: 10_000_000 })), 0); // بيانات قديمة = مدفوع
  assert.equal(salePending(sale({ sellAmount: 10_000_000, pendingAmount: 3_000_000 })), 3_000_000);
});

test('computeFinancials: الذمم المدينة والدائنة صحيحة', () => {
  const fin = computeFinancials(
    [purchase({ amount: 10_000_000, pendingAmount: 2_500_000 })],
    [sale({ sellAmount: 8_000_000, buyAmount: 6_000_000, pendingAmount: 1_500_000 })],
    [{ id: 'e1', date: '2026-01-01', amount: 500_000, category: 'إيجار', target: 'عام', name: '', notes: '' }],
    []
  );
  assert.equal(fin.receivables, 1_500_000);
  assert.equal(fin.payables, 2_500_000);
  assert.equal(fin.grossProfit, 2_000_000);
  assert.equal(fin.netProfit, 1_500_000);
  assert.equal(fin.openCreditSales, 1);
});

test('summarizeRange: يجمع حركة الفترة فقط', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  const to = new Date('2026-01-31T23:59:59.999Z');
  const summary = summarizeRange(
    [purchase({ date: '2026-01-10T10:00:00.000Z' }), purchase({ id: 'p2', date: '2026-03-01T10:00:00.000Z' })],
    [sale({ date: '2026-01-11T10:00:00.000Z' })],
    [],
    from,
    to
  );
  assert.equal(summary.purchasesCount, 1);
  assert.equal(summary.salesCount, 1);
  assert.equal(summary.profit, 1_000_000);
});

/* ---------------------------------- المزامنة ---------------------------------- */

test('merge: الحذف لا يعود بعد المزامنة (tombstone)', () => {
  const cloud = [purchase({ id: 'p1' }), purchase({ id: 'p2' })];
  const local = [purchase({ id: 'p2' })];
  const tombstones = { p1: new Date().toISOString() };
  const result = mergeRecordsWithTombstones(local, cloud, tombstones, {});
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'p2');
});

test('merge: السجل الأحدث تعديلاً يفوز', () => {
  const older = purchase({ id: 'p1', amount: 100, updatedAt: '2026-01-01T00:00:00.000Z' });
  const newer = purchase({ id: 'p1', amount: 200, updatedAt: '2026-02-01T00:00:00.000Z' });
  const result = mergeRecordsWithTombstones([older], [newer]);
  assert.equal(result.items[0].amount, 200);
});

test('merge: تعديل بعد الحذف يُحيي السجل', () => {
  const deletedAt = '2026-01-01T00:00:00.000Z';
  const edited = purchase({ id: 'p1', updatedAt: '2026-02-01T00:00:00.000Z' });
  const result = mergeRecordsWithTombstones([edited], [], { p1: deletedAt }, {});
  assert.equal(result.items.length, 1);
});

test('merge: يجمع السجلات الجديدة من الجهازين', () => {
  const result = mergeRecordsWithTombstones([purchase({ id: 'local' })], [purchase({ id: 'cloud' })]);
  assert.equal(result.items.length, 2);
});
