import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  Calendar,
  X,
  Building2,
  UserCheck,
  ChevronLeft
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum, formatInvoiceDate, kCurrency } from '../../core/format';
import { Expense } from '../../types';

export const ExpensesScreen: React.FC = () => {
  const {
    expenses,
    partners,
    addExpense,
    deleteExpense,
  } = useGoldStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'general' | 'private'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | '7days' | 'month'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [targetType, setTargetType] = useState<'عام' | 'خاص'>('عام');
  const [selectedPartner, setSelectedPartner] = useState<string>(partners[0]?.name || 'السر الصائغ');
  const [notes, setNotes] = useState('');

  const handleOpenAdd = () => {
    setName('');
    setAmount('');
    setTargetType('عام');
    setSelectedPartner(partners[0]?.name || '');
    setNotes('');
    setShowAddModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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

  // Filter & Search Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      // Type Filter
      if (filterType === 'general' && item.target !== 'عام' && item.target) {
        return false;
      }
      if (filterType === 'private' && (item.target === 'عام' || !item.target)) {
        return false;
      }

      // Period Filter
      if (filterPeriod !== 'all') {
        const itemDate = new Date(item.date);
        const now = new Date();
        if (filterPeriod === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false;
        } else if (filterPeriod === '7days') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (filterPeriod === 'month') {
          if (
            itemDate.getMonth() !== now.getMonth() ||
            itemDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }
      }

      // Search Query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.target && item.target.toLowerCase().includes(q)) ||
        item.amount.toString().includes(q)
      );
    });
  }, [expenses, filterType, filterPeriod, searchQuery]);

  // Totals for Summary Row
  const totalAmountSum = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const generalSum = filteredExpenses
    .filter((e) => e.target === 'عام' || !e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const privateSum = filteredExpenses
    .filter((e) => e.target !== 'عام' && e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalGeneralCount = expenses.filter((e) => e.target === 'عام' || !e.target).length;
  const totalPrivateCount = expenses.filter((e) => e.target !== 'عام' && e.target).length;

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-200">
      
      {/* 1. Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالمصروف أو البيان أو الشريك أو المبلغ..."
          className="w-full bg-slate-900 border border-slate-800 focus:border-rose-400 rounded-2xl py-3 px-4 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none shadow-md transition-colors"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* 2. Type Filter Tabs (كل المنصرفات / عامة فقط / خاصة فقط) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            filterType === 'all'
              ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <span>كل المنصرفات ({expenses.length})</span>
        </button>

        <button
          onClick={() => setFilterType('general')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            filterType === 'general'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>عامة فقط ({totalGeneralCount})</span>
        </button>

        <button
          onClick={() => setFilterType('private')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            filterType === 'private'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>خاصة فقط ({totalPrivateCount})</span>
        </button>
      </div>

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

      {/* 3. Table Container (Exact Match to Purchases / Sales Table List Design) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Table Column Headers (Rose/Amber Themed) */}
        <div className="bg-rose-500/15 border-b border-rose-500/30 text-rose-400 px-3 py-3 grid grid-cols-12 text-center text-xs font-black">
          <div className="col-span-3">تاريخ</div>
          <div className="col-span-4">بيان المصروف</div>
          <div className="col-span-2">النوع</div>
          <div className="col-span-3">المبلغ</div>
        </div>

        {/* Table Rows List */}
        <div className="divide-y divide-slate-800/80 max-h-[60vh] overflow-y-auto">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs space-y-2">
              <TrendingDown className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p>لا توجد منصرفات مسجلة في هذه الفترة</p>
            </div>
          ) : (
            filteredExpenses.map((item) => {
              const isGeneral = item.target === 'عام' || !item.target;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedExpense(item)}
                  className="px-3 py-3.5 grid grid-cols-12 items-center text-center text-xs hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="col-span-3 text-slate-300 font-mono text-[11px] truncate">
                    {formatInvoiceDate(item.date)}
                  </div>

                  <div className="col-span-4 text-white font-bold text-xs truncate px-1 text-right sm:text-center">
                    {item.name}
                  </div>

                  <div className="col-span-2">
                    {isGeneral ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-bold text-[10px] truncate block">
                        عام
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 font-bold text-[10px] truncate block">
                        {item.target}
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 text-rose-400 font-mono font-black text-xs truncate">
                    {fmtNum(item.amount)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Bottom Sticky Summary Row (الإجمالي مع الجمع التلقائي) */}
        <div className="bg-rose-500/20 border-t-2 border-rose-500/50 px-3 py-3.5 grid grid-cols-12 text-center font-black text-xs text-rose-300 items-center">
          <div className="col-span-3">الإجمالي</div>
          <div className="col-span-6 text-[11px] text-slate-300 truncate">
            عامة: <b className="text-amber-400 font-mono">{fmtNum(generalSum)}</b> • خاصة: <b className="text-cyan-400 font-mono">{fmtNum(privateSum)}</b>
          </div>
          <div className="col-span-3 font-mono text-rose-400 text-sm truncate">
            {fmtNum(totalAmountSum)}
          </div>
        </div>

      </div>

      {/* Floating Action Button: + تسجيل مصروف */}
      <div className="fixed bottom-20 right-4 z-30">
        <button
          onClick={handleOpenAdd}
          className="bg-gradient-to-r from-rose-500 via-rose-600 to-rose-500 hover:from-rose-600 text-white font-black px-5 py-3 rounded-2xl shadow-2xl shadow-rose-500/30 flex items-center gap-2 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5 text-white" />
          <span className="text-sm">تسجيل مصروف</span>
        </button>
      </div>

      {/* Modal: Add New Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveExpense}
            className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-white relative animate-in zoom-in-95 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-rose-400 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                <span>تسجيل مصروف جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Expense Name / Statement */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                بيان المصروف (الاسم):
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
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

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

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  if (confirm('هل تريد حذف هذا المصروف؟')) {
                    deleteExpense(selectedExpense.id);
                    setSelectedExpense(null);
                  }
                }}
                className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold rounded-xl text-xs border border-rose-600/40"
              >
                حذف المصروف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
