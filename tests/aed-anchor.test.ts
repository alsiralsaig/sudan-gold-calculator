import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aedAnchorRatio,
  resolveAedSdg,
  AED_PER_USD,
  AED_RATIO_MIN,
  AED_RATIO_MAX,
  AED_SDG_MIN,
  AED_SDG_MAX,
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

test('aedAnchorRatio: المدى واسع — يقبل أي درهم معقول من الصراف', () => {
  // المدى مفتوح (5% لـ 20 ضعف) فأي رقم داخل نطاق الدرهم 100-20,000 يتقبل ويتمشى مع الدولار
  for (const aed of [500, 1_000, 2_532, 5_000, 12_000, 20_000]) {
    const ratio = aedAnchorRatio(aed, USD);
    assert.ok(ratio !== null, `الدرهم ${aed} لازم يتقبل`);
    assert.ok(ratio! >= AED_RATIO_MIN && ratio! <= AED_RATIO_MAX);
  }
});

test('aedAnchorRatio: درهم برّه نطاق السوق يُرفض (كباية صريحة)', () => {
  assert.equal(aedAnchorRatio(AED_SDG_MIN - 1, USD), null, 'أقل من نطاق السوق');
  assert.equal(aedAnchorRatio(AED_SDG_MAX + 1, USD), null, 'أعلى من نطاق السوق');
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
  for (const bad of [0, AED_RATIO_MIN / 2, AED_RATIO_MAX * 2, -1]) {
    const r = resolveAedSdg({ aedRatio: bad, aedMarket: 2600, usdSell: USD });
    assert.equal(r.basis, 'market', `النسبة ${bad} لازم تتجاهل`);
    assert.equal(r.aedSdg, 2600);
  }
  // الحد الأدنى مقبول (ناتجه 125 جنيه — داخل نطاق السوق)
  const minEdge = resolveAedSdg({ aedRatio: AED_RATIO_MIN, usdSell: USD });
  assert.equal(minEdge.basis, 'anchored', 'الحد الأدنى مقبول');
  // والحد الأقصى مقبول لما ناتجه يفضل داخل النطاق
  const maxEdge = resolveAedSdg({ aedRatio: AED_RATIO_MAX, usdSell: 3_000 });
  assert.equal(maxEdge.basis, 'anchored', 'الحد الأقصى مقبول');
  assert.ok(maxEdge.aedSdg! <= AED_SDG_MAX);
});

test('الحارس الحقيقي: معايرة ناتجها درهم برّه النطاق تُتجاهل ولو كانت النسبة داخل المدى', () => {
  // نسبة 0.1 داخل المدى، بس ناتجها ~54 جنيه — تحت نطاق السوق → تُرفض
  const tooLow = resolveAedSdg({ aedRatio: 0.1, aedMarket: 2600, usdSell: 2_000 });
  assert.equal(tooLow.basis, 'market', `الناتج ${0.1 * (2_000 / AED_PER_USD)} تحت ${AED_SDG_MIN}`);
  assert.equal(tooLow.aedSdg, 2600);

  // نسبة 8 داخل المدى، بس ناتجها ~26 ألف — فوق نطاق السوق → تُرفض
  const tooHigh = resolveAedSdg({ aedRatio: 8, aedMarket: 2600, usdSell: 12_000 });
  assert.equal(tooHigh.basis, 'market', `الناتج ${8 * (12_000 / AED_PER_USD)} فوق ${AED_SDG_MAX}`);
  assert.equal(tooHigh.aedSdg, 2600);

  // ونسبة 7 ناتجها ~17.5 ألف — داخل النطاق → تُقبل
  const fine = resolveAedSdg({ aedRatio: 7, usdSell: USD });
  assert.equal(fine.basis, 'anchored');
  assert.ok(fine.aedSdg! <= AED_SDG_MAX && fine.aedSdg! >= AED_SDG_MIN);
});

test('المعايرة الواسعة تفضل تمشي مع الدولار بنسبة بعيدة عن 1', () => {
  // صراف في ولاية تانية: درهم 6,000 مع دولار 9,200 → نسبة ≈ 2.395
  const ratio = aedAnchorRatio(6_000, USD)!;
  assert.ok(ratio > 2 && ratio < 2.5, `نسبة متوقعة ~2.4، جاءت ${ratio}`);
  const atStart = resolveAedSdg({ aedRatio: ratio, usdSell: USD });
  assert.ok(Math.abs(atStart.aedSdg! - 6_000) < 0.5);
  const moved = resolveAedSdg({ aedRatio: ratio, usdSell: 11_040 }); // +20%
  assert.ok(Math.abs(moved.aedSdg! - 7_200) < 1, `يمشي بنفس النسبة: ${moved.aedSdg}`);
});

test('قيم غير رقمية ما تسببش استثناء', () => {
  const r = resolveAedSdg({ overrideAed: NaN, aedRatio: NaN, aedMarket: NaN, usdSell: NaN });
  assert.equal(r.basis, null);
});
