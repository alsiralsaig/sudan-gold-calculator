import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  Building2,
  UserCheck,
  HandCoins,
  ArrowLeftRight,
  Info
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { StickyActionBar } from '../layout/StickyActionBar';
import {
  fmtMoney,
  fmtNum,
  formatInvoiceDate,
  kCurrency
} from '../../core/format';
import { Expense, LoanDirection } from '../../types';
import { summarizeExpenses, partnerExpenseText, PeriodFilter } from '../../core/expenseSummary';
import { matchExpenseQuery } from '../../core/globalSearch';
import { PasteButton } from '../common/PasteButton';
import { ShareButtons } from '../common/ShareButtons';

export const ExpensesScreen: React.FC = () => {
  const {
    expenses,
    partners,
    addExpense,
    archiveExpense,
    updateExpense,
    deleteExpense,
    addLoan,
    loanSummary,
  } = useGoldStore();

  const [searchQuery, setSearchQuery] = useState('');
  /** 'all' | 'عام' | 'خاصة' | اسم شريك — الفلترة الأساسية للشاشة */
  const [filterTarget, setFilterTarget] = useState<'all' | 'عام' | 'خاصة' | string>('all');
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>('all');
  const [showBreakdown, setShowBreakdown] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [targetType, setTargetType] = useState<'عام' | 'خاص'>('عام');
  const [selectedPartner, setSelectedPartner] = useState<string>(partners[0]?.name || 'السر الصائغ');
  const [notes, setNotes] = useState('');

  // وضع «سلفة» داخل شاشة المنصرفات — السلفة لا تُحسب مصروفاً
  const [isLoanMode, setIsLoanMode] = useState(false);
  const [loanDirection, setLoanDirection] = useState<LoanDirection>('lent');
  const [loanPhone, setLoanPhone] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');

  const handleOpenAdd = () => {
    setName('');
    setAmount('');
    setTargetType('عام');
    setSelectedPartner(partners[0]?.name || '');
    setNotes('');
    setIsLoanMode(false);
    setLoanDirection('lent');
    setLoanPhone('');
    setLoanDueDate('');
    setShowAddModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // سلفة: لا تذهب إلى المنصرفات إطلاقاً — لا تؤثر على الربح
    if (isLoanMode) {
      addLoan({
        date: new Date().toISOString(),
        person: name.trim(),
        phone: loanPhone.trim(),
        amount: parseFloat(amount) || 0,
        direction: loanDirection,
        dueDate: loanDueDate ? new Date(loanDueDate).toISOString() : undefined,
        notes: notes.trim(),
      });
      setShowAddModal(false);
      return;
    }

    const actualTarget = targetType === 'عام' ? 'عام' : (selectedPartner || 'شريك');

    addExpense({
      date: new Date().toISOString(),
      name: name.trim(),
      amount: parseFloat(amount) || 0,
      category: targetType === 'عام' ? 'منصرفات عامة' : 'مسحوبات شريك',
      target: actualTarget,
      notes: notes.trim(),
    });

    setShowAddModal(false);
  };

  // الفلترة والتجميع — المنطق في core/expenseSummary.ts (مُختبر)
  const summary = useMemo(
    () =>
      summarizeExpenses(expenses, {
        target: filterTarget,
        period: filterPeriod,
        query: searchQuery,
      }),
    [expenses, filterTarget, filterPeriod, searchQuery]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses
        .filter((e) => !e.archived)
        .filter((e) => {
          if (filterTarget === 'all') return true;
          if (filterTarget === 'عام') return !e.target || e.target === 'عام';
          if (filterTarget === 'خاصة') return Boolean(e.target) && e.target !== 'عام';
          return e.target === filterTarget;
        })
        .filter((e) => {
          if (filterPeriod === 'all') return true;
          const d = new Date(e.date);
          const now = new Date();
          if (filterPeriod === 'today') return d.toDateString() === now.toDateString();
          if (filterPeriod === '7days') {
            const diff = (now.getTime() - d.getTime()) / 86400000;
            return diff >= 0 && diff <= 7;
          }
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .filter((e) => matchExpenseQuery(e, searchQuery)),
    [expenses, filterTarget, filterPeriod, searchQuery]
  );

  /** تجميع الشرائح: يتبع الفترة والبحث، ولا يتبع فلتر الشريك */
  const allTimeByPartner = useMemo(
    () => summarizeExpenses(expenses, { target: 'all', period: filterPeriod, query: searchQuery }),
    [expenses, filterPeriod, searchQuery]
  );

  const partnerList = useMemo(
    () => allTimeByPartner.partners.map((p) => ({ name: p.target, count: p.count, total: p.total })),
    [allTimeByPartner]
  );

  // الإجماليات للنتائج الظاهرة
  const totalAmountSum = summary.total;
  const generalSum = summary.generalTotal;
  const privateSum = summary.privateTotal;

  const periodLabels: Record<PeriodFilter, string> = {
    all: 'كل الفترات',
    today: 'اليوم',
    '7days': 'آخر 7 أيام',
    month: 'هذا الشهر',
  };
  const periodLabel = periodLabels[filterPeriod];
  const selectedLabel =
    filterTarget === 'all'
      ? 'كل المنصرفات'
      : filterTarget === 'عام'
      ? 'المنصرفات العامة'
      : filterTarget === 'خاصة'
      ? 'منصرفات الشركاء'
      : `منصرفات ${filterTarget}`;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالبيان أو الشريك أو المبلغ..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-rose-400 rounded-2xl py-3 px-4 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none shadow-md transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
        <PasteButton onPaste={(text) => setSearchQuery(text)} compact />
      </div>

      {/* 2. فلترة الجهة: الكل / عامة / خاصة */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setFilterTarget('all')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            filterTarget === 'all'
              ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <span>كل المنصرفات ({allTimeByPartner.count})</span>
        </button>

        <button
          onClick={() => setFilterTarget('عام')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            filterTarget === 'عام'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>عامة ({allTimeByPartner.general?.count || 0})</span>
        </button>

        <button
          onClick={() => setFilterTarget('خاصة')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            filterTarget === 'خاصة'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>خاصة ({allTimeByPartner.partners.reduce((n, x) => n + x.count, 0)})</span>
        </button>
      </div>

      {/* 2.1 شرائح الشركاء — ضغطة واحدة تجمع منصرفات الشريك كاملة */}
      {partnerList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-300 flex items-center gap-1.5">
              <HandCoins className="w-3.5 h-3.5 text-cyan-400" />
              منصرفات كل شريك ({periodLabel}) — اضغط لتجميعها
            </span>
            {filterTarget !== 'all' && (
              <button
                onClick={() => setFilterTarget('all')}
                className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1"
              >
                إلغاء الفلترة
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {partnerList.map((partner) => {
              const active = filterTarget === partner.name;
              return (
                <button
                  key={partner.name}
                  onClick={() => setFilterTarget(active ? 'all' : partner.name)}
                  className={`shrink-0 min-w-[110px] text-right rounded-2xl p-3 border transition-all ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`text-xs font-black ${active ? 'text-cyan-200' : 'text-white'}`}>
                    {partner.name}
                  </div>
                  <div className={`text-sm font-black font-mono mt-0.5 ${active ? 'text-cyan-300' : 'text-slate-200'}`}>
                    {fmtNum(partner.total)}
                  </div>
                  <div className="text-[10px] text-slate-500">{partner.count} عملية</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2.2 جدول التجميع التفصيلي بالشريك */}
      {showBreakdown && summary.byTarget.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              تجميع {selectedLabel} — {periodLabel}
            </span>
            <button
              onClick={() => setShowBreakdown(false)}
              className="text-[10px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1"
            >
              إخفاء
            </button>
          </div>

          <div className="space-y-2">
            {summary.byTarget.map((row) => {
              const active = filterTarget === row.target;
              return (
                <button
                  key={row.target}
                  onClick={() => setFilterTarget(active ? 'all' : row.target)}
                  className={`w-full text-right rounded-2xl p-3 border transition-all space-y-1.5 ${
                    active ? 'bg-amber-500/15 border-amber-500/50' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      {row.target}
                      {row.isGeneral && (
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-md px-1.5 py-0.5">
                          عام
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-black font-mono text-rose-300 whitespace-nowrap">
                      {fmtNum(row.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.isGeneral ? 'bg-amber-400' : 'bg-cyan-400'}`}
                        style={{ width: `${Math.min(100, row.percent)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono w-12 text-left">{row.percent}%</span>
                    <span className="text-[10px] text-slate-500">{row.count} عملية</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl p-3">
            <span className="text-[11px] font-bold text-slate-300">الإجمالي</span>
            <span className="text-sm font-black font-mono text-white">{fmtNum(summary.total)} {kCurrency}</span>
          </div>
          {filterTarget !== 'all' && filterPeriod !== 'all' && (
            <div className="pt-1">
              <ShareButtons
                text={partnerExpenseText(
                  'مجوهرات الذهب',
                  {
                    target: selectedLabel,
                    isGeneral: filterTarget === 'عام',
                    count: summary.count,
                    total: summary.total,
                    percent: 100,
                    firstDate: null,
                    lastDate: null,
                  },
                  periodLabel
                )}
                label="إرسال الملخص على واتساب"
              />
            </div>
          )}
        </div>
      )}

      {!showBreakdown && summary.byTarget.length > 0 && (
        <button
          onClick={() => setShowBreakdown(true)}
          className="w-full py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300"
        >
          إظهار تجميع الشركاء
        </button>
      )}

      {/* Period Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'today', label: 'اليوم' },
          { id: '7days', label: 'آخر 7 أيام' },
          { id: 'month', label: 'هذا الشهر' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterPeriod(tab.id as any)}
            className={`py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterPeriod === tab.id
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {filteredExpenses.length > 0 && <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-3 space-y-2">
        <div className="text-[11px] text-slate-400">إجراءات الصفحة على السجلات الظاهرة فقط</div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => { if (confirm('أرشفة كل السجلات الظاهرة؟')) filteredExpenses.forEach(x => archiveExpense(x.id)); }} className="py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black">أرشفة الكل</button>
          <button onClick={() => { const value = prompt('الملاحظات الجديدة'); if (value !== null) filteredExpenses.forEach(x => updateExpense({ ...x, notes: value })); }} className="py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-black">تعديل الكل</button>
          <button onClick={() => { if (confirm('حذف نهائي لكل السجلات الظاهرة؟')) filteredExpenses.forEach(x => deleteExpense(x.id)); }} className="py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black">حذف الكل</button>
        </div>
      </div>}

      {/* 3. Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[700px] text-xs border-collapse" dir="rtl">
            <thead>
              <tr className="bg-rose-500/15 border-b border-rose-500/30 text-rose-400 font-black">
                <th className="py-3 px-3 text-right w-[18%]">التاريخ</th>
                <th className="py-3 px-3 text-center w-[18%]">المبلغ</th>
                <th className="py-3 px-3 text-right w-[24%]">بيان المصروف</th>
                <th className="py-3 px-3 text-center w-[16%]">النوع</th>
                <th className="py-3 px-3 text-right w-[24%]">الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                    <TrendingDown className="w-8 h-8 mx-auto text-slate-600 opacity-60 mb-2" />
                    <p>لا توجد منصرفات مسجلة في هذه الفترة</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item) => {
                  const isGeneral = item.target === 'عام' || !item.target;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedExpense(item)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {formatInvoiceDate(item.date)}
                      </td>

                      <td className="py-3.5 px-3 text-center text-rose-400 font-mono font-black text-xs whitespace-nowrap">
                        {fmtNum(item.amount)}
                      </td>

                      <td className="py-3.5 px-3 text-right text-white font-bold text-xs truncate max-w-[180px]">
                        {item.name}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isGeneral ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-bold text-[10px]">
                            عام
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 font-bold text-[10px]" title={item.target}>
                            {item.target}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right text-slate-400 text-[10px] truncate max-w-[180px]" title={item.notes || ''}>
                        {item.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* شريط ثابت: إجماليات المصروفات + زر مصروف جديد */}
      <StickyActionBar
        stats={[
          { label: filterTarget === 'all' ? 'الإجمالي' : 'إجمالي المعروض', value: fmtNum(totalAmountSum), tone: 'rose' },
          { label: 'عامة', value: fmtNum(generalSum), tone: 'amber' },
          { label: 'خاصة', value: fmtNum(privateSum), tone: 'cyan' },
          { label: 'عدد العمليات', value: String(summary.count), tone: 'slate' },
        ]}
        columns={4}
        hint={
          filterTarget !== 'all' || filterPeriod !== 'all' || searchQuery
            ? `${selectedLabel} — ${periodLabel} (النتائج الظاهرة فقط)`
            : 'الإجماليات لكل المصروفات غير المؤرشفة'
        }
        actions={[{ label: 'مصروف جديد', onClick: handleOpenAdd, icon: Plus, tone: 'rose' }]}
      />

      {/* Modal: Add New Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveExpense}
            className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-white relative animate-in zoom-in-95 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3
                className={`font-black text-base flex items-center gap-2 ${
                  isLoanMode ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isLoanMode ? <HandCoins className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{isLoanMode ? 'تسجيل سلفة جديدة' : 'تسجيل مصروف جديد'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* وضع السجل: مصروف أم سلفة */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsLoanMode(false)}
                className={`py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                  !isLoanMode ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                مصروف (ينقص الربح)
              </button>
              <button
                type="button"
                onClick={() => setIsLoanMode(true)}
                className={`py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                  isLoanMode ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                <HandCoins className="w-4 h-4" />
                سلفة (لا تنقص الربح)
              </button>
            </div>

            {isLoanMode && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {(['lent', 'borrowed'] as LoanDirection[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLoanDirection(d)}
                      className={`py-2 rounded-xl text-[11px] font-black border transition-colors ${
                        loanDirection === d
                          ? d === 'lent'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-rose-500 text-white border-rose-400'
                          : 'bg-slate-950 text-slate-300 border-slate-700'
                      }`}
                    >
                      {d === 'lent' ? 'سلّفناه (لنا عليه)' : 'استلفنا منه (علينا له)'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">الهاتف (واتساب)</label>
                    <input
                      value={loanPhone}
                      onChange={(e) => setLoanPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="09xxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">تاريخ السداد المتوقع</label>
                    <input
                      type="date"
                      value={loanDueDate}
                      onChange={(e) => setLoanDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-200/80 leading-relaxed flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ستُسجَّل في «السلف والأمانات» كذمة (أصل) وليس كمصروف، ويمكن متابعتها وسدادها على دفعات.
                </p>
              </div>
            )}

            {/* Expense Name / Statement */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {isLoanMode ? 'اسم الشخص:' : 'بيان المصروف (الاسم):'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: ثلج، مويه صحة، فطور، إيجار..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-rose-400 focus:outline-none"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                المبلغ ({kCurrency}):
              </label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-rose-400 font-mono font-bold text-lg focus:border-rose-400 focus:outline-none text-right"
              />
            </div>

            {/* Target Type: General vs Partner Private */}
            {!isLoanMode && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                نوع المصروف:
              </label>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setTargetType('عام')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    targetType === 'عام'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>عام (مصروف المحل)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('خاص')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    targetType === 'خاص'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 border border-slate-800'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>خاص (مسحوبات شريك)</span>
                </button>
              </div>

              {/* Partner Dropdown if Private */}
              {targetType === 'خاص' && (
                <div className="animate-in fade-in pt-1">
                  <label className="block text-xs text-slate-400 mb-1">اختر الشريك المعني:</label>
                  <select
                    value={selectedPartner}
                    onChange={(e) => setSelectedPartner(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  >
                    {partners.filter((p) => !p.archived).map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية:</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي تفاصيل أخرى..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 text-white font-black rounded-xl text-xs shadow-md"
              >
                حفظ المصروف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: View Selected Expense Details */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-rose-400">تفاصيل المصروف</h3>
              <button
                onClick={() => setSelectedExpense(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">التاريخ:</span>
                <span className="font-mono text-white">{formatInvoiceDate(selectedExpense.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">البيان:</span>
                <span className="text-white font-bold">{selectedExpense.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ:</span>
                <span className="font-mono text-rose-400 font-black text-sm">{fmtMoney(selectedExpense.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">النوع:</span>
                <span className={selectedExpense.target === 'عام' || !selectedExpense.target ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'}>
                  {selectedExpense.target === 'عام' || !selectedExpense.target ? 'عام (المحل)' : `خاص: ${selectedExpense.target}`}
                </span>
              </div>
              {selectedExpense.notes && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ملاحظات:</span>
                  <span className="text-slate-300">{selectedExpense.notes}</span>
                </div>
              )}
            </div>

            {/* تحويل المصروف القديم إلى سلفة (بدون أثر على الربح) */}
            <button
              onClick={() => {
                const isGeneral = selectedExpense.target === 'عام' || !selectedExpense.target;
                const msg = isGeneral
                  ? 'تحويل هذا السجل إلى سلفة؟ سيُحذف من المنصرفات (ويرتفع الربح بنفس المبلغ) ويُضاف إلى «السلف والأمانات» كذمة لنا على الشخص.'
                  : 'هذا السجل مسحوبات شريك وليس سلفة. تحويله إلى سلفة سيحذفه من المسحوبات ويسجّله كذمة. متابعة؟';
                if (!confirm(msg)) return;
                addLoan({
                  date: selectedExpense.date,
                  person: selectedExpense.name.trim(),
                  amount: selectedExpense.amount,
                  direction: 'lent',
                  notes: selectedExpense.notes || 'مُحوَّلة من المنصرفات',
                });
                deleteExpense(selectedExpense.id);
                setSelectedExpense(null);
              }}
              className="w-full py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 font-bold rounded-xl text-[11px] border border-emerald-500/40 flex items-center justify-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4" />
              تحويل إلى سلفة (يخرج من المصروفات)
            </button>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button onClick={() => { const name = prompt('البيان الجديد', selectedExpense.name); const amount = prompt('المبلغ الجديد', String(selectedExpense.amount)); if (name !== null && amount !== null) { updateExpense({ ...selectedExpense, name: name.trim() || selectedExpense.name, amount: parseFloat(amount) || selectedExpense.amount }); setSelectedExpense(null); } }} className="py-2.5 bg-amber-500/20 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/40">تعديل</button>
              <button onClick={() => { if (confirm('أرشفة هذا المصروف؟')) { archiveExpense(selectedExpense.id); setSelectedExpense(null); } }} className="py-2.5 bg-rose-600/20 text-rose-400 font-bold rounded-xl text-xs border border-rose-600/40">أرشفة</button>
              <button onClick={() => { if (confirm('حذف نهائي؟ لا يمكن الاستعادة.')) { deleteExpense(selectedExpense.id); setSelectedExpense(null); } }} className="py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs border border-slate-700">حذف</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
