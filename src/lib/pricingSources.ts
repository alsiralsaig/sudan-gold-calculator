/**
 * موصّلات مصادر الأسعار — كل مصدر يعود بـ«قراءة» موصوفة (سعر/مصدر/وقت/نوع).
 *
 * السوق الموازي: لا نعتمد على مصدر واحد. عدة مواقع سودانية تنشر سعر السوق
 * الموازي يومياً، وخروج رقم شاذ من أحدها لا يجب أن يفسد سعرنا.
 *
 * الموصّلات هنا «غبية» عن قصد: تستخرج الأرقام فقط، وكل منطق الحكم
 * (شذوذ، اتفاق، ثقة) موكول إلى محرك التحقق في core/pricing.ts.
 */

import { fetchText, htmlToText, normalizeDigits } from './rates';
import type { SourceReading } from '../core/pricing';

export interface SourceBundle {
  readings: SourceReading[];
  errors: string[];
  /** سعر ذهب محلي منشور من مصدر سوداني (للتحقق المتقاطع) */
  publishedLocalGold?: number | null;
}

const nowIso = () => new Date().toISOString();

function toNum(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const clean = normalizeDigits(String(raw)).replace(/[٬،,\s]/g, '');
  const n = Number(clean.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** يستخرج أول رقم بعد كلمة مفتاحية داخل مسافة محدودة */
function firstNumberAfter(text: string, keywords: string[], window = 90): number | null {
  for (const kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx < 0) continue;
    const segment = text.slice(idx, idx + window);
    const m = segment.match(/([\d\u0660-\u0669][\d\u0660-\u0669.,]{2,12})/);
    const n = toNum(m?.[1]);
    if (n) return n;
  }
  return null;
}

/** يبحث عن أقرب رقمين (شراء/بيع) بعد كلمة مفتاحية */
function pairAfter(text: string, keyword: string, window = 220): { buy: number | null; sell: number | null } {
  const idx = text.indexOf(keyword);
  if (idx < 0) return { buy: null, sell: null };
  const segment = text.slice(idx, idx + window);
  const nums = (segment.match(/[\d\u0660-\u0669][\d\u0660-\u0669.,]{2,12}/g) || [])
    .map((v) => toNum(v))
    .filter((v): v is number => !!v && v > 500);
  if (nums.length >= 2) return { buy: nums[0], sell: nums[1] };
  if (nums.length === 1) return { buy: null, sell: nums[0] };
  return { buy: null, sell: null };
}

/* ------------------------------------------------------------------ */
/*                        أدوات مشتركة (RSS/إعادة)                    */
/* ------------------------------------------------------------------ */

/** جلب مع إعادة محاولة — المصادر السودانية متقطعة، والمحاولة الثانية تنقذ كثيراً */
async function fetchTextRetry(url: string, timeoutMs = 12000, attempts = 2): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const html = await fetchText(url, timeoutMs);
    if (html) return html;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** شهور عربية → رقم (0-based) */
const AR_MONTHS: Record<string, number> = {
  يناير: 0, فبراير: 1, مارس: 2, أبريل: 3, ابريل: 3, مايو: 4, يونيو: 5,
  يوليو: 6, أغسطس: 7, اغسطس: 7, سبتمبر: 8, أكتوبر: 9, اكتوبر: 9, نوفمبر: 10, ديسمبر: 11,
};

/**
 * يقرأ «منذ 18 دقيقة / منذ 12 ساعة / منذ 3 أيام / منذ أسبوعين» ويعيد وقتاً ISO.
 * المواقع السودانية تنشر العمر النسبي بدل التاريخ.
 */
export function parseRelativeArabicAge(text: string, now: Date = new Date()): string | null {
  const t = normalizeDigits(text);
  const m = t.match(/منذ\s+(?:<[^>]*>\s*)?(\d+|نصف|أسبوعين|أسبوع|شهر|سنة)?\s*(دقيقة|دقائق|دقيقتين|ساعة|ساعات|ساعتين|يوم|أيام|يومين|أسبوع|أسابيع|أسبوعين|شهر|أشهر|شهرين)?/);
  if (!m) return null;
  const rawNum = m[1];
  let unit = m[2] || '';
  let count = 1;
  if (rawNum === 'نصف') count = 0.5;
  else if (rawNum && /^\d+$/.test(rawNum)) count = Number(rawNum);
  else if (rawNum) {
    // صيغ المثنى بلا رقم: أسبوعين، يومين، ساعتين، دقيقتين، شهرين
    count = 2;
    if (rawNum === 'أسبوعين') unit = unit || 'أسبوع';
    else if (rawNum === 'شهرين') unit = unit || 'شهر';
    else if (rawNum === 'سنة') {
      count = 1;
      unit = unit || 'شهر';
      count = 12;
    }
  }
  if (!unit && rawNum === 'أسبوع') unit = 'أسبوع';
  let minutes: number | null = null;
  if (/دقيق/.test(unit)) minutes = count;
  else if (/ساع/.test(unit)) minutes = count * 60;
  else if (/يوم|أيام/.test(unit)) minutes = count * 1440;
  else if (/أسبوع|أسابيع/.test(unit)) minutes = count * 10080;
  else if (/شهر|أشهر/.test(unit)) minutes = count * 43200;
  if (minutes === null) return null;
  return new Date(now.getTime() - minutes * 60000).toISOString();
}

/** «6 أكتوبر 2026 - 2:25 مساءً» أو «7-10-2026» */
export function parseArabicDate(text: string, now: Date = new Date()): string | null {
  const t = normalizeDigits(text);

  const named = t.match(/(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/);
  if (named) {
    const day = Number(named[1]);
    const month = AR_MONTHS[named[2]];
    const year = Number(named[3]);
    const time = t.match(/(\d{1,2}):(\d{2})\s*(ص|م|صباحاً|مساءً|صباحا|مساء)?/);
    let hour = time ? Number(time[1]) : 12;
    if (time && /م|مساء/.test(time[3] || '')) hour = hour === 12 ? 12 : hour + 12;
    const d = new Date(Date.UTC(year, month, day, hour, time ? Number(time[2]) : 0));
    // تحويل تقريبي لتوقيت السودان (UTC+2)
    d.setUTCHours(d.getUTCHours() - 2);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const numeric = t.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (numeric) {
    const d = new Date(Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]), 12));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** عمر المقال من نص الصفحة: «منذ 12 ساعة» أو تاريخ صريح */
export function articleTime(pageText: string, now: Date = new Date()): string {
  return parseRelativeArabicAge(pageText, now) || parseArabicDate(pageText, now) || now.toISOString();
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

/** قارئ RSS بسيط — يكفي لمواقع ووردبريس التي نعتمد عليها */
export function parseRssItems(xml: string): RssItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const clean = (raw: string | undefined): string =>
    (raw || '')
      .replace(/^\s*<!\[CDATA\[/, '')
      .replace(/\]\]>\s*$/, '')
      .trim();
  return items.map((item) => {
    const grab = (tag: string): string | undefined => {
      const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m?.[1];
    };
    const pubRaw = clean(grab('pubDate'));
    const pub = pubRaw ? new Date(pubRaw) : null;
    return {
      title: clean(grab('title')),
      link: clean(grab('link')),
      description: clean(grab('description')),
      pubDate: pub && !isNaN(pub.getTime()) ? pub.toISOString() : null,
    };
  });
}

/** تحويل وصف RSS (HTML) إلى نص نظيف */
const rssText = (descHtml: string): string => normalizeDigits(htmlToText(descHtml));

/* ------------------------------------------------------------------ */
/*                    سودافاكس — JSON-LD articleBody                  */
/* ------------------------------------------------------------------ */

export function parseSudafaxArticle(html: string): {
  usd: { buy: number | null; sell: number | null };
  gold21: number | null;
  title: string | null;
} {
  const body = extractJsonLdBody(html) || htmlToText(html);
  const text = normalizeDigits(body);

  // صيغ شائعة: «الدولار الأمريكي: شراء 7,005 وبيع 7,420» أو «سعر الدولار ... 8730»
  const usdSeg = (() => {
    const i = text.search(/الدولار\s*(الأمريكي)?/);
    return i >= 0 ? text.slice(i, i + 320) : '';
  })();

  let buy: number | null = null;
  let sell: number | null = null;
  const buyM = usdSeg.match(/شراء[^\d]{0,30}([\d][\d.,]{2,12})/);
  const sellM = usdSeg.match(/بيع[^\d]{0,30}([\d][\d.,]{2,12})/);
  if (buyM) buy = toNum(buyM[1]);
  if (sellM) sell = toNum(sellM[1]);
  if (!buy && !sell) {
    const pair = pairAfter(text, 'الدولار', 260);
    buy = pair.buy;
    sell = pair.sell;
  }
  // لا نثق برقم واحد في سودافاكس إن وُجد ضمن جدول عيارات
  const goldSeg = text.match(/عيار\s*21[^\d]{0,40}([\d][\d.,]{3,12})/);
  const gold21 = goldSeg ? toNum(goldSeg[1]) : null;

  const titleM = html.match(/<title>([^<]{5,180})<\/title>/i);
  return { usd: { buy, sell }, gold21, title: titleM ? titleM[1].trim() : null };
}

function extractJsonLdBody(html: string): string | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try {
      const data = JSON.parse(jsonText);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const body = node?.articleBody || node?.description;
        if (typeof body === 'string' && body.length > 120) return body;
      }
    } catch {
      /* نتجاهل أي JSON غير صالح */
    }
  }
  return null;
}

export function parseSudafaxFeedItem(descHtml: string): { buy: number | null; sell: number | null } {
  const text = rssText(descHtml);

  // الصيغة الأكثر شيوعاً: «سجل الدولار 8,185 جنيهاً للشراء و8,675 جنيهاً للبيع»
  const pair = text.match(
    /الدولار[^\d]{0,60}?([\d][\d.,]{2,12})[^\d]{0,60}?للشراء[^\d]{0,40}?([\d][\d.,]{2,12})[^\d]{0,40}?للبيع/
  );
  if (pair) return { buy: toNum(pair[1]), sell: toNum(pair[2]) };

  // صيغة بديلة: «شراء 7,005 وبيع 7,420»
  const alt = text.match(/(?:شراء)[^\d]{0,30}?([\d][\d.,]{2,12})[^\d]{0,60}?(?:بيع)[^\d]{0,30}?([\d][\d.,]{2,12})/);
  if (alt) return { buy: toNum(alt[1]), sell: toNum(alt[2]) };

  // رقم واحد فقط
  const single = text.match(/الدولار[^\d]{0,60}?([\d][\d.,]{3,12})/);
  if (single) return { buy: null, sell: toNum(single[1]) };

  return { buy: null, sell: null };
}

async function fetchSudafaxReading(): Promise<{ reading: SourceReading | null; gold21: number | null; error: string | null }> {
  // ① الـ feed أولاً: أخف (55KB) وأسرع وأثبت من صفحات البحث والمقالات
  const feed = await fetchTextRetry('https://sudafax.com/feed/', 12000);
  if (feed) {
    const items = parseRssItems(feed);
    const priced = items.find((it) => /أسعار|سعر/.test(it.title) && /الدولار|العملات/.test(it.title));
    if (priced) {
      const parsed = parseSudafaxFeedItem(priced.description);
      if (parsed.sell || parsed.buy) {
        const gold = parseSudafaxArticle(`<html><body>${priced.description}</body></html>`).gold21;
        return {
          reading: {
            source: 'سودافاكس',
            kind: 'parallel',
            buy: parsed.buy,
            sell: parsed.sell,
            at: priced.pubDate || nowIso(),
            url: priced.link,
            label: priced.title.slice(0, 90),
          },
          gold21: gold,
          error: null,
        };
      }
    }
  }

  // ② بديل: صفحة البحث ثم المقال
  const search = await fetchTextRetry('https://sudafax.com/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1', 12000, 1);
  if (search) {
    const links = Array.from(search.matchAll(/<h2[^>]*>\s*<a[^>]*href="(https:\/\/sudafax\.com\/\d+\/[^"]+)"/g)).map((m) => m[1]);
    const articleUrls = links.filter((u) => /%D8%AF%D9%88%D9%84%D8%A7%D8%B1|دولار|أسعار|%d8%a3%d8%b3%d8%b9%d8%a7%d8%b1/.test(decodeURIComponent(u)));
    for (const url of articleUrls.slice(0, 2)) {
      const html = await fetchText(url, 12000);
      if (!html) continue;
      const parsed = parseSudafaxArticle(html);
      if (parsed.usd.sell) {
        return {
          reading: {
            source: 'سودافاكس',
            kind: 'parallel',
            buy: parsed.usd.buy,
            sell: parsed.usd.sell,
            at: nowIso(),
            url,
            label: parsed.title || undefined,
          },
          gold21: parsed.gold21,
          error: null,
        };
      }
    }
  }
  return { reading: null, gold21: null, error: 'سودافاكس: تعذّر الوصول أو لا سعر حديث' };
}

/* ------------------------------------------------------------------ */
/*                  اخبار السودان — مقال السوق الموازي                */
/* ------------------------------------------------------------------ */

export function parseSudanakhbarArticle(text: string): { buy: number | null; sell: number | null } {
  const t = normalizeDigits(text);
  let sell: number | null = null;
  let buy: number | null = null;

  // «سعر بيع الدولار الأمريكي إلى 8732.8559 جنيهًا»
  const sellM = t.match(/سعر\s*بيع\s*الدولار[^0-9]{0,60}?([\d][\d.,]{2,12})/);
  if (sellM) sell = toNum(sellM[1]);

  // «سعر الشراء ... X» أو «وسجل سعر الشراء X» — يُذكر أحياناً في نفس المقال
  const buyM = t.match(/سعر\s*ال?شراء\s*(?:الدولار\s*(?:الأمريكي)?\s*)?[^0-9]{0,60}?([\d][\d.,]{2,12})/);
  if (buyM) buy = toNum(buyM[1]);

  if (!sell) {
    // بديل: «وصل سعر الدولار إلى X» أو «الدولار ... عند X جنيه»
    const alt = t.match(/الدولار\s*(?:الأمريكي)?[^0-9]{0,80}?(?:إلى|عند|عند مستوى|سجل)\s*([\d][\d.,]{3,12})/);
    if (alt) sell = toNum(alt[1]);
  }
  // لا نأخذ «مقابل X عند بداية الارتفاع» — رقم سياقي وليس سعراً
  return { buy, sell };
}

async function fetchSudanakhbarReading(): Promise<{ reading: SourceReading | null; error: string | null }> {
  const section = await fetchTextRetry('https://www.sudanakhbar.com/latestnews/dollar-prices', 12000);
  if (!section) return { reading: null, error: 'اخبار السودان: تعذّر الوصول' };
  const links = Array.from(section.matchAll(/href="(https:\/\/www\.sudanakhbar\.com\/\d+)"/g)).map((m) => m[1]);
  const unique = Array.from(new Set(links)).slice(0, 4);
  for (const url of unique) {
    const html = await fetchText(url, 12000);
    if (!html) continue;
    const title = (html.match(/<title>([^<]{5,180})<\/title>/i) || [])[1] || '';
    if (!/دولار/i.test(title)) continue;
    const parsed = parseSudanakhbarArticle(htmlToText(html));
    if (parsed.sell) {
      return {
        reading: {
          source: 'اخبار السودان',
          kind: 'parallel',
          buy: parsed.buy,
          sell: parsed.sell,
          at: nowIso(),
          url,
          label: title.trim(),
        },
        error: null,
      };
    }
  }
  return { reading: null, error: 'اخبار السودان: لم يُعثر على سعر في المقالات' };
}

/* ------------------------------------------------------------------ */
/*                 اليوم نيوز (aluom.net) — السوق الموازي              */
/* ------------------------------------------------------------------ */

export function parseAluomArticle(text: string): { buy: number | null; sell: number | null } {
  const t = normalizeDigits(text);
  let buy: number | null = null;
  let sell: number | null = null;

  // «متوسط سعر بيع تراوح بين 8400 و8550 جنيهاً سودانياً»
  const range = t.match(/سعر\s*بيع[^0-9]{0,60}?([\d][\d.,]{2,12})[^0-9]{0,25}?و\s*([\d][\d.,]{2,12})/);
  if (range) {
    const a = toNum(range[1]);
    const b = toNum(range[2]);
    if (a && b) sell = Math.round(((a + b) / 2) * 100) / 100;
  }
  if (!sell) {
    const single = t.match(/سعر\s*بيع(?:\s*الدولار)?[^0-9]{0,60}?([\d][\d.,]{3,12})/);
    if (single) sell = toNum(single[1]);
  }

  // «فيما بلغ متوسط سعر الشراء نحو 8300 جنيه»
  const buyM = t.match(/سعر\s*الشراء[^0-9]{0,50}?([\d][\d.,]{3,12})/);
  if (buyM) buy = toNum(buyM[1]);

  if (!sell && !buy) {
    // احتياط: «سجل الدولار ... 8,550»
    const alt = t.match(/الدولار\s*الأمريكي[^0-9]{0,80}?([\d][\d.,]{3,12})/);
    if (alt) sell = toNum(alt[1]);
  }
  return { buy, sell };
}

async function fetchAluomReading(): Promise<{ reading: SourceReading | null; error: string | null }> {
  const search = await fetchTextRetry('https://aluom.net/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1', 12000);
  if (!search) return { reading: null, error: 'اليوم نيوز: تعذّر الوصول' };

  const links = Array.from(new Set(Array.from(search.matchAll(/href="(https:\/\/aluom\.net\/\d+)"/g)).map((m) => m[1])));
  for (const url of links.slice(0, 3)) {
    const html = await fetchTextRetry(url, 12000, 1);
    if (!html) continue;
    const title = (html.match(/<title>([^<]{5,180})<\/title>/i) || [])[1] || '';
    if (!/دولار/i.test(title)) continue;
    const pageText = htmlToText(html);
    const parsed = parseAluomArticle(pageText);
    if (parsed.sell || parsed.buy) {
      // وقت المقال من «منذ X» أو التاريخ المنشور
      const header = pageText.slice(0, 2500);
      return {
        reading: {
          source: 'اليوم نيوز',
          kind: 'parallel',
          buy: parsed.buy,
          sell: parsed.sell,
          at: articleTime(header),
          url,
          label: title.trim(),
        },
        error: null,
      };
    }
  }
  return { reading: null, error: 'اليوم نيوز: لم يُعثر على سعر' };
}

/* ------------------------------------------------------------------ */
/*              المشهد السوداني — خبر السوق الموازية اليومي           */
/* ------------------------------------------------------------------ */

export function parseAlmashhadArticle(text: string): { price: number | null } {
  const t = normalizeDigits(text);
  const patterns = [
    /سعر\s*صرف\s*الدولار[^0-9]{0,60}?([\d][\d.,]{3,12})/,
    /الدولار\s*(?:الأمريكي)?[^0-9]{0,70}?إلى\s*([\d][\d.,]{3,12})/,
    /وصل(?:ت)?\s*(?:أسعار|سعر)\s*الدولار[^0-9]{0,40}?([\d][\d.,]{3,12})/,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    const n = toNum(m?.[1]);
    if (n) return { price: n };
  }
  return { price: null };
}

async function fetchAlmashhadReading(): Promise<{ reading: SourceReading | null; error: string | null }> {
  const FEED = 'https://almashhadalsudani.com/economic-news/currency-prices-sudan/feed/';

  // ① الـ feed أولاً (صفحة التصنيف كبيرة وبطيئة)
  const feed = await fetchTextRetry(FEED, 12000);
  if (feed) {
    const items = parseRssItems(feed);
    for (const item of items.slice(0, 5)) {
      if (!/دولار/.test(item.title)) continue;
      const parsed = parseAlmashhadArticle(`${item.title} ${rssText(item.description)}`);
      if (parsed.price) {
        return {
          reading: {
            source: 'المشهد السوداني',
            kind: 'parallel',
            price: parsed.price,
            at: item.pubDate || nowIso(),
            url: item.link,
            label: item.title.slice(0, 90),
          },
          error: null,
        };
      }
    }
  }

  // ② بديل: صفحة التصنيف ثم المقالات
  const section = await fetchText('https://almashhadalsudani.com/economic-news/currency-prices-sudan/', 12000);
  if (!section) return { reading: null, error: 'المشهد السوداني: تعذّر الوصول' };
  const links = Array.from(
    new Set(
      Array.from(section.matchAll(/href="(https:\/\/almashhadalsudani\.com\/economic-news\/currency-prices-sudan\/\d+\/?)"/g)).map(
        (m) => m[1]
      )
    )
  );
  for (const url of links.slice(0, 4)) {
    const html = await fetchText(url, 12000);
    if (!html) continue;
    const title = (html.match(/<title>([^<]{5,180})<\/title>/i) || [])[1] || '';
    if (!/دولار/i.test(title)) continue;
    const parsed = parseAlmashhadArticle(htmlToText(html));
    if (parsed.price) {
      return {
        reading: {
          source: 'المشهد السوداني',
          kind: 'parallel',
          price: parsed.price,
          at: nowIso(),
          url,
          label: title.trim(),
        },
        error: null,
      };
    }
  }
  return { reading: null, error: 'المشهد السوداني: لم يُعثر على سعر' };
}

/* ------------------------------------------------------------------ */
/*        فلسطينيو48 — يخدم المستويين: المركزي (رسمي) والموازي        */
/* ------------------------------------------------------------------ */

export interface Pls48Result {
  /** رسمي (بنك السودان) أم موازي */
  kind: 'bank' | 'parallel';
  buy: number | null;
  sell: number | null;
  title: string;
  at: string;
  url: string;
}

export function parsePls48Article(text: string): { buy: number | null; sell: number | null } {
  const t = normalizeDigits(text);
  // «سعر الشراء: 4200 جنيه سوداني. سعر البيع: 3700 جنيه»
  const sellM = t.match(/سعر\s*البيع[^0-9]{0,20}([\d][\d.,]{2,12})/);
  const buyM = t.match(/سعر\s*الشراء[^0-9]{0,20}([\d][\d.,]{2,12})/);
  if (sellM || buyM) {
    return { buy: toNum(buyM?.[1]), sell: toNum(sellM?.[1]) };
  }

  // جدول: «الدولار الأمريكي ... X ... Y»
  const idx = t.search(/الدولار\s*(الأمريكي)?/);
  if (idx < 0) return { buy: null, sell: null };
  const seg = t.slice(idx, idx + 300);
  const pair = seg.match(/([\d][\d.,]{3,12})[^\d]{1,80}?([\d][\d.,]{3,12})/);
  if (!pair) return { buy: null, sell: null };
  const a = toNum(pair[1]);
  const b = toNum(pair[2]);
  if (!a || !b) return { buy: null, sell: null };
  return { buy: Math.min(a, b), sell: Math.max(a, b) };
}

/** يقرر المستوى من عنوان المقال */
export function classifyPls48(title: string): 'bank' | 'parallel' {
  if (/البنوك|المركزي|بنك السودان/.test(title)) return 'bank';
  return 'parallel';
}

async function fetchPls48Reading(): Promise<{ bank: Pls48Result | null; parallel: Pls48Result | null; error: string | null }> {
  const search = await fetchTextRetry(
    'https://pls48.net/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1+%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86',
    12000
  );
  if (!search) return { bank: null, parallel: null, error: 'فلسطينيو48: تعذّر الوصول' };

  const links: { url: string; title: string }[] = [];
  const re = /<a[^>]+href="(https:\/\/pls48\.net\/[^"#]+)"[^>]*>([\s\S]{0,160}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(search)) && links.length < 10) {
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!title || !/دولار|جنيه/.test(title)) continue;
    if (!links.some((l) => l.url === m![1])) links.push({ url: m[1], title });
  }

  let bank: Pls48Result | null = null;
  let parallel: Pls48Result | null = null;

  for (const link of links.slice(0, 4)) {
    const html = await fetchTextRetry(link.url, 12000, 1);
    if (!html) continue;
    const pageText = htmlToText(html);
    const parsed = parsePls48Article(pageText);
    if (!parsed.buy && !parsed.sell) continue;
    const kind = classifyPls48(link.title);
    const result: Pls48Result = {
      kind,
      buy: parsed.buy,
      sell: parsed.sell,
      title: link.title.slice(0, 90),
      at: articleTime(pageText.slice(0, 2500)),
      url: link.url,
    };
    if (kind === 'bank' && !bank) bank = result;
    if (kind === 'parallel' && !parallel) parallel = result;
    if (bank && parallel) break;
  }

  return { bank, parallel, error: bank || parallel ? null : 'فلسطينيو48: لا سعر في المقالات الحديثة' };
}

/* ------------------------------------------------------------------ */
/*                    بنك السودان المركزي — السعر الرسمي              */
/* ------------------------------------------------------------------ */

export function parseNbsOfficial(text: string): { buy: number | null; sell: number | null } {
  const t = normalizeDigits(text);
  const idx = t.search(/US\s*Dollar/i);
  if (idx < 0) return { buy: null, sell: null };
  const seg = t.slice(idx, idx + 120);
  const nums = (seg.match(/[\d][\d.,]{2,12}/g) || []).map(toNum).filter((v): v is number => !!v && v > 100);
  if (nums.length >= 2) return { buy: nums[0], sell: nums[1] };
  if (nums.length === 1) return { buy: null, sell: nums[0] };
  return { buy: null, sell: null };
}

async function fetchOfficialUsdReading(): Promise<{ reading: SourceReading | null; error: string | null }> {
  const html = await fetchTextRetry('https://nbs.sd/currency-rate/?lang=en', 12000);
  if (!html) return { reading: null, error: 'بنك السودان المركزي: تعذّر الوصول' };
  const parsed = parseNbsOfficial(htmlToText(html));
  if (!parsed.buy && !parsed.sell) return { reading: null, error: 'بنك السودان المركزي: لم يُعثر على صف الدولار' };
  return {
    reading: {
      source: 'بنك السودان المركزي',
      kind: 'bank',
      buy: parsed.buy,
      sell: parsed.sell,
      at: nowIso(),
      url: 'https://nbs.sd/currency-rate',
      label: 'السعر الرسمي المعلن',
    },
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/*                     الأونصة — الذهب العالمي (Spot)                 */
/* ------------------------------------------------------------------ */

export function parseGoldApiJson(json: unknown): number | null {
  const obj = json as { price?: unknown };
  const n = typeof obj?.price === 'number' ? obj.price : Number(obj?.price);
  return Number.isFinite(n) && n > 500 ? n : null;
}

export function parseCoinbaseJson(json: unknown): number | null {
  const amount = (json as { data?: { amount?: unknown } })?.data?.amount;
  const n = Number(amount);
  return Number.isFinite(n) && n > 500 ? n : null;
}

async function fetchSpotReadings(): Promise<{ readings: SourceReading[]; errors: string[] }> {
  const readings: SourceReading[] = [];
  const errors: string[] = [];

  const goldApi = await fetchTextRetry('https://api.gold-api.com/price/XAU', 9000);
  if (goldApi) {
    try {
      const price = parseGoldApiJson(JSON.parse(goldApi));
      if (price) readings.push({ source: 'gold-api', kind: 'spot', price, at: nowIso(), label: 'سعر الأونصة العالمي' });
    } catch {
      errors.push('gold-api: رد غير صالح');
    }
  } else {
    errors.push('gold-api: تعذّر الوصول');
  }

  const coinbase = await fetchTextRetry('https://api.coinbase.com/v2/prices/PAXG-USD/spot', 9000);
  if (coinbase) {
    try {
      const price = parseCoinbaseJson(JSON.parse(coinbase));
      if (price) readings.push({ source: 'Coinbase PAXG', kind: 'spot', price, at: nowIso(), label: 'سعر الأونصة (عبر PAXG)' });
    } catch {
      errors.push('Coinbase: رد غير صالح');
    }
  } else {
    errors.push('Coinbase: تعذّر الوصول');
  }

  return { readings, errors };
}

/* ------------------------------------------------------------------ */
/*                          الواجهة الموحدة                           */
/* ------------------------------------------------------------------ */

export interface PricingSnapshot {
  parallel: SourceBundle;
  official: SourceBundle;
  spot: SourceBundle;
  fetchedAt: string;
}

/** جلب كل المصادر بالتوازي — فشل مصدر لا يوقف البقية أبداً */
export async function fetchPricingSources(): Promise<PricingSnapshot> {
  const now = new Date();
  const [sudafax, sudanakhbar, almashhad, aluom, pls48, official, spot] = await Promise.allSettled([
    fetchSudafaxReading(),
    fetchSudanakhbarReading(),
    fetchAlmashhadReading(),
    fetchAluomReading(),
    fetchPls48Reading(),
    fetchOfficialUsdReading(),
    fetchSpotReadings(),
  ]);

  const parallel: SourceBundle = { readings: [], errors: [] };
  const officialBundle: SourceBundle = { readings: [], errors: [] };
  const spotBundle: SourceBundle = { readings: [], errors: [] };
  let publishedLocalGold: number | null = null;

  const collectParallel = (
    result: PromiseSettledResult<{ reading: SourceReading | null; error: string | null; gold21?: number | null }>
  ) => {
    if (result.status === 'fulfilled') {
      if (result.value.reading) parallel.readings.push(result.value.reading);
      if (result.value.error) parallel.errors.push(result.value.error);
      if (result.value.gold21) publishedLocalGold = result.value.gold21 as number;
    } else {
      parallel.errors.push('مصدر: فشل غير متوقع');
    }
  };

  collectParallel(sudafax);
  collectParallel(sudanakhbar);
  collectParallel(almashhad);
  collectParallel(aluom as PromiseSettledResult<{ reading: SourceReading | null; error: string | null }>);

  // فلسطينيو48 يخدم المستويين
  if (pls48.status === 'fulfilled') {
    const value = pls48.value;
    if (value.bank && (value.bank.buy || value.bank.sell)) {
      officialBundle.readings.push({
        source: 'فلسطينيو48',
        kind: 'bank',
        buy: value.bank.buy,
        sell: value.bank.sell,
        at: value.bank.at,
        url: value.bank.url,
        label: value.bank.title,
      });
    }
    if (value.parallel && (value.parallel.buy || value.parallel.sell)) {
      parallel.readings.push({
        source: 'فلسطينيو48',
        kind: 'parallel',
        buy: value.parallel.buy,
        sell: value.parallel.sell,
        at: value.parallel.at,
        url: value.parallel.url,
        label: value.parallel.title,
      });
    }
    if (value.error) {
      parallel.errors.push(value.error);
    }
  } else {
    parallel.errors.push('فلسطينيو48: فشل غير متوقع');
  }

  if (official.status === 'fulfilled') {
    if (official.value.reading) officialBundle.readings.push(official.value.reading);
    if (official.value.error) officialBundle.errors.push(official.value.error);
  }

  if (spot.status === 'fulfilled') {
    spotBundle.readings = spot.value.readings;
    spotBundle.errors = spot.value.errors;
  }

  return {
    parallel: { ...parallel, publishedLocalGold },
    official: officialBundle,
    spot: spotBundle,
    fetchedAt: now.toISOString(),
  };
}
