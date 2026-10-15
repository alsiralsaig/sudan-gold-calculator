import { NextRequest, NextResponse } from 'next/server';

import { aggregateReadings, computeGoldPrice, compareWithPublished, resolveAedSdg, TRADE_KARAT } from '../../../../core/pricing';
import { fetchPricingSources } from '../../../../lib/pricingSources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates/engine
 *
 * محرك الأسعار: يجلب عدة مصادر للسوق الموازي + الرسمي + الذهب العالمي،
 * يمررها على طبقة التحقق (شذوذ/اتفاق/حداثة) ثم يحسب سعر جرام عيار 21
 * شراءً وبيعاً بشكل منفصل — ولا يعطي رقماً واحداً على أنه الحقيقة.
 *
 * معاملات اختيارية (لتجاوز مصدر بتقدير المستخدم):
 *   ?usdBuy=  ?usdSell=  ?ounce=  ?adjust=  ?karat=
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const numParam = (key: string): number | null => {
      const raw = params.get(key);
      if (!raw) return null;
      const n = Number(String(raw).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };

    const snapshot = await fetchPricingSources();

    const parallel = aggregateReadings(snapshot.parallel.readings, 'parallel', new Date(), { minSources: 2 });
    const official = aggregateReadings(snapshot.official.readings, 'bank', new Date(), { minSources: 1 });
    const spot = aggregateReadings(snapshot.spot.readings, 'spot', new Date(), { minSources: 1 });
    const aedAgg = aggregateReadings(snapshot.parallelAed?.readings ?? [], 'parallel-aed', new Date(), { minSources: 1 });

    const overrideUsdBuy = numParam('usdBuy');
    const overrideUsdSell = numParam('usdSell');
    const overrideOunce = numParam('ounce');
    const overrideAed = numParam('aed');
    const aedRatio = numParam('aedRatio'); // معايرة: نسبة الدرهم الحقيقي للمحسوب من الدولار (المدى في core/pricing)
    const adjust = numParam('adjust') ?? 0;
    const karat = numParam('karat') ?? TRADE_KARAT;

    const usdBuy = overrideUsdBuy ?? parallel.buy ?? parallel.sell;
    const usdSell = overrideUsdSell ?? parallel.sell ?? parallel.buy;
    const ounceUsd = overrideOunce ?? spot.sell ?? spot.buy;

    // سعر الدرهم: «من عندي» ثم القراءة المنشورة ثم المحسوب من الدولار (3.6725)
    // ملاحظة صادقة: بعض المواقع تنشر «الدرهم» مجرد الدولار ÷ 3.6725 — لو القراءة
    // تطابق الاشتقاق (±0.5%) نعتبرها محسوبة مش سعر سوق حقيقي.
    // قاعدة الاختيار موحّدة ومُختبَرة في core/pricing.ts — الأولوية:
    // يدوي ← معايرة (تمشي مع الدولار) ← قراءة السوق ← المحسوب من الدولار
    const aedResolution = resolveAedSdg({
      overrideAed,
      aedRatio,
      aedMarket: aedAgg.sell ?? aedAgg.buy,
      usdSell,
    });
    const aedSdg = aedResolution.aedSdg;
    const aedBasis = aedResolution.basis;

    const warnings = [
      ...parallel.warnings,
      ...official.warnings.map((w) => `الرسمي: ${w}`),
      ...spot.warnings.map((w) => `الأونصة: ${w}`),
    ];

    let computation = null as ReturnType<typeof computeGoldPrice> | null;
    let publishedCheck = null as ReturnType<typeof compareWithPublished> | null;

    if (usdBuy && usdSell && ounceUsd) {
      computation = computeGoldPrice({
        ounceUsd,
        usdBuy,
        usdSell,
        localAdjustPercent: adjust,
        karat,
        aedSdg,
      });
      warnings.push(...computation.warnings);

      const published = snapshot.parallel.publishedLocalGold ?? null;
      if (published && computation.sell > 0) {
        publishedCheck = compareWithPublished(computation.sell, published);
        if (publishedCheck.message) warnings.push(publishedCheck.message);
      }
    } else {
      warnings.push('تعذّر حساب السعر: ناقص سعر الدولار الموازي أو الأونصة — أدخل السعر يدوياً');
    }

    const sourcesUsed = {
      parallel: parallel.used.map((r) => r.source),
      official: official.used.map((r) => r.source),
      spot: spot.used.map((r) => r.source),
    };

    return NextResponse.json({
      ok: Boolean(computation?.ok && parallel.used.length > 0),
      fetchedAt: snapshot.fetchedAt,
      aedSdg: aedSdg ?? null,
      aedBasis,
      aedAggregates: { used: aedAgg.used, warnings: aedAgg.warnings },
      inputs: { ounceUsd, usdBuy, usdSell, adjust, karat, aedSdg },
      overridesUsed: {
        usdBuy: overrideUsdBuy !== null,
        usdSell: overrideUsdSell !== null,
        ounce: overrideOunce !== null,
      },
      parallel: { readings: snapshot.parallel.readings, errors: snapshot.parallel.errors },
      official: { readings: snapshot.official.readings, errors: snapshot.official.errors },
      spot: { readings: snapshot.spot.readings, errors: snapshot.spot.errors },
      aggregates: { parallel, official, spot },
      computation,
      publishedCheck,
      publishedLocalGold: snapshot.parallel.publishedLocalGold ?? null,
      sourcesUsed,
      warnings,
      errors: [...snapshot.parallel.errors, ...snapshot.official.errors, ...snapshot.spot.errors],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, warnings: ['فشل تشغيل محرك الأسعار'], message },
      { status: 500 }
    );
  }
}
