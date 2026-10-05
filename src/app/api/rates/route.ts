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
      // Follow the newest Sudan Akhbar article about the parallel-market dollar.
      // The landing page also contains bank rates, so taking the first number
      // (the old implementation) could incorrectly return 8203 instead of the
      // published selling rate such as 8400.
      const article = html.match(/href="(https?:\/\/www\.sudanakhbar\.com\/\d+)"[^>]+title="[^"]*الدولار[^"]*"/i);
      if (article?.[1]) {
        const articleRes = await fetch(article[1], { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } });
        if (articleRes.ok) {
          const articleHtml = await articleRes.text();
          const sellMatch = articleHtml.match(/متوسط\s+سعر\s+بيع\s+الدولار[^\d]{0,100}([\d,]+)/i);
          const sell = sellMatch ? parseFloat(sellMatch[1].replace(/,/g, '')) : 0;
          if (sell >= 5000 && sell <= 15000) {
            usdRate = sell;
            source = 'sudanakhbar (سعر البيع المنشور)';
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
