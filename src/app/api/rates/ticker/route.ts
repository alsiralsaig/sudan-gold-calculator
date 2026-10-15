import { NextRequest, NextResponse } from 'next/server';
import { getRates } from '../../../../lib/rates';
import { fetchPricingSources } from '../../../../lib/pricingSources';
import { aggregateReadings, AED_PER_USD } from '../../../../core/pricing';

export const dynamic = 'force-dynamic';

const GRAMS_PER_OUNCE = 31.1034768;
let memo: { at: number; body: any; key: string } | null = null;

type AedBasisLabel = 'manual' | 'anchored' | 'market' | 'computed' | null;

const n = (v: unknown): number | null => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
};

/**
 * GET /api/rates/ticker — بيانات الشريط المتحرك:
 * الأونصة والجرام بالدولار، الدولار في السوق الموازي (شراء/بيع)، الدرهم الموازي (شراء/بيع)،
 * بنك الخرطوم (شراء/بيع)، وسعر الجرام بالجنيه.
 *
 * ⚠️ سعر الجرام يتحسب **بسلسلة الدرهم** (زي محرك الأسعار بالظبط):
 *   جرام 24 = (الأونصة ÷ 31.1034768) × 3.6725 × سعر الدرهم
 * مش بالدولار مباشرة — عشان الشريط ما يخالفش المحرك في نفس الشاشة.
 *
 * ?aed= سعر درهم من العميل (بمعايرته المحفوظة) — يُقدَّم على قراءات السوق.
 */
export async function GET(request: NextRequest) {
  const aedParam = n(request.nextUrl.searchParams.get('aed'));
  const rawBasis = request.nextUrl.searchParams.get('aedBasis');
  const aedBasisParam =
    rawBasis === 'manual' || rawBasis === 'anchored' || rawBasis === 'market' || rawBasis === 'computed'
      ? rawBasis
      : null;
  const memoKey = `${aedParam ?? 'none'}:${aedBasisParam ?? 'none'}`;
  if (memo && memo.key === memoKey && Date.now() - memo.at < 5 * 60_000) {
    return NextResponse.json(memo.body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  }
  const [r, snap] = await Promise.all([
    getRates().catch(() => null),
    fetchPricingSources().catch(() => null),
  ]);

  const now = new Date();
  const par = snap ? aggregateReadings(snap.parallel.readings, 'parallel', now, { minSources: 1 }) : null;
  const off = snap ? aggregateReadings(snap.official.readings, 'bank', now, { minSources: 1 }) : null;
  const spot = snap ? aggregateReadings(snap.spot.readings, 'spot', now, { minSources: 1 }) : null;

  // الذهب العالمي
  const ounceUsd = (r?.global.ok ? n(r.global.ounceUsd) : null) ?? n(spot?.sell) ?? n(r?.global.ounceUsd);

  // الدولار الموازي: اخبار السودان لو نجحت (مقال اليوم)، وإلا المحرك
  let parallel: { buy: number | null; sell: number; source: string; ageMinutes: number | null } | null = null;
  if (r?.usd.ok && n(r.usd.sell)) {
    parallel = { buy: n(r.usd.buy), sell: r.usd.sell, source: r.usd.source, ageMinutes: 0 };
  } else if (par && n(par.sell ?? par.buy)) {
    parallel = {
      buy: n(par.buy),
      sell: (n(par.sell) ?? n(par.buy))!,
      source: par.used.map((x) => x.source).join(' + '),
      ageMinutes: par.freshestAgeMinutes ?? null,
    };
  }

  // البنك: بنك الخرطوم من جدول التحويلات، وإلا الرسمي من المحرك
  let bank: { name: string; buy: number | null; sell: number } | null = null;
  if (r && n(r.banks.sell)) {
    bank = { name: r.banks.bank || 'بنك الخرطوم', buy: n(r.banks.buy), sell: r.banks.sell! };
  } else if (off && n(off.sell ?? off.buy)) {
    const a = n(off.buy), b = n(off.sell);
    const lo = a && b ? Math.min(a, b) : a ?? b;
    const hi = a && b ? Math.max(a, b) : b ?? a;
    bank = { name: off.used[0]?.source || 'البنك', buy: lo, sell: hi! };
  }

  const gram24Usd = ounceUsd ? ounceUsd / GRAMS_PER_OUNCE : null;
  const gram21Usd = gram24Usd ? gram24Usd * (21 / 24) : null;

  /* ---------- الدرهم الموازي: نفس أولوية المحرك (معايرة/سوق/محسوب) ---------- */
  const aedAll = snap?.parallelAed?.readings ?? [];
  const aedAgg = snap ? aggregateReadings(aedAll, 'parallel-aed', now, { minSources: 1 }) : null;
  const aedMarket = n(aedAgg?.sell) ?? n(aedAgg?.buy);
  // قراءة تساوي «دولار ÷ 3.6725» ما بتضيفش معلومة — نحيّدها لو معانا قراءة سوق
  const aedComputedRef = n(parallel?.sell) ? parallel!.sell / AED_PER_USD : null;
  const aedIndependent = aedAll.filter((r) => {
    const v = r.sell ?? r.price ?? r.buy ?? null;
    return !(v && aedComputedRef && Math.abs(v - aedComputedRef) / v < 0.005);
  });
  const aedIndepAgg = aedIndependent.length ? aggregateReadings(aedIndependent, 'parallel-aed', now, { minSources: 1 }) : null;
  const aedMarketReal = n(aedIndepAgg?.sell) ?? n(aedIndepAgg?.buy) ?? aedMarket;

  const aedSell = aedParam ?? aedMarketReal ?? aedComputedRef;
  // فارق الشراء/البيع بنفس نسبة زوج الدولار (زي computeGoldPrice)
  const aedBuy = aedSell && parallel?.buy && parallel?.sell ? aedSell * (parallel.buy / parallel.sell) : null;
  // أساس الرقم: من العميل (معايرته/السوق حسب ما حسم المحرك)، وإلا نحسمه هنا
  const aedBasis: AedBasisLabel = aedParam
    ? aedBasisParam ?? 'manual'
    : aedMarketReal
      ? 'market'
      : aedSell
        ? 'computed'
        : null;
  const aed = aedSell
    ? { buy: aedBuy ? Math.round(aedBuy) : null, sell: Math.round(aedSell), basis: aedBasis as AedBasisLabel }
    : null;

  /* ---------- سعر الجرام: سلسلة الدرهم (الأصل) وسلسلة الدولار (احتياطي) ---------- */
  const gram24Aed = ounceUsd ? (ounceUsd / GRAMS_PER_OUNCE) * AED_PER_USD : null;
  const useDirhamChain = Boolean(gram24Aed && aedSell);
  const body = {
    ok: Boolean(ounceUsd && parallel),
    fetchedAt: now.toISOString(),
    ounceUsd: ounceUsd ? Math.round(ounceUsd * 100) / 100 : null,
    gram24Usd: gram24Usd ? Math.round(gram24Usd * 100) / 100 : null,
    gram21Usd: gram21Usd ? Math.round(gram21Usd * 100) / 100 : null,
    parallel,
    bank,
    // الأهم: سعر الجرام بالجنيه — سلسلة الدرهم: (أونصة ÷ 31.1035) × 3.6725 × سعر الدرهم
    gram21Parallel: useDirhamChain
      ? Math.round(((gram24Aed! * aedSell!) * (21 / 24)))
      : gram21Usd && parallel
        ? Math.round(gram21Usd * parallel.sell)
        : null,
    gram24Parallel: useDirhamChain
      ? Math.round(gram24Aed! * aedSell!)
      : gram24Usd && parallel
        ? Math.round(gram24Usd * parallel.sell)
        : null,
    aed,
    gram21Bank: gram21Usd && bank ? Math.round(gram21Usd * bank.sell) : null,
  };
  if (body.ok) memo = { at: Date.now(), body, key: memoKey };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
