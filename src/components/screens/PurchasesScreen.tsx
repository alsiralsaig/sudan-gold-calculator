import React, { useState } from 'react';
import { ShoppingBag, Plus, Trash2, Edit2, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { weightToUnits, unitsToWeight, unitsToGramsDecimal, fmtMoney, fmtNum, kCurrency } from '../../core/format';
import { Purchase } from '../../types';

export const PurchasesScreen: React.FC = () => {
  const { purchases, addPurchase, updatePurchase, deletePurchase, addPaymentToPurchase } = useGoldStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Purchase | null>(null);

  // Form State
  const [grams, setGrams] = useState('');
  const [habba, setHabba] = useState('0');
  const [juz, setJuz] = useState('0');
  const [purity, setPurity] = useState<number>(21);
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [seller, setSeller] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');

  // Payment Modal State
  const [newPayAmount, setNewPayAmount] = useState('');
  const [newPayNote, setNewPayNote] = useState('');

  const handleOpenAdd = () => {
    setGrams('');
    setHabba('0');
    setJuz('0');
    setPurity(21);
    setAmount('');
    setPaidAmount('');
    setSeller('');
    setBankAccount('');
    setNotes('');
    setShowAddModal(true);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams) || 0;
    const h = parseFloat(habba) || 0;
    const j = parseFloat(juz) || 0;
    const totalUnits = weightToUnits(g, h, j);
    const totalCost = parseFloat(amount) || 0;
    const initialPaid = parseFloat(paidAmount) || 0;
    const pending = Math.max(0, totalCost - initialPaid);

    addPurchase({
      date: new Date().toISOString(),
      units: totalUnits,
      purity,
      amount: totalCost,
      pendingAmount: pending,
      seller: seller.trim() || 'تاجر مجهول',
      bankAccount: bankAccount.trim(),
      notes: notes.trim(),
    });

    setShowAddModal(false);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;
    const pVal = parseFloat(newPayAmount) || 0;
    if (pVal <= 0) return;

    addPaymentToPurchase(showPaymentModal.id, {
      date: new Date().toISOString(),
      amount: pVal,
      note: newPayNote.trim() || 'دفعة سداد دين',
    });

    setShowPaymentModal(null);
    setNewPayAmount('');
    setNewPayNote('');
  };

  const totalPurchasedUnits = purchases.reduce((sum, p) => sum + p.units, 0);
  const totalPurchasesCost = purchases.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingDebt = purchases.reduce((sum, p) => sum + p.pendingAmount, 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Top Summary Card */}
      <div className="bg-gradient-to-br from-blue-500/20 via-slate-900 to-slate-950 p-5 rounded-3xl border-2 border-blue-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-blue-300 font-bold block">إجمالي مشتريات الذهب</span>
            <div className="text-2xl font-black text-white font-mono mt-0.5">
              {fmtMoney(totalPurchasesCost)}
            </div>
          </div>
          <div className="text-left bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-bold">الديون المتبقية</span>
            <span className="text-base font-black text-rose-400 font-mono">
              {fmtMoney(totalPendingDebt)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400">إجمالي الوزن المشترى:</span>
          <span className="font-bold text-amber-400">
            {unitsToGramsDecimal(totalPurchasedUnits).toFixed(2)} جرام ({unitsToWeight(totalPurchasedUnits)})
          </span>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/40">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-base text-white">سجل فواتير المشتريات</h3>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 text-white font-black text-xs rounded-2xl shadow-lg flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>شراء جديد</span>
        </button>
      </div>

      {/* Purchases List */}
      <div className="space-y-4">
        {purchases.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-bold">لا توجد عمليات شراء مسجلة حتى الآن</p>
          </div>
        ) : (
          purchases.map((pch) => {
            const gramsVal = unitsToGramsDecimal(pch.units);
            const isFullyPaid = pch.pendingAmount <= 0;

            return (
              <div
                key={pch.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-3xl p-5 shadow-lg space-y-3 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-base text-white">{pch.seller}</h4>
                      <span className="px-2 py-0.5 bg-slate-800 text-amber-400 text-[11px] font-bold rounded-lg border border-slate-700">
                        عيار {pch.purity}k
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {new Date(pch.date).toLocaleDateString('ar-SD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف فاتورة الشراء؟`)) {
                          deletePurchase(pch.id);
                        }
                      }}
                      className="p-2 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">الوزن المشترى</span>
                    <span className="font-mono font-black text-amber-400">
                      {gramsVal.toFixed(2)} ج
                    </span>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {unitsToWeight(pch.units)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">إجمالي الفاتورة</span>
                    <span className="font-mono font-black text-white">
                      {fmtNum(pch.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">المتبقي (الدين)</span>
                    <span className={`font-mono font-black ${isFullyPaid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isFullyPaid ? 'مسدد بالكامل' : fmtNum(pch.pendingAmount)}
                    </span>
                  </div>
                </div>

                {/* Payments Section */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    {pch.bankAccount && <span>الحساب: {pch.bankAccount} • </span>}
                    {pch.notes && <span>{pch.notes}</span>}
                  </div>

                  {!isFullyPaid && (
                    <button
                      onClick={() => {
                        setShowPaymentModal(pch);
                        setNewPayAmount(pch.pendingAmount.toString());
                      }}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/40 flex items-center gap-1 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>سداد دفعة</span>
                    </button>
                  )}
                </div>

                {pch.payments && pch.payments.length > 0 && (
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">سجل الدفعات السابقة:</span>
                    {pch.payments.map((pm) => (
                      <div key={pm.id} className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>{new Date(pm.date).toLocaleDateString('ar-SD')} - {pm.note}</span>
                        <span className="font-mono text-emerald-400 font-bold">{fmtMoney(pm.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSavePurchase}
            className="bg-slate-900 border-2 border-blue-500/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-white my-auto animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-blue-400">إضافة فاتورة شراء ذهب</h3>
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
                <label className="block text-slate-300 font-bold mb-1">اسم التاجر / البائع</label>
                <input
                  type="text"
                  required
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  placeholder="مثال: مجمع الذهب - المحل 12"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400 font-mono"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400 font-mono"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">العيار</label>
                  <select
                    value={purity}
                    onChange={(e) => setPurity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400"
                  >
                    <option value={18}>18k</option>
                    <option value={21}>21k</option>
                    <option value={22}>22k</option>
                    <option value={24}>24k</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">إجمالي المبلغ ({kCurrency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (!paidAmount) setPaidAmount(e.target.value);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">المبلغ المدفوع كاش/بنكك الآن ({kCurrency})</label>
                <input
                  type="number"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="إذا لم تدفع كامل المبلغ، سيتم قيد الباقي كدين"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">رقم الحساب / بنكك (اختياري)</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="حساب بنك الخرطوم..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ملاحظات الفاتورة</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تفاصيل إضافية..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-400"
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
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 text-white font-black rounded-xl text-xs shadow-md"
              >
                حفظ الفاتورة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pay Debt Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddPayment}
            className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-emerald-400">سداد دفعة من الدين</h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1">
              <span className="text-slate-400">البائع: <b className="text-white">{showPaymentModal.seller}</b></span>
              <div className="text-rose-400 font-mono font-bold">
                المتبقي الحالي: {fmtMoney(showPaymentModal.pendingAmount)}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">مبلغ الدفعة ({kCurrency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newPayAmount}
                  onChange={(e) => setNewPayAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">بيان السداد (بنكك / كاش)</label>
                <input
                  type="text"
                  value={newPayNote}
                  onChange={(e) => setNewPayNote(e.target.value)}
                  placeholder="سداد تحويل بنكك"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                تأكيد السداد
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
