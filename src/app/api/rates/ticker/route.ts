import { NextResponse } from 'next/server';
import { getRates } from '../../../../lib/rates';
import { fetchPricingSources } from '../../../../lib/pricingSources';
import { aggregateReadings } from '../../../../core/pricing';

export const dynamic = 'force-dynamic';

const GRAMS_PER_OUNCE = 31.1034768;
let memo: { at: number; body: any } | null = null;

const n = (v: unknown): number | null => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
};

/**
 * GET /api/rates/ticker — بيانات الشريط المتحرك:
 * الأونصة والجرام بالدولار، الدولار في السوق الموازي (شراء/بيع)، بنك الخرطوم (شراء/بيع)،
 * وسعر الجرام بالجنيه حسب السوق الموازي.
 * بيجمع مصدرين: اخبار السودان (الأحدث) + محرك المصادر المتعددة (احتياطي) — الأحدث بيكسب.
 */
export async function GET() {
  if (memo && Date.now() - memo.at < 5 * 60_000) {
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
  const body = {
    ok: Boolean(ounceUsd && parallel),
    fetchedAt: now.toISOString(),
    ounceUsd: ounceUsd ? Math.round(ounceUsd * 100) / 100 : null,
    gram24Usd: gram24Usd ? Math.round(gram24Usd * 100) / 100 : null,
    gram21Usd: gram21Usd ? Math.round(gram21Usd * 100) / 100 : null,
    parallel,
    bank,
    // الأهم: سعر الجرام بالجنيه = جرام الذهب العالمي بالدولار × سعر بيع الدولار الموازي
    gram21Parallel: gram21Usd && parallel ? Math.round(gram21Usd * parallel.sell) : null,
    gram24Parallel: gram24Usd && parallel ? Math.round(gram24Usd * parallel.sell) : null,
    gram21Bank: gram21Usd && bank ? Math.round(gram21Usd * bank.sell) : null,
  };
  if (body.ok) memo = { at: Date.now(), body };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
