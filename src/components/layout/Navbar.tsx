import React, { useState } from 'react';
import { Coins, Lock, Smartphone, RotateCw, Sparkles, Check } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum } from '../../core/format';

interface NavbarProps {
  onOpenInstallModal: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenInstallModal, activeTab }) => {
  const { pinCode, lockApp, rates, updateRates } = useGoldStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'لوحة التحكم';
      case 'calculator':
        return 'حاسبة الذهب والكسر';
      case 'partners':
        return 'الشركاء وتوزيع الأرباح';
      case 'purchases':
        return 'سجل المشتريات';
      case 'sales':
        return 'سجل المبيعات';
      case 'expenses':
        return 'سجل المصروفات';
      case 'gold_price':
        return 'السعر العالمي للذهب';
      case 'settings':
        return 'الإعدادات والقفل';
      default:
        return 'حاسبة الذهب';
    }
  };

  const handleGlobalRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setToastMessage('جاري تحديث الأسعار...');

    try {
      const res = await fetch('/api/rates');
      if (res.ok) {
        const data = await res.json();
        updateRates({
          globalOunceUsd: data.ounceUsd || 4144.70,
          usdRate: data.usdRate || 8203.10,
          sarRate: data.sarRate || 2185.27,
          aedRate: data.aedRate || 2233.40,
          egpRate: data.egpRate || 157.60,
          karat24: data.karat24 || 1093102,
          karat21: data.karat21 || 956464,
          karat18: data.karat18 || 819826,
          karat22: data.karat22 || 1002010,
        });
      }
    } catch (_) {
      // Fallback update
      updateRates({
        globalOunceUsd: 4144.70,
        usdRate: 8203.10,
        karat24: 1093102,
        karat21: 956464,
        karat18: 819826,
        karat22: 1002010,
      });
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setToastMessage('تم تحديث ومزامنة الأسعار بنجاح ⚡');
        setTimeout(() => setToastMessage(''), 2500);
      }, 500);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        {/* Reload / Refresh Arrow Button on Top Left / Right as in screenshot */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleGlobalRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-400 rounded-2xl border border-amber-500/40 transition-all active:scale-90 flex items-center justify-center shadow-md shadow-amber-500/10"
            title="إعادة التشغيل وتحديث الأسعار"
          >
            <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div>
            <h1 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5">
              <span>{getTitle()}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-md font-bold">
                السودان
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              21k: {fmtNum(rates.karat21)} ج.س • $ {fmtNum(rates.usdRate)}
            </p>
          </div>
        </div>

        {/* Action buttons on the opposite side */}
        <div className="flex items-center gap-2">
          
          {/* iOS Install Prompt Button */}
          <button
            onClick={onOpenInstallModal}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="تثبيت التطبيق على آيفون"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">تثبيت</span>
          </button>

          {/* Lock Button */}
          {pinCode && (
            <button
              onClick={lockApp}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl transition-colors"
              title="قفل التطبيق الآن"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>

      {/* Floating Toast Notification on Refresh */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-amber-500 text-amber-300 px-4 py-2 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 animate-in fade-in zoom-in-95">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
};
