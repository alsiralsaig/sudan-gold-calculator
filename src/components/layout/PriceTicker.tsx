'use client';

import React, { useEffect, useState } from 'react';
import { fmtNum } from '../../core/format';
import type { GoldRates } from '../../types';

interface TickerData {
  ok: boolean;
  fetchedAt: string;
  ounceUsd: number | null;
  gram24Usd: number | null;
  gram21Usd: number | null;
  parallel: { buy: number | null; sell: number; source: string; ageMinutes: number | null } | null;
  bank: { name: string; buy: number | null; sell: number } | null;
  gram21Parallel: number | null;
  gram24Parallel: number | null;
}

const usd = (v: number | null | undefined) =>
  v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const sdg = (v: number | null | undefined) => (v ? fmtNum(Math.round(v)) : '—');
const rate = (v: number | null | undefined) =>
  v ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

/**
 * شريط أسعار متحرك (زي شريط الأخبار): الجرام بالموازي أولاً (الأهم)، ثم الأونصة والجرام بالدولار،
 * الدولار في السوق الموازي، وبنك الخرطوم. بيتوقف لما تلمسه عشان تقرأ.
 */
export function PriceTicker({ rates }: { rates: GoldRates }) {
  const [d, setD] = useState<TickerData | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/rates/ticker', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j) setD(j); })
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // قبل ما توصل البيانات: نعرض من أسعار التطبيق
  const ounce = d?.ounceUsd ?? rates.globalOunceUsd;
  const g24 = d?.gram24Usd ?? (ounce ? ounce / 31.1034768 : null);
  const g21 = d?.gram21Usd ?? (g24 ? g24 * 0.875 : null);
  const parSell = d?.parallel?.sell ?? rates.usdRate;
  const parBuy = d?.parallel?.buy ?? rates.usdBuyRate ?? null;
  const g21Par = d?.gram21Parallel ?? (g21 && parSell ? g21 * parSell : null);
  const g24Par = d?.gram24Parallel ?? (g24 && parSell ? g24 * parSell : null);
  const stale = d ? !d.ok || (d.parallel?.ageMinutes ?? 0) > 12 * 60 : rates.isStale;

  const Sep = () => <span className="text-amber-500/50 px-3">◆</span>;
  const items = (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
        <span className="text-amber-300 font-bold">⭐ جرام 21 بالموازي:</span>
        <span className="text-amber-400 font-black">{sdg(g21Par)}</span>
        <span className="text-slate-400">ج.س</span>
      </span>
      <Sep />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-amber-300/90 font-bold">جرام 24 بالموازي:</span>
        <span className="text-amber-400 font-bold">{sdg(g24Par)}</span>
        <span className="text-slate-400">ج.س</span>
      </span>
      <Sep />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-slate-300 font-bold">🌍 الأونصة:</span>
        <span className="text-white font-bold" dir="ltr">{usd(ounce)}</span>
      </span>
      <Sep />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-slate-300 font-bold">الجرام:</span>
        <span className="text-slate-400">24</span>
        <span className="text-white font-bold" dir="ltr">{usd(g24)}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">21</span>
        <span className="text-white font-bold" dir="ltr">{usd(g21)}</span>
      </span>
      <Sep />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-emerald-300 font-bold">💵 الدولار الموازي:</span>
        <span className="text-slate-400">شراء</span>
        <span className="text-white font-bold">{rate(parBuy)}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">بيع</span>
        <span className="text-white font-bold">{rate(parSell)}</span>
      </span>
      <Sep />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-sky-300 font-bold">🏦 {d?.bank?.name || 'البنك'}:</span>
        <span className="text-slate-400">شراء</span>
        <span className="text-white font-bold">{rate(d?.bank?.buy ?? null)}</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">بيع</span>
        <span className="text-white font-bold">{rate(d?.bank?.sell ?? rates.bankUsdRate ?? null)}</span>
      </span>
      <Sep />
      <span className="inline-flex items-center gap-1.5">
        <span className="text-slate-400">🟡 عيار 21 (المعتمد في الحاسبة):</span>
        <span className="text-amber-300 font-bold">{sdg(rates.karat21)}</span>
        <span className="text-slate-400">ج.س</span>
      </span>
      <Sep />
    </>
  );

  return (
    <div
      className="max-w-4xl mx-auto mt-1.5 overflow-hidden rounded-xl bg-slate-950/70 border border-amber-500/20 select-none"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
      title="المس الشريط عشان يقيف"
    >
      <div
        className="price-ticker-track flex w-max whitespace-nowrap py-1.5 text-[11px] sm:text-xs font-mono"
        style={{ animationPlayState: paused ? 'paused' : 'running' }}
      >
        <div className="flex items-center px-2">{items}</div>
        <div className="flex items-center px-2" aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}
