import React from 'react';
import { Coins, Lock, Smartphone, RefreshCw, Sparkles } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum } from '../../core/format';

interface NavbarProps {
  onOpenInstallModal: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenInstallModal, activeTab }) => {
  const { pinCode, lockApp, rates } = useGoldStore();

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
        return 'أسعار الذهب والعملات';
      case 'settings':
        return 'الإعدادات والقفل';
      default:
        return 'حاسبة الذهب';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        {/* Brand & Page Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
          </div>
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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          
          {/* iOS Install Prompt Button */}
          <button
            onClick={onOpenInstallModal}
            className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="تثبيت التطبيق على آيفون"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">تثبيت للتطبيق</span>
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
    </header>
  );
};
