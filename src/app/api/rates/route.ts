import { NextResponse } from 'next/server';

const GRAMS_PER_OUNCE = 31.1034768;

export async function GET() {
  let ounceUsd = 4144.70;
  let usdRate = 8400.00;
  let source = 'sudanakhbar + yahoo/coinbase';

  // 1. Fetch live global gold price from Yahoo Finance
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
  } catch (_) {}

  // 1b. Fallback live gold from gold-api.com if Yahoo failed
  if (source === 'sudanakhbar + yahoo/coinbase') {
    try {
      const goldApiRes = await fetch('https://api.gold-api.com/price/XAU', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 60 },
      });
      if (goldApiRes.ok) {
        const goldData = await goldApiRes.json();
        const price = Number(goldData?.price);
        if (price > 1000) {
          ounceUsd = price;
          source = 'Gold-API (XAU)';
        }
      }
    } catch (_) {}
  }

  // 1c. Fallback live gold from Coinbase PAXG if needed
  if (source === 'sudanakhbar + yahoo/coinbase') {
    try {
      const cbRes = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 60 },
      });
      if (cbRes.ok) {
        const cbData = await cbRes.json();
        const price = Number(cbData?.data?.amount);
        if (price > 1000) {
          ounceUsd = price;
          source = 'Coinbase (PAXG/Gold)';
        }
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
      const article = html.match(/href="(https?:\/\/www\.sudanakhbar\.com\/\d+)"[^>]+title="[^"]*الدولار[^"]*"/i);
      if (article?.[1]) {
        const articleRes = await fetch(article[1], { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } });
        if (articleRes.ok) {
          const articleHtml = await articleRes.text();
          const sellMatch = articleHtml.match(/متوسط\s+سعر\s+بيع\s+الدولار[^\d]{0,100}([\d,]+)/i);
          const sell = sellMatch ? parseFloat(sellMatch[1].replace(/,/g, '')) : 0;
          if (sell >= 5000 && sell <= 15000) {
            usdRate = sell;
          }
        }
      }
    }
  } catch (_) {}

  // 3. Sudafax fallback for parallel rate
  if (usdRate === 8400.00) {
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

  const sarRate = Math.round((usdRate / 3.75) * 100) / 100;
  const aedRate = Math.round((usdRate / 3.6725) * 100) / 100;
  const egpRate = Math.round((usdRate / 48.5) * 100) / 100;

  return NextResponse.json({
    ounceUsd: parseFloat(ounceUsd.toFixed(2)),
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
