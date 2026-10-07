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

async function fetchSudafaxReading(): Promise<{ reading: SourceReading | null; gold21: number | null; error: string | null }> {
  const search = await fetchText('https://sudafax.com/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1', 12000);
  if (!search) return { reading: null, gold21: null, error: 'سودافاكس: تعذّر الوصول' };

  const links = Array.from(search.matchAll(/<h2[^>]*>\s*<a[^>]*href="(https:\/\/sudafax\.com\/\d+\/[^"]+)"/g)).map((m) => m[1]);
  const articleUrls = links.filter((u) => /%D8%AF%D9%88%D9%84%D8%A7%D8%B1|دولار|أسعار|%d8%a3%d8%b3%d8%b9%d8%a7%d8%b1/.test(decodeURIComponent(u)));
  for (const url of articleUrls.slice(0, 3)) {
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
  return { reading: null, gold21: null, error: 'سودافاكس: لا يوجد سعر في المقالات الحديثة' };
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
  const section = await fetchText('https://www.sudanakhbar.com/latestnews/dollar-prices', 12000);
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
/*                 فلسطينيو48 — جدول شراء/بيع للدولار                 */
/* ------------------------------------------------------------------ */

export function parsePls48Article(text: string): { buy: number | null; sell: number | null } {
  const t = normalizeDigits(text);
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

async function fetchPls48Reading(): Promise<{ reading: SourceReading | null; error: string | null }> {
  // صفحة التصنيف: آخر مقالات أسعار العملات في السودان
  const section = await fetchText('https://pls48.net/category/economy/', 12000);
  if (!section) return { reading: null, error: 'فلسطينيو48: تعذّر الوصول' };
  const links = Array.from(new Set(Array.from(section.matchAll(/href="(https:\/\/pls48\.net\/[^"#]+)"/g)).map((m) => m[1])))
    .filter((u) => /%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86|%D8%A3%D8%B3%D8%B9%D8%A7%D8%B1/.test(u))
    .slice(0, 3);
  for (const url of links) {
    const html = await fetchText(url, 12000);
    if (!html) continue;
    const parsed = parsePls48Article(htmlToText(html));
    if (parsed.sell) {
      const title = (html.match(/<title>([^<]{5,180})<\/title>/i) || [])[1] || '';
      return {
        reading: {
          source: 'فلسطينيو48',
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
  return { reading: null, error: 'فلسطينيو48: لا يوجد سعر حديث' };
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
  const html = await fetchText('https://nbs.sd/currency-rate/?lang=en', 12000);
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

  const goldApi = await fetchText('https://api.gold-api.com/price/XAU', 9000);
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

  const coinbase = await fetchText('https://api.coinbase.com/v2/prices/PAXG-USD/spot', 9000);
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
  const [sudafax, sudanakhbar, almashhad, pls48, official, spot] = await Promise.allSettled([
    fetchSudafaxReading(),
    fetchSudanakhbarReading(),
    fetchAlmashhadReading(),
    fetchPls48Reading(),
    fetchOfficialUsdReading(),
    fetchSpotReadings(),
  ]);

  const parallel: SourceBundle = { readings: [], errors: [] };
  let publishedLocalGold: number | null = null;

  const collect = (
    result: PromiseSettledResult<{ reading: SourceReading | null; error: string | null; gold21?: number | null }>,
    bundle: SourceBundle = parallel
  ) => {
    if (result.status === 'fulfilled') {
      if (result.value.reading) bundle.readings.push(result.value.reading);
      if (result.value.error) bundle.errors.push(result.value.error);
      if (result.value.gold21) publishedLocalGold = result.value.gold21;
    } else {
      parallel.errors.push('مصدر: فشل غير متوقع');
    }
  };

  collect(sudafax);
  collect(sudanakhbar);
  collect(almashhad);
  collect(pls48);

  const officialBundle: SourceBundle = { readings: [], errors: [] };
  if (official.status === 'fulfilled') {
    if (official.value.reading) officialBundle.readings.push(official.value.reading);
    if (official.value.error) officialBundle.errors.push(official.value.error);
  }

  const spotBundle: SourceBundle = { readings: [], errors: [] };
  if (spot.status === 'fulfilled') {
    spotBundle.readings = spot.value.readings;
    spotBundle.errors = spot.value.errors;
  }

  return {
    parallel: { ...parallel, publishedLocalGold },
    official: officialBundle,
    spot: spotBundle,
    fetchedAt: nowIso(),
  };
}
