'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Globe,
  Landmark,
  Store,
  MapPin,
  AlertTriangle,

  Clock,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  Info,
  BadgeCheck,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtNum, kCurrency } from '../../core/format';
import { priceForKarat } from '../../core/purity';
import { StickyActionBar } from '../layout/StickyActionBar';

const ageLabel = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return 'غير معروف';
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.round(hours / 24)} يوم`;
};

const timeLabel = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const sourceAgeMinutes = (at: string): number => {
  const t = new Date(at).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
};

const agreementLabel: Record<string, string> = {
  high: 'اتفاق عالٍ',
  medium: 'اتفاق متوسط',
  low: 'اتفاق ضعيف',
  none: 'لا اتفاق',
};

const agreementTone: Record<string, string> = {
  high: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  none: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

export const GoldPriceScreen: React.FC = () => {
  const {
    rates,
    engine,
    refreshEngine,
    engineBusy,
    engineError,
    approvedPrice,
    approvePrice,
    approvalNeedsConfirmation,
    localAdjustPercent,
    setLocalAdjust,
  } = useGoldStore();

  const [status, setStatus] = useState('');
  const [showOverrides, setShowOverrides] = useState(false);
  const [usdBuyInput, setUsdBuyInput] = useState('');
  const [usdSellInput, setUsdSellInput] = useState('');
  const [ounceInput, setOunceInput] = useState('');
  const [adjustInput, setAdjustInput] = useState(String(localAdjustPercent ?? 0));

  useEffect(() => {
    setAdjustInput(String(localAdjustPercent ?? 0));
  }, [localAdjustPercent]);

  useEffect(() => {
    if (engine) return;
    refreshEngine();
    // الجلب الأول عند فتح الشاشة فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(''), 3500);
  };

  const handleRefresh = async () => {
    const ok = await refreshEngine();
    flash(ok ? 'تم جلب المصادر ومراجعتها ✅' : 'تعذر جلب بعض المصادر — راجع التفاصيل');
  };

  const handleRefreshWithOverrides = async () => {
    const usdBuy = parseFloat(usdBuyInput) || undefined;
    const usdSell = parseFloat(usdSellInput) || undefined;
    const ounce = parseFloat(ounceInput) || undefined;
    const ok = await refreshEngine({ usdBuy, usdSell, ounce });
    flash(ok ? 'تم الحساب بقيمك مع بقية المصادر ✅' : 'تعذر الحساب — تحقق من القيم');
  };

  const applyAdjust = () => {
    const value = parseFloat(adjustInput);
    if (isNaN(value) || value < -20 || value > 50) {
      flash('تعديل السوق المحلي يجب أن يكون بين -20% و +50%');
      return;
    }
    setLocalAdjust(value);
    refreshEngine().then((ok) => flash(ok ? `تم تطبيق تعديل السوق: ${value > 0 ? '+' : ''}${value}%` : 'تم الحفظ — تعذر الجلب الآن'));
  };

  const computation = engine?.computation || null;
  const suggestion = computation?.ok ? { buy: computation.buy, sell: computation.sell } : null;
  const effective = approvedPrice || (rates.karat21 > 0 ? { buy: rates.karat21, sell: rates.karat21, at: rates.lastUpdated, source: 'auto' as const } : null);

  const parallel = engine?.aggregates?.parallel;
  const official = engine?.aggregates?.official;
  const spot = engine?.aggregates?.spot;

  const karatRows = useMemo(() => {
    if (!effective) return [];
    return [21, 24, 22, 18].map((k) => ({
      karat: k,
      buy: Math.round(priceForKarat(effective.buy, k)),
      sell: Math.round(priceForKarat(effective.sell, k)),
      official: k === 21,
    }));
  }, [effective?.buy, effective?.sell]);

  const warnings = engine?.warnings || [];
  const criticalWarnings = warnings.filter((w) => w.includes('⚠️'));

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ===================== السعر المعتمد ===================== */}
      <div className="bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 p-5 rounded-3xl border-2 border-emerald-500/40 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-extrabold text-sm text-white">السعر المعتمد حاليًا</span>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full font-bold border border-slate-700 bg-slate-900 text-slate-300">
            {approvedPrice?.source === 'manual' ? 'اعتماد يدوي' : 'اعتماد تلقائي'}
          </span>
        </div>

        {effective ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/90 p-4 rounded-2xl border border-rose-500/30">
                <span className="text-[11px] text-rose-300 font-bold block mb-1">شراء الجرام عيار 21</span>
                <div className="text-2xl font-black font-mono text-rose-300">
                  {fmtNum(effective.buy)}
                </div>
                <span className="text-[10px] text-slate-500">{kCurrency} — نشتري به من الزبون</span>
              </div>
              <div className="bg-slate-950/90 p-4 rounded-2xl border border-emerald-500/30">
                <span className="text-[11px] text-emerald-300 font-bold block mb-1">بيع الجرام عيار 21</span>
                <div className="text-2xl font-black font-mono text-emerald-300">
                  {fmtNum(effective.sell)}
                </div>
                <span className="text-[10px] text-slate-500">{kCurrency} — نبيع به للزبون</span>
              </div>
            </div>

            <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">أساس الحساب</span>
                <span className="text-slate-200 font-mono">
                  أونصة ${engine?.inputs?.ounceUsd ? Number(engine.inputs.ounceUsd).toFixed(0) : '—'} × دولار موازي{' '}
                  {engine?.inputs ? `${fmtNum(engine.inputs.usdBuy)}/${fmtNum(engine.inputs.usdSell)}` : '—'} × 21/24
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">تعديل السوق المحلي</span>
                <span className={localAdjustPercent === 0 ? 'text-slate-300' : localAdjustPercent > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {localAdjustPercent > 0 ? '+' : ''}
                  {localAdjustPercent}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">وقت الاعتماد</span>
                <span className="text-slate-300">{timeLabel(approvedPrice?.at || effective.at)}</span>
              </div>
              {approvedPrice?.note && (
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">{approvedPrice.note}</div>
              )}
            </div>

            {suggestion && (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-950/70 rounded-2xl p-3 border border-slate-800 text-[11px]">
                  <span className="text-slate-400 block mb-0.5">المقترح من المحرك الآن</span>
                  <span className="font-mono text-slate-100">
                    شراء {fmtNum(suggestion.buy)} — بيع {fmtNum(suggestion.sell)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    approvePrice(suggestion, 'manual', 'اعتماد يدوي من شاشة محرك الأسعار');
                    flash('تم اعتماد السعر — العمليات الجديدة ستستخدمه ✅');
                  }}
                  className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-colors"
                >
                  اعتماد السعر
                </button>
              </div>
            )}

            {approvalNeedsConfirmation && (
              <div className="bg-amber-500/10 border border-amber-500/50 rounded-2xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200 leading-relaxed">
                  تغيّر كبير في السعر عن المعتمد — لم يُطبَّق تلقائيًا. راجع المصادر ثم اضغط «اعتماد السعر».
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-300">لا يوجد سعر معتمد بعد.</p>
            <p className="text-[11px] text-slate-500">اضغط «جلب المصادر» ليحسب المحرك سعرًا مقترحًا ثم اعتمده.</p>
          </div>
        )}
      </div>

      {/* ===================== حالة المحرك ===================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${engine?.ok ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div>
              <h3 className="font-extrabold text-sm text-white">محرك التحقق من المصادر</h3>
              <p className="text-[10px] text-slate-400">
                {engine?.ok ? 'الأسعار مرّت من التحقق' : engine ? 'الأسعار تحتاج مراجعة' : 'لم يتم الجلب بعد'} —{' '}
                {engine?.fetchedAt ? timeLabel(engine.fetchedAt) : '—'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={engineBusy}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black text-xs rounded-xl shadow-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${engineBusy ? 'animate-spin' : ''}`} />
            جلب المصادر
          </button>
        </div>

        {engineError && (
          <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/40 rounded-xl p-2.5">{engineError}</p>
        )}
        {status && (
          <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-xl p-2.5">{status}</p>
        )}

        {engine?.errors && engine.errors.length > 0 && (
          <details className="text-[10px] text-slate-500">
            <summary className="cursor-pointer font-bold text-slate-400">مصادر متعذرة ({engine.errors.length})</summary>
            <ul className="mt-1.5 space-y-0.5 list-disc pr-4">
              {engine.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        )}

        {criticalWarnings.length > 0 && (
          <div className="space-y-2">
            {criticalWarnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/50 rounded-xl p-2.5 leading-relaxed">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ===================== المستويات الأربعة ===================== */}

      {/* 🟢 الذهب العالمي */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            🟢 الذهب العالمي (الأونصة)
          </span>
          {spot && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${agreementTone[spot.agreement]}`}>
              {agreementLabel[spot.agreement]}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">الأونصة بالدولار</span>
            <div className="text-lg font-black font-mono text-emerald-400">
              ${spot?.sell ? Number(spot.sell).toFixed(2) : '—'}
            </div>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">الجرام الخالص</span>
            <div className="text-lg font-black font-mono text-cyan-400">
              ${spot?.sell ? (Number(spot.sell) / 31.1034768).toFixed(2) : '—'}
            </div>
          </div>
        </div>
        <SourceList
          readings={engine?.spot?.readings || []}
          renderValue={(r) => (r.price ? `$${Number(r.price).toFixed(2)}` : '—')}
        />
      </div>

      {/* 🔵 الدولار الرسمي */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-2">
            <Landmark className="w-4 h-4 text-sky-400" />
            🔵 الدولار الرسمي (البنوك)
          </span>
          <span className="text-[10px] text-slate-500">للمعلومية — لا يقود تسعيرنا</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">شراء البنك</span>
            <div className="text-lg font-black font-mono text-sky-300">
              {official?.buy ? fmtNum(official.buy) : '—'}
            </div>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">بيع البنك</span>
            <div className="text-lg font-black font-mono text-sky-300">
              {official?.sell ? fmtNum(official.sell) : '—'}
            </div>
          </div>
        </div>
        {official && official.used.length > 0 && (
          <p className="text-[10px] text-slate-500">
            المصدر: {official.used.map((r) => r.source).join(' + ')} — {ageLabel(official.freshestAgeMinutes)}
          </p>
        )}
        {(!official || official.used.length === 0) && (
          <p className="text-[10px] text-slate-500">لم يُنشر السعر الرسمي الآن — يظهر عند توفره.</p>
        )}
      </div>

      {/* 🟠 السوق الموازي */}
      <div className="bg-slate-900 border-2 border-orange-500/40 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-400" />
            🟠 السوق الموازي (يقود بيعنا وشراءنا)
          </span>
          {parallel && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${agreementTone[parallel.agreement]}`}>
              {agreementLabel[parallel.agreement]}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-orange-500/30">
            <span className="text-[11px] text-orange-300 font-bold block mb-1">شراء الدولار</span>
            <div className="text-lg font-black font-mono text-orange-300">
              {parallel?.buy ? fmtNum(parallel.buy) : '—'}
            </div>
            <span className="text-[10px] text-slate-500">{kCurrency}</span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-orange-500/30">
            <span className="text-[11px] text-orange-300 font-bold block mb-1">بيع الدولار</span>
            <div className="text-lg font-black font-mono text-orange-300">
              {parallel?.sell ? fmtNum(parallel.sell) : '—'}
            </div>
            <span className="text-[10px] text-slate-500">{kCurrency}</span>
          </div>
        </div>

        {parallel && (
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>
              ثقة المحرك: <span className="font-mono text-slate-200">{Math.round((parallel.confidence || 0) * 100)}%</span>
            </span>
            <span>•</span>
            <span>
              عدد المصادر: <span className="font-mono text-slate-200">{parallel.used.length}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {ageLabel(parallel.freshestAgeMinutes)}
            </span>
          </div>
        )}

        {/* القراءات لكل مصدر */}
        <SourceList
          readings={engine?.parallel?.readings || []}
          renderValue={(r) =>
            r.buy && r.sell
              ? `شراء ${fmtNum(r.buy)} / بيع ${fmtNum(r.sell)}`
              : r.price
              ? fmtNum(r.price)
              : '—'
          }
        />

        {/* قراءات مستبعدة */}
        {parallel && parallel.rejected.length > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 space-y-1">
            <span className="text-[11px] font-bold text-rose-300 block">قراءات استبعدها المحرك:</span>
            {parallel.rejected.map((r, i) => (
              <p key={i} className="text-[10px] text-rose-200/90">
                {r.reading.source}: {r.reason}
              </p>
            ))}
          </div>
        )}

        {/* تجاوز يدوي */}
        <button
          onClick={() => setShowOverrides((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-2xl text-[11px] font-bold text-slate-300 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {showOverrides ? 'إخفاء الإدخال اليدوي' : 'تجاوز مصدر بقيمة من عندي'}
        </button>

        {showOverrides && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              القيم المدخلة تُقدَّم على قراءات المصادر، وتبقى بقية المصادر تُحسب وتُحذَّر عند الاختلاف.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={usdBuyInput}
                onChange={(e) => setUsdBuyInput(e.target.value)}
                placeholder="شراء الدولار"
                className="bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                value={usdSellInput}
                onChange={(e) => setUsdSellInput(e.target.value)}
                placeholder="بيع الدولار"
                className="bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                value={ounceInput}
                onChange={(e) => setOunceInput(e.target.value)}
                placeholder="الأونصة $"
                className="bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none"
              />
            </div>
            <button
              onClick={handleRefreshWithOverrides}
              disabled={engineBusy}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black text-xs rounded-xl transition-colors"
            >
              احسب بهذه القيم
            </button>
          </div>
        )}
      </div>

      {/* 🟣 السوق المحلي */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-purple-400" />
            🟣 السوق المحلي (الخرطوم وغيرها)
          </span>
          <span className="text-[10px] text-slate-500">تعديل ±% على السعر النظري</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={adjustInput}
            onChange={(e) => setAdjustInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-purple-400 rounded-xl p-3 text-white font-mono text-sm focus:outline-none"
            placeholder="تعديل % (مثال: 1.5 أو -1)"
          />
          <button
            onClick={applyAdjust}
            className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-black text-xs rounded-xl transition-colors"
          >
            تطبيق
          </button>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          يغطي فرق العرض والطلب والمصنعية المحلية وسعر التاجر (خام/مشغول). يتراوح منطقيًا بين -20% و +50%.
        </p>

        {engine?.publishedLocalGold ? (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              سعر محلي منشور من مصدر سوداني: <span className="font-mono text-slate-200">{fmtNum(engine.publishedLocalGold)}</span> — نستخدمه للتحقق
              المتقاطع فقط ولا يُعتمد مباشرة.
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500">لا يوجد سعر محلي منشور الآن للمقارنة — يعتمد المحرك على قراءات الدولار والأونصة.</p>
        )}
      </div>

      {/* ===================== جدول العيارات ===================== */}
      {effective && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black text-white">العيارات من السعر المعتمد</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400">
                  <th className="py-2 font-bold">العيار</th>
                  <th className="py-2 font-bold">شراء</th>
                  <th className="py-2 font-bold">بيع</th>
                </tr>
              </thead>
              <tbody>
                {karatRows.map((row) => (
                  <tr key={row.karat} className="border-t border-slate-800">
                    <td className="py-2.5">
                      <span className={`font-black ${row.official ? 'text-amber-300' : 'text-slate-200'}`}>
                        عيار {row.karat}
                      </span>
                      {row.official && <span className="block text-[9px] text-amber-400/80">العيار الرسمي</span>}
                    </td>
                    <td className="py-2.5 font-mono text-rose-300">{fmtNum(row.buy)}</td>
                    <td className="py-2.5 font-mono text-emerald-300">{fmtNum(row.sell)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            تعديل أي عيار يدويًا يستخدم نفس نسبة عيار 21 — والوحدة الأساسية: 1 جرام = 10 حبات = 100 جزء.
          </p>
        </div>
      )}

      {/* شريط ثابت */}
      <StickyActionBar
        stats={[
          { label: 'شراء 21', value: effective ? fmtNum(effective.buy) : '—', tone: 'rose' },
          { label: 'بيع 21', value: effective ? fmtNum(effective.sell) : '—', tone: 'emerald' },
          { label: 'دولار موازي', value: parallel?.sell ? fmtNum(parallel.sell) : '—', tone: 'amber' },
          { label: 'الأونصة', value: spot?.sell ? Number(spot.sell).toFixed(0) : '—', tone: 'cyan' },
        ]}
        columns={4}
        hint={
          engine?.ok
            ? `آخر تحقق: ${timeLabel(engine.fetchedAt)} — ${parallel?.used.length || 0} مصادر`
            : 'اضغط «جلب المصادر» لتحديث الأسعار والتحقق منها'
        }
        actions={[{ label: 'جلب المصادر', onClick: handleRefresh, icon: RefreshCw, tone: 'amber', disabled: engineBusy }]}
      />
    </div>
  );
};

/* ------------------------- قائمة قراءات المصادر ------------------------- */

interface SourceRow {
  source: string;
  buy?: number | null;
  sell?: number | null;
  price?: number | null;
  at: string;
  label?: string;
  url?: string;
}

const SourceList: React.FC<{ readings: SourceRow[]; renderValue: (r: SourceRow) => string }> = ({
  readings,
  renderValue,
}) => {
  if (!readings || readings.length === 0) {
    return <p className="text-[10px] text-slate-500">لا توجد قراءات من هذا المستوى الآن.</p>;
  }
  return (
    <div className="space-y-2">
      {readings.map((r, i) => (
        <div key={`${r.source}-${i}`} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-200 block truncate">{r.source}</span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {ageLabel(sourceAgeMinutes(r.at))}
              {r.label ? ` — ${r.label.slice(0, 40)}` : ''}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-100 whitespace-nowrap">{renderValue(r)}</span>
        </div>
      ))}
    </div>
  );
};

export default GoldPriceScreen;
