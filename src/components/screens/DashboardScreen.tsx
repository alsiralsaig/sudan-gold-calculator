'use client';

import React from 'react';
import {
  TrendingDown,
  Scale,
  DollarSign,
  Wallet,
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  ChevronLeft,
  Settings,
  FileBarChart,
  AlertTriangle,
  Cloud,
  RefreshCw,
  Clock,
  HandCoins,
  Sparkles
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  fmtMoney,
  fmtNum,
  unitsToWeight,
  unitsToGhJ,
  unitsToGramsDecimal,
  kCurrency
} from '../../core/format';
import { purityLabel } from '../../core/purity';
import { BarChart } from '../charts/Charts';
import { summarizeRange, startOfDay, endOfDay } from '../../core/accounting';
import {
  arabicDate,
  arabicDayName,
  addDays,
  relativeDays,
  shortLabel
} from '../../core/dates';
import {
  BellRing,
  WifiOff,
  CloudUpload,
  BarChart3,
  MessageCircle
} from 'lucide-react';
import { buildReportText, openWhatsApp } from '../../core/share';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
}

function freshnessLabel(fetchedAt?: string, isStale?: boolean): { text: string; tone: string } {
  if (isStale) return { text: 'بيانات غير محدّثة', tone: 'text-amber-300' };
  if (!fetchedAt) return { text: 'لم يتم التحديث بعد', tone: 'text-slate-400' };
  const diffMin = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000);
  if (diffMin < 1) return { text: 'تحديث الآن', tone: 'text-emerald-400' };
  if (diffMin < 60) return { text: `قبل ${diffMin} دقيقة`, tone: 'text-emerald-400' };
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return { text: `قبل ${hours} ساعة`, tone: 'text-amber-300' };
  return { text: `قبل ${Math.round(hours / 24)} يوم`, tone: 'text-rose-300' };
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const {
    rates,
    ratesMeta,
    inventory,
    financials,
    partners,
    purchases,
    sales,
    refreshRates,
    isSyncing,
    isCloudSignedIn,
    lastSyncTime,
    dues,
    isOnline,
    pendingSync,
    forceSync,
    storeName,
    expenses,
  } = useGoldStore();

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const freshness = freshnessLabel(rates.fetchedAt || rates.lastUpdated, rates.isStale);

  const recentCreditSales = sales
    .filter((s) => !s.archived && (s.pendingAmount || 0) > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // ربح آخر 7 أيام (رسم مصغّر)
  const weekly = React.useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, idx) => {
      const day = addDays(today, -(6 - idx));
      const summary = summarizeRange(purchases, sales, expenses, startOfDay(day), endOfDay(day));
      return { label: shortLabel(day), value: summary.profit, hint: `${arabicDayName(day)}: ربح ${fmtNum(summary.profit)}` };
    });
  }, [purchases, sales, expenses]);

  const weeklyNet = weekly.reduce((s, d) => s + d.value, 0);

  const sendDailyReport = () => {
    const today = startOfDay(new Date());
    const summary = summarizeRange(purchases, sales, expenses, today, endOfDay(today));
    openWhatsApp(
      undefined,
      buildReportText({
        storeName,
        dateLabel: `تقرير يوم ${arabicDate(today)}`,
        salesCount: summary.salesCount,
        salesAmount: summary.salesAmount,
        salesUnits: summary.salesUnits,
        profit: summary.profit,
        expenses: summary.expenses,
        net: summary.net,
        collected: summary.collected,
        credit: summary.credit,
        stockGramsK21: inventory.gramsK21,
        price21: rates.karat21,
      })
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshRates();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-200">
      {/* Hero: المركز المالي */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-6 rounded-3xl border-2 border-amber-500/40 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              المركز المالي الشامل
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {fmtMoney(financials.totalCapital)}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">إجمالي رأس مال الشركاء المودع</p>
          </div>
          <div className="text-left bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">صافي الأرباح</span>
            <span
              className={`text-base sm:text-lg font-black font-mono ${
                financials.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {fmtMoney(financials.netProfit)}
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              هامش {financials.profitMarginPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <button
            onClick={() => onNavigate('sales')}
            className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80 text-right hover:border-emerald-500/50 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>إجمالي المبيعات</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-black font-mono text-white truncate">
              {fmtNum(financials.totalSales)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {financials.activeSalesCount} عملية
            </div>
          </button>

          <button
            onClick={() => onNavigate('sales')}
            className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80 text-right hover:border-amber-500/50 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>تكلفة المبيعات</span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-black font-mono text-white truncate">
              {fmtNum(financials.totalCost)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              ربح إجمالي {fmtNum(financials.grossProfit)}
            </div>
          </button>

          <button
            onClick={() => onNavigate('expenses')}
            className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80 text-right hover:border-rose-500/50 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>المنصرفات العامة</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-sm font-black font-mono text-rose-400 truncate">
              {fmtNum(financials.generalExpenses)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              خاصة: {fmtNum(financials.privateExpenses)}
            </div>
          </button>

          <button
            onClick={() => onNavigate('purchases')}
            className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800/80 text-right hover:border-cyan-500/50 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>متبقي للبائعين</span>
              <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-sm font-black font-mono text-cyan-400 truncate">
              {fmtNum(financials.payables)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              على {purchases.filter((p) => !p.archived && (p.pendingAmount || 0) > 0).length} فاتورة
            </div>
          </button>
        </div>
      </div>

      {/* الذمم المدينة (البيع الآجل) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-2xl border border-emerald-500/40">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">متبقي على الزبائن</h3>
              <p className="text-xs text-slate-400">ذمم مدينة من فواتير البيع الآجل</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            التفاصيل
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 block font-bold mb-1">إجمالي المتبقي</span>
            <div
              className={`text-xl font-black font-mono ${
                financials.receivables > 0 ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              {fmtMoney(financials.receivables)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {financials.openCreditSales > 0
                ? `${financials.openCreditSales} فاتورة غير مسددة`
                : 'لا توجد فواتير آجلة 🎉'}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 block font-bold mb-2">أحدث المدينين</span>
            {recentCreditSales.length === 0 ? (
              <p className="text-xs text-slate-500">لا يوجد مدينون حالياً</p>
            ) : (
              <ul className="space-y-1.5">
                {recentCreditSales.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold truncate max-w-[55%]">
                      {s.buyer || 'زبون عام'}
                    </span>
                    <span className="font-mono text-amber-300">{fmtNum(s.pendingAmount || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* رصيد المخزون — أساس عيار 21 */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">رصيد المخزون الحالي</h3>
              <p className="text-xs text-slate-400">
                محسوب بمعادل <span className="text-amber-400 font-bold">عيار 21</span> (العيار الرسمي
                للبيع والشراء)
              </p>
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

        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div>
            <span className="text-xs text-slate-400 block font-bold mb-1">معادل عيار 21</span>
            <div className="text-xl font-black text-amber-400 font-mono">
              {unitsToGramsDecimal(inventory.unitsK21).toFixed(2)} جرام
            </div>
            <div className="text-xs text-slate-300 font-semibold mt-0.5">
              ({unitsToGhJ(inventory.unitsK21)}) — {unitsToWeight(inventory.unitsK21)}
            </div>
          </div>

          <div className="border-r border-slate-800 pr-4">
            <span className="text-xs text-slate-400 block font-bold mb-1">القيمة السوقية اليوم</span>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {fmtMoney(inventory.marketValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              بسعر {fmtNum(rates.karat21)} {kCurrency}/جرام (عيار 21)
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <span className="text-xs text-slate-400 block font-bold mb-1">تكلفة المخزون</span>
            <div className="text-lg font-black text-slate-200 font-mono">
              {fmtMoney(inventory.costBasis)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              متوسط {fmtNum(inventory.avgCostPerGramK21)} {kCurrency}/جرام
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <span className="text-xs text-slate-400 block font-bold mb-1">ربح غير محقّق</span>
            <div
              className={`text-lg font-black font-mono ${
                inventory.unrealizedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {fmtMoney(inventory.unrealizedProfit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">تقديري على أساس السعر الحالي</div>
          </div>
        </div>

        {/* تفصيل العيارات */}
        {inventory.byKarat.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-bold">تفصيل المخزون حسب العيار:</span>
            <div className="flex flex-wrap gap-2">
              {inventory.byKarat.map((k) => (
                <div
                  key={k.purity}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-bold ${
                    k.units < 0
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <span className="text-amber-400">عيار {purityLabel(k.purity)}</span>
                  <span className="mx-1.5 font-mono">·</span>
                  <span className="font-mono">{(k.units / 100).toFixed(2)} ج</span>
                  <span className="text-slate-500 mx-1">→</span>
                  <span className="font-mono text-slate-400">
                    معادل {(k.unitsK21 / 100).toFixed(2)} ج21
                  </span>
                </div>
              ))}
            </div>
            {inventory.negativeKarats.length > 0 && (
              <div className="flex items-start gap-2 bg-rose-950/30 border border-rose-500/40 rounded-2xl p-3">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-200 leading-relaxed">
                  يوجد عجز في العيارات:{' '}
                  <span className="font-bold">
                    {inventory.negativeKarats.map((k) => purityLabel(k)).join('، ')}
                  </span>
                  . يعني أنك بعت من عيار أكثر مما اشتريت — راجع عمليات البيع أو أدخل جرد افتتاحي.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* حالة الأسعار */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                rates.isStale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            سعر جرام الذهب عيار 21 اليوم
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300"
              title="تحديث الأسعار"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => onNavigate('gold_price')}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
            >
              تفاصيل الأسعار
            </button>
          </div>
        </div>

        <div className="text-xl sm:text-2xl font-black text-white font-mono">
          {fmtMoney(rates.karat21)}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className={`flex items-center gap-1 ${freshness.tone}`}>
            <Clock className="w-3 h-3" />
            {freshness.text}
          </span>
          <span className="text-slate-400">دولار السوق: {fmtNum(rates.usdRate)}</span>
          {rates.bankUsdRate ? (
            <span className="text-slate-400">البنوك: {fmtNum(rates.bankUsdRate)}</span>
          ) : null}
          {rates.globalOunceUsd ? (
            <span className="text-slate-400">الأونصة: ${rates.globalOunceUsd.toFixed(2)}</span>
          ) : null}
        </div>

        <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-2 space-y-0.5">
          <div>الذهب: {rates.goldSource || '—'}</div>
          <div>الدولار: {rates.usdSource || '—'}</div>
        </div>

        {ratesMeta.warnings.length > 0 && (
          <ul className="space-y-1">
            {ratesMeta.warnings.slice(0, 3).map((w, i) => (
              <li key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* حالة الاتصال */}
      {!isOnline && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl px-4 py-3 flex items-start gap-2.5">
          <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <p className="text-rose-200 font-bold">لا يوجد اتصال بالإنترنت</p>
            <p className="text-rose-200/80">
              التطبيق يعمل بالكامل من جهازك — كل عملية تسجّلها تُحفظ محلياً وتُرفع تلقائياً عند عودة
              الشبكة.
            </p>
          </div>
        </div>
      )}

      {isOnline && pendingSync && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl px-4 py-3 flex items-center justify-between gap-2.5">
          <span className="flex items-center gap-2 text-[11px] text-amber-200 font-bold">
            <CloudUpload className="w-4 h-4 text-amber-400" />
            تغييرات بانتظار المزامنة السحابية
          </span>
          <button
            onClick={() => void forceSync()}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100 text-[11px] font-bold"
          >
            مزامنة الآن
          </button>
        </div>
      )}

      {/* المزامنة */}
      {isCloudSignedIn && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            المزامنة السحابية مفعّلة {isSyncing ? '(جاري المزامنة...)' : ''}
          </span>
          <span className="text-slate-500">آخر مزامنة: {lastSyncTime || '—'}</span>
        </div>
      )}

      {/* التنبيهات والمتأخرات */}
      {(dues.overdue.length > 0 || dues.dueToday.length > 0) && (
        <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-rose-500/15 text-rose-400 rounded-2xl border border-rose-500/40">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">تنبيهات التحصيل</h3>
                <p className="text-[11px] text-slate-400">
                  {dues.overdue.length > 0
                    ? `${dues.overdue.length} فاتورة متأخرة بقيمة ${fmtMoney(dues.overdueTotal)}`
                    : `${dues.dueToday.length} فاتورة تستحق اليوم`}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('reminders')}
              className="text-xs font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1"
            >
              الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            {[...dues.overdue, ...dues.dueToday].slice(0, 3).map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2.5 border border-slate-800"
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">
                    {item.party}
                    <span className="text-[10px] text-slate-500 font-normal mr-1.5">
                      {item.kind === 'receivable' ? '(لنا)' : '(علينا)'}
                    </span>
                  </span>
                  <span className="text-[10px] text-rose-300 font-bold">
                    {item.status === 'overdue' ? `متأخر ${item.daysOverdue} يوم` : relativeDays(item.daysOverdue)}
                  </span>
                </div>
                <span className="font-mono font-black text-amber-300 text-xs shrink-0">
                  {fmtNum(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ربح آخر 7 أيام */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <div>
              <h3 className="font-extrabold text-sm text-white">الربح في آخر 7 أيام</h3>
              <p className="text-[11px] text-slate-400">
                الصافي: <span className={weeklyNet >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{fmtNum(weeklyNet)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('analytics')}
            className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1"
          >
            تحليلات
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <BarChart data={weekly} height={120} colors={['#10b981', '#f59e0b']} emptyMessage="لا توجد مبيعات هذا الأسبوع" />
      </div>

      {/* اختصارات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { tab: 'purchases', label: 'المشتريات والديون', icon: ShoppingBag, color: 'text-blue-400', count: `${purchases.filter((p) => !p.archived).length} عملية شراء` },
          { tab: 'sales', label: 'المبيعات والأرباح', icon: DollarSign, color: 'text-emerald-400', count: `${sales.filter((s) => !s.archived).length} عملية بيع` },
          { tab: 'partners', label: 'الشركاء والأرباح', icon: Users, color: 'text-amber-400', count: `${partners.filter((p) => !p.archived).length} شركاء` },
          { tab: 'reports', label: 'التقارير والكشوفات', icon: FileBarChart, color: 'text-cyan-400', count: 'يومي · شهري · طباعة' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              onClick={() => onNavigate(item.tab)}
              className="bg-slate-900 hover:bg-slate-800/90 p-4 rounded-3xl border border-slate-800 hover:border-amber-500/50 text-right space-y-2 transition-all group"
            >
              <div className={`p-2.5 bg-slate-950 ${item.color} rounded-2xl w-fit group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">{item.label}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.count}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* الإعدادات */}
      <div
        onClick={() => onNavigate('settings')}
        className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 hover:border-amber-500/50 p-4 rounded-3xl flex items-center justify-between cursor-pointer transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-2xl group-hover:scale-110 transition-transform border border-amber-500/30">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>الإعدادات والمزامنة السحابية</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">
                نسخ احتياطي + PIN
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              تعديل سعر السوق، رمز القفل، النسخ الاحتياطي والمظهر
            </p>
          </div>
        </div>
        <ChevronLeft className="w-5 h-5 text-amber-400 group-hover:-translate-x-1 transition-transform" />
      </div>

      {/* مشاركة تقرير اليوم */}
      <button
        onClick={sendDailyReport}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2"
      >
        <MessageCircle className="w-4 h-4" />
        إرسال تقرير اليوم على واتساب (للشريك)
      </button>

      {financials.activeSalesCount === 0 && financials.activePurchasesCount === 0 && (
        <div className="bg-slate-900/60 border border-dashed border-slate-700 rounded-3xl p-5 text-center space-y-2">
          <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
          <h4 className="font-extrabold text-sm text-white">ابدأ بتسجيل أول عملية</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            أضف المشتريات من «سجل المشتريات»، ثم المبيعات من «سجل المبيعات». سيُحسب المخزون والأرباح
            تلقائياً بمعادل عيار 21.
          </p>
        </div>
      )}
    </div>
  );
};
