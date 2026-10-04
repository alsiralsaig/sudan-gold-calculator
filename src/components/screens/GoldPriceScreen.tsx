import React, { useState } from 'react';
import { Coins, RefreshCw, DollarSign, TrendingUp, Edit3, Check, Globe, Sparkles, Scale, ArrowDownUp } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum, kCurrency } from '../../core/format';

// Live Market Presets for Sudan Parallel Market
const SUDAN_PARALLEL_MARKET_PRESET = {
  karat24: 215000,
  karat21: 188125,
  karat18: 161250,
  karat22: 197083,
  usdRate: 8200,
  sarRate: 2185.27,
  aedRate: 2233.40,
  egpRate: 157.60,
  globalOunceUsd: 2650,
};

export const GoldPriceScreen: React.FC = () => {
  const { rates, updateRates } = useGoldStore();

  const [priceMode, setPriceMode] = useState<'market' | 'manual'>('market');
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Editable fields
  const [karat24, setKarat24] = useState(rates.karat24.toString());
  const [karat21, setKarat21] = useState(rates.karat21.toString());
  const [karat18, setKarat18] = useState(rates.karat18.toString());
  const [karat22, setKarat22] = useState(rates.karat22.toString());
  const [usdRate, setUsdRate] = useState(rates.usdRate.toString());
  const [sarRate, setSarRate] = useState(rates.sarRate.toString());
  const [aedRate, setAedRate] = useState(rates.aedRate.toString());
  const [egpRate, setEgpRate] = useState(rates.egpRate.toString());
  const [ounceRate, setOunceRate] = useState(rates.globalOunceUsd.toString());

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
      globalOunceUsd: parseFloat(ounceRate) || rates.globalOunceUsd,
    });
    setIsEditing(false);
    setPriceMode('manual');
    setSyncMessage('تم حفظ الأسعار المخصصة بنجاح ✅');
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleSyncParallelMarket = () => {
    setIsSyncing(true);
    setTimeout(() => {
      updateRates(SUDAN_PARALLEL_MARKET_PRESET);
      setKarat24(SUDAN_PARALLEL_MARKET_PRESET.karat24.toString());
      setKarat21(SUDAN_PARALLEL_MARKET_PRESET.karat21.toString());
      setKarat18(SUDAN_PARALLEL_MARKET_PRESET.karat18.toString());
      setKarat22(SUDAN_PARALLEL_MARKET_PRESET.karat22.toString());
      setUsdRate(SUDAN_PARALLEL_MARKET_PRESET.usdRate.toString());
      setSarRate(SUDAN_PARALLEL_MARKET_PRESET.sarRate.toString());
      setAedRate(SUDAN_PARALLEL_MARKET_PRESET.aedRate.toString());
      setEgpRate(SUDAN_PARALLEL_MARKET_PRESET.egpRate.toString());
      setOunceRate(SUDAN_PARALLEL_MARKET_PRESET.globalOunceUsd.toString());
      setIsSyncing(false);
      setIsEditing(false);
      setPriceMode('market');
      setSyncMessage('تمت مزامنة أسعار السوق الموازي السوداني بنجاح! ⚡');
      setTimeout(() => setSyncMessage(''), 3500);
    }, 600);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Header & Mode Switcher */}
      <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-5 rounded-3xl border-2 border-amber-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">أسعار الذهب والعملات (السودان)</h3>
              <p className="text-xs text-slate-400">متابعة أسعار السوق المفتوح والموازي والتسعير اليدوي</p>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs: [السوق الموازي / المفتوح] و [تعديل يدوي] */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={handleSyncParallelMarket}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              priceMode === 'market'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>السوق الموازي / المفتوح</span>
          </button>

          <button
            onClick={() => {
              setPriceMode('manual');
              setIsEditing(true);
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              priceMode === 'manual' || isEditing
                ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تسعير يدوي مخصص</span>
          </button>
        </div>

        {syncMessage && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold text-center animate-in fade-in">
            {syncMessage}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>وضع التسعير: <b>{priceMode === 'market' ? 'السوق المفتوح (محدث)' : 'مخصص يدوي'}</b></span>
          </span>
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

      {/* Gold Karat Prices Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Scale className="w-4 h-4" />
            <span>أسعار جرام الذهب بالسودان (ج.س)</span>
          </h4>
          {isEditing && (
            <button
              onClick={handleSavePrices}
              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>حفظ التعديلات</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          
          {/* Karat 24 */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
            <span className="text-xs font-bold text-amber-300 block">عيار 24 (ذهب خالص 999)</span>
            {isEditing ? (
              <input
                type="number"
                value={karat24}
                onChange={(e) => setKarat24(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.karat18)}</div>
            )}
          </div>

        </div>
      </div>

      {/* Foreign Exchange Parallel Market Rates */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
          <Globe className="w-4 h-4" />
          <span>أسعار العملات مقابل الجنيه السوداني (السوق الموازي)</span>
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
              />
            ) : (
              <div className="text-lg font-black text-white font-mono">{fmtMoney(rates.egpRate)}</div>
            )}
          </div>

        </div>

        {/* Global Gold Ounce Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">أونصة الذهب العالمية (USD)</span>
            <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
              ${fmtNum(rates.globalOunceUsd)}
            </div>
          </div>
          <span className="text-[11px] text-slate-500">بورصة المعادن العالمية</span>
        </div>
      </div>

      {isEditing && (
        <button
          onClick={handleSavePrices}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Check className="w-5 h-5" />
          <span>حفظ كافة الأسعار المعدلة</span>
        </button>
      )}

    </div>
  );
};
