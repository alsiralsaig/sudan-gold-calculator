import { test } from 'node:test';
import assert from 'node:assert/strict';

import { distributableProfit, profitDisplay } from '../src/core/accounting';

/** نفس حالة صورتك: تطبيق لسه ما باعش، وعليه 26,000 منصرفات عامة */
const ZEROED = { netProfit: -26_000, totalSales: 0, generalExpenses: 26_000 };

test('قبل أول مبيعة: ما فيش خسارة — الصفر مع تنبيه بالمنصرفات المؤجّلة', () => {
  const d = profitDisplay(ZEROED);
  assert.equal(d.signed, 0, 'ما يتوزّعش ربح سالب');
  assert.equal(d.amount, 0);
  assert.equal(d.kind, 'profit');
  assert.equal(d.label, 'صافي الربح');
  assert.ok(d.note?.includes('26,000'), `التنبيه يوضّح المبلغ: ${d.note}`);
  assert.ok(d.note?.includes('ما فيش مبيعات'), 'يوضّح السبب');
});

test('distributableProfit: قبل أول مبيعة والربح سالب → صفر', () => {
  assert.equal(distributableProfit(-26_000, 0), 0);
  assert.equal(distributableProfit(-26_000, 0), 0);
});

test('بعد أول مبيعة: الخسارة الحقيقية تتسمّى خسارة وتظهر موجبة', () => {
  // باعوا بـ 100 ألف، تكلفة 90 ألف، ومنصرفات 26 ألف → خسارة 16 ألف
  const d = profitDisplay({ netProfit: -16_000, totalSales: 100_000, generalExpenses: 26_000 });
  assert.equal(d.kind, 'loss', 'دي خسارة حقيقية');
  assert.equal(d.label, 'صافي الخسارة');
  assert.equal(d.amount, 16_000, 'تظهر موجبة — الرقم سالب مش منطقي في خانة «ربح»');
  assert.equal(d.signed, -16_000, 'والحساب الداخلي يفضل بإشارته');
});

test('ربح موجب: التسمية «صافي الربح» والرقم زي ما هو', () => {
  const d = profitDisplay({ netProfit: 500_000, totalSales: 2_000_000, generalExpenses: 26_000 });
  assert.equal(d.kind, 'profit');
  assert.equal(d.label, 'صافي الربح');
  assert.equal(d.amount, 500_000);
  assert.equal(d.signed, 500_000);
  assert.equal(d.note, undefined, 'ما فيش تنبيه');
});

test('صفر بالظبط = ربح صفر، مش خسارة', () => {
  const d = profitDisplay({ netProfit: 0, totalSales: 0, generalExpenses: 0 });
  assert.equal(d.kind, 'profit');
  assert.equal(d.amount, 0);
  assert.equal(d.signed, 0);
});

test('المنصرفات ما تُخفيش خسارة حقيقية بعد بدء البيع', () => {
  const d = profitDisplay({ netProfit: -5_000, totalSales: 1_000, generalExpenses: 26_000 });
  assert.equal(d.kind, 'loss', 'بمجرد ما في مبيعات → الخسارة تظهر');
  assert.equal(d.amount, 5_000);
});

test('توزيع أنصبة الشركاء على -26,000 قبل أول مبيعة → كل واحد صفر', () => {
  const base = distributableProfit(-26_000, 0);
  const partnerA = (base * 50) / 100;
  const partnerB = (base * 50) / 100;
  const partnerC = (base * 0) / 100;
  assert.equal(partnerA, 0, 'بدل -13,000 اللي كانت باينة في الصورة');
  assert.equal(partnerB, 0);
  assert.equal(partnerC, 0);
});

test('توزيع أنصبة الشركاء بعد المبيعات → الخسارة تتوزّع', () => {
  const base = distributableProfit(-16_000, 100_000);
  assert.equal((base * 50) / 100, -8_000, 'كل شريك يتحمّل نصيبه');
});
