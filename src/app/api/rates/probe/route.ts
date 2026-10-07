import { NextResponse } from 'next/server';

import { fetchText } from '../../../../lib/rates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates/probe — تشخيص مؤقت
 *
 * يجرّب قائمة مصادر محتملة **من شبكة السيرفر نفسه** (Vercel) ويخبر أيّها
 * قابل للوصول فعلًا من بيئة النشر. المواقع السودانية كثيراً ما تحجب
 * عناوين مراكز البيانات، فلا يكفي أن يعمل المصدر محليًا.
 */
const CANDIDATES: { name: string; url: string; expect?: string }[] = [
  { name: 'اخبار السودان (قسم)', url: 'https://www.sudanakhbar.com/latestnews/dollar-prices', expect: 'دولار' },
  { name: 'اخبار السودان (feed)', url: 'https://www.sudanakhbar.com/feed', expect: 'item' },
  { name: 'اخبار السودان (بلا www)', url: 'https://sudanakhbar.com/latestnews/dollar-prices', expect: 'دولار' },
  { name: 'المشهد (feed)', url: 'https://almashhadalsudani.com/economic-news/currency-prices-sudan/feed/', expect: 'item' },
  { name: 'المشهد (قسم)', url: 'https://almashhadalsudani.com/economic-news/currency-prices-sudan/', expect: 'دولار' },
  { name: 'فلسطينيو48', url: 'https://pls48.net/category/economy/', expect: 'دولار' },
  { name: 'سودافاكس (feed)', url: 'https://sudafax.com/feed/', expect: 'item' },
  { name: 'بنك السودان', url: 'https://nbs.sd/currency-rate/?lang=en', expect: 'Dollar' },
  { name: 'الووم', url: 'https://aluom.net/', expect: 'دولار' },
  { name: 'سودان تربيون (عربي)', url: 'https://sudantribune.com/ar/', expect: 'السودان' },
  { name: 'الراكوبة', url: 'https://alrakoba.net/', expect: 'السودان' },
  { name: 'سودارس', url: 'https://www.sudaress.com/', expect: 'السودان' },
  { name: 'السوداني', url: 'https://alsudanalyoum.com/', expect: 'السودان' },
  { name: 'سودانايل', url: 'https://sudanile.com/', expect: 'السودان' },
  { name: 'دبنقا', url: 'https://www.dabangasudan.org/ar/', expect: 'السودان' },
  { name: 'الطريق', url: 'https://altaghyeer.info/ar/', expect: 'السودان' },
  { name: 'تليغراف السودان', url: 'https://www.sudantribune.com/spip.php?rubrique2', expect: '' },
  { name: 'أخبار Google RSS (دولار السودان)', url: 'https://news.google.com/rss/search?q=%D8%B3%D8%B9%D8%B1+%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1+%D9%81%D9%8A+%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86&hl=ar&gl=SD&ceid=SD:ar', expect: 'item' },
  { name: 'Bing News RSS', url: 'https://www.bing.com/news/search?q=%D8%B3%D8%B9%D8%B1+%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1+%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86&format=RSS', expect: 'item' },
  { name: 'تليغرام — قناة سودانية', url: 'https://t.me/s/sudannewsnow', expect: 'tgme' },
  { name: 'gold-api', url: 'https://api.gold-api.com/price/XAU', expect: 'price' },
  { name: 'Coinbase PAXG', url: 'https://api.coinbase.com/v2/prices/PAXG-USD/spot', expect: 'amount' },
];

function snippet(html: string, needle: string, limit = 3, window = 200): string[] {
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const out: string[] = [];
  let idx = text.indexOf(needle);
  while (idx >= 0 && out.length < limit) {
    out.push(text.slice(Math.max(0, idx - 40), idx + window));
    idx = text.indexOf(needle, idx + needle.length);
  }
  return out;
}

export async function GET(request: Request) {
  const inspect = new URL(request.url).searchParams.get('mode') === 'inspect';
  if (inspect) {
    const targets = [
      { name: 'فلسطينيو48 (اقتصاد)', url: 'https://pls48.net/category/economy/' },
      { name: 'فلسطينيو48 (بحث السودان)', url: 'https://pls48.net/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1+%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86' },
      { name: 'الراكوبة', url: 'https://alrakoba.net/' },
      { name: 'الراكوبة (بحث دولار)', url: 'https://alrakoba.net/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1' },
      { name: 'الووم', url: 'https://aluom.net/' },
      { name: 'الووم (بحث دولار)', url: 'https://aluom.net/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1' },
      { name: 'دبنقا (بحث دولار)', url: 'https://www.dabangasudan.org/ar/search?query=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1' },
      { name: 'Google News RSS', url: 'https://news.google.com/rss/search?q=%D8%B3%D8%B9%D8%B1+%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1+%D9%81%D9%8A+%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86&hl=ar&gl=SD&ceid=SD:ar' },
      { name: 'Bing News RSS', url: 'https://www.bing.com/news/search?q=%D8%B3%D8%B9%D8%B1+%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1+%D8%A7%D9%84%D8%B3%D9%88%D8%AF%D8%A7%D9%86&format=RSS' },
    ];
    const out = await Promise.all(
      targets.map(async (t) => {
        const body = await fetchText(t.url, 12000);
        if (!body) return { name: t.name, ok: false };
        const titles = (body.match(/<title>(?:<!\[CDATA\[)?([^<\]]{10,120})/g) || [])
          .map((m) => m.replace(/<title>(?:<!\[CDATA\[)?/, '').trim())
          .slice(0, 6);
        return {
          name: t.name,
          ok: true,
          bytes: body.length,
          titles,
          snippets: snippet(body, 'الدولار', 3, 220),
        };
      })
    );
    return NextResponse.json({ ok: true, inspected: out });
  }

  const started = Date.now();
  const results = await Promise.all(
    CANDIDATES.map(async (candidate) => {
      const t0 = Date.now();
      try {
        const body = await fetchText(candidate.url, 9000);
        const ms = Date.now() - t0;
        if (!body) {
          return { ...candidate, ok: false, status: 0, ms, bytes: 0, note: 'لا رد' };
        }
        const expectedOk = !candidate.expect || body.includes(candidate.expect);
        const numbers = (body.match(/[\d,]{4,9}/g) || []).slice(0, 3);
        return {
          name: candidate.name,
          url: candidate.url,
          ok: expectedOk,
          status: 200,
          ms,
          bytes: body.length,
          note: expectedOk ? 'يحتوي الكلمة المتوقعة' : `لا يحتوي «${candidate.expect}»`,
          sampleNumbers: numbers,
        };
      } catch (error: unknown) {
        return {
          name: candidate.name,
          url: candidate.url,
          ok: false,
          status: 0,
          ms: Date.now() - t0,
          bytes: 0,
          note: error instanceof Error ? error.message.slice(0, 60) : 'خطأ',
        };
      }
    })
  );

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - started,
    reachable: results.filter((r) => r.ok).map((r) => r.name),
    blocked: results.filter((r) => !r.ok).map((r) => r.name),
    results,
  });
}
