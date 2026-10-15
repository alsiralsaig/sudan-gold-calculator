import { test } from 'node:test';
import assert from 'node:assert/strict';

import { profitDisplay } from '../src/core/accounting';

test('الربح الموجب: التسمية «صافي الربح» والرقم زي ما هو', () => {
  const d = profitDisplay({ netProfit: 500_000 });
  assert.equal(d.kind, 'profit');
  assert.equal(d.label, 'صافي الربح');
  assert.equal(d.amount, 500_000);
  assert.equal(d.signed, 500_000);
  assert.equal(d.note, undefined, 'ما فيش تنبيه');
});

test('صفر بالظبط = ربح صفر، مش خسارة', () => {
  const d = profitDisplay({ netProfit: 0 });
  assert.equal(d.kind, 'profit');
  assert.equal(d.amount, 0);
  assert.equal(d.signed, 0);
});

test('خسارة تجارية (التكلفة أكبر من المبيعات): تظهر موجبة وباسم «خسارة»', () => {
  const d = profitDisplay({ netProfit: -16_000 });
  assert.equal(d.kind, 'loss');
  assert.equal(d.label, 'صافي الخسارة');
  assert.equal(d.amount, 16_000, 'موجبة — الرقم السالب ممنوع');
  assert.equal(d.signed, -16_000, 'والحساب الداخلي يفضل بإشارته');
  assert.ok(d.note?.includes('16,000'), `التنبيه يذكر المبلغ: ${d.note}`);
});

test('الخسارة تتوزّع على الشركاء بنسب الربح (50% → 8,000 لكل واحد)', () => {
  const d = profitDisplay({ netProfit: -16_000 });
  const shareA = (d.signed * 50) / 100;
  const shareC = (d.signed * 0) / 100;
  assert.equal(shareA, -8_000);
  assert.equal(Math.abs(shareA), 8_000, 'يُعرض موجباً ك«نصيب خسارة»');
  assert.equal(Math.abs(shareC), 0, 'شريك بنسبة 0% ما يتحمّلش، وما يظهرش -0');
});
