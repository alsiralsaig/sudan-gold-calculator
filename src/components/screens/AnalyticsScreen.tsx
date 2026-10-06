'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Scale,
  Coins,
  Wallet,
  Receipt,
  Percent,
  Calendar,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { BarChart, LineChart } from '../charts/Charts';
import { fmtNum, unitsToGramsDecimal, kCurrency } from '../../core/format';
import { summarizeRange, startOfDay, startOfMonth, endOfDay } from '../../core/accounting';
import { shortLabel, arabicDate, arabicDayName, addDays } from '../../core/dates';

type RangeKey = 7 | 14 | 30;

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 7, label: '7 أيام' },
  { key: 14, label: '14 يوم' },
  { key: 30, label: '30 يوم' },
];

export const AnalyticsScreen: React.FC = () => {
  const { purchases, sales, expenses, rates, ratesHistory, inventory, financials } = useGoldStore();
  const [rangeDays, setRangeDays] = useState<RangeKey>(14);

  const today = startOfDay(new Date());

  /* ---------------------- السلسلة اليومية (أرباح/وزن) ---------------------- */
  const dailySeries = useMemo(() => {
    const activeSales = sales.filter((s) => !s.archived);
    const activePurchases = purchases.filter((p) => !p.archived);
    const activeExpenses = expenses.filter((e) => !e.archived);

    return Array.from({ length: rangeDays }, (_, idx) => {
      const day = addDays(today, -(rangeDays - 1 - idx));
      const from = startOfDay(day);
      const to = endOfDay(day);
      const summary = summarizeRange(activePurchases, activeSales, activeExpenses, from, to);

      return {
        date: day,
        label: shortLabel(day),
        dayName: arabicDayName(day),
        sales: summary.salesAmount,
        purchases: summary.purchasesAmount,
        profit: summary.profit,
        expenses: summary.expenses,
        net: summary.net,
        soldUnits: summary.salesUnits,
        boughtUnits: summary.purchasesUnits,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, purchases, expenses, rangeDays]);

  /* ---------------------------- السلسلة الشهرية ---------------------------- */
  const monthlySeries = useMemo(() => {
    const activeSales = sales.filter((s) => !s.archived);
    const activePurchases = purchases.filter((p) => !p.archived);
    const activeExpenses = expenses.filter((e) => !e.archived);
    const now = new Date();

    return Array.from({ length: 6 }, (_, idx) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const from = startOfMonth(monthDate);
      const to = endOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      const summary = summarizeRange(activePurchases, activeSales, activeExpenses, from, to);
      return {
        label: `${monthDate.getMonth() + 1}/${String(monthDate.getFullYear()).slice(2)}`,
        sales: summary.salesAmount,
        profit: summary.profit,
        expenses: summary.expenses,
        net: summary.net,
        salesCount: summary.salesCount,
      };
    });
  }, [sales, purchases, expenses]);

  /* ------------------------------- الإجماليات ------------------------------- */
  const totals = useMemo(() => {
    const salesSum = dailySeries.reduce((s, d) => s + d.sales, 0);
    const profitSum = dailySeries.reduce((s, d) => s + d.profit, 0);
    const expenseSum = dailySeries.reduce((s, d) => s + d.expenses, 0);
    const soldUnits = dailySeries.reduce((s, d) => s + d.soldUnits, 0);
    const boughtUnits = dailySeries.reduce((s, d) => s + d.boughtUnits, 0);
    const bestDay = dailySeries.reduce(
      (best, d) => (d.profit > best.profit ? d : best),
      dailySeries[0] || { profit: 0, label: '—', date: today }
    );
    const activeDays = dailySeries.filter((d) => d.sales > 0 || d.purchases > 0).length;

    return {
      salesSum,
      profitSum,
      expenseSum,
      netSum: profitSum - expenseSum,
      soldUnits,
      boughtUnits,
      netUnits: boughtUnits - soldUnits,
      avgProfit: activeDays > 0 ? profitSum / activeDays : 0,
      bestDay,
      activeDays,
      margin: salesSum > 0 ? (profitSum / salesSum) * 100 : 0,
    };
  }, [dailySeries, today]);

  /* ----------------------------- سجل سعر العيار 21 ----------------------------- */
  const ratePoints = useMemo(() => {
    const history = (ratesHistory || []).slice(-60);
    const points = history.map((h) => ({ label: shortLabel(h.t), value: h.v }));
    if (points.length === 0 && rates.karat21 > 0) {
      points.push({ label: shortLabel(new Date()), value: rates.karat21 });
    }
    return points;
  }, [ratesHistory, rates.karat21]);

  const rateStats = useMemo(() => {
    const values = ratePoints.map((p) => p.value).filter((v) => v > 0);
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max, spread: max - min, spreadPercent: min > 0 ? ((max - min) / min) * 100 : 0 };
  }, [ratePoints]);

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-200">
      {/* العنوان والمدى الزمني */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-extrabold text-sm text-white">التحليلات والرسوم البيانية</h2>
              <p className="text-[11px] text-slate-400">
                آخر {rangeDays} يوماً — القيم بالجنيه السوداني ({kCurrency})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeDays(r.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                rangeDays === r.key
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ملخص الفترة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'المبيعات', value: totals.salesSum, icon: TrendingUp, tone: 'text-emerald-400' },
          { label: 'الربح الإجمالي', value: totals.profitSum, icon: Wallet, tone: totals.profitSum >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'المصروفات', value: totals.expenseSum, icon: Receipt, tone: 'text-rose-400' },
          { label: 'الصافي', value: totals.netSum, icon: Percent, tone: totals.netSum >= 0 ? 'text-cyan-400' : 'text-rose-400' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold">{card.label}</span>
                <Icon className={`w-3.5 h-3.5 ${card.tone}`} />
              </div>
              <div className={`text-sm sm:text-base font-black font-mono ${card.tone} truncate`}>
                {fmtNum(card.value)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] text-slate-400 font-bold block mb-1">متوسط الربح لليوم النشط</span>
          <span className="font-mono font-black text-amber-300 text-sm">{fmtNum(totals.avgProfit)}</span>
          <p className="text-[10px] text-slate-500 mt-1">{totals.activeDays} يوم فيه حركة</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] text-slate-400 font-bold block mb-1">هامش الربح</span>
          <span className={`font-mono font-black text-sm ${totals.margin >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {totals.margin.toFixed(1)}%
          </span>
          <p className="text-[10px] text-slate-500 mt-1">من إجمالي المبيعات</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 font-bold block mb-1">أفضل يوم</span>
          <span className="font-mono font-black text-emerald-300 text-sm">{fmtNum(totals.bestDay.profit)}</span>
          <p className="text-[10px] text-slate-500 mt-1">
            {totals.bestDay.label !== '—' && totals.bestDay.date
              ? `${arabicDayName(totals.bestDay.date)} ${arabicDate(totals.bestDay.date)}`
              : '—'}
          </p>
        </div>
      </div>

      {/* ربح/خسارة يومية */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="font-extrabold text-sm text-white">الربح اليومي</h3>
        </div>
        <BarChart
          data={dailySeries.map((d) => ({
            label: d.label,
            value: d.profit,
            hint: `${d.dayName} ${d.label}: ربح ${fmtNum(d.profit)} — مبيعات ${fmtNum(d.sales)}`,
          }))}
          colors={['#10b981', '#f59e0b']}
          height={160}
          emptyMessage="لا توجد مبيعات في هذه الفترة"
        />
      </div>

      {/* المبيعات مقابل المشتريات */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <h3 className="font-extrabold text-sm text-white">المبيعات مقابل المشتريات</h3>
        </div>
        <BarChart
          data={dailySeries.map((d) => ({
            label: d.label,
            value: d.sales,
            value2: d.purchases,
            hint: `${d.label}: مبيعات ${fmtNum(d.sales)} · مشتريات ${fmtNum(d.purchases)}`,
          }))}
          colors={['#10b981', '#3b82f6']}
          labels2="المشتريات"
          height={170}
        />
      </div>

      {/* حركة الوزن */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm text-white">حركة الوزن (جرام)</h3>
          </div>
          <span className="text-[10px] text-slate-500">صافي الفترة: {unitsToGramsDecimal(totals.netUnits).toFixed(2)} ج</span>
        </div>
        <BarChart
          data={dailySeries.map((d) => ({
            label: d.label,
            value: d.boughtUnits / 100,
            value2: d.soldUnits / 100,
            hint: `${d.label}: مشترى ${(d.boughtUnits / 100).toFixed(2)} ج · مبيع ${(d.soldUnits / 100).toFixed(2)} ج`,
          }))}
          colors={['#3b82f6', '#10b981']}
          labels2="المبيع"
          height={160}
          formatValue={(n) => `${n.toFixed(1)} جم`}
        />
      </div>

      {/* الأشهر الستة */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <h3 className="font-extrabold text-sm text-white">آخر 6 أشهر</h3>
        </div>
        <BarChart
          data={monthlySeries.map((m) => ({
            label: m.label,
            value: m.sales,
            value2: m.profit,
            hint: `${m.label}: مبيعات ${fmtNum(m.sales)} · ربح ${fmtNum(m.profit)} · ${m.salesCount} عملية`,
          }))}
          colors={['#6366f1', '#10b981']}
          labels2="الربح"
          height={170}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[420px]">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="text-right py-2 px-2 font-bold">الشهر</th>
                <th className="text-right py-2 px-2 font-bold">المبيعات</th>
                <th className="text-right py-2 px-2 font-bold">الربح</th>
                <th className="text-right py-2 px-2 font-bold">المصروفات</th>
                <th className="text-right py-2 px-2 font-bold">الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {monthlySeries.map((m) => (
                <tr key={m.label}>
                  <td className="py-2 px-2 text-white font-bold">{m.label}</td>
                  <td className="py-2 px-2 font-mono text-slate-300">{fmtNum(m.sales)}</td>
                  <td className="py-2 px-2 font-mono text-emerald-300">{fmtNum(m.profit)}</td>
                  <td className="py-2 px-2 font-mono text-rose-300">{fmtNum(m.expenses)}</td>
                  <td className={`py-2 px-2 font-mono font-bold ${m.net >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                    {fmtNum(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* سجل سعر عيار 21 */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-sm text-white">تطور سعر جرام عيار 21</h3>
              <p className="text-[10px] text-slate-500">
                يُسجَّل السعر تلقائياً كلما تم تحديثه على جهازك ({ratePoints.length} نقطة)
              </p>
            </div>
          </div>
        </div>

        <LineChart
          points={ratePoints}
          color="#f59e0b"
          height={130}
          emptyMessage="لم يُسجَّل سجل أسعار بعد — سيظهر بعد أول تحديث للأسعار"
        />

        {rateStats && (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="bg-slate-950 rounded-xl p-2.5">
              <span className="text-slate-400 block">الأدنى</span>
              <span className="font-mono text-slate-200">{fmtNum(rateStats.min)}</span>
            </div>
            <div className="bg-slate-950 rounded-xl p-2.5">
              <span className="text-slate-400 block">الأعلى</span>
              <span className="font-mono text-slate-200">{fmtNum(rateStats.max)}</span>
            </div>
            <div className="bg-slate-950 rounded-xl p-2.5">
              <span className="text-slate-400 block">المدى</span>
              <span className="font-mono text-amber-300">{rateStats.spreadPercent.toFixed(2)}%</span>
            </div>
          </div>
        )}

        {ratePoints.length < 3 && (
          <p className="text-[10px] text-slate-500 bg-slate-950 border border-slate-800 rounded-xl p-2.5 leading-relaxed">
            نصيحة: اترك التطبيق مفتوحاً أو افتحه يومياً — كل تحديث للسعر يُضاف إلى السجل تلقائياً لترى
            اتجاه السعر خلال الأيام القادمة.
          </p>
        )}
      </div>

      {/* مقارنة المخزون */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-400" />
          <h3 className="font-extrabold text-sm text-white">المخزون الحالي مقابل الحركة</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-slate-950 rounded-xl p-3">
            <span className="text-slate-400 block mb-1">ما اشتريته ({rangeDays} يوم)</span>
            <span className="font-mono text-blue-300">{(totals.boughtUnits / 100).toFixed(2)} ج</span>
          </div>
          <div className="bg-slate-950 rounded-xl p-3">
            <span className="text-slate-400 block mb-1">ما بعته ({rangeDays} يوم)</span>
            <span className="font-mono text-emerald-300">{(totals.soldUnits / 100).toFixed(2)} ج</span>
          </div>
          <div className="bg-slate-950 rounded-xl p-3">
            <span className="text-slate-400 block mb-1">رصيد المخزون (معادل 21)</span>
            <span className="font-mono text-amber-300">{unitsToGramsDecimal(inventory.unitsK21).toFixed(2)} ج</span>
          </div>
          <div className="bg-slate-950 rounded-xl p-3">
            <span className="text-slate-400 block mb-1">نسبة الدوران</span>
            <span className="font-mono text-cyan-300">
              {inventory.unitsK21 > 0
                ? `${((totals.soldUnits / inventory.unitsK21) * 100).toFixed(0)}%`
                : '—'}
            </span>
          </div>
        </div>

        {financials.receivables > 0 && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200 leading-relaxed">
              رأس مالك المجمّد في ذمم الزبائن: <span className="font-bold">{fmtNum(financials.receivables)}</span>{' '}
              {kCurrency} — يعادل{' '}
              {inventory.costBasis > 0
                ? `${((financials.receivables / inventory.costBasis) * 100).toFixed(1)}% من تكلفة المخزون`
                : 'نسبة غير محسوبة'}
              .
            </p>
          </div>
        )}

        {totals.activeDays === 0 && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            سجّل عمليات بيع وشراء وستظهر الرسوم تلقائياً.
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsScreen;
