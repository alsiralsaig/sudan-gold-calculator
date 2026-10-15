import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aedAnchorRatio,
  resolveAedSdg,
  AED_PER_USD,
  AED_RATIO_MIN,
  AED_RATIO_MAX,
} from '../src/core/pricing';

const USD = 9200; // دولار السوق الموازي وقت المعايرة
const COMPUTED = USD / AED_PER_USD; // ≈ 2505.1 جنيه للدرهم

/* --------------------------- نسبة المعايرة --------------------------- */

test('aedAnchorRatio: نسبة صراف حقيقي أعلى من المحسوب تُحسب وتتقرّب لـ 4 خانات', () => {
  // الصراف قال 2532 والدولار 9200 → المحسوب 2505.1 → النسبة ≈ 1.0107
  const ratio = aedAnchorRatio(2532, USD);
  assert.ok(ratio !== null);
  assert.equal(ratio, Math.round((2532 / COMPUTED) * 10000) / 10000);
  assert.ok(ratio! > 1 && ratio! < 1.05, `نسبة متوقعة قريبة من 1، جاءت ${ratio}`);
});

test('aedAnchorRatio: نسبة برّه المدى المعقول تُرفض (ما نبوّظش التسعير)', () => {
  assert.equal(aedAnchorRatio(50, USD), null, 'درهم رخيص بشكل غير معقول');
  assert.equal(aedAnchorRatio(50_000, USD), null, 'درهم غالي بشكل غير معقول');
  assert.equal(aedAnchorRatio(0, USD), null);
  assert.equal(aedAnchorRatio(2532, 0), null);
});

/* -------------------- وعد v6.20.4: الدرهم يمشي مع الدولار -------------------- */

test('المعايرة: الدرهم يتحرك مع الدولار بنفس النسبة تلقائياً — مش مجمّد', () => {
  const ratio = aedAnchorRatio(2532, USD)!;

  const first = resolveAedSdg({ aedRatio: ratio, usdSell: USD });
  assert.equal(first.basis, 'anchored');
  assert.ok(Math.abs(first.aedSdg! - 2532) < 0.5, 'أول جلب يطلع نفس رقم الصراف');

  // الدولار نطّ من 9200 → 10,120 (+10%)
  const after = resolveAedSdg({ aedRatio: ratio, usdSell: 10_120 });
  assert.equal(after.basis, 'anchored');
  assert.ok(
    Math.abs(after.aedSdg! - 2532 * (10_120 / USD)) < 0.5,
    `الدرهم لازم يمشي بنفس النسبة: ${after.aedSdg} مقابل ${2532 * (10_120 / USD)}`,
  );
  assert.ok(after.aedSdg! > first.aedSdg!, 'الدرهم يزيد مع الدولار — ما يفضلش مجمّد');

  // والدولار نزل → الدرهم ينزل معاه
  const down = resolveAedSdg({ aedRatio: ratio, usdSell: 8_280 });
  assert.ok(down.aedSdg! < first.aedSdg!, 'الدرهم ينزل مع الدولار');
});

/* ------------------------------ ترتيب الأولوية ------------------------------ */

test('الأولوية: التدخل اليدوي الصريح يكسح المعايرة', () => {
  const r = resolveAedSdg({ overrideAed: 2400, aedRatio: 1.0107, usdSell: USD });
  assert.equal(r.basis, 'manual');
  assert.equal(r.aedSdg, 2400);
});

test('الأولوية: المعايرة تتقدّم على قراءة السوق المنشورة', () => {
  const r = resolveAedSdg({ aedRatio: 1.2, aedMarket: 2600, usdSell: USD });
  assert.equal(r.basis, 'anchored');
  assert.ok(Math.abs(r.aedSdg! - 1.2 * COMPUTED) < 0.001);
});

test('الأولوية: بدون معايرة تؤخذ قراءة السوق، ولو مشتقة من الدولار تتعلّم computed بصراحة', () => {
  const market = resolveAedSdg({ aedMarket: 2600, usdSell: USD });
  assert.equal(market.basis, 'market');
  assert.equal(market.aedSdg, 2600);

  // قراءة مطابقة للمحسوب (فرق < 0.5%) = مجرد دولار ÷ 3.6725 مش سعر سوق حقيقي
  const fake = resolveAedSdg({ aedMarket: COMPUTED, usdSell: USD });
  assert.equal(fake.basis, 'computed');
});

test('الأولوية: آخر حل هو المحسوب من الدولار ÷ 3.6725', () => {
  const r = resolveAedSdg({ usdSell: USD });
  assert.equal(r.basis, 'computed');
  assert.ok(Math.abs(r.aedSdg! - COMPUTED) < 0.001);
});

test('ما فيش دولار ولا قراءة → ما فيش درهم، من غير استثناء', () => {
  const r = resolveAedSdg({});
  assert.equal(r.basis, null);
  assert.equal(r.aedSdg, null);
});

/* ------------------------------ حماية المدخلات ------------------------------ */

test('نسبة برّه المدى تُتجاهل بدل ما تبوّظ السعر', () => {
  for (const bad of [0, 0.1, AED_RATIO_MIN, AED_RATIO_MAX, 5, -1]) {
    const r = resolveAedSdg({ aedRatio: bad, aedMarket: 2600, usdSell: USD });
    assert.equal(r.basis, 'market', `النسبة ${bad} لازم تتجاهل`);
    assert.equal(r.aedSdg, 2600);
  }
});

test('قيم غير رقمية ما تسببش استثناء', () => {
  const r = resolveAedSdg({ overrideAed: NaN, aedRatio: NaN, aedMarket: NaN, usdSell: NaN });
  assert.equal(r.basis, null);
});
