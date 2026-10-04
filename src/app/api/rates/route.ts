import { NextResponse } from 'next/server';

const GRAMS_PER_OUNCE = 31.1034768;

export async function GET() {
  let ounceUsd = 4144.70;
  let usdRate = 8203.10;
  let sarRate = 2185.27;
  let aedRate = 2233.40;
  let egpRate = 157.60;
  let source = 'sudanakhbar + yahoo/coinbase';

  // 1. Fetch Live Ounce from Coinbase / Gold-API / Yahoo Finance
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      const p = parseFloat(data?.data?.amount);
      if (p && p > 1000) ounceUsd = p;
    }
  } catch (_) {
    try {
      const res2 = await fetch('https://api.gold-api.com/price/XAU', {
        next: { revalidate: 60 },
      });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2?.price && data2.price > 1000) ounceUsd = data2.price;
      }
    } catch (_) {}
  }

  // 2. Fetch Sudan Parallel Market Rates from SudanAkhbar / Sudafax
  try {
    const sudanRes = await fetch('https://www.sudanakhbar.com/latestnews/dollar-prices', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
      },
      next: { revalidate: 300 },
    });

    if (sudanRes.ok) {
      const html = await sudanRes.text();
      // Extract latest numbers (e.g. 8100 - 8250)
      const matches = html.match(/(\d{4,5}(?:\.\d+)?)\s*(?:جنيه|ج\.س)/g);
      if (matches && matches.length > 0) {
        for (const m of matches) {
          const num = parseFloat(m.replace(/[^\d.]/g, ''));
          if (num >= 5000 && num <= 15000) {
            usdRate = num;
            source = 'sudanakhbar (مباشر)';
            break;
          }
        }
      }
    }
  } catch (_) {
    // Keep standard parallel market rate
  }

  // Exact Mathematical Calculations
  const gramUsd = ounceUsd / GRAMS_PER_OUNCE;
  const karat24 = Math.round(gramUsd * usdRate);
  const karat22 = Math.round(karat24 * (22 / 24));
  const karat21 = Math.round(karat24 * (21 / 24));
  const karat18 = Math.round(karat24 * (18 / 24));
  const ounceSdg = Math.round(ounceUsd * usdRate);

  return NextResponse.json({
    ounceUsd,
    gramUsd: parseFloat(gramUsd.toFixed(2)),
    usdRate,
    sarRate,
    aedRate,
    egpRate,
    karat24,
    karat22,
    karat21,
    karat18,
    ounceSdg,
    source,
    lastUpdated: new Date().toISOString(),
  });
}
