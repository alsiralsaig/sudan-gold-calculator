import React, { useState } from 'react';
import { Coins, RefreshCw, DollarSign, TrendingUp, Edit3, Check, Globe } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum, kCurrency } from '../../core/format';

export const GoldPriceScreen: React.FC = () => {
  const { rates, updateRates } = useGoldStore();

  const [isEditing, setIsEditing] = useState(false);
  const [karat24, setKarat24] = useState(rates.karat24.toString());
  const [karat21, setKarat21] = useState(rates.karat21.toString());
  const [karat18, setKarat18] = useState(rates.karat18.toString());
  const [karat22, setKarat22] = useState(rates.karat22.toString());
  const [usdRate, setUsdRate] = useState(rates.usdRate.toString());
  const [sarRate, setSarRate] = useState(rates.sarRate.toString());
  const [aedRate, setAedRate] = useState(rates.aedRate.toString());
  const [egpRate, setEgpRate] = useState(rates.egpRate.toString());

  const handleSavePrices = () => {
    updateRates({
      karat24: parseFloat(karat24) || rates.karat24,
      karat21: parseFloat(karat21) || rates.karat21,
      karat18: parseFloat(karat18) || rates.karat18,
      karat22: parseFloat(karat22) || rates.karat22,
      usdRate: parseFloat(usdRate) || rates.usdRate,
      sarRate: parseFloat(sarRate) || rates.sarRate,
      aedRate: parseFloat(aedRate) || rates.aedRate,
      egpRate: parseFloat(egpRate) || rates.egpRate,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Header & Controls */}
      <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-5 rounded-3xl border-2 border-amber-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">أسعار الذهب والعملات (السوق الموازي)</h3>
              <p className="text-xs text-slate-400">أسعار الصرف الرسمية واليومية في السودان</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isEditing) {
                handleSavePrices();
              } else {
                setKarat24(rates.karat24.toString());
                setKarat21(rates.karat21.toString());
                setKarat18(rates.karat18.toString());
                setKarat22(rates.karat22.toString());
                setUsdRate(rates.usdRate.toString());
                setSarRate(rates.sarRate.toString());
                setAedRate(rates.aedRate.toString());
                setEgpRate(rates.egpRate.toString());
                setIsEditing(true);
              }
            }}
            className={`px-4 py-2 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all ${
              isEditing
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
            }`}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{isEditing ? 'حفظ الأسعار' : 'تعديل يدوي'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
          <span>آخر تحديث للأسعار:</span>
          <span className="font-mono text-amber-300">
            {new Date(rates.lastUpdated).toLocaleString('ar-SD', {
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      </div>

      {/* Gold Karat Prices */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider px-1">
          أسعار جرام الذهب بالسودان (ج.س)
        </h4>

        <div className="grid grid-cols-2 gap-3">
          
          {/* Karat 24 */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-amber-300 block">عيار 24 (ذهب خالص 999)</span>
            {isEditing ? (
              <input
                type="number"
                value={karat24}
                onChange={(e) => setKarat24(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.karat24)}</div>
            )}
          </div>

          {/* Karat 21 */}
          <div className="bg-slate-900 border-2 border-amber-500/50 p-4 rounded-2xl space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 block">عيار 21 (الأكثر تداولاً)</span>
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded">سوقي</span>
            </div>
            {isEditing ? (
              <input
                type="number"
                value={karat21}
                onChange={(e) => setKarat21(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-amber-400 font-mono">{fmtMoney(rates.karat21)}</div>
            )}
          </div>

          {/* Karat 22 */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-slate-300 block">عيار 22</span>
            {isEditing ? (
              <input
                type="number"
                value={karat22}
                onChange={(e) => setKarat22(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.karat22)}</div>
            )}
          </div>

          {/* Karat 18 */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-slate-300 block">عيار 18</span>
            {isEditing ? (
              <input
                type="number"
                value={karat18}
                onChange={(e) => setKarat18(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.karat18)}</div>
            )}
          </div>

        </div>
      </div>

      {/* Foreign Exchange Parallel Market Rates */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider px-1">
          أسعار صرف العملات مقابل الجنيه السوداني (السوق الموازي)
        </h4>

        <div className="grid grid-cols-2 gap-3">
          
          {/* USD */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-emerald-400 block">الدولار الأمريكي (USD)</span>
            {isEditing ? (
              <input
                type="number"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.usdRate)}</div>
            )}
          </div>

          {/* SAR */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-amber-300 block">الريال السعودي (SAR)</span>
            {isEditing ? (
              <input
                type="number"
                value={sarRate}
                onChange={(e) => setSarRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.sarRate)}</div>
            )}
          </div>

          {/* AED */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-cyan-300 block">الدرهم الإماراتي (AED)</span>
            {isEditing ? (
              <input
                type="number"
                value={aedRate}
                onChange={(e) => setAedRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.aedRate)}</div>
            )}
          </div>

          {/* EGP */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-rose-300 block">الجنيه المصري (EGP)</span>
            {isEditing ? (
              <input
                type="number"
                value={egpRate}
                onChange={(e) => setEgpRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-sm"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.egpRate)}</div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
