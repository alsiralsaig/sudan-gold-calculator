import test from 'node:test';
import assert from 'node:assert/strict';

import {
  htmlToText,
  normalizeDigits,
  extractCurrencyPair,
  extractSinglePrice,
  extractBankRate,
} from '../src/lib/rates';

/**
 * نماذج مأخوذة من البنية الفعلية لصفحات "اخبار السودان".
 * هذه الاختبارات تمنع تكرار الخطأ القديم: نمط بحث لا يطابق المصدر
 * فيرجع التطبيق بصمت إلى سعر ثابت.
 */

const PARALLEL_TABLE = htmlToText(`
  <p>صرف الدولار الامريكي والريال السعودي مقابل الجنية من السوق الاسود</p>
  <table>
    <tr><td>العملة</td><td>سعر الصرف</td></tr>
    <tr><td>اسعار الدولار الامريكي</td><td>8400</td><td>جنيه للشراء</td><td>8583.7600</td><td>جنيه للبيع</td></tr>
    <tr><td>اسعار الريال السعودي</td><td>2237.5536</td><td>جنيه للشراء</td><td>2286.5027</td><td>للبيع</td></tr>
    <tr><td>اسعار الدرهم الإماراتي</td><td>2287.1457</td><td>جنيه للشراء</td><td>2337.1798</td><td>للبيع</td></tr>
  </table>
`);

const SALE_TABLE = htmlToText(`
  <table>
    <tr><td>العملة</td><td>السعر بالجنيه السوداني</td></tr>
    <tr><td>الدولار الأمريكي</td><td>8583.7600</td></tr>
    <tr><td>الريال السعودي</td><td>2286.5027</td></tr>
    <tr><td>الجنيه المصري</td><td>164.0000</td></tr>
  </table>
`);

test('htmlToText: يحفظ حدود الجدول ويحوّل الأرقام العربية', () => {
  const text = htmlToText('<td>السعر</td><td>٨٤٠٠</td>');
  assert.match(text, /السعر \| 8400/);
});

test('normalizeDigits: يحوّل الأرقام الهندية', () => {
  assert.equal(normalizeDigits('١٢٣٤'), '1234');
});

test('extractCurrencyPair: يستخرج شراء وبيع الدولار من جدول السوق الأسود', () => {
  const pair = extractCurrencyPair(PARALLEL_TABLE, ['الدولار\\s*الا?مريكي']);
  assert.equal(pair.buy, 8400);
  assert.equal(pair.sell, 8583.76);
});

test('extractCurrencyPair: يستخرج زوج الريال السعودي', () => {
  const pair = extractCurrencyPair(PARALLEL_TABLE, ['الريال\\s*السعودي']);
  assert.equal(pair.buy, 2237.5536);
  assert.equal(pair.sell, 2286.5027);
});

test('extractSinglePrice: يقرأ سعر العملة من الجدول المنشور', () => {
  assert.equal(extractSinglePrice(SALE_TABLE, ['الجنيه\\s*المصري']), 164);
  assert.equal(extractSinglePrice(SALE_TABLE, ['الريال\\s*السعودي']), 2286.5027);
});

test('extractBankRate: يقرأ متوسط سعر البنوك', () => {
  const text = htmlToText('<p>وبلغ سعر البيع 5550.0656 جنيهًا في بنك المال المتحد.</p>');
  assert.equal(extractBankRate(text), 5550.0656);
});

test('extractCurrencyPair: لا يخترع رقماً عند غياب النمط', () => {
  const pair = extractCurrencyPair('لا يوجد جدول أسعار هنا', ['الدولار\\s*الا?مريكي']);
  assert.equal(pair.buy, null);
  assert.equal(pair.sell, null);
  assert.equal(extractBankRate('نص بدون أسعار'), null);
});
