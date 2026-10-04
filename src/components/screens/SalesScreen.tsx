import React, { useState } from 'react';
import { DollarSign, Plus, Trash2, ArrowUpRight, TrendingUp } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { weightToUnits, unitsToWeight, unitsToGramsDecimal, fmtMoney, fmtNum, kCurrency } from '../../core/format';
import { Sale } from '../../types';

export const SalesScreen: React.FC = () => {
  const { sales, addSale, deleteSale, totalSales, totalCost, grossProfit } = useGoldStore();

  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [grams, setGrams] = useState('');
  const [habba, setHabba] = useState('0');
  const [juz, setJuz] = useState('0');
  const [purity, setPurity] = useState<number>(21);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [buyer, setBuyer] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenAdd = () => {
    setGrams('');
    setHabba('0');
    setJuz('0');
    setPurity(21);
    setBuyAmount('');
    setSellAmount('');
    setBuyer('');
    setNotes('');
    setShowAddModal(true);
  };

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams) || 0;
    const h = parseFloat(habba) || 0;
    const j = parseFloat(juz) || 0;
    const totalUnits = weightToUnits(g, h, j);

    addSale({
      date: new Date().toISOString(),
      units: totalUnits,
      purity,
      buyAmount: parseFloat(buyAmount) || 0,
      sellAmount: parseFloat(sellAmount) || 0,
      buyer: buyer.trim() || 'زبون عام',
      notes: notes.trim(),
    });

    setShowAddModal(false);
  };

  const totalSoldUnits = sales.reduce((sum, s) => sum + s.units, 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Top Summary Card */}
      <div className="bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 p-5 rounded-3xl border-2 border-emerald-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-300 font-bold block">إجمالي إيرادات المبيعات</span>
            <div className="text-2xl font-black text-white font-mono mt-0.5">
              {fmtMoney(totalSales)}
            </div>
          </div>
          <div className="text-left bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">مجمل الربح (قبل المصاريف)</span>
            <span className={`text-base font-black font-mono ${grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtMoney(grossProfit)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400">إجمالي الذهب المباع:</span>
          <span className="font-bold text-amber-400">
            {unitsToGramsDecimal(totalSoldUnits).toFixed(2)} جرام ({unitsToWeight(totalSoldUnits)})
          </span>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40">
            <DollarSign className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-base text-white">سجل فواتير المبيعات</h3>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 text-slate-950 font-black text-xs rounded-2xl shadow-lg flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>بيع جديد</span>
        </button>
      </div>

      {/* Sales List */}
      <div className="space-y-4">
        {sales.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-2">
            <DollarSign className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-bold">لا توجد عمليات بيع مسجلة حتى الآن</p>
          </div>
        ) : (
          sales.map((sal) => {
            const gramsVal = unitsToGramsDecimal(sal.units);
            const profit = sal.sellAmount - sal.buyAmount;

            return (
              <div
                key={sal.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-5 shadow-lg space-y-3 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-base text-white">{sal.buyer}</h4>
                      <span className="px-2 py-0.5 bg-slate-800 text-amber-400 text-[11px] font-bold rounded-lg border border-slate-700">
                        عيار {sal.purity}k
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {new Date(sal.date).toLocaleDateString('ar-SD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف فاتورة البيع؟`)) {
                        deleteSale(sal.id);
                      }
                    }}
                    className="p-2 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">الوزن المباع</span>
                    <span className="font-mono font-black text-amber-400">
                      {gramsVal.toFixed(2)} ج
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">التكلفة</span>
                    <span className="font-mono font-black text-slate-300">
                      {fmtNum(sal.buyAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">سعر البيع</span>
                    <span className="font-mono font-black text-white">
                      {fmtNum(sal.sellAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ربح العملية</span>
                    <span className={`font-mono font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtNum(profit)}
                    </span>
                  </div>
                </div>

                {sal.notes && (
                  <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                    {sal.notes}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveSale}
            className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-white my-auto animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-emerald-400">إضافة فاتورة بيع جديدة</h3>
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
                <label className="block text-slate-300 font-bold mb-1">اسم المشتري / الزبون</label>
                <input
                  type="text"
                  required
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value)}
                  placeholder="مثال: أحمد عثمان"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Weight Inputs (Gram, Habba, Juz) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">جرام (g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">حبة (ح)</label>
                  <input
                    type="number"
                    step="any"
                    value={habba}
                    onChange={(e) => setHabba(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">جزء (ز)</label>
                  <input
                    type="number"
                    step="any"
                    value={juz}
                    onChange={(e) => setJuz(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">العيار</label>
                  <select
                    value={purity}
                    onChange={(e) => setPurity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value={18}>18k</option>
                    <option value={21}>21k</option>
                    <option value={22}>22k</option>
                    <option value={24}>24k</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">سعر البيع (المقبوض)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400"
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
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                حفظ البيع
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
