import { test } from 'node:test';
import assert from 'node:assert/strict';

import { profitDisplay } from '../src/core/accounting';

/** نفس حالة صورتك: تطبيق مصفر، وعليه 26,000 منصرفات عامة + 58,500 منصرفات خاصة */
const ZEROED = { netProfit: -26_000, generalExpenses: 26_000 };

test('المنصرفات العامة تخصم وتظهر كخسارة — مش رقم سالب تحت عنوان «ربح»', () => {
  const d = profitDisplay(ZEROED);
  assert.equal(d.kind, 'loss');
  assert.equal(d.label, 'صافي الخسارة');
  assert.equal(d.amount, 26_000, 'موجبة — الرقم السالب ممنوع');
  assert.equal(d.signed, -26_000, 'والحساب الداخلي يفضل بإشارته');
});

test('الخسارة تتوزّع على الشركاء بنسب الربح (50% → 13,000 لكل واحد)', () => {
  const d = profitDisplay(ZEROED);
  const shareA = (d.signed * 50) / 100;
  const shareB = (d.signed * 50) / 100;
  const shareC = (d.signed * 0) / 100;
  assert.equal(shareA, -13_000);
  assert.equal(shareB, -13_000);
  assert.equal(Math.abs(shareC), 0, 'شريك بنسبة 0% ما يتحمّلش خسارة، وما يظهرش -0');
  // والعرض: موجب وباسم «نصيب الخسارة»
  assert.equal(Math.abs(shareA), 13_000);
});

test('صافي المستحق = رأس المال + نصيب الخسارة − المنصرفات الخاصة', () => {
  const netProfit = -26_000;
  const ناجو = { capital: 2_020_000, pct: 50, priv: 44_500 };
  const تاجو = { capital: 9_581_000, pct: 50, priv: 14_000 };
  const والي = { capital: 2_230_000, pct: 0, priv: 0 };

  const net = (p: { capital: number; pct: number; priv: number }) =>
    p.capital + (netProfit * p.pct) / 100 - p.priv;

  assert.equal(net(ناجو), 1_962_500, '2,020,000 − 13,000 − 44,500');
  assert.equal(net(تاجو), 9_554_000, '9,581,000 − 13,000 − 14,000');
  assert.equal(net(والي), 2_230_000, 'نسبة 0% → ما يتأثرش');
});

test('التنبيه يوضّح السبب: المنصرفات أكبر من إجمالي الربح', () => {
  const d = profitDisplay(ZEROED);
  assert.ok(d.note?.includes('26,000'), `يذكر المنصرفات: ${d.note}`);
  assert.ok(d.note?.includes('إجمالي الربح'), `يذكر إجمالي الربح: ${d.note}`);
  assert.ok(d.note?.includes('0'), `إجمالي الربح صفر: ${d.note}`);
});

test('ربح موجب: التسمية «صافي الربح» والرقم زي ما هو', () => {
  const d = profitDisplay({ netProfit: 500_000, generalExpenses: 26_000 });
  assert.equal(d.kind, 'profit');
  assert.equal(d.label, 'صافي الربح');
  assert.equal(d.amount, 500_000);
  assert.equal(d.signed, 500_000);
  assert.equal(d.note, undefined, 'ما فيش تنبيه');
});

test('صفر بالظبط = ربح صفر، مش خسارة', () => {
  const d = profitDisplay({ netProfit: 0, generalExpenses: 0 });
  assert.equal(d.kind, 'profit');
  assert.equal(d.amount, 0);
  assert.equal(d.signed, 0);
});

test('خسارة بعد مبيعات: تظهر موجبة وسببها واضح', () => {
  // باعوا بـ 100 ألف، تكلفة 90 ألف → إجمالي الربح 10 آلاف، والمنصرفات 26 ألف
  const d = profitDisplay({ netProfit: -16_000, generalExpenses: 26_000 });
  assert.equal(d.kind, 'loss');
  assert.equal(d.amount, 16_000);
  assert.ok(d.note?.includes('10,000'), `يذكر إن إجمالي الربح 10,000: ${d.note}`);
});

test('الخسارة ما تتخبّش — لو المنصرفات كبرت عن الربح تظهر', () => {
  const d = profitDisplay({ netProfit: -5_000, generalExpenses: 26_000 });
  assert.equal(d.kind, 'loss');
  assert.equal(d.amount, 5_000);
});
