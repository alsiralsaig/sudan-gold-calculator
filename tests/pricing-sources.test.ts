import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAlmashhadArticle,
  parseCoinbaseJson,
  parseGoldApiJson,
  parseNbsOfficial,
  parsePls48Article,
  parseSudafaxArticle,
  parseSudanakhbarArticle,
} from '../src/lib/pricingSources';

/* ------------------------- اخبار السودان (الموازي) ------------------------- */

test('اخبار السودان: يستخرج سعر البيع ولا يخلط الرقم السياقي «مقابل»', () => {
  const text = `
    خاص – قفزت أسعار العملات الأجنبية في السوق الموازي بالسودان بنسبة كبيرة، الأربعاء 07 أكتوبر 2026،
    مواصلة صعودها لليوم الرابع منذ مطلع الأسبوع، في حركة تعكس اتساع الضغوط على الجنيه السوداني.
    وصعد سعر بيع الدولار الأمريكي إلى 8732.8559 جنيهًا، مقابل 8331.83 جنيهًا عند بداية موجة الارتفاع.
    وسجل سعر الشراء 8583 جنيهًا في تعاملات المساء.
  `;
  const r = parseSudanakhbarArticle(text);
  assert.equal(r.sell, 8732.8559, 'سعر البيع الصحيح');
  assert.equal(r.buy, 8583, 'سعر الشراء الصحيح — وليس رقم «مقابل»');
  assert.notEqual(r.buy, 8331.83);
});

test('اخبار السودان: صيغة بديلة «الدولار ... إلى X»', () => {
  const r = parseSudanakhbarArticle('وارتفع سعر صرف الدولار الأمريكي اليوم إلى 8,900 جنيه في السوق الموازي');
  assert.equal(r.sell, 8900);
});

test('اخبار السودان: أرقام عربية-هندية تُحوَّل', () => {
  const r = parseSudanakhbarArticle('سعر بيع الدولار الأمريكي إلى ٨٧٣٢ جنيهًا');
  assert.equal(r.sell, 8732);
});

/* ------------------------------ سودافاكس ------------------------------ */

test('سودافاكس: يقرأ JSON-LD ويستخرج شراء/بيع الدولار وسعر الذهب عيار 21', () => {
  const html = `<html><head><title>أسعار الدولار والعملات والذهب في السودان</title>
    <script type="application/ld+json">${JSON.stringify({
      '@type': 'NewsArticle',
      articleBody:
        'شهدت أسعار العملات في السودان اليوم استقراراً نسبياً حيث بلغ الدولار الأمريكي: شراء 7,005 جنيه وبيع 7,420 جنيه، فيما سجل الذهب عيار 21 نحو 1,050,000 جنيه للأوقية المحلية في أسواق الخرطوم.',
    })}</script></head><body></body></html>`;
  const r = parseSudafaxArticle(html);
  assert.equal(r.usd.buy, 7005);
  assert.equal(r.usd.sell, 7420);
  assert.equal(r.gold21, 1050000);
  assert.ok(r.title?.includes('سودافاكس') || r.title?.includes('الدولار'));
});

test('سودافاكس: بلا JSON-LD يستخرج من النص العادي', () => {
  const html = `<html><head><title>ت</title></head><body><p>الدولار الأمريكي: شراء 8,330 جنيه وبيع 8,730 جنيه.</p></body></html>`;
  const r = parseSudafaxArticle(html);
  assert.equal(r.usd.buy, 8330);
  assert.equal(r.usd.sell, 8730);
});

/* -------------------------- المشهد السوداني -------------------------- */

test('المشهد السوداني: يستخرج سعر صرف الدولار من الخبر', () => {
  const text = `
    سجل الجنيه السوداني هبوطًا جديدًا أمام الدولار الأمريكي في السوق الموازية، اليوم الثلاثاء،
    مع وصول سعر صرف الدولار إلى 8600 جنيه، في أحدث مستوى قياسي للعملة الأمريكية.
  `;
  assert.equal(parseAlmashhadArticle(text).price, 8600);
});

test('المشهد السوداني: بلا سعر → null', () => {
  assert.equal(parseAlmashhadArticle('نشرة اقتصادية بلا أرقام عملات').price, null);
});

/* ---------------------------- فلسطينيو48 ---------------------------- */

test('فلسطينيو48: زوج الأرقام → شراء أصغر وبيع أكبر', () => {
  const r = parsePls48Article('وسجل الدولار الأمريكي في السوق الموازي 7,455 جنيهًا للشراء مقابل 7,565 جنيهًا للبيع.');
  assert.equal(r.buy, 7455);
  assert.equal(r.sell, 7565);
});

/* ------------------------ بنك السودان المركزي ------------------------ */

test('بنك السودان: صف US Dollar الرسمي', () => {
  const t = 'Currency Buy Sell US Dollar 4,332.2500 4,316.1250 Euro 5,050.00 5,020.00';
  const r = parseNbsOfficial(t);
  assert.equal(r.buy, 4332.25);
  assert.equal(r.sell, 4316.125);
});

/* ------------------------------ الأونصة ------------------------------ */

test('gold-api: يقرأ السعر من JSON', () => {
  assert.equal(parseGoldApiJson({ price: 4134.700195 }), 4134.700195);
  assert.equal(parseGoldApiJson({ price: '4140.2' }), 4140.2);
  assert.equal(parseGoldApiJson({ price: 12 }), null, 'قيمة غير منطقية مرفوضة');
  assert.equal(parseGoldApiJson(null), null);
});

test('Coinbase PAXG: يقرأ amount النصي', () => {
  assert.equal(parseCoinbaseJson({ data: { amount: '4141.97', base: 'PAXG' } }), 4141.97);
  assert.equal(parseCoinbaseJson({ data: {} }), null);
});
