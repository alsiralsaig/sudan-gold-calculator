import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  articleTime,
  classifyPls48,
  parseAlmashhadArticle,
  parseAluomArticle,
  parseArabicDate,
  parseRelativeArabicAge,
  parseAlrakobaFeedItem,
  parseCoinbaseJson,
  parseGoldApiJson,
  parseNbsOfficial,
  parsePls48Article,
  parseRssItems,
  parseSudafaxArticle,
  parseSudafaxFeedItem,
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

/* ------------------------------ RSS ------------------------------ */

test('parseRssItems: يقرأ عناصر RSS مع التاريخ والعنوان والنص', () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[أسعار الدولار والذهب في السودان اليوم]]></title>
      <link>https://sudafax.com/584690/x</link>
      <pubDate>Tue, 06 Oct 2026 17:42:39 +0000</pubDate>
      <description><![CDATA[<p>سجل الدولار 8,185 جنيهاً للشراء و8,675 جنيهاً للبيع</p>]]></description>
    </item>
    <item><title>خبر آخر</title><link>https://sudafax.com/1</link><description>بلا تاريخ</description></item>
  </channel></rss>`;
  const items = parseRssItems(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'أسعار الدولار والذهب في السودان اليوم');
  assert.equal(items[0].link, 'https://sudafax.com/584690/x');
  assert.ok(items[0].pubDate && items[0].pubDate.startsWith('2026-10-06'), 'التاريخ يُحوَّل ISO');
  assert.equal(items[1].pubDate, null, 'بلا تاريخ = null');
});

test('parseSudafaxFeedItem: «8,185 جنيهاً للشراء و8,675 جنيهاً للبيع»', () => {
  const desc =
    '<p>شهدت أسعار العملات تفاوتاً، فيما سجل الدولار 8,185 جنيهاً للشراء و8,675 جنيهاً للبيع، وفق الأسعار الواردة.</p>';
  const r = parseSudafaxFeedItem(desc);
  assert.equal(r.buy, 8185);
  assert.equal(r.sell, 8675);
});

test('parseSudafaxFeedItem: صيغة «شراء X وبيع Y» ورقم مفرد', () => {
  assert.deepEqual(parseSudafaxFeedItem('<p>الدولار الأمريكي: شراء 7,005 وبيع 7,420 جنيه.</p>'), { buy: 7005, sell: 7420 });
  const single = parseSudafaxFeedItem('<p>وسجل الدولار 8,730 جنيه في السوق الموازي.</p>');
  assert.equal(single.sell, 8730);
  assert.equal(single.buy, null);
});

test('parseSudafaxFeedItem: نص بلا سعر → قيم فارغة', () => {
  const r = parseSudafaxFeedItem('<p>تعديل وزاري في الحكومة السودانية</p>');
  assert.equal(r.buy, null);
  assert.equal(r.sell, null);
});

/* --------------------- اليوم نيوز (aluom) --------------------- */

test('اليوم نيوز: «متوسط سعر بيع تراوح بين 8400 و8550» → وسيط، والشراء 8300', () => {
  const text = `
    وبحسب مؤشرات التداول في السوق الموازي، سجل سعر الدولار الأمريكي متوسط سعر بيع تراوح
    بين 8400 و8550 جنيهاً سودانياً، فيما بلغ متوسط سعر الشراء نحو 8300 جنيه.
  `;
  const r = parseAluomArticle(text);
  assert.equal(r.sell, 8475, 'وسيط 8400 و8550');
  assert.equal(r.buy, 8300);
});

test('اليوم نيوز: سعر بيع مفرد', () => {
  const r = parseAluomArticle('سجل سعر بيع الدولار الأمريكي 8,550 جنيهاً في السوق الموازي.');
  assert.equal(r.sell, 8550);
});

/* ------------------------ فلسطينيو48 ------------------------ */

test('فلسطينيو48: تصنيف العنوان — بنوك أم موازي', () => {
  assert.equal(classifyPls48('سعر الدولار أمام الجنيه في بنك السودان المركزي'), 'bank');
  assert.equal(classifyPls48('أسعار الدولار والعملات في البنوك السودانية اليوم بالتفصيل'), 'bank');
  assert.equal(classifyPls48('الجنيه السوداني يواجه موجة تراجع جديدة أمام الدولار والدرهم والريال'), 'parallel');
});

test('فلسطينيو48: يقرأ «سعر الشراء: X. سعر البيع: Y» كما هي (بلا تصحيح صامت)', () => {
  const t = 'سعر الجنيه السوداني مقابل الدولار في بنك السودان المركزي سعر الشراء: 4200 جنيه سوداني. سعر البيع: 3700 جنيه سوداني.';
  const r = parsePls48Article(t);
  assert.equal(r.buy, 4200);
  assert.equal(r.sell, 3700, 'قيم المصدر تُنقل كما هي — والتحقق هو من يستبعد المعكوس');
});

test('فلسطينيو48: جدول بزوج أرقام → الأصغر شراء والأكبر بيع', () => {
  const r = parsePls48Article('الدولار الأمريكي 7,455 جنيه للشراء مقابل 7,565 جنيه للبيع في السوق الموازي.');
  assert.equal(r.buy, 7455);
  assert.equal(r.sell, 7565);
});

/* --------------------- التواريخ العربية --------------------- */

test('parseRelativeArabicAge: دقائق/ساعات/أيام/أسابيع', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  assert.equal(parseRelativeArabicAge('منذ 18 دقيقة', now), new Date(now.getTime() - 18 * 60000).toISOString());
  assert.equal(parseRelativeArabicAge('منذ 12 ساعة', now), new Date(now.getTime() - 12 * 3600000).toISOString());
  assert.equal(parseRelativeArabicAge('منذ 3 أيام', now), new Date(now.getTime() - 3 * 86400000).toISOString());
  assert.equal(parseRelativeArabicAge('منذ أسبوعين', now), new Date(now.getTime() - 14 * 86400000).toISOString());
  assert.equal(parseRelativeArabicAge('منذ 3 أسابيع', now), new Date(now.getTime() - 21 * 86400000).toISOString());
});

test('parseRelativeArabicAge: نص بلا عمر → null', () => {
  assert.equal(parseRelativeArabicAge('نشرة اقتصادية بلا تاريخ', new Date()), null);
});

test('parseArabicDate: «6 أكتوبر 2026 - 2:25 مساءً» يُحوَّل لتوقيت السودان', () => {
  const iso = parseArabicDate('اليوم نيوز 8 6 أكتوبر 2026 - 2:25 مساءً');
  assert.ok(iso, 'التاريخ مقروء');
  const d = new Date(iso as string);
  assert.equal(d.toISOString(), '2026-10-06T12:25:00.000Z', '2:25 مساءً بتوقيت +2 = 12:25Z');
});

test('parseArabicDate: صيغة رقمية 7-10-2026', () => {
  const iso = parseArabicDate('بتاريخ 7-10-2026 بتوقيت الخرطوم');
  assert.ok(iso && iso.startsWith('2026-10-07'));
});

test('articleTime: يفضل العمر النسبي ثم التاريخ ثم الآن', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const rel = articleTime('admin منذ 5 ساعات', now);
  assert.equal(rel, new Date(now.getTime() - 5 * 3600000).toISOString());
  const abs = articleTime('نُشر 6 أكتوبر 2026', now);
  assert.ok(abs.startsWith('2026-10-06'));
});

/* ------------------------- الراكوبة ------------------------- */

test('الراكوبة: «تراوحت بين 8600 إلى 8700» → سعر مفرد = الوسيط 8650', () => {
  const desc =
    'عادت أسعار العملات الأجنبية إلى الصعود مجدداً في السوق الموازي، وسط توقعات التجار أن يقفز الدولار الأمريكي إلى 9 آلاف جنيه مقابل الجنيه السوداني. ووصل سعر الدولار أمس إلى أسعار تراوحت بين 8600 إلى 8700 للطلبيات الكبيرة، بينما ارتفع سعر الدرهم الإماراتي إلى 2287 جنيها.';
  const r = parseAlrakobaFeedItem(desc);
  assert.equal(r.price, 8650);
  assert.equal(r.buy, null, 'بلا شراء صريح');
  assert.equal(r.sell, null);
});

test('الراكوبة: لا يلتقط «9 آلاف جنيه» كسعر (توقع لا سعر)', () => {
  const r = parseAlrakobaFeedItem('يتوقع التجار أن يقفز الدولار الأمريكي إلى 9 آلاف جنيه قريباً');
  assert.equal(r.price, null, 'التوقع ليس سعراً منشوراً');
});

test('الراكوبة: صيغة «وصل سعر الدولار إلى 8,700»', () => {
  const r = parseAlrakobaFeedItem('وصل سعر الدولار إلى 8,700 جنيه في تعاملات الخرطوم');
  assert.equal(r.price, 8700);
});

test('الراكوبة: نطاق بعيد جداً (شاذ) لا يُقبل كسعر وسط', () => {
  const r = parseAlrakobaFeedItem('سعر الدولار تراوحت بين 3000 إلى 9000 جنيه');
  assert.equal(r.price, null, 'نطاق أوسع من 20% يُرفض');
});
