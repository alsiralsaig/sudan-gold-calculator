import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anchorAgeHours,
  isCalibrationStale,
  CALIBRATION_STALE_HOURS,
  aedAnchorRatio,
  AED_PER_USD,
  type AedAnchor,
} from '../src/core/pricing';

const NOW = new Date('2026-10-15T15:30:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const anchor = (at?: string, gramPrice?: number): AedAnchor => ({
  aed: 2395,
  usd: 9300,
  ratio: aedAnchorRatio(2395, 9300)!,
  ...(at ? { at } : {}),
  ...(gramPrice ? { gramPrice } : {}),
});

test('anchorAgeHours: يحسب عمر المعايرة بالساعات', () => {
  assert.equal(anchorAgeHours(anchor(hoursAgo(3)), NOW), 3);
  assert.ok(Math.abs(anchorAgeHours(anchor(hoursAgo(0.5)), NOW)! - 0.5) < 1e-9);
  assert.ok(Math.abs(anchorAgeHours(anchor(hoursAgo(36)), NOW)! - 36) < 1e-9);
});

test('anchorAgeHours: معايرة قديمة بلا تاريخ (نسخة قبل التحديث) → null بلا انهيار', () => {
  assert.equal(anchorAgeHours(anchor(), NOW), null, 'ما فيش at');
  assert.equal(anchorAgeHours(null, NOW), null, 'ما فيش معايرة أصلاً');
  assert.equal(anchorAgeHours({ aed: 1, usd: 1, ratio: 1, at: 'مش تاريخ' }, NOW), null, 'تاريخ تالف');
});

test('isCalibrationStale: طازة جوه 12 ساعة → مش قديمة', () => {
  assert.equal(isCalibrationStale(anchor(hoursAgo(1)), NOW), false);
  assert.equal(isCalibrationStale(anchor(hoursAgo(CALIBRATION_STALE_HOURS - 1)), NOW), false);
});

test('isCalibrationStale: بعد 12 ساعة → قديمة وتستاهل تنبيه', () => {
  assert.equal(isCalibrationStale(anchor(hoursAgo(13)), NOW), true, 'يوم جديد = حدّث');
  assert.equal(isCalibrationStale(anchor(hoursAgo(48)), NOW), true);
});

test('ما فيش معايرة → ما فيش تنبيه (ما نزعجش المستخدم على الفاضي)', () => {
  assert.equal(isCalibrationStale(null, NOW), false, 'بدون معايرة = بدون تنبيه');
  assert.equal(isCalibrationStale(anchor(undefined), NOW), false, 'معايرة بلا تاريخ = بدون تنبيه');
});

test('المعايرة تحفظ سعر الجرام اللي اشتُقّت منه', () => {
  const a = anchor(hoursAgo(2), 1_028_000);
  assert.equal(a.gramPrice, 1_028_000);
  // والنسبة مضبوطة: 2395 ÷ (9300 ÷ 3.6725)
  const computed = 9300 / AED_PER_USD;
  assert.ok(Math.abs(a.ratio - 2395 / computed) < 1e-4);
});
