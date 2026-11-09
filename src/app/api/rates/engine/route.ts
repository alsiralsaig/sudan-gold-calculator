import { NextRequest, NextResponse } from 'next/server';

import {
  aggregateReadings,
  computeGoldPrice,
  compareWithPublished,
  AED_PER_USD,
  TRADE_KARAT,
} from '../../../../core/pricing';
import { fetchPricingSources } from '../../../../lib/pricingSources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates/engine
 *
 * يحسب سعر الذهب من الأونصة العالمية وسعر الدولار الموازي.
 * سعر الدرهم مشتق من الدولار بنسبة ثابتة 1 USD = 3.6725 AED،
 * ولا تُستخدم قراءة درهم مستقلة أو معايرة للدرهم في الحساب.
 *
 * معاملات اختيارية:
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

    const parallel = aggregateReadings(
      snapshot.parallel.readings,
      'parallel',
      new Date(),
      { minSources: 2 }
    );

    const official = aggregateReadings(
      snapshot.official.readings,
      'bank',
      new Date(),
      { minSources: 1 }
    );

    const spot = aggregateReadings(
      snapshot.spot.readings,
      'spot',
      new Date(),
      { minSources: 1 }
    );

    const overrideUsdBuy = numParam('usdBuy');
    const overrideUsdSell = numParam('usdSell');
    const overrideOunce = numParam('ounce');
    const adjust = numParam('adjust') ?? 0;
    const karat = numParam('karat') ?? TRADE_KARAT;

    // أخبار السودان هو المصدر الأساسي لسعر الدولار الموازي.
    const sudanAkhbarUsd = snapshot.parallel.readings.find(
      (reading) =>
        /اخبار السودان/i.test(reading.source) &&
        (reading.buy ?? 0) > 0 &&
        (reading.sell ?? 0) > 0
    );

    const usdBuy =
      overrideUsdBuy ??
      sudanAkhbarUsd?.buy ??
      parallel.buy ??
      parallel.sell;

    const usdSell =
      overrideUsdSell ??
      sudanAkhbarUsd?.sell ??
      parallel.sell ??
      parallel.buy;

    const ounceUsd = overrideOunce ?? spot.sell ?? spot.buy;

    // سعر الدرهم بالجنيه مشتق من الدولار فقط:
    // SDG لكل AED = SDG لكل USD ÷ 3.6725
    const aedSdg = usdSell ? usdSell / AED_PER_USD : null;
    const aedBasis = 'computed';

    const warnings = [
      ...parallel.warnings,
      ...official.warnings.map((warning) => `الرسمي: ${warning}`),
      ...spot.warnings.map((warning) => `الأونصة: ${warning}`),
    ];

    let computation: ReturnType<typeof computeGoldPrice> | null = null;
    let publishedCheck: ReturnType<typeof compareWithPublished> | null = null;

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

        if (publishedCheck.message) {
          warnings.push(publishedCheck.message);
        }
      }
    } else {
      warnings.push(
        'تعذّر حساب السعر: ناقص سعر الدولار الموازي أو الأونصة — أدخل السعر يدوياً'
      );
    }

    const sourcesUsed = {
      parallel: sudanAkhbarUsd
        ? [sudanAkhbarUsd.source]
        : parallel.used.map((reading) => reading.source),
      official: official.used.map((reading) => reading.source),
      spot: spot.used.map((reading) => reading.source),
    };

    return NextResponse.json({
      ok: Boolean(
        computation?.ok &&
          (sudanAkhbarUsd || parallel.used.length > 0)
      ),
      fetchedAt: snapshot.fetchedAt,
      aedSdg: aedSdg ?? null,
      aedBasis,
      aedAggregates: {
        used: [],
        warnings: [],
        readings: [],
      },
      inputs: {
        ounceUsd,
        usdBuy,
        usdSell,
        adjust,
        karat,
        aedSdg,
      },
      overridesUsed: {
        usdBuy: overrideUsdBuy !== null,
        usdSell: overrideUsdSell !== null,
        ounce: overrideOunce !== null,
      },
      parallel: {
        readings: snapshot.parallel.readings,
        errors: snapshot.parallel.errors,
        primarySource: sudanAkhbarUsd?.source ?? null,
      },
      official: {
        readings: snapshot.official.readings,
        errors: snapshot.official.errors,
      },
      spot: {
        readings: snapshot.spot.readings,
        errors: snapshot.spot.errors,
      },
      aggregates: { parallel, official, spot },
      computation,
      publishedCheck,
      publishedLocalGold: snapshot.parallel.publishedLocalGold ?? null,
      sourcesUsed,
      warnings,
      errors: [
        ...snapshot.parallel.errors,
        ...snapshot.official.errors,
        ...snapshot.spot.errors,
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { ok: false, warnings: ['فشل تشغيل محرك الأسعار'], message },
      { status: 500 }
    );
  }
}
