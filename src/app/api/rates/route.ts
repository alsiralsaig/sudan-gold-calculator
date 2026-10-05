import { NextResponse } from 'next/server';

const GRAMS_PER_OUNCE = 31.1034768;

export async function GET() {
  let ounceUsd = 4144.70;
  let usdRate = 8203.10;
  let sarRate = 2185.27;
  let aedRate = 2233.40;
  let egpRate = 157.60;
  let source = 'sudanakhbar + yahoo/coinbase';

  // 1. Fetch the global gold ounce price from Yahoo Finance (GC=F).
  try {
    const yahooRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1m', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    });
    if (yahooRes.ok) {
      const yahooData = await yahooRes.json();
      const price = Number(yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice);
      if (price > 1000) {
        ounceUsd = price;
        source = 'Yahoo Finance (GC=F)';
      }
    }
  } catch (_) {
    // Keep the last known value on the client if Yahoo is temporarily unavailable.
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

  // 3. SudanFax fallback for the published Sudanese dollar selling rate.
  // It is only used when Sudan Akhbar is unavailable or has no valid value.
  if (source === 'sudanakhbar + yahoo/coinbase' || source === 'Yahoo Finance (GC=F)') {
    try {
      const faxSearch = await fetch('https://sudafax.com/?s=%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A7%D8%B1', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      });
      if (faxSearch.ok) {
        const faxHtml = await faxSearch.text();
        const faxArticle = faxHtml.match(/href="(https?:\/\/sudafax\.com\/\d+\/[^"]+)"/i);
        if (faxArticle?.[1]) {
          const faxRes = await fetch(faxArticle[1], { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } });
          if (faxRes.ok) {
            const faxBody = await faxRes.text();
            const faxMatch = faxBody.match(/سعر\s+بيع\s+الدولار[^\d]{0,100}([\d,]+(?:\.\d+)?)/i);
            const faxRate = faxMatch ? parseFloat(faxMatch[1].replace(/,/g, '')) : 0;
            if (faxRate >= 5000 && faxRate <= 15000) {
              usdRate = faxRate;
              source = 'SudanFax (سعر البيع المنشور)';
            }
          }
        }
      }
    } catch (_) {}
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
