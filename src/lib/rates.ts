/**
 * جالب الأسعار: الذهب العالمي + الدولار والعملات في السودان.
 *
 * المشاكل التي كان يعاني منها الجالب القديم:
 *  - نمط بحث (regex) لا يطابق بنية المقال، فيرجع بصمت إلى رقم ثابت (8400).
 *  - أسعار الريال/الدرهم/الجنيه المصري محسوبة بمعادلة ثابتة لا تعكس السوق.
 *  - حدود قديمة (5000-15000) ترفض أي سعر خارجها بصمت.
 *
 * الحل هنا: قراءة جدول "السوق الأسود" المنشور فعلياً، مع تحقق منطقي،
 * وإظهار المصدر ووقت التحديث، وعدم تقديم رقم قديم على أنه حديث.
 */

export const GRAMS_PER_OUNCE = 31.1034768;

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';

const SUDANAKHBAR_SECTION = 'https://www.sudanakhbar.com/latestnews/dollar-prices';

export interface RatesResult {
  ok: boolean;
  stale: boolean;
  warnings: string[];
  fetchedAt: string;
  global: { ounceUsd: number; gramUsd: number; source: string; ok: boolean };
  usd: { sell: number; buy: number | null; source: string; ok: boolean };
  /** بنك الخرطوم (تحويلات): شراء/بيع */
  banks: { sell: number | null; buy: number | null; bank: string; source: string };
  cross: { sar: number | null; aed: number | null; egp: number | null; source: string };
  karat21: number;
  karat24: number;
  karat22: number;
  karat18: number;
  ounceSdg: number;
}

interface CacheEntry<T> {
  value: T;
  at: number;
}

/** الأسعار الاحتياطية — تُستخدم فقط عند فشل كل المصادر وتُعلَّم كبيانات غير محدثة */
const BASELINE = {
  ounceUsd: 4000,
  usdSell: 8400,
  usdBuy: 8300,
  sar: 2240,
  aed: 2288,
  egp: 170,
};

const globalCache = new Map<string, CacheEntry<unknown>>();
const lastGood: {
  ounce?: { value: number; source: string; at: number };
  sudan?: { value: SudanSnapshot; at: number };
} = {};

function cached<T>(key: string, ttlMs: number): T | null {
  const entry = globalCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) return null;
  return entry.value;
}

function setCache<T>(key: string, value: T) {
  globalCache.set(key, { value, at: Date.now() });
}

/* ---------------------------------- أدوات ---------------------------------- */

/** تحويل الأرقام العربية-الهندية إلى لاتينية (احتياط لو تغيّر المصدر) */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** تحويل HTML إلى نص بفواصل | للحفاظ على حدود الجداول */
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const piped = withoutScripts.replace(/<[^>]+>/g, ' | ');
  return normalizeDigits(piped)
    .replace(/&nbsp;|&#160;|\u00a0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/(\s*\|\s*)+/g, ' | ')
    .trim();
}

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = normalizeDigits(String(raw)).replace(/[,\s]/g, '');
  const value = parseFloat(cleaned);
  return isFinite(value) ? value : null;
}

function inRange(value: number | null, min: number, max: number): value is number {
  return value !== null && value >= min && value <= max;
}

/** مواقع بتحجب سيرفرات Vercel (Cloudflare) — لو الجلب المباشر فشل بنجرّب عبر قارئ وسيط */
const PROXY_HOSTS = /(^|\.)(sudanakhbar\.com|almashhadalsudani\.com)$/i;

async function fetchDirect(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    // صفحة تحدّي Cloudflare بدل المحتوى
    if (/Just a moment\.\.\.|cf-browser-verification|challenge-platform/i.test(text.slice(0, 4000))) return null;
    return text;
  } catch {
    return null;
  }
}

/** جلب نص مع مهلة زمنية وشعار تعريف (+ قارئ وسيط احتياطي للمواقع المحجوبة) */
export async function fetchText(url: string, timeoutMs = 9000): Promise<string | null> {
  const direct = await fetchDirect(url, timeoutMs);
  if (direct) return direct;
  let host = '';
  try { host = new URL(url).hostname; } catch { return null; }
  if (!PROXY_HOSTS.test(host)) return null;
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'X-Return-Format': 'html', Accept: 'text/html' },
      signal: AbortSignal.timeout(Math.max(timeoutMs, 15000)),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any | null> {
  const text = await fetchText(url, timeoutMs);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ------------------------------ الذهب العالمي ------------------------------ */

async function fetchOunce(): Promise<{ value: number; source: string } | null> {
  const fromCache = cached<{ value: number; source: string }>('ounce', 60_000);
  if (fromCache) return fromCache;

  // 1) Yahoo Finance — عقود الذهب الآجلة
  const yahoo = await fetchJson(
    'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1m'
  );
  const yahooPrice = toNumber(yahoo?.chart?.result?.[0]?.meta?.regularMarketPrice);
  if (inRange(yahooPrice, 300, 30_000)) {
    const value = { value: yahooPrice, source: 'Yahoo Finance (GC=F)' };
    setCache('ounce', value);
    lastGood.ounce = { ...value, at: Date.now() };
    return value;
  }

  // 2) gold-api.com
  const goldApi = await fetchJson('https://api.gold-api.com/price/XAU');
  const goldApiPrice = toNumber(goldApi?.price);
  if (inRange(goldApiPrice, 300, 30_000)) {
    const value = { value: goldApiPrice, source: 'Gold-API (XAU)' };
    setCache('ounce', value);
    lastGood.ounce = { ...value, at: Date.now() };
    return value;
  }

  // 3) Coinbase PAXG (يعادل أونصة ذهب)
  const coinbase = await fetchJson('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
  const cbPrice = toNumber(coinbase?.data?.amount);
  if (inRange(cbPrice, 300, 30_000)) {
    const value = { value: cbPrice, source: 'Coinbase (PAXG)' };
    setCache('ounce', value);
    lastGood.ounce = { ...value, at: Date.now() };
    return value;
  }

  return null;
}

/* --------------------------- السوق السوداني --------------------------- */

interface SudanSnapshot {
  usdSell: number;
  usdBuy: number | null;
  bankSell: number | null;
  bankBuy?: number | null;
  sar: number | null;
  aed: number | null;
  egp: number | null;
  source: string;
  articleUrl?: string;
}

interface CurrencyPair {
  buy: number | null;
  sell: number | null;
}

/**
 * استخراج زوج (شراء/بيع) لعملة من جدول "السوق الأسود".
 * الشكل في المصدر: "الدولار الامريكي | 8400 | جنيه للشراء | 8583.7600 | جنيه للبيع"
 */
export function extractCurrencyPair(text: string, aliases: string[]): CurrencyPair {
  for (const alias of aliases) {
    const pairRe = new RegExp(
      `${alias}[\\s|]*([\\d,]+(?:\\.\\d+)?)[\\s|]*(?:جنيه\\s*)?للشراء[\\s|]*([\\d,]+(?:\\.\\d+)?)`,
      'i'
    );
    const m = pairRe.exec(text);
    if (m) {
      const buy = toNumber(m[1]);
      const sell = toNumber(m[2]);
      if (buy !== null || sell !== null) return { buy, sell };
    }
  }
  return { buy: null, sell: null };
}

/**
 * استخراج قيمة بيع منفردة لعملة من جدول "السعر بالجنيه السوداني".
 * الشكل: "الدولار الأمريكي | 8583.7600 ( ارتفاع سعر متوسط )"
 */
export function extractSinglePrice(text: string, aliases: string[]): number | null {
  for (const alias of aliases) {
    const re = new RegExp(`${alias}[\\s|]*([\\d,]+(?:\\.\\d+)?)`, 'i');
    const m = re.exec(text);
    if (m) {
      const value = toNumber(m[1]);
      if (value !== null) return value;
    }
  }
  return null;
}

const ALIAS = {
  usd: ['الدولار\\s*الا?مريكي', 'دولار\\s*امريكي', 'الدولار'],
  sar: ['الريال\\s*السعودي', 'ريال\\s*سعودي'],
  aed: ['الدرهم\\s*الإ?ماراتي', 'درهم\\s*اماراتي', 'الدرهم'],
  egp: ['الجنيه\\s*المصري', 'جنيه\\s*مصري'],
};

/** استخراج متوسط سعر البنوك من مقال البنوك */
export function extractBankRate(text: string): number | null {
  const sellMatch =
    /بلغ\s*سعر\s*البيع[\s|]*([\d,]+(?:\.\d+)?)/i.exec(text) ||
    /سعر\s*البيع\s*في\s*البنوك[\s|]*([\d,]+(?:\.\d+)?)/i.exec(text);
  const value = toNumber(sellMatch?.[1]);
  if (inRange(value, 500, 50_000)) return value;
  return null;
}

/**
 * سعر بنك الخرطوم من جدول «سعر صرف الدولار ... للتحويلات في 17 بنك سوداني»:
 * الشكل: "بنك الخرطوم | 4200.00 | 4231.50 | مستقر" (شراء ثم بيع).
 * لازم رقمين ورا اسم البنك مباشرة (بين فواصل/مسافات بس) عشان ما نلقط أرقام من فقرات النص.
 */
export function extractKhartoumBank(text: string): { buy: number; sell: number } | null {
  const re = /بنك\s*الخرطوم[\s|]+([\d,]+(?:\.\d+)?)[\s|]+([\d,]+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const a = toNumber(m[1]);
    const b = toNumber(m[2]);
    if (inRange(a, 500, 50_000) && inRange(b, 500, 50_000)) {
      const buy = Math.min(a!, b!);
      const sell = Math.max(a!, b!);
      if (sell / buy < 1.2) return { buy, sell };
    }
  }
  return null;
}

function parseSudanArticle(text: string, url: string): SudanSnapshot | null {
  const usdPair = extractCurrencyPair(text, ALIAS.usd);
  let usdSell = usdPair.sell;
  let usdBuy = usdPair.buy;

  if (!inRange(usdSell, 1_000, 100_000)) usdSell = null;
  if (!inRange(usdBuy, 1_000, 100_000)) usdBuy = null;

  if (usdSell === null) {
    const single = extractSinglePrice(text, ALIAS.usd);
    if (inRange(single, 1_000, 100_000)) usdSell = single;
  }
  if (usdSell === null) return null;

  const sarPair = extractCurrencyPair(text, ALIAS.sar);
  const aedPair = extractCurrencyPair(text, ALIAS.aed);
  const egpPair = extractCurrencyPair(text, ALIAS.egp);

  let sar = sarPair.sell ?? extractSinglePrice(text, ALIAS.sar);
  let aed = aedPair.sell ?? extractSinglePrice(text, ALIAS.aed);
  let egp = egpPair.sell ?? extractSinglePrice(text, ALIAS.egp);

  if (!inRange(sar, 200, 20_000)) sar = null;
  if (!inRange(aed, 200, 20_000)) aed = null;
  if (!inRange(egp, 20, 5_000)) egp = null;

  return {
    usdSell,
    usdBuy: usdBuy !== null && usdSell !== null && usdBuy <= usdSell ? usdBuy : null,
    bankSell: null,
    sar,
    aed,
    egp,
    source: 'اخبار السودان (السوق الموازي)',
    articleUrl: url,
  };
}

function articleLinks(sectionHtml: string): { url: string; title: string }[] {
  const links: { url: string; title: string }[] = [];
  const re = /href="(https:\/\/www\.sudanakhbar\.com\/\d+)"[^>]*title="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(sectionHtml))) {
    const url = m[1];
    const title = normalizeDigits(m[2]);
    if (seen.has(url)) continue;
    seen.add(url);
    if (!/الدولار|العملات|اسعار/.test(title)) continue;
    links.push({ url, title });
  }
  return links;
}

async function fetchSudanRates(): Promise<SudanSnapshot | null> {
  const fromCache = cached<SudanSnapshot>('sudan', 300_000);
  if (fromCache) return fromCache;

  const sectionHtml = await fetchText(SUDANAKHBAR_SECTION);
  if (sectionHtml) {
    const links = articleLinks(sectionHtml);

    // 1) مقال السوق الموازي/الأسود — بعض المقالات أخبار بدون جدول، فنجرّب أكتر من مرشح
    const parallelCandidates = [
      ...links.filter((l) => /السوق\s*(الأسود|السوداء|الموازي)|السوداء|الموازي/.test(l.title) && !/البنوك|بنك/.test(l.title)),
      ...links.filter((l) => !/البنوك|بنك|المصري/.test(l.title)),
    ]
      .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i)
      // المقالات اليومية البتحتوي الجدول ("سعر الدولار في السودان اليوم ... السوق السوداء") أولاً
      .sort((a, b) => {
        const score = (t: string) => (/سعر الدولار في السودان اليوم|أسعار العملات مقابل الجنيه/.test(t) ? 0 : 1);
        return score(a.title) - score(b.title);
      })
      .slice(0, 5);

    let snapshot: SudanSnapshot | null = null;
    for (const cand of parallelCandidates) {
      const html = await fetchText(cand.url);
      if (!html) continue;
      const snap = parseSudanArticle(htmlToText(html), cand.url);
      if (!snap) continue;
      if (snap.usdBuy !== null) { snapshot = snap; break; } // جدول كامل (شراء/بيع)
      if (!snapshot) snapshot = snap; // احتياطي: سعر بيع بس
    }

    if (snapshot) {
      // 2) مقال البنوك: سعر بنك الخرطوم (شراء/بيع) من جدول التحويلات
      const bankCandidates = links
        .filter((l) => /البنوك|بنك/.test(l.title))
        .sort((a, b) => {
          const score = (t: string) => (/من البنوك|في البنوك|البنوك السودانية|متوسط/.test(t) ? 0 : 1);
          return score(a.title) - score(b.title);
        })
        .slice(0, 4);

      for (const candidate of bankCandidates) {
        const bankHtml = await fetchText(candidate.url);
        if (!bankHtml) continue;
        const text = htmlToText(bankHtml);
        const bok = extractKhartoumBank(text);
        if (bok) {
          snapshot.bankSell = bok.sell;
          snapshot.bankBuy = bok.buy;
          break;
        }
        const bankRate = extractBankRate(text);
        if (bankRate && !snapshot.bankSell) snapshot.bankSell = bankRate;
      }
      setCache('sudan', snapshot);
      lastGood.sudan = { value: snapshot, at: Date.now() };
      return snapshot;
    }
  }

  // 3) مصدر بديل: sudafax
  const faxHtml = await fetchText(
    'https://sudafax.com/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1'
  );
  if (faxHtml) {
    const links: { url: string; title: string }[] = [];
    const re = /href="(https?:\/\/(?:www\.)?sudafax\.com\/\d+\/[^"#?]+)"[^>]*title="([^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(faxHtml))) links.push({ url: m[1], title: normalizeDigits(m[2]) });
    for (const link of links.slice(0, 3)) {
      const html = await fetchText(link.url);
      if (!html) continue;
      const text = htmlToText(html);
      const pair = extractCurrencyPair(text, ALIAS.usd);
      const sell = inRange(pair.sell, 1_000, 100_000)
        ? pair.sell
        : extractSinglePrice(text, ALIAS.usd);
      if (inRange(sell, 1_000, 100_000)) {
        const snapshot: SudanSnapshot = {
          usdSell: sell,
          usdBuy: inRange(pair.buy, 1_000, 100_000) ? pair.buy : null,
          bankSell: null,
          sar: extractSinglePrice(text, ALIAS.sar),
          aed: extractSinglePrice(text, ALIAS.aed),
          egp: extractSinglePrice(text, ALIAS.egp),
          source: 'سودافاكس',
          articleUrl: link.url,
        };
        setCache('sudan', snapshot);
        lastGood.sudan = { value: snapshot, at: Date.now() };
        return snapshot;
      }
    }
  }

  return null;
}

/* ------------------------------ التجميع النهائي ------------------------------ */

export async function getRates(): Promise<RatesResult> {
  const warnings: string[] = [];
  const [ounce, sudan] = await Promise.all([fetchOunce(), fetchSudanRates()]);

  let ounceUsd: number;
  let ounceSource: string;
  let goldOk = true;
  let usdSell: number;
  let usdBuy: number | null = null;
  let usdSource: string;
  let usdOk = true;
  let bankSell: number | null = null;
  let bankBuy: number | null = null;
  let sar: number | null = null;
  let aed: number | null = null;
  let egp: number | null = null;
  let crossSource = '';

  if (ounce) {
    ounceUsd = ounce.value;
    ounceSource = ounce.source;
  } else if (lastGood.ounce) {
    ounceUsd = lastGood.ounce.value;
    ounceSource = `${lastGood.ounce.source} (آخر قيمة محفوظة)`;
    goldOk = false;
    warnings.push('تعذر تحديث سعر الذهب العالمي، يتم عرض آخر قيمة محفوظة.');
  } else {
    ounceUsd = BASELINE.ounceUsd;
    ounceSource = 'قيمة احتياطية ثابتة';
    goldOk = false;
    warnings.push('تعذر الوصول لمصادر سعر الذهب العالمي.');
  }

  if (sudan) {
    usdSell = sudan.usdSell;
    usdBuy = sudan.usdBuy;
    bankSell = sudan.bankSell;
    bankBuy = sudan.bankBuy ?? null;
    sar = sudan.sar;
    aed = sudan.aed;
    egp = sudan.egp;
    usdSource = sudan.source;
    crossSource = sudan.source;
  } else if (lastGood.sudan) {
    const snap = lastGood.sudan.value;
    usdSell = snap.usdSell;
    usdBuy = snap.usdBuy;
    bankSell = snap.bankSell;
    bankBuy = snap.bankBuy ?? null;
    sar = snap.sar;
    aed = snap.aed;
    egp = snap.egp;
    usdSource = `${snap.source} (آخر قيمة محفوظة)`;
    crossSource = usdSource;
    usdOk = false;
    warnings.push('تعذر تحديث سعر الدولار من السوق، يتم عرض آخر قيمة محفوظة.');
  } else {
    usdSell = BASELINE.usdSell;
    usdBuy = BASELINE.usdBuy;
    usdSource = 'قيمة احتياطية ثابتة';
    crossSource = usdSource;
    usdOk = false;
    warnings.push('تعذر قراءة سعر الدولار من مصادر السوق السوداني.');
  }

  if (sar === null || aed === null || egp === null) {
    warnings.push('بعض أسعار العملات (ريال/درهم/جنيه مصري) لم تُنشر اليوم، وتُعرض بقيمتها المحسوبة أو السابقة.');
  }

  const gram24 = ounceUsd / GRAMS_PER_OUNCE;
  const karat21Raw = gram24 * (21 / 24) * usdSell;
  const karat21 = Math.round(karat21Raw);
  const karat24 = Math.round(karat21Raw * (24 / 21));
  const karat22 = Math.round(karat21Raw * (22 / 21));
  const karat18 = Math.round(karat21Raw * (18 / 21));
  const ounceSdg = Math.round(ounceUsd * usdSell);

  const stale = !goldOk || !usdOk;
  const ok = goldOk && usdOk;

  if (ok && !cached('sudan-warn-logged', 60 * 60 * 1000)) {
    setCache('sudan-warn-logged', true);
  }

  return {
    ok,
    stale,
    warnings,
    fetchedAt: new Date().toISOString(),
    global: {
      ounceUsd: Math.round(ounceUsd * 100) / 100,
      gramUsd: Math.round(gram24 * 100) / 100,
      source: ounceSource,
      ok: goldOk,
    },
    usd: {
      sell: usdSell,
      buy: usdBuy,
      source: usdSource,
      ok: usdOk,
    },
    banks: { sell: bankSell, buy: bankBuy, bank: 'بنك الخرطوم', source: bankSell ? 'اخبار السودان (البنوك)' : '' },
    cross: { sar, aed, egp, source: crossSource },
    karat21,
    karat24,
    karat22,
    karat18,
    ounceSdg,
  };
}
