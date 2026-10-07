import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateReadings,
  checkApproval,
  compareWithPublished,
  computeGoldPrice,
  detectBigChange,
  operationPriceWarning,
  GRAMS_PER_OUNCE,
  SourceReading,
} from '../src/core/pricing';

const NOW = new Date('2026-10-07T12:00:00Z');
const fresh = (minutesAgo = 10) => new Date(NOW.getTime() - minutesAgo * 60000).toISOString();

/* ------------------------------ جمع القراءات ------------------------------ */

test('aggregateReadings: مصدران متقاربان → اتفاق عالٍ وسعر صالح', () => {
  const readings: SourceReading[] = [
    { source: 'أ', kind: 'parallel', buy: 8330, sell: 8730, at: fresh(20) },
    { source: 'ب', kind: 'parallel', buy: 8340, sell: 8760, at: fresh(35) },
  ];
  const agg = aggregateReadings(readings, 'parallel', NOW);
  assert.equal(agg.used.length, 2);
  assert.equal(agg.agreement, 'high');
  assert.ok(agg.sell && Math.abs(agg.sell - 8745) < 1, 'الوسيط بين 8730 و 8760');
  assert.ok(agg.buy && Math.abs(agg.buy - 8335) < 1);
  assert.ok(agg.confidence >= 0.7, `ثقة عالية متوقعة، جاءت ${agg.confidence}`);
});

test('aggregateReadings: مصدر شاذ يُستبعد ولا يُفسد السعر', () => {
  const readings: SourceReading[] = [
    { source: 'أ', kind: 'parallel', buy: 8330, sell: 8730, at: fresh(10) },
    { source: 'ب', kind: 'parallel', buy: 8350, sell: 8760, at: fresh(20) },
    { source: 'ج', kind: 'parallel', buy: 9000, sell: 9500, at: fresh(5) },
  ];
  const agg = aggregateReadings(readings, 'parallel', NOW);
  assert.equal(agg.used.length, 2, 'المصدر الشاذ مستبعد');
  assert.equal(agg.rejected.length, 1);
  assert.match(agg.rejected[0].reason, /شاذة/);
  assert.ok(agg.sell && agg.sell < 9000, 'السعر لم يتلوّث بالرقم الشاذ');
});

test('aggregateReadings: اختلاف هائل بين المصادر → لا سعر + تحذير', () => {
  const readings: SourceReading[] = [
    { source: 'أ', kind: 'parallel', sell: 5800, at: fresh(10) },
    { source: 'ب', kind: 'parallel', sell: 5850, at: fresh(12) },
    { source: 'ج', kind: 'parallel', sell: 8400, at: fresh(8) },
  ];
  const agg = aggregateReadings(readings, 'parallel', NOW);
  // 8400 شاذ → يُستبعد، فيبقى مصدران متقاربان. لكن مع قيم متقاربة تحقق التالي:
  const wide = aggregateReadings(
    [
      { source: 'أ', kind: 'parallel', sell: 5800, at: fresh(10) },
      { source: 'ب', kind: 'parallel', sell: 8400, at: fresh(10) },
    ],
    'parallel',
    NOW
  );
  assert.equal(wide.agreement, 'none', 'مصدران متباعدان جداً = لا اتفاق');
  assert.equal(wide.sell, null, 'لا يُعتمد سعر عند عدم الاتفاق');
  assert.ok(wide.warnings.some((w) => w.includes('اختلاف غير طبيعي')));
  assert.ok(agg.used.length >= 1);
});

test('aggregateReadings: قراءة قديمة (أكثر من 36 ساعة) تُرفض', () => {
  const readings: SourceReading[] = [{ source: 'أ', kind: 'parallel', sell: 8700, at: fresh(60 * 48) }];
  const agg = aggregateReadings(readings, 'parallel', NOW);
  assert.equal(agg.used.length, 0);
  assert.match(agg.rejected[0].reason, /قديمة/);
  assert.equal(agg.confidence, 0);
});

test('aggregateReadings: قيم غير منطقية تُرفض (شراء أعلى من البيع، أو خارج النطاق)', () => {
  const agg = aggregateReadings(
    [
      { source: 'أ', kind: 'parallel', buy: 9000, sell: 8000, at: fresh(5) },
      { source: 'ب', kind: 'parallel', sell: 12, at: fresh(5) },
      { source: 'ج', kind: 'parallel', sell: 8700, at: fresh(5) },
    ],
    'parallel',
    NOW
  );
  assert.equal(agg.used.length, 1);
  assert.equal(agg.used[0].source, 'ج');
  assert.equal(agg.rejected.length, 2);
});

test('aggregateReadings: سعر مفرد (بلا شراء/بيع) يُقبل ويُستخدم في المتوسط', () => {
  const agg = aggregateReadings(
    [
      { source: 'أ', kind: 'parallel', sell: 8700, at: fresh(10) },
      { source: 'ب', kind: 'parallel', price: 8740, at: fresh(30) },
    ],
    'parallel',
    NOW
  );
  assert.equal(agg.used.length, 2);
  assert.ok(agg.avg && agg.avg > 8700 && agg.avg < 8750);
});

test('aggregateReadings: الأونصة تُقاس بحدودها الخاصة لا حدود الدولار', () => {
  const good = aggregateReadings(
    [
      { source: 'gold-api', kind: 'spot', price: 4134.7, at: fresh(5) },
      { source: 'yahoo', kind: 'spot', price: 4140.2, at: fresh(2) },
    ],
    'spot',
    NOW
  );
  assert.equal(good.used.length, 2);
  assert.ok(good.agreement === 'high');
  // 8000 دولار للأونصة = خارج الحدود المنطقية (12,000 سقف، لكن 8000 مقبول)
  const impossible = aggregateReadings([{ source: 'خطأ', kind: 'spot', price: 45, at: fresh(1) }], 'spot', NOW);
  assert.equal(impossible.used.length, 0);
});

/* ------------------------------ حساب السعر ------------------------------ */

test('computeGoldPrice: المعادلة صحيحة (أونصة × دولار ÷ 31.1 × العيار)', () => {
  const r = computeGoldPrice({ ounceUsd: 4134.7, usdBuy: 8330, usdSell: 8730, karat: 21 });
  const gram24Buy = (4134.7 / GRAMS_PER_OUNCE) * 8330;
  const expectedBuy = gram24Buy * (21 / 24);
  assert.ok(Math.abs(r.buy - expectedBuy) < 2, `الشراء: ${r.buy} مقابل ${Math.round(expectedBuy)}`);
  assert.ok(r.sell > r.buy, 'سعر البيع أعلى من الشراء دائماً (فارق الدولار)');
  assert.equal(r.ok, true);
});

test('computeGoldPrice: لا يستخدم المتوسط أعمى — الشراء والبيع من سعرَي الدولار', () => {
  const r = computeGoldPrice({ ounceUsd: 4000, usdBuy: 8000, usdSell: 9000, karat: 21 });
  const midBySellerRate = ((4000 / GRAMS_PER_OUNCE) * 9000 * 21) / 24;
  assert.ok(r.sell > r.mid && r.buy < r.mid, 'الشراء أقل والبيع أعلى من المتوسط');
  assert.ok(Math.abs(r.sell - midBySellerRate) < 2);
  assert.equal(r.spreadPercent > 10, true, 'الفارق يعكس فارق الدولار (12.5%)');
});

test('computeGoldPrice: تعديل السوق المحلي يُطبَّق على الشراء والبيع', () => {
  const base = computeGoldPrice({ ounceUsd: 4000, usdBuy: 8500, usdSell: 8500 });
  const plus = computeGoldPrice({ ounceUsd: 4000, usdBuy: 8500, usdSell: 8500, localAdjustPercent: 5 });
  assert.ok(plus.buy > base.buy && plus.sell > base.sell);
  assert.ok(Math.abs(plus.buy - base.buy * 1.05) < 2);
  const minus = computeGoldPrice({ ounceUsd: 4000, usdBuy: 8500, usdSell: 8500, localAdjustPercent: -10 });
  assert.ok(minus.buy < base.buy);
});

test('computeGoldPrice: مدخلات غير صالحة تُعلَّم بوضوح', () => {
  const r = computeGoldPrice({ ounceUsd: 0, usdBuy: 0, usdSell: 0 });
  assert.equal(r.ok, false);
  assert.ok(r.warnings.length > 0);
});

test('computeGoldPrice: سعر شراء الدولار أعلى من بيعه = خطأ (يُعلَّم)', () => {
  const r = computeGoldPrice({ ounceUsd: 4000, usdBuy: 9000, usdSell: 8000 });
  assert.equal(r.ok, false);
});

/* --------------------------- التغيّر الكبير --------------------------- */

test('detectBigChange: تغيّر 3% لا يُعتبر كبيراً، و54% يحتاج تأكيداً', () => {
  const small = detectBigChange(5800, 5974, 5);
  assert.equal(small.changed, false);
  assert.ok(small.percent > 2.9 && small.percent < 3.1);

  const big = detectBigChange(5800, 8900, 5);
  assert.equal(big.changed, true);
  assert.equal(big.direction, 'up');
  assert.match(big.message || '', /يحتاج تأكيد/);

  const drop = detectBigChange(8900, 5800, 5);
  assert.equal(drop.direction, 'down');
});

test('detectBigChange: لا تحذير عند غياب سعر سابق', () => {
  const r = detectBigChange(null, 8700);
  assert.equal(r.changed, false);
  assert.equal(r.percent, 0);
});

test('checkApproval: يعتمد تلقائياً في التغيّر الطبيعي ويطلب تأكيداً عند القفزة', () => {
  const current = { buy: 800000, sell: 840000, at: NOW.toISOString(), source: 'manual' as const };

  const normal = checkApproval(current, { buy: 810000, sell: 850000 });
  assert.equal(normal.needsConfirmation, false);
  assert.equal(normal.messages.length, 0);

  const jump = checkApproval(current, { buy: 950000, sell: 990000 });
  assert.equal(jump.needsConfirmation, true);
  assert.equal(jump.messages.length, 2, 'تحذير للشراء وتحذير للبيع');
  assert.ok(jump.messages[0].includes('سعر الشراء المعتمد'));
});

test('operationPriceWarning: تحذير عند تعديل سعر العملية بعيداً عن المعتمد', () => {
  assert.equal(operationPriceWarning(890000, 880000, 2), null, 'فرق 1.1% لا يستدعي تحذيراً');
  const warn = operationPriceWarning(920000, 880000, 2);
  assert.ok(warn && warn.includes('أعلى') && warn.includes('4.55'));
  const lower = operationPriceWarning(840000, 880000, 2);
  assert.ok(lower && lower.includes('أقل'));
});

/* --------------------- المقارنة بسعر محلي منشور --------------------- */

test('compareWithPublished: فرق كبير مع السوق المحلي يُنذر', () => {
  assert.equal(compareWithPublished(880000, 885000).ok, true);
  const bad = compareWithPublished(880000, 700000);
  assert.equal(bad.ok, false);
  assert.ok((bad.message || '').includes('راجع المصادر'));
  assert.equal(compareWithPublished(880000, null).ok, true, 'بلا سعر منشور لا إنذار');
});

test('aggregateReadings: مصدر واحد لا يُنتج تحذير «اختلاف» بل ملاحظة', () => {
  const agg = aggregateReadings([{ source: 'وحيد', kind: 'bank', buy: 4332.25, sell: 4316.13, at: fresh(5) }], 'bank', NOW);
  assert.equal(agg.used.length, 1);
  assert.ok(!agg.warnings.some((w) => w.includes('اختلاف')), 'لا تحذير اختلاف مع مصدر واحد');
  assert.ok(agg.warnings.some((w) => w.includes('مصدر واحد')), 'ملاحظة مصدر واحد');
  assert.ok(agg.sell && agg.sell > 0, 'السعر متاح رغم التحفظ');
});

test('aggregateReadings: القراءة المفردة تدخل في حساب الشراء والبيع معاً', () => {
  const readings: SourceReading[] = [
    { source: 'أ', kind: 'parallel', buy: 8185, sell: 8675, at: fresh(30) },
    { source: 'ب', kind: 'parallel', price: 8600, at: fresh(20) },
  ];
  const agg = aggregateReadings(readings, 'parallel', NOW);
  assert.equal(agg.used.length, 2);
  // البيع = وسيط [8675, 8600] = 8637.5 | الشراء = وسيط [8185, 8600] = 8392.5
  assert.ok(Math.abs((agg.sell || 0) - 8637.5) < 1, `البيع ${agg.sell}`);
  assert.ok(Math.abs((agg.buy || 0) - 8392.5) < 1, `الشراء ${agg.buy}`);
  assert.ok(agg.buy && agg.sell && agg.buy < agg.sell);
});
