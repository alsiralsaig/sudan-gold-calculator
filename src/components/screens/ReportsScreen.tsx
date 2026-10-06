'use client';

import React, { useMemo, useState } from 'react';
import {
  FileBarChart,
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  HandCoins,
  Users,
  Scale,
  Search,
  ChevronLeft,
  Wallet,
  Receipt
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  summarizeRange,
  startOfDay,
  startOfMonth,
  endOfDay,
  PeriodSummary
} from '../../core/accounting';
import {
  fmtMoney,
  fmtNum,
  unitsToGhJ,
  unitsToGramsDecimal,
  formatInvoiceDate,
  kCurrency
} from '../../core/format';
import { purityLabel } from '../../core/purity';
import { buildReportText, buildReminderText, openWhatsApp } from '../../core/share';
import { branchShare, branchStats } from '../../core/branches';
import { loanStatusLabel } from '../../core/loans';
import { StickyActionBar } from '../layout/StickyActionBar';
import { Building2 } from 'lucide-react';
import { MessageCircle, AlertTriangle } from 'lucide-react';

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'كل الفترة' },
];

function periodRange(key: PeriodKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), label: `تقرير يوم ${formatInvoiceDate(now.toISOString())}` };
    case 'yesterday': {
      const y = new Date(now.getTime() - 86400000);
      return { from: startOfDay(y), to: endOfDay(y), label: `تقرير يوم ${formatInvoiceDate(y.toISOString())}` };
    }
    case 'week':
      return { from: startOfDay(new Date(now.getTime() - 6 * 86400000)), to: endOfDay(now), label: 'تقرير آخر 7 أيام' };
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now), label: `تقرير شهر ${now.getMonth() + 1}/${now.getFullYear()}` };
    default:
      return { from: new Date(2000, 0, 1), to: endOfDay(now), label: 'تقرير كل الفترة' };
  }
}

const emptySummary: PeriodSummary = {
  purchasesCount: 0,
  purchasesUnits: 0,
  purchasesAmount: 0,
  salesCount: 0,
  salesUnits: 0,
  salesAmount: 0,
  salesCost: 0,
  profit: 0,
  expenses: 0,
  net: 0,
  collected: 0,
  credit: 0,
};

export const ReportsScreen: React.FC = () => {
  const {
    purchases,
    sales,
    expenses,
    partnerSharesList,
    inventory,
    financials,
    rates,
    exportCsv,
    storeName,
    dues,
    branches,
    allPurchases,
    allSales,
    allExpenses,
    activeBranchName,
    loans,
    loanSummary,
  } = useGoldStore();

  const [period, setPeriod] = useState<PeriodKey>('today');
  const [partyQuery, setPartyQuery] = useState('');
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer');

  const range = periodRange(period);
  const summary = useMemo(
    () => summarizeRange(purchases, sales, expenses, range.from, range.to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchases, sales, expenses, period]
  );

  const inPeriodSales = useMemo(
    () =>
      sales
        .filter((s) => !s.archived)
        .filter((s) => {
          const d = new Date(s.date);
          return d >= range.from && d <= range.to;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales, period]
  );

  const inPeriodPurchases = useMemo(
    () =>
      purchases
        .filter((p) => !p.archived)
        .filter((p) => {
          const d = new Date(p.date);
          return d >= range.from && d <= range.to;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchases, period]
  );

  // كشف حساب طرف
  const parties = useMemo(() => {
    const names = new Set<string>();
    if (partyType === 'customer') sales.filter((s) => !s.archived).forEach((s) => s.buyer && names.add(s.buyer));
    else purchases.filter((p) => !p.archived).forEach((p) => p.seller && names.add(p.seller));
    return Array.from(names).sort();
  }, [sales, purchases, partyType]);

  const filteredParties = useMemo(() => {
    const q = partyQuery.trim();
    if (!q) return parties.slice(0, 40);
    return parties.filter((n) => n.includes(q)).slice(0, 40);
  }, [parties, partyQuery]);

  const statement = useMemo(() => {
    const q = partyQuery.trim();
    if (!q) return null;
    if (partyType === 'customer') {
      const rows = sales.filter((s) => !s.archived && s.buyer === q);
      return {
        name: q,
        rows: rows.map((r) => ({
          id: r.id,
          date: r.date,
          weight: r.units,
          purity: r.purity,
          total: r.sellAmount,
          remaining: r.pendingAmount || 0,
          note: r.notes,
        })),
        totalWeight: rows.reduce((sum, r) => sum + r.units, 0),
        total: rows.reduce((sum, r) => sum + (r.sellAmount || 0), 0),
        remaining: rows.reduce((sum, r) => sum + (r.pendingAmount || 0), 0),
      };
    }
    const rows = purchases.filter((p) => !p.archived && p.seller === q);
    return {
      name: q,
      rows: rows.map((r) => ({
        id: r.id,
        date: r.date,
        weight: r.units,
        purity: r.purity,
        total: r.amount,
        remaining: r.pendingAmount || 0,
        note: r.notes,
      })),
      totalWeight: rows.reduce((sum, r) => sum + r.units, 0),
      total: rows.reduce((sum, r) => sum + (r.amount || 0), 0),
      remaining: rows.reduce((sum, r) => sum + (r.pendingAmount || 0), 0),
    };
  }, [partyQuery, partyType, sales, purchases]);

  // أعلى المتعاملين في الفترة
  const topBuyers = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    inPeriodSales.forEach((s) => {
      const key = s.buyer || 'زبون عام';
      const prev = map.get(key) || { amount: 0, count: 0 };
      map.set(key, { amount: prev.amount + (s.sellAmount || 0), count: prev.count + 1 });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [inPeriodSales]);

  const topSellers = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    inPeriodPurchases.forEach((p) => {
      const key = p.seller || 'بائع عام';
      const prev = map.get(key) || { amount: 0, count: 0 };
      map.set(key, { amount: prev.amount + (p.amount || 0), count: prev.count + 1 });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [inPeriodPurchases]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* شريط التحكم */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 print:border-0 print:bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-extrabold text-sm text-white">التقارير والكشوفات</h2>
              <p className="text-[11px] text-slate-400">{range.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() =>
                openWhatsApp(
                  undefined,
                  buildReportText({
                    storeName,
                    dateLabel: range.label,
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
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
              title="إرسال التقرير على واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              واتساب
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة / PDF
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar print:hidden">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                period === p.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ترويسة الطباعة */}
      <div className="hidden print:block text-center space-y-1">
        <h1 className="text-lg font-black">{storeName}</h1>
        <p className="text-xs">{range.label}</p>
        <p className="text-[10px] text-slate-500">
          سعر جرام عيار 21 عند الطباعة: {fmtNum(rates.karat21)} {kCurrency}
        </p>
      </div>

      {/* ملخص الفترة */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'المبيعات', value: summary.salesAmount, sub: `${summary.salesCount} عملية`, icon: TrendingUp, tone: 'text-emerald-400' },
          { label: 'تكلفة المبيعات', value: summary.salesCost, sub: 'تكلفة البضاعة المبيعة', icon: TrendingDown, tone: 'text-amber-400' },
          { label: 'الربح الإجمالي', value: summary.profit, sub: `${summary.salesAmount > 0 ? ((summary.profit / summary.salesAmount) * 100).toFixed(1) : '0'}% من المبيعات`, icon: Wallet, tone: summary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'المصروفات', value: summary.expenses, sub: 'عامة وخاصة', icon: Receipt, tone: 'text-rose-400' },
          { label: 'الصافي', value: summary.net, sub: 'بعد المصروفات', icon: FileBarChart, tone: summary.net >= 0 ? 'text-cyan-400' : 'text-rose-400' },
          { label: 'المشتريات', value: summary.purchasesAmount, sub: `${summary.purchasesCount} عملية`, icon: Scale, tone: 'text-blue-400' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 print:bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-400 font-bold">{card.label}</span>
                <Icon className={`w-3.5 h-3.5 ${card.tone}`} />
              </div>
              <div className={`text-sm sm:text-base font-black font-mono ${card.tone} truncate`}>
                {fmtNum(card.value)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* حركة الأوزان + الذمم */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            حركة الأوزان في الفترة
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">وزن المشتريات</span>
              <span className="font-mono text-blue-300">
                {unitsToGramsDecimal(summary.purchasesUnits).toFixed(2)} ج ({unitsToGhJ(summary.purchasesUnits)})
              </span>
            </div>
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">وزن المبيعات</span>
              <span className="font-mono text-emerald-300">
                {unitsToGramsDecimal(summary.salesUnits).toFixed(2)} ج ({unitsToGhJ(summary.salesUnits)})
              </span>
            </div>
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">صافي الحركة</span>
              <span className="font-mono text-amber-300">
                {unitsToGramsDecimal(summary.purchasesUnits - summary.salesUnits).toFixed(2)} ج
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-emerald-400" />
            التحصيل والذمم
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">محصّل من مبيعات الفترة</span>
              <span className="font-mono text-emerald-300">{fmtNum(summary.collected)}</span>
            </div>
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">آجل في الفترة</span>
              <span className="font-mono text-amber-300">{fmtNum(summary.credit)}</span>
            </div>
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">إجمالي ذمم الزبائن (كل الفترات)</span>
              <span className="font-mono text-amber-200">{fmtNum(financials.receivables)}</span>
            </div>
            <div className="flex justify-between bg-slate-950 rounded-xl px-3 py-2.5">
              <span className="text-slate-400">إجمالي المستحق للبائعين</span>
              <span className="font-mono text-cyan-200">{fmtNum(financials.payables)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* المخزون */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 print:bg-white">
        <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-400" />
          جرد المخزون الحالي (معادل عيار 21)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950 rounded-2xl p-3">
            <span className="text-slate-400 block mb-1">الوزن</span>
            <span className="font-mono font-black text-amber-300">
              {unitsToGramsDecimal(inventory.unitsK21).toFixed(2)} ج
            </span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3">
            <span className="text-slate-400 block mb-1">التكلفة</span>
            <span className="font-mono font-black text-slate-200">{fmtNum(inventory.costBasis)}</span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3">
            <span className="text-slate-400 block mb-1">القيمة السوقية</span>
            <span className="font-mono font-black text-emerald-300">{fmtNum(inventory.marketValue)}</span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3">
            <span className="text-slate-400 block mb-1">ربح غير محقق</span>
            <span className={`font-mono font-black ${inventory.unrealizedProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {fmtNum(inventory.unrealizedProfit)}
            </span>
          </div>
        </div>

        {inventory.byKarat.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-3 font-bold">العيار</th>
                  <th className="text-right py-2 px-3 font-bold">الوزن (جرام)</th>
                  <th className="text-right py-2 px-3 font-bold">بالإشارة السودانية</th>
                  <th className="text-right py-2 px-3 font-bold">معادل 21 (جرام)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inventory.byKarat.map((k) => (
                  <tr key={k.purity}>
                    <td className="py-2 px-3 text-white font-bold">عيار {purityLabel(k.purity)}</td>
                    <td className="py-2 px-3 font-mono text-slate-300">{(k.units / 100).toFixed(2)}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{unitsToGhJ(k.units)}</td>
                    <td className="py-2 px-3 font-mono text-amber-300">{(k.unitsK21 / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* السلف النقدية — خارج حساب الربح */}
      {loans.length > 0 && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 space-y-3 print:bg-white">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-emerald-400" />
            السلف النقدية (لا تدخل في الربح)
          </h3>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
              <span className="block text-[10px] text-slate-400 font-bold">لنا على الآخرين</span>
              <span className="block font-mono font-black text-emerald-400 text-sm">
                {fmtNum(loanSummary.lentOutstanding)}
              </span>
            </div>
            <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
              <span className="block text-[10px] text-slate-400 font-bold">علينا للآخرين</span>
              <span className="block font-mono font-black text-rose-400 text-sm">
                {fmtNum(loanSummary.borrowedOutstanding)}
              </span>
            </div>
            <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800">
              <span className="block text-[10px] text-slate-400 font-bold">الصافي</span>
              <span
                className={`block font-mono font-black text-sm ${
                  loanSummary.netOutstanding >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {fmtNum(loanSummary.netOutstanding)}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-3 font-bold">الاسم</th>
                  <th className="text-right py-2 px-3 font-bold">النوع</th>
                  <th className="text-right py-2 px-3 font-bold">الأصل</th>
                  <th className="text-right py-2 px-3 font-bold">مسدَّد</th>
                  <th className="text-right py-2 px-3 font-bold">المتبقي</th>
                  <th className="text-right py-2 px-3 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loans.slice(0, 12).map((l) => {
                  const paid = (l.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const pending = Math.max(0, l.amount - paid);
                  return (
                    <tr key={l.id}>
                      <td className="py-2 px-3 text-white font-bold">{l.person}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {l.direction === 'lent' ? 'لنا عليه' : 'علينا له'}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300">{fmtNum(l.amount)}</td>
                      <td className="py-2 px-3 font-mono text-emerald-300">{fmtNum(paid)}</td>
                      <td className="py-2 px-3 font-mono text-amber-300">{fmtNum(pending)}</td>
                      <td className="py-2 px-3 text-slate-400">{loanStatusLabel(l)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500">
            السلف أصول وذمم وليست مصروفات — لذلك لا تُخصم من الأرباح ولا تُضاف إليها.
          </p>
        </div>
      )}

      {/* ربحية الفروع — لكل الفروع بغض النظر عن الفرع النشط */}
      {branches.filter((b) => !b.archived).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 print:bg-white">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            ربحية الفروع
            <span className="text-[10px] font-bold text-slate-500">(الفرع النشط: {activeBranchName})</span>
          </h3>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-3 font-bold">الفرع</th>
                  <th className="text-right py-2 px-3 font-bold">مبيعات</th>
                  <th className="text-right py-2 px-3 font-bold">مشتريات</th>
                  <th className="text-right py-2 px-3 font-bold">مصروفات</th>
                  <th className="text-right py-2 px-3 font-bold">ربح البيع</th>
                  <th className="text-right py-2 px-3 font-bold">ذمم</th>
                  <th className="text-right py-2 px-3 font-bold">الحصة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(() => {
                  const rows = branchStats(
                    branches.filter((b) => !b.archived),
                    allPurchases,
                    allSales,
                    allExpenses
                  );
                  const shares = branchShare(rows);
                  return rows.map((row) => (
                    <tr key={row.branchId || 'none'}>
                      <td className="py-2 px-3 text-white font-bold whitespace-nowrap">{row.name}</td>
                      <td className="py-2 px-3 font-mono text-emerald-300">{fmtNum(row.salesAmount)}</td>
                      <td className="py-2 px-3 font-mono text-amber-300">{fmtNum(row.purchasesAmount)}</td>
                      <td className="py-2 px-3 font-mono text-rose-300">{fmtNum(row.expensesAmount)}</td>
                      <td
                        className={`py-2 px-3 font-mono font-bold ${
                          row.salesProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {fmtNum(row.salesProfit)}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300">{fmtNum(row.pending)}</td>
                      <td className="py-2 px-3 font-mono text-amber-300">
                        {shares.find((x) => x.name === row.name)?.percent ?? 0}%
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            الجدول يعرض كل الفروع دائماً — أما بقية أرقام التقرير فتتبع الفرع النشط في الشريط العلوي.
          </p>
        </div>
      )}

      {/* أنصبة الشركاء */}
      {partnerSharesList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 print:bg-white">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            توزيع الأرباح على الشركاء
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-3 font-bold">الشريك</th>
                  <th className="text-right py-2 px-3 font-bold">النسبة</th>
                  <th className="text-right py-2 px-3 font-bold">نصيب الربح</th>
                  <th className="text-right py-2 px-3 font-bold">مسحوبات</th>
                  <th className="text-right py-2 px-3 font-bold">الصافي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {partnerSharesList.map((p) => (
                  <tr key={p.partner.id}>
                    <td className="py-2 px-3 text-white font-bold">{p.partner.name}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{p.partner.profitPercent}%</td>
                    <td className="py-2 px-3 font-mono text-emerald-300">{fmtNum(p.profitShare)}</td>
                    <td className="py-2 px-3 font-mono text-rose-300">{fmtNum(p.privateExpenses)}</td>
                    <td className="py-2 px-3 font-mono text-amber-300 font-bold">{fmtNum(p.netShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500">
            الصافي = نصيب الربح − المسحوبات الخاصة (المصروفات المنسوبة للشريك).
          </p>
        </div>
      )}

      {/* أعلى المتعاملين */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-white">أعلى الزبائن في الفترة</h3>
          {topBuyers.length === 0 ? (
            <p className="text-xs text-slate-500">لا مبيعات في هذه الفترة</p>
          ) : (
            <ul className="space-y-2">
              {topBuyers.map((b, i) => (
                <li key={b.name} className="flex items-center justify-between text-xs bg-slate-950 rounded-xl px-3 py-2">
                  <span className="text-slate-300 font-semibold truncate">
                    <span className="text-slate-500 ml-1">{i + 1}.</span> {b.name}
                  </span>
                  <span className="font-mono text-emerald-300">
                    {fmtNum(b.amount)} <span className="text-[10px] text-slate-500">({b.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-white">أعلى الموردين في الفترة</h3>
          {topSellers.length === 0 ? (
            <p className="text-xs text-slate-500">لا مشتريات في هذه الفترة</p>
          ) : (
            <ul className="space-y-2">
              {topSellers.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between text-xs bg-slate-950 rounded-xl px-3 py-2">
                  <span className="text-slate-300 font-semibold truncate">
                    <span className="text-slate-500 ml-1">{i + 1}.</span> {s.name}
                  </span>
                  <span className="font-mono text-blue-300">
                    {fmtNum(s.amount)} <span className="text-[10px] text-slate-500">({s.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* المتأخرات في الفترة */}
      {dues.items.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 print:bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              المتأخرات والمتبقي على الزبائن ({dues.items.length})
            </h3>
            <span className="text-[11px] font-mono text-amber-300">
              إجمالي المتأخر: {fmtNum(dues.overdueTotal)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-2 font-bold">الطرف</th>
                  <th className="text-right py-2 px-2 font-bold">النوع</th>
                  <th className="text-right py-2 px-2 font-bold">المتبقي</th>
                  <th className="text-right py-2 px-2 font-bold">الاستحقاق</th>
                  <th className="text-right py-2 px-2 font-bold">الحالة</th>
                  <th className="text-right py-2 px-2 font-bold print:hidden">تذكير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dues.items.slice(0, 12).map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td className="py-2 px-2 text-slate-200 font-semibold">{item.party}</td>
                    <td className="py-2 px-2 text-[10px] text-slate-400">
                      {item.kind === 'receivable' ? 'لنا' : 'علينا'}
                    </td>
                    <td className="py-2 px-2 font-mono text-amber-300">{fmtNum(item.amount)}</td>
                    <td className="py-2 px-2 font-mono text-slate-400">
                      {item.dueDate ? formatInvoiceDate(item.dueDate) : '—'}
                    </td>
                    <td
                      className={`py-2 px-2 font-bold ${
                        item.status === 'overdue'
                          ? 'text-rose-300'
                          : item.status === 'today'
                          ? 'text-amber-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.status === 'overdue'
                        ? `متأخر ${item.daysOverdue} يوم`
                        : item.status === 'today'
                        ? 'اليوم'
                        : item.dueDate
                        ? `${Math.abs(item.daysOverdue)} يوم`
                        : '—'}
                    </td>
                    <td className="py-2 px-2 print:hidden">
                      <button
                        onClick={() =>
                          openWhatsApp(
                            item.phone,
                            buildReminderText({
                              storeName,
                              party: item.party,
                              amount: item.amount,
                              dueDate: item.dueDate,
                              daysOverdue: item.daysOverdue,
                              kind: item.kind,
                            })
                          )
                        }
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300"
                        title="إرسال تذكير على واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dues.items.length > 12 && (
            <p className="text-[10px] text-slate-500">
              يُعرض أول 12 سطراً — القائمة الكاملة في شاشة «التنبيهات والمتأخرات».
            </p>
          )}
        </div>
      )}

      {/* كشف حساب طرف */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 print:bg-white">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" />
          <div>
            <h3 className="font-extrabold text-sm text-white">كشف حساب طرف</h3>
            <p className="text-[11px] text-slate-400">زبون أو مورد — الحركات والأرصدة</p>
          </div>
        </div>

        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => setPartyType('customer')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
              partyType === 'customer' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
            }`}
          >
            زبون
          </button>
          <button
            onClick={() => setPartyType('supplier')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
              partyType === 'supplier' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-300 border border-slate-800'
            }`}
          >
            مورد / بائع
          </button>
        </div>

        <input
          value={partyQuery}
          onChange={(e) => setPartyQuery(e.target.value)}
          placeholder={partyType === 'customer' ? 'اكتب اسم الزبون...' : 'اكتب اسم المورد...'}
          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-sm text-white focus:outline-none print:hidden"
        />

        {!statement && (
          <div className="flex flex-wrap gap-2 print:hidden">
            {filteredParties.map((name) => (
              <button
                key={name}
                onClick={() => setPartyQuery(name)}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-[11px] text-slate-300"
              >
                {name}
              </button>
            ))}
            {filteredParties.length === 0 && (
              <p className="text-xs text-slate-500">لا يوجد طرف مطابق</p>
            )}
          </div>
        )}

        {statement && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-950 rounded-xl p-3">
                <span className="text-slate-400 block mb-1">عدد الحركات</span>
                <span className="font-mono font-black text-white">{statement.rows.length}</span>
              </div>
              <div className="bg-slate-950 rounded-xl p-3">
                <span className="text-slate-400 block mb-1">إجمالي الوزن</span>
                <span className="font-mono font-black text-amber-300">
                  {unitsToGramsDecimal(statement.totalWeight).toFixed(2)} ج
                </span>
              </div>
              <div className="bg-slate-950 rounded-xl p-3">
                <span className="text-slate-400 block mb-1">إجمالي القيمة</span>
                <span className="font-mono font-black text-emerald-300">{fmtNum(statement.total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/40 rounded-2xl px-4 py-3">
              <span className="text-xs font-bold text-amber-200">
                {partyType === 'customer' ? 'المتبقي على الزبون' : 'المتبقي للمورد'}
              </span>
              <span className="font-mono font-black text-amber-300">{fmtMoney(statement.remaining)}</span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="text-right py-2 px-2 font-bold">التاريخ</th>
                    <th className="text-right py-2 px-2 font-bold">الوزن</th>
                    <th className="text-right py-2 px-2 font-bold">العيار</th>
                    <th className="text-right py-2 px-2 font-bold">المبلغ</th>
                    <th className="text-right py-2 px-2 font-bold">المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {statement.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-2 text-slate-300">{formatInvoiceDate(r.date)}</td>
                      <td className="py-2 px-2 font-mono text-slate-300">{unitsToGhJ(r.weight)}</td>
                      <td className="py-2 px-2 text-slate-400">{purityLabel(r.purity)}</td>
                      <td className="py-2 px-2 font-mono text-white">{fmtNum(r.total)}</td>
                      <td className={`py-2 px-2 font-mono ${r.remaining > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                        {fmtNum(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* حركات الفترة */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 print:bg-white">
        <h3 className="font-extrabold text-sm text-white">مبيعات الفترة ({inPeriodSales.length})</h3>
        {inPeriodSales.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد مبيعات في هذه الفترة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-2 font-bold">التاريخ</th>
                  <th className="text-right py-2 px-2 font-bold">الزبون</th>
                  <th className="text-right py-2 px-2 font-bold">الوزن</th>
                  <th className="text-right py-2 px-2 font-bold">عيار</th>
                  <th className="text-right py-2 px-2 font-bold">البيع</th>
                  <th className="text-right py-2 px-2 font-bold">التكلفة</th>
                  <th className="text-right py-2 px-2 font-bold">الربح</th>
                  <th className="text-right py-2 px-2 font-bold">متبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inPeriodSales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-2 text-slate-300">{formatInvoiceDate(s.date)}</td>
                    <td className="py-2 px-2 text-slate-200">{s.buyer || 'زبون عام'}</td>
                    <td className="py-2 px-2 font-mono text-slate-300">{unitsToGhJ(s.units)}</td>
                    <td className="py-2 px-2 text-slate-400">{purityLabel(s.purity)}</td>
                    <td className="py-2 px-2 font-mono text-white">{fmtNum(s.sellAmount)}</td>
                    <td className="py-2 px-2 font-mono text-slate-400">{fmtNum(s.buyAmount)}</td>
                    <td
                      className={`py-2 px-2 font-mono ${
                        s.sellAmount - s.buyAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {fmtNum(s.sellAmount - s.buyAmount)}
                    </td>
                    <td className="py-2 px-2 font-mono text-amber-300">{fmtNum(s.pendingAmount || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-950 font-black">
                <tr>
                  <td className="py-2 px-2" colSpan={4}>
                    الإجمالي
                  </td>
                  <td className="py-2 px-2 font-mono text-white">{fmtNum(summary.salesAmount)}</td>
                  <td className="py-2 px-2 font-mono text-slate-400">{fmtNum(summary.salesCost)}</td>
                  <td className="py-2 px-2 font-mono text-emerald-300">{fmtNum(summary.profit)}</td>
                  <td className="py-2 px-2 font-mono text-amber-300">{fmtNum(summary.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 print:bg-white">
        <h3 className="font-extrabold text-sm text-white">مشتريات الفترة ({inPeriodPurchases.length})</h3>
        {inPeriodPurchases.length === 0 ? (
          <p className="text-xs text-slate-500">لا توجد مشتريات في هذه الفترة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="text-right py-2 px-2 font-bold">التاريخ</th>
                  <th className="text-right py-2 px-2 font-bold">البائع</th>
                  <th className="text-right py-2 px-2 font-bold">الوزن</th>
                  <th className="text-right py-2 px-2 font-bold">عيار</th>
                  <th className="text-right py-2 px-2 font-bold">المبلغ</th>
                  <th className="text-right py-2 px-2 font-bold">المسدد</th>
                  <th className="text-right py-2 px-2 font-bold">المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inPeriodPurchases.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 px-2 text-slate-300">{formatInvoiceDate(p.date)}</td>
                    <td className="py-2 px-2 text-slate-200">{p.seller || 'بائع عام'}</td>
                    <td className="py-2 px-2 font-mono text-slate-300">{unitsToGhJ(p.units)}</td>
                    <td className="py-2 px-2 text-slate-400">{purityLabel(p.purity)}</td>
                    <td className="py-2 px-2 font-mono text-white">{fmtNum(p.amount)}</td>
                    <td className="py-2 px-2 font-mono text-emerald-300">
                      {fmtNum((p.amount || 0) - (p.pendingAmount || 0))}
                    </td>
                    <td className="py-2 px-2 font-mono text-amber-300">{fmtNum(p.pendingAmount || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-950 font-black">
                <tr>
                  <td className="py-2 px-2" colSpan={4}>
                    الإجمالي
                  </td>
                  <td className="py-2 px-2 font-mono text-white">{fmtNum(summary.purchasesAmount)}</td>
                  <td className="py-2 px-2 font-mono text-slate-400">
                    {fmtNum(summary.purchasesAmount - inPeriodPurchases.reduce((s, p) => s + (p.pendingAmount || 0), 0))}
                  </td>
                  <td className="py-2 px-2 font-mono text-amber-300">
                    {fmtNum(inPeriodPurchases.reduce((s, p) => s + (p.pendingAmount || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 print:text-slate-700">
        <ChevronLeft className="w-3 h-3" />
        كل القيم بالجنيه السوداني ({kCurrency}) — والأوزان بمعادل عيار 21 عند الإجمال
      </div>
      {/* شريط ثابت: ملخص الفترة + إجراءات التقرير */}
      <StickyActionBar
        stats={[
          { label: 'مبيعات الفترة', value: fmtNum(summary.salesAmount), tone: 'emerald' },
          { label: 'ربح الفترة', value: fmtNum(summary.profit), tone: summary.profit >= 0 ? 'emerald' : 'rose' },
          { label: 'مصروفات', value: fmtNum(summary.expenses), tone: 'rose' },
          { label: 'صافي', value: fmtNum(summary.net), tone: summary.net >= 0 ? 'amber' : 'rose' },
        ]}
        columns={4}
        hint={range.label}
        actions={[{ label: 'طباعة / PDF', onClick: () => window.print(), icon: Printer, tone: 'amber' }]}
      />
    </div>
  );
};

export default ReportsScreen;
