'use client';

import React, { useState } from 'react';
import {
  RefreshCw,
  Globe,
  Scale,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  Percent,
  Info,
  TrendingUp
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtNum, kCurrency } from '../../core/format';
import { KARAT_OPTIONS, priceForKarat } from '../../core/purity';

const pct = (n: number, base: number) => (base > 0 ? ((n - base) / base) * 100 : 0);

export const GoldPriceScreen: React.FC = () => {
  const {
    rates,
    ratesMeta,
    refreshRates,
    updateRates,
    setLocalPremium,
    setManualRateOverride,
  } = useGoldStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [premiumInput, setPremiumInput] = useState(String(rates.localPremiumPercent ?? 0));
  const [manualInput, setManualInput] = useState(String(rates.karat21));
  const [showManual, setShowManual] = useState(false);

  const base21 = rates.karat21Base || rates.karat21;
  const premium = rates.localPremiumPercent ?? 0;

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus('جاري جلب أسعار البورصة العالمية والسوق الموازي...');
    const ok = await refreshRates();
    setIsSyncing(false);
    setStatus(
      ok
        ? 'تم تحديث الأسعار من المصادر ✅'
        : 'تعذر التحديث الآن — يتم عرض آخر أسعار متوفرة'
    );
    setTimeout(() => setStatus(''), 3500);
  };

  const applyPremium = () => {
    const value = parseFloat(premiumInput);
    if (isNaN(value) || value < -20 || value > 50) {
      setStatus('تعديل السوق يجب أن يكون بين -20% و +50%');
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    setLocalPremium(value);
    setStatus(`تم تطبيق تعديل السوق المحلي: ${value > 0 ? '+' : ''}${value}%`);
    setTimeout(() => setStatus(''), 3000);
  };

  const applyManual = () => {
    const value = parseFloat(manualInput);
    if (isNaN(value) || value < 1000) {
      setStatus('أدخل سعراً صحيحاً لجرام عيار 21');
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    updateRates({
      karat21: value,
      karat24: Math.round(priceForKarat(value, 24)),
      karat22: Math.round(priceForKarat(value, 22)),
      karat18: Math.round(priceForKarat(value, 18)),
      manualOverride: true,
    });
    setManualRateOverride(true);
    setShowManual(false);
    setStatus('تم تثبيت السعر يدوياً — لن يُستبدل بالتحديث التلقائي');
    setTimeout(() => setStatus(''), 3500);
  };

  const releaseManual = () => {
    setManualRateOverride(false);
    setStatus('تم إلغاء التثبيت اليدوي، سيتم التحديث التلقائي');
    refreshRates();
    setTimeout(() => setStatus(''), 3000);
  };

  const crossRates = [
    { label: 'الدولار الأمريكي', value: rates.usdRate, symbol: '$', hint: rates.usdBuyRate ? `شراء ${fmtNum(rates.usdBuyRate)}` : '' },
    { label: 'الريال السعودي', value: rates.sarRate, symbol: 'ر.س', hint: '' },
    { label: 'الدرهم الإماراتي', value: rates.aedRate, symbol: 'د.إ', hint: '' },
    { label: 'الجنيه المصري', value: rates.egpRate, symbol: 'ج.م', hint: '' },
  ];

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-200">
      {/* السعر العالمي */}
      <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-5 rounded-3xl border-2 border-amber-500/50 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            <span className="font-extrabold text-sm text-white">سعر الذهب العالمي (الأونصة)</span>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black text-xs rounded-xl shadow-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            تحديث الآن
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">الأونصة بالدولار</span>
            <div className="text-xl font-black font-mono text-amber-400">
              ${rates.globalOunceUsd ? rates.globalOunceUsd.toFixed(2) : '—'}
            </div>
          </div>
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">الجرام الخالص عالمياً</span>
            <div className="text-xl font-black font-mono text-cyan-400">
              $
              {rates.globalOunceUsd
                ? (rates.globalOunceUsd / 31.1034768).toFixed(2)
                : '—'}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-bold">سعر جرام عيار 21 بالسوق</span>
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">
              العيار الرسمي للتداول
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {fmtNum(rates.karat21)} <span className="text-sm font-sans text-slate-300">{kCurrency}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span>الأساس قبل تعديل السوق: {fmtNum(base21)}</span>
            {premium !== 0 && (
              <span className={premium > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                تعديل السوق: {premium > 0 ? '+' : ''}
                {premium}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* حالة المصادر */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white flex items-center gap-2">
            {rates.isStale ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            {rates.isStale ? 'الأسعار تحتاج تحديث' : 'الأسعار محدّثة'}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {ratesMeta.fetchedAt
              ? new Date(ratesMeta.fetchedAt).toLocaleString('ar-EG', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2 border border-slate-800">
            <span className="text-slate-400">مصدر الذهب العالمي</span>
            <span className="text-slate-200 font-bold">{rates.goldSource || '—'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2 border border-slate-800">
            <span className="text-slate-400">مصدر الدولار (السوق الموازي)</span>
            <span className="text-slate-200 font-bold">{rates.usdSource || '—'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2 border border-slate-800">
            <span className="text-slate-400">سعر شراء الدولار في السوق</span>
            <span className="text-slate-200 font-bold">
              {rates.usdBuyRate ? fmtNum(rates.usdBuyRate) : 'غير منشور'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2 border border-slate-800">
            <span className="text-slate-400">متوسط سعر البنوك</span>
            <span className="text-slate-200 font-bold">
              {rates.bankUsdRate ? fmtNum(rates.bankUsdRate) : 'غير منشور'}
            </span>
          </div>
        </div>

        {ratesMeta.warnings.length > 0 && (
          <ul className="space-y-1 pt-1">
            {ratesMeta.warnings.map((w, i) => (
              <li key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        )}

        {status && (
          <div className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            {status}
          </div>
        )}
      </div>

      {/* جدول العيارات — مشتق من عيار 21 */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-extrabold text-sm text-white">أسعار الجرام حسب العيار</h3>
            <p className="text-[11px] text-slate-400">مشتقة من سعر عيار 21 بنسبة النقاوة</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="text-right py-2.5 px-3 font-bold">العيار</th>
                <th className="text-right py-2.5 px-3 font-bold">النقاوة</th>
                <th className="text-right py-2.5 px-3 font-bold">سعر الجرام</th>
                <th className="text-right py-2.5 px-3 font-bold">قياس 21</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {KARAT_OPTIONS.map((karat) => {
                const price =
                  karat === 21
                    ? rates.karat21
                    : karat === 24
                    ? rates.karat24
                    : karat === 22
                    ? rates.karat22
                    : rates.karat18;
                return (
                  <tr
                    key={karat}
                    className={karat === 21 ? 'bg-amber-500/10' : 'bg-slate-900'}
                  >
                    <td className="py-2.5 px-3 font-black text-white">
                      عيار {karat}
                      {karat === 21 && (
                        <span className="mr-2 text-[9px] px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded font-black">
                          رسمي
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
                      {Math.round((karat / 24) * 1000)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-black text-emerald-400">
                      {fmtNum(price)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {karat === 21 ? '—' : `${(((karat / 24) * 1000) / 875).toFixed(3)}×`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-3">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            كل الحسابات في التطبيق (المخزون، المبيعات، الأرباح، التقارير) تُبنى على{' '}
            <span className="text-amber-400 font-bold">معادل عيار 21</span>. عند إدخال ذهب بعيار آخر
            يُحوَّل تلقائياً إلى معادل 21 حتى تكون المقارنة عادلة.
          </p>
        </div>
      </div>

      {/* تعديل السوق المحلي */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-extrabold text-sm text-white">تعديل سوقك المحلي</h3>
            <p className="text-[11px] text-slate-400">
              الأسعار المنشورة عامة، وسعر السوق في مدينتك قد يختلف — اضبط الفرق هنا
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.5"
            value={premiumInput}
            onChange={(e) => setPremiumInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-white font-mono text-sm text-right focus:outline-none"
            placeholder="مثال: 1.5 أو -2"
          />
          <button
            onClick={applyPremium}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl"
          >
            تطبيق
          </button>
          <button
            onClick={() => {
              setPremiumInput('0');
              setLocalPremium(0);
            }}
            className="px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
          >
            صفر
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[-2, -1, 1, 2, 3, 5].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPremiumInput(String(p));
                setLocalPremium(p);
              }}
              className="py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl"
            >
              {p > 0 ? '+' : ''}
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* تثبيت يدوي */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {rates.manualOverride ? (
              <Lock className="w-5 h-5 text-amber-400" />
            ) : (
              <Unlock className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <h3 className="font-extrabold text-sm text-white">تثبيت السعر يدوياً</h3>
              <p className="text-[11px] text-slate-400">
                {rates.manualOverride
                  ? 'السعر مثبّت ولن يتغير بالتحديث التلقائي'
                  : 'عند انقطاع الإنترنت أو عند اتفاق سعر معيّن'}
              </p>
            </div>
          </div>
          <button
            onClick={() => (rates.manualOverride ? releaseManual() : setShowManual((v) => !v))}
            className={`px-3 py-2 rounded-xl text-xs font-black ${
              rates.manualOverride
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            {rates.manualOverride ? 'إلغاء التثبيت' : showManual ? 'إغلاق' : 'تثبيت سعر'}
          </button>
        </div>

        {showManual && !rates.manualOverride && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-white font-mono text-sm focus:outline-none"
              placeholder="سعر جرام عيار 21"
            />
            <button
              onClick={applyManual}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl"
            >
              حفظ
            </button>
          </div>
        )}
      </div>

      {/* العملات */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="font-extrabold text-sm text-white">أسعار العملات في السودان</h3>
            <p className="text-[11px] text-slate-400">
              منشورة من {ratesMeta.crossSource || rates.usdSource || 'مصدر السوق'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {crossRates.map((c) => (
            <div key={c.label} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">{c.label}</span>
              <div className="text-base font-black font-mono text-white">
                {fmtNum(c.value)}
                <span className="text-[10px] text-slate-500 font-sans mr-1">{c.symbol}</span>
              </div>
              {c.hint && <div className="text-[10px] text-slate-500 mt-0.5">{c.hint}</div>}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          ملاحظة: سعر الريال/الدرهم/الجنيه المصري يُقرأ من الجدول المنشور. إذا لم يُنشر اليوم يُعرض
          آخر سعر متوفر مع تنبيه أعلاه.
        </p>
      </div>
    </div>
  );
};
