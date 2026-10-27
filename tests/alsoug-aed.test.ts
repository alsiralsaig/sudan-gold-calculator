import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseAlsougCurrency, isNonParallelUsdArticle } from '../src/lib/pricingSources';
import { resolveAedSdg, AED_PER_USD } from '../src/core/pricing';

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');

/** الجدول زي ما بينشره alsoug فعلاً — الرقم الأول بنك الخرطوم والثاني «البديل» */
const LIVE_TABLE = `
  اسعار بيع العملات مقابل الجنيه السوداني اليوم
  العملة بنك الخرطوم البديل
  $ الدولار الامريكي 4231.5 8990 اعرف المزيد>>
  الدرهم الاماراتي 1159.32 2450 اعرف المزيد>>
  € اليورو 4645.35 10362 اعرف المزيد>>
  الريال السعودي 1137.50 2360 اعرف المزيد>>
  الجنيه المصري 80.36 170 اعرف المزيد>>
  الريال القطري 1162.74 2450 اعرف المزيد>>
`;

test('parseAlsougCurrency: يستخرج درهم الموازي والدولار الموازي', () => {
  const r = parseAlsougCurrency(LIVE_TABLE);
  assert.equal(r.aedParallel, 2450, 'الدرهم من عمود البديل');
  assert.equal(r.usdParallel, 8990, 'الدولار من عمود البديل');
  assert.equal(r.raw.aedBank, 1159.32, 'الرقم الأول بنك الخرطوم');
  assert.equal(r.raw.usdBank, 4231.5);
});

test('parseAlsougCurrency: يتجاهل أرقام برّه النطاق بدل ما يبوّظ التسعير', () => {
  assert.equal(parseAlsougCurrency('الدرهم الاماراتي 1159.32 12').aedParallel, null, 'درهم رخيص جداً');
  assert.equal(parseAlsougCurrency('الدرهم الاماراتي 1159.32 999999').aedParallel, null, 'درهم خيالي');
  assert.equal(parseAlsougCurrency('ما فيش جدول خالص').aedParallel, null);
  assert.equal(parsealsougEmpty(), null);
});

function parsealsougEmpty() {
  return parseAlsougCurrency('').aedParallel;
}

test('parseAlsougCurrency: يقبل الأرقام بفواصل الآلاف وبالأرقام العربية', () => {
  const withComma = parseAlsougCurrency('الدرهم الاماراتي 1,159.32 2,450');
  assert.equal(withComma.aedParallel, 2450);
  const arabicDigits = parseAlsougCurrency('الدرهم الاماراتي ١١٥٩.٣٢ ٢٤٥٠');
  assert.equal(arabicDigits.aedParallel, 2450, 'الأرقام العربية-الهندية تتطبّع');
});

test('درهم alsoug (2450) مش اشتقاق من الدولار (8990 ÷ 3.6725 = 2447.6)', () => {
  const derived = 8990 / AED_PER_USD;
  assert.ok(Math.abs(2450 - derived) / 2450 > 0.0005, "فرق عن الاشتقاق (~0.1%) — الرقم مقوّر مش محسوب");
  // المحرك يعتبره قراءة سوق لأن الفرق أكبر من 0.5% من الدولار الفعّال
  const r = resolveAedSdg({ aedMarket: 2450, usdSell: 9300 });
  assert.equal(r.basis, 'market', 'يتعلّم قراءة سوق حقيقية');
  assert.equal(r.aedSdg, 2450);
});

test('عكسها: 2532.128 = 9300 ÷ 3.6725 بالظبط → تتعلّم computed', () => {
  const r = resolveAedSdg({ aedMarket: 2532.128, usdSell: 9300 });
  assert.equal(r.basis, 'computed', 'مجرّد اشتقاق من الدولار مش سعر سوق');
});

test('على HTML حقيقي محفوظ من الموقع (إن وُجد)', () => {
  const path = '/home/user/src_probe/70a5a3d1.html';
  if (!fs.existsSync(path)) return; // الملف اختياري — التست يعدّي بدونه
  const parsed = parseAlsougCurrency(strip(fs.readFileSync(path, 'utf-8')));
  assert.equal(parsed.aedParallel, 2450);
  assert.equal(parsed.usdParallel, 8990);
});

test('مقال الدولار الجمركي ما يتعدّاش سوق موازي', () => {
  assert.equal(isNonParallelUsdArticle('زيادة جديدة في سعر الدولار الجمركي في السودان - سودافاكس'), true);
  assert.equal(isNonParallelUsdArticle('سعر الدولار في السوق الموازي اليوم'), false);
});
