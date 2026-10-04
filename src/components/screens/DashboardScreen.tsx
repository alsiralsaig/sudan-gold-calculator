import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  DollarSign,
  Wallet,
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum, unitsToWeight, unitsToGramsDecimal, kCurrency } from '../../core/format';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const {
    totalCapital,
    totalSales,
    totalCost,
    grossProfit,
    generalExpenses,
    privateExpenses,
    netProfit,
    currentStockUnits,
    purchases,
    sales,
    rates,
    partners,
  } = useGoldStore();

  const totalDebtToSellers = purchases.reduce((sum, p) => sum + (p.pendingAmount || 0), 0);
  const currentStockGrams = unitsToGramsDecimal(currentStockUnits);
  const estimatedStockValue = currentStockGrams * rates.karat21;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Hero Financial Overview Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-6 rounded-3xl border-2 border-amber-500/40 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              المركز المالي الشامل
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {fmtMoney(totalCapital)}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">إجمالي رأس مال الشركاء المودع</p>
          </div>
          <div className="text-left bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">صافي الأرباح</span>
            <span className={`text-base sm:text-lg font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtMoney(netProfit)}
            </span>
          </div>
        </div>

        {/* 4 Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          
          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>إجمالي المبيعات</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-black font-mono text-white truncate">
              {fmtNum(totalSales)}
            </div>
          </div>

          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>تكلفة المشتريات</span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-black font-mono text-white truncate">
              {fmtNum(totalCost)}
            </div>
          </div>

          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>المنصرفات العامة</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-sm font-black font-mono text-rose-400 truncate">
              {fmtNum(generalExpenses)}
            </div>
          </div>

          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>متبقي المديونية</span>
              <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-sm font-black font-mono text-cyan-400 truncate">
              {fmtNum(totalDebtToSellers)}
            </div>
          </div>

        </div>
      </div>

      {/* Gold Stock & Inventory Balance */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">رصيد المخزون الحالي من الذهب</h3>
              <p className="text-xs text-slate-400">الوزن المتبقي في الخزينة بعد حركات البيع والشراء</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('calculator')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            الحاسبة
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div>
            <span className="text-xs text-slate-400 block font-bold mb-1">الوزن بالجرام والنظام السوداني:</span>
            <div className="text-xl font-black text-amber-400 font-mono">
              {currentStockGrams.toFixed(2)} جرام
            </div>
            <div className="text-xs text-slate-300 font-semibold mt-0.5">
              ({unitsToWeight(currentStockUnits)})
            </div>
          </div>

          <div className="border-t sm:border-t-0 sm:border-r border-slate-800 pt-3 sm:pt-0 sm:pr-4">
            <span className="text-xs text-slate-400 block font-bold mb-1">القيمة التقديرية (عيار 21):</span>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {fmtMoney(estimatedStockValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              بسعر {fmtNum(rates.karat21)} {kCurrency}/جرام
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('partners')}
          className="bg-slate-900 hover:bg-slate-800/90 p-4 rounded-3xl border border-slate-800 hover:border-amber-500/50 text-right space-y-2 transition-all group"
        >
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl w-fit group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white">الشركاء والأرباح</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{partners.length} شركاء مسجلين</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('purchases')}
          className="bg-slate-900 hover:bg-slate-800/90 p-4 rounded-3xl border border-slate-800 hover:border-amber-500/50 text-right space-y-2 transition-all group"
        >
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl w-fit group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white">المشتريات والديون</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{purchases.length} عمليات شراء</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('sales')}
          className="bg-slate-900 hover:bg-slate-800/90 p-4 rounded-3xl border border-slate-800 hover:border-amber-500/50 text-right space-y-2 transition-all group"
        >
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit group-hover:scale-110 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white">المبيعات والأرباح</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{sales.length} عمليات بيع</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('gold_price')}
          className="bg-slate-900 hover:bg-slate-800/90 p-4 rounded-3xl border border-slate-800 hover:border-amber-500/50 text-right space-y-2 transition-all group"
        >
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl w-fit group-hover:scale-110 transition-transform">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white">أسعار الذهب والعملات</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">السوق الموازي والدولار</p>
          </div>
        </button>
      </div>

      {/* Live Market Price Widget */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            سعر جرام الذهب عيار 21 اليوم بالسودان
          </span>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {fmtMoney(rates.karat21)}
          </div>
        </div>
        <button
          onClick={() => onNavigate('gold_price')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
        >
          تفاصيل العملات
        </button>
      </div>

    </div>
  );
};
