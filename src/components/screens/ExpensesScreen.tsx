import React, { useState } from 'react';
import { TrendingDown, Plus, Trash2, Tag, Layers, UserCheck } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtMoney, fmtNum, kCurrency } from '../../core/format';
import { Expense } from '../../types';

export const ExpensesScreen: React.FC = () => {
  const { expenses, partners, generalExpenses, privateExpenses, addExpense, deleteExpense } = useGoldStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [filterTarget, setFilterTarget] = useState<string>('all');

  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('إيجار ومحل');
  const [target, setTarget] = useState('عام');
  const [notes, setNotes] = useState('');

  const handleOpenAdd = () => {
    setName('');
    setAmount('');
    setCategory('إيجار ومحل');
    setTarget('عام');
    setNotes('');
    setShowAddModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addExpense({
      date: new Date().toISOString(),
      name: name.trim(),
      amount: parseFloat(amount) || 0,
      category,
      target,
      notes: notes.trim(),
    });

    setShowAddModal(false);
  };

  const filteredExpenses = expenses.filter((item) => {
    if (filterTarget === 'all') return true;
    if (filterTarget === 'عام') return item.target === 'عام' || !item.target;
    return item.target === filterTarget;
  });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-4 rounded-3xl border-2 border-amber-500/40 shadow-lg space-y-1">
          <span className="text-xs text-amber-300 font-bold block">منصرفات عامة (مشتركة)</span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {fmtMoney(generalExpenses)}
          </div>
          <span className="text-[10px] text-slate-400 block">تُخصم من الأرباح العامة</span>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/20 via-slate-900 to-slate-950 p-4 rounded-3xl border-2 border-cyan-500/40 shadow-lg space-y-1">
          <span className="text-xs text-cyan-300 font-bold block">منصرفات الشركاء الخاصة</span>
          <div className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
            {fmtMoney(privateExpenses)}
          </div>
          <span className="text-[10px] text-slate-400 block">تُخصم من مستحق الشريك فقط</span>
        </div>
      </div>

      {/* Action Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/40">
            <TrendingDown className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-base text-white">سجل المصروفات والنثريات</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Target Filter */}
          <select
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
          >
            <option value="all">كل المنصرفات</option>
            <option value="عام">عامة فقط</option>
            {partners.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مصروف</span>
          </button>
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-2">
            <TrendingDown className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-bold">لا توجد منصرفات مسجلة في هذا القسم</p>
          </div>
        ) : (
          filteredExpenses.map((exp) => {
            const isGeneral = exp.target === 'عام' || !exp.target;

            return (
              <div
                key={exp.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">{exp.name}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                        isGeneral
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {isGeneral ? 'عام' : `خاص: ${exp.target}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{exp.category}</span>
                    <span>•</span>
                    <span>
                      {new Date(exp.date).toLocaleDateString('ar-SD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm sm:text-base font-black text-rose-400 font-mono">
                    {fmtMoney(exp.amount)}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف بند المصروف (${exp.name})؟`)) {
                        deleteExpense(exp.id);
                      }
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveExpense}
            className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-rose-400">تسجيل منصرف جديد</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم / بيان المنصرف</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: إيجار المحل، عمالة، كهرباء..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">المبلغ ({kCurrency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نوع المنصرف</label>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-rose-400"
                  >
                    <option value="عام">عام (يُخصم من المحل)</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        خاص بالشريك: {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-rose-400"
                  >
                    <option value="إيجار ومحل">إيجار ومحل</option>
                    <option value="كهرباء وإنترنت">كهرباء وإنترنت</option>
                    <option value="نثريات وضيافة">نثريات وضيافة</option>
                    <option value="أجور وعمالة">أجور وعمالة</option>
                    <option value="مسحوبات شخصية">مسحوبات شخصية</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل أخرى..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
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
                حفظ المنصرف
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
