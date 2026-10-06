import { NextResponse } from 'next/server';
import { getRates } from '../../../lib/rates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates
 *
 * يرجع الشكل الجديد (global/usd/cross/warnings) مع الحقول القديمة
 * (ounceUsd, usdRate, karat21 ...) للتوافق مع الإصدارات السابقة.
 */
export async function GET() {
  try {
    const result = await getRates();

    return NextResponse.json({
      // ---- الشكل الجديد ----
      ...result,
      // ---- توافق مع الشكل القديم ----
      ounceUsd: result.global.ounceUsd,
      gramUsd: result.global.gramUsd,
      usdRate: result.usd.sell,
      usdBuyRate: result.usd.buy,
      bankUsdRate: result.banks.sell,
      sarRate: result.cross.sar,
      aedRate: result.cross.aed,
      egpRate: result.cross.egp,
      source: `${result.global.source} + ${result.usd.source}`,
      lastUpdated: result.fetchedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        stale: true,
        warnings: ['فشل جلب الأسعار'],
        message: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
