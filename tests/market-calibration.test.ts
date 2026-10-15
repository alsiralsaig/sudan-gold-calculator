import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calibrateToMarketPrice,
  computeGoldPrice,
  GRAMS_PER_OUNCE,
  AED_PER_USD,
  AED_SDG_MAX,
  TRADE_KARAT,
} from '../src/core/pricing';

/** نفس أرقام يوم 15 أكتوبر 2026 */
const OUNCE = 4149.91;
const USD_BUY = 9100;
const USD_SELL = 9300;
const AED_NOMINAL = 2532; // 9300 ÷ 3.6725 — «النظري» اللي بينشروه
const MARKET_TODAY = 1_028_000; // سعر البيع الحقيقي لجرام 21

const engineSell = (aed: number, adjust = 0) =>
  computeGoldPrice({
    ounceUsd: OUNCE,
    usdBuy: USD_BUY,
    usdSell: USD_SELL,
    aedSdg: aed,
    localAdjustPercent: adjust,
    karat: TRADE_KARAT,
  }).sell;

test('المحرك بالدرهم النظري يطلع ~1,085,639 — أعلى من سعر السوق 1,028,000', () => {
  const sell = engineSell(AED_NOMINAL);
  assert.ok(sell > 1_080_000 && sell < 1_090_000, `المتوقع ~1,085,639، جاء ${sell}`);
  assert.ok(sell > MARKET_TODAY, 'المحرك أعلى من السوق — ده سبب الشكوى');
});

test('معايرة بسعر السوق تستنتج درهم سوق الذهب ≈ 2,397', () => {
  const current = engineSell(AED_NOMINAL);
  const cal = calibrateToMarketPrice({ currentSell: current, targetSell: MARKET_TODAY, aedSdg: AED_NOMINAL });
  assert.ok(cal, 'لازم ترجع معايرة');
  assert.equal(cal!.mode, 'dirham');
  assert.ok(Math.abs(cal!.aedSdg! - 2_397) <= 3, `المتوقع ~2397، جاء ${cal!.aedSdg}`);
  assert.ok(cal!.gapPercent < -5 && cal!.gapPercent > -6, `الفرق المتوقع ~-5.31%، جاء ${cal!.gapPercent}`);
});

test('الدرهم المستنتج يرجّع نفس سعر السوق بالظبط ( round-trip )', () => {
  const current = engineSell(AED_NOMINAL);
  const cal = calibrateToMarketPrice({ currentSell: current, targetSell: MARKET_TODAY, aedSdg: AED_NOMINAL })!;
  const after = engineSell(cal.aedSdg!);
  assert.ok(
    Math.abs(after - MARKET_TODAY) / MARKET_TODAY < 0.0005,
    `بعد المعايرة لازم نطلع ${MARKET_TODAY}، جاء ${after}`,
  );
});

test('المعايرة تفضل صامدة لو السوق اتحرك — نفس النسبة', () => {
  const cal = calibrateToMarketPrice({
    currentSell: engineSell(AED_NOMINAL),
    targetSell: MARKET_TODAY,
    aedSdg: AED_NOMINAL,
  })!;
  // نسبة المعايرة = 2397 ÷ (9300 ÷ 3.6725)
  const ratio = cal.aedSdg! / (USD_SELL / AED_PER_USD);
  // الأونصة نزلت 5% → السعر ينزل ~5% بنفس النسبة
  const lower = computeGoldPrice({
    ounceUsd: OUNCE * 0.95,
    usdBuy: USD_BUY,
    usdSell: USD_SELL,
    aedSdg: ratio * (USD_SELL / AED_PER_USD),
    karat: TRADE_KARAT,
  }).sell;
  assert.ok(Math.abs(lower - MARKET_TODAY * 0.95) / (MARKET_TODAY * 0.95) < 0.001, `جاء ${lower}`);
});

test('سعر بعيد عن المعقول (أكثر من ±50%) يُرفض — حماية من الأصفار', () => {
  const current = engineSell(AED_NOMINAL);
  assert.equal(calibrateToMarketPrice({ currentSell: current, targetSell: 102_800, aedSdg: AED_NOMINAL }), null);
  assert.equal(calibrateToMarketPrice({ currentSell: current, targetSell: 10_280_000, aedSdg: AED_NOMINAL }), null);
  assert.equal(calibrateToMarketPrice({ currentSell: 0, targetSell: MARKET_TODAY, aedSdg: AED_NOMINAL }), null);
  assert.equal(calibrateToMarketPrice({ currentSell: current, targetSell: 0, aedSdg: AED_NOMINAL }), null);
});

test('بدون درهم (تسعير بالدولار) → يستنتج نسبة تعديل السوق المحلي', () => {
  // aedSdg = 0 يعني computeGoldPrice يمشي بالدولار
  const current = computeGoldPrice({ ounceUsd: OUNCE, usdBuy: USD_BUY, usdSell: USD_SELL, aedSdg: 0, karat: TRADE_KARAT }).sell;
  const cal = calibrateToMarketPrice({ currentSell: current, targetSell: current * 0.9, aedSdg: 0 });
  assert.ok(cal);
  assert.equal(cal!.mode, 'adjust');
  assert.ok(Math.abs(cal!.adjustPercent! - -10) < 0.15, `المتوقع -10%， جاء ${cal!.adjustPercent}`);
});

test('النسبة المستنتجة تتقيّد بمدى التعديل المسموح (-20%..+50%)', () => {
  const cal = calibrateToMarketPrice({ currentSell: 1_000_000, targetSell: 1_400_000, aedSdg: 0 });
  assert.equal(cal!.adjustPercent, 40);
  const capped = calibrateToMarketPrice({ currentSell: 1_000_000, targetSell: 1_450_000, aedSdg: 0 });
  assert.equal(capped!.adjustPercent, 45);
});

test('درهم مستنتج برّه نطاق السوق يُرفض', () => {
  // أونصة وهمية صغيرة تخلّي النسبة تطلع الدرهم فوق 20,000
  const cal = calibrateToMarketPrice({ currentSell: 1_000, targetSell: 1_500, aedSdg: AED_SDG_MAX });
  assert.equal(cal, null, `${AED_SDG_MAX} × 1.5 فوق النطاق`);
});

test('الحسبة خطّية في الدرهم — مضاعفة الدرهم تضاعف السعر', () => {
  const a = engineSell(2000);
  const b = engineSell(4000);
  assert.ok(Math.abs(b / a - 2) < 0.0001, `النسبة ${b / a}`);
  assert.ok(Math.abs(engineSell(AED_NOMINAL) - (OUNCE / GRAMS_PER_OUNCE) * AED_PER_USD * AED_NOMINAL * (TRADE_KARAT / 24)) < 1);
});
