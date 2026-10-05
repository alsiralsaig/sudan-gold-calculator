import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Archive,
  Edit2,
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  Calendar,
  X,
  ChevronLeft
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  weightToUnits,
  unitsToGhJ,
  unitsToWeight,
  unitsToGramsDecimal,
  kUnitsPerGram,
  kUnitsPerHabba,
  fmtMoney,
  fmtNum,
  formatInvoiceDate,
  kCurrency
} from '../../core/format';
import { Purchase } from '../../types';

export const PurchasesScreen: React.FC = () => {
  const {
    purchases,
    addPurchase,
    updatePurchase,
    archivePurchase,
    deletePurchase,
    addPaymentToPurchase,
    rates,
  } = useGoldStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | '7days' | 'month'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Purchase | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkSeller, setBulkSeller] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkPurity, setBulkPurity] = useState('');

  // Form State
  const [grams, setGrams] = useState('');
  const [habba, setHabba] = useState('');
  const [juz, setJuz] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [customKarat, setCustomKarat] = useState<string>('21');
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [seller, setSeller] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');

  // Payment Modal State
  const [newPayAmount, setNewPayAmount] = useState('');
  const [newPayNote, setNewPayNote] = useState('');

  // Auto-calculate Total Amount when Weight or Price changes
  const handleWeightOrPriceChange = (
    newG: string,
    newH: string,
    newJ: string,
    newP: string
  ) => {
    const g = parseFloat(newG) || 0;
    const h = parseFloat(newH) || 0;
    const j = parseFloat(newJ) || 0;
    const p = parseFloat(newP) || 0;

    const totalU = weightToUnits(g, h, j);
    const totalG = unitsToGramsDecimal(totalU);
    if (p > 0 && totalG > 0) {
      const calculated = Math.round(totalG * p);
      setAmount(calculated.toString());
      setPaidAmount(calculated.toString());
    }
  };

  const resetPurchaseForm = () => {
    setEditingPurchase(null);
    setGrams('');
    setHabba('');
    setJuz('');
    setPricePerGram('');
    setCustomKarat('21');
    setAmount('');
    setPaidAmount('');
    setSeller('');
    setBankAccount('');
    setNotes('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setGrams(Math.floor(purchase.units / kUnitsPerGram).toString());
    setHabba(Math.floor((purchase.units % kUnitsPerGram) / kUnitsPerHabba).toString());
    setJuz((purchase.units % kUnitsPerHabba).toString());
    setPricePerGram('');
    setCustomKarat(purchase.purity > 0 ? purchase.purity.toString() : '-');
    setAmount(purchase.amount.toString());
    setPaidAmount(Math.max(0, purchase.amount - purchase.pendingAmount).toString());
    setSeller(purchase.seller || '');
    setBankAccount(purchase.bankAccount || '');
    setNotes(purchase.notes || '');
    setSelectedPurchase(null);
    setShowAddModal(true);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams) || 0;
    const h = parseFloat(habba) || 0;
    const j = parseFloat(juz) || 0;
    const totalUnits = weightToUnits(g, h, j);
    const totalCost = parseFloat(amount) || 0;

    if (totalUnits <= 0 && totalCost <= 0) {
      alert('يرجى إدخال الوزن (جرام أو حبة أو جزء) أو المبلغ');
      return;
    }

    const initialPaid = paidAmount !== '' ? (parseFloat(paidAmount) || 0) : totalCost;
    const pending = Math.max(0, totalCost - initialPaid);
    const karatNum = customKarat === '-' ? 0 : parseFloat(customKarat) || 0;

    const purchaseData = {
      date: editingPurchase?.date || new Date().toISOString(),
      units: totalUnits,
      purity: karatNum,
      amount: totalCost,
      pendingAmount: pending,
      seller: seller.trim() || 'بائع عام',
      bankAccount: bankAccount.trim(),
      notes: notes.trim(),
    };

    if (editingPurchase) {
      updatePurchase({ ...editingPurchase, ...purchaseData });
    } else {
      addPurchase(purchaseData);
    }

    setEditingPurchase(null);
    setShowAddModal(false);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    const payVal = parseFloat(newPayAmount) || 0;
    if (payVal <= 0) return;

    addPaymentToPurchase(showPaymentModal.id, {
      date: new Date().toISOString(),
      amount: payVal,
      note: newPayNote.trim() || 'سداد دفعة',
    });

    setShowPaymentModal(null);
    setNewPayAmount('');
    setNewPayNote('');
  };

  // Filter & Search Logic
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => !item.archived).filter((item) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.seller.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        item.amount.toString().includes(q) ||
        unitsToGhJ(item.units).includes(q);

      if (!matchSearch) return false;

      // Period Filter
      if (filterPeriod === 'all') return true;
      const itemDate = new Date(item.date);
      const now = new Date();
      if (filterPeriod === 'today') {
        return itemDate.toDateString() === now.toDateString();
      }
      if (filterPeriod === '7days') {
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (filterPeriod === 'month') {
        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [purchases, searchQuery, filterPeriod]);

  // Totals for Summary Row
  const totalUnitsSum = filteredPurchases.reduce((sum, p) => sum + (p.units || 0), 0);
  const totalAmountSum = filteredPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPendingSum = filteredPurchases.reduce((sum, p) => sum + (p.pendingAmount || 0), 0);

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-200">
      
      {/* 1. Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالبائع أو الملاحظات أو المبلغ..."
          className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-2xl py-3 px-4 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none shadow-md transition-colors"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* 2. Filter Pills */}
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
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterPeriod === tab.id
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            {filterPeriod === tab.id && ' ✓'}
          </button>
        ))}
      </div>

      {/* Bulk actions apply to the currently visible filtered records only */}
      {filteredPurchases.length > 0 && <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-3 space-y-2">
        <div className="text-[11px] text-slate-400">إجراءات الصفحة على {fmtNum(filteredPurchases.length)} فاتورة ظاهرة</div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => { if (confirm(`أرشفة ${filteredPurchases.length} فاتورة ظاهرة؟`)) filteredPurchases.forEach(p => archivePurchase(p.id)); }} className="py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black">أرشفة الكل</button>
          <button onClick={() => setShowBulkEdit(true)} className="py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-black">تعديل الكل</button>
          <button onClick={() => { if (confirm(`حذف نهائي لـ ${filteredPurchases.length} فاتورة؟ لا يمكن الاستعادة.`)) filteredPurchases.forEach(p => deletePurchase(p.id)); }} className="py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black">حذف الكل</button>
        </div>
      </div>}

      {/* 3. Table Container (Exact Match to Screenshot 1) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className="min-w-[680px]">
        
        {/* Table Column Headers (Amber Themed) */}
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-400 px-3 py-3 grid grid-cols-6 text-center text-xs font-black">
          <div>التاريخ</div>
          <div>الوزن</div>
          <div>العيار</div>
          <div>المبلغ</div>
          <div>المتبقي</div>
          <div>ملاحظات</div>
        </div>

        {/* Table Rows List */}
        <div className="divide-y divide-slate-800/80 max-h-[60vh] overflow-y-auto">
          {filteredPurchases.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs space-y-2">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p>لا توجد فواتير شراء مسجلة في هذه الفترة</p>
            </div>
          ) : (
            filteredPurchases.map((pch) => {
              const isPaid = (pch.pendingAmount || 0) === 0;

              return (
                <div
                  key={pch.id}
                  onClick={() => setSelectedPurchase(pch)}
                  className="px-3 py-3.5 grid grid-cols-6 items-center text-center text-xs hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="text-slate-300 font-mono text-[11px] truncate">
                    {formatInvoiceDate(pch.date)}
                  </div>

                  <div className="text-white font-mono font-bold text-xs truncate">
                    {unitsToGhJ(pch.units)}
                  </div>

                  <div className="text-slate-300 font-mono text-xs">
                    {pch.purity > 0 ? `${pch.purity}k` : '—'}
                  </div>

                  <div className="text-white font-mono font-black text-xs truncate">
                    {fmtNum(pch.amount)}
                  </div>

                  <div>
                    {isPaid ? (
                      <span className="text-emerald-400 font-bold text-[11px]">مسدَّد</span>
                    ) : (
                      <span className="text-amber-400 font-mono font-bold text-xs">
                        {fmtNum(pch.pendingAmount)}
                      </span>
                    )}
                  </div>

                  <div className="text-slate-400 text-[10px] truncate" title={pch.notes || ''}>
                    {pch.notes || '—'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Bottom Sticky Summary Row (الإجمالي) */}
        <div className="sticky bottom-0 z-20 bg-amber-500/95 border-t-2 border-amber-500/70 px-3 py-3 grid grid-cols-6 text-center font-black text-xs text-amber-300">
          <div>الإجمالي</div>
          <div className="font-mono text-amber-400 text-sm">{unitsToGhJ(totalUnitsSum)}</div>
          <div>—</div>
          <div className="font-mono text-amber-400 text-sm truncate">{fmtNum(totalAmountSum)}</div>
          <div className="font-mono text-rose-400 text-sm truncate">{fmtNum(totalPendingSum)}</div>
          <div>—</div>
        </div>
          </div>
        </div>

      </div>

      {/* Floating Action Button: + مشترى جديد */}
      <div className="fixed bottom-5 right-4 z-30">
        <button
          onClick={resetPurchaseForm}
          className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl shadow-2xl shadow-amber-500/30 flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          <span className="text-xs">مشترى جديد</span>
        </button>
      </div>

      {/* Modal: Add New Purchase Invoice */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSavePurchase}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-white relative animate-in zoom-in-95 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-amber-400 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span>{editingPurchase ? 'تعديل فاتورة الشراء' : 'إضافة فاتورة شراء جديدة'}</span>
              </h3>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingPurchase(null); }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Weight Inputs: [جرام] [حبة] [جزء] */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                الوزن (جرام أو حبات أو أجزاء):
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 text-center">جرام</span>
                  <input
                    type="number"
                    step="any"
                    value={grams}
                    onChange={(e) => {
                      setGrams(e.target.value);
                      handleWeightOrPriceChange(e.target.value, habba, juz, pricePerGram);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-center font-mono font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 text-center">حبة</span>
                  <input
                    type="number"
                    step="any"
                    value={habba}
                    onChange={(e) => {
                      setHabba(e.target.value);
                      handleWeightOrPriceChange(grams, e.target.value, juz, pricePerGram);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-center font-mono font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 text-center">جزء</span>
                  <input
                    type="number"
                    step="any"
                    value={juz}
                    onChange={(e) => {
                      setJuz(e.target.value);
                      handleWeightOrPriceChange(grams, habba, e.target.value, pricePerGram);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-center font-mono font-bold focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Price Per Gram & Auto Calculation */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  سعر الجرام ({kCurrency}) (اختياري):
                </label>
                <input
                  type="number"
                  step="any"
                  value={pricePerGram}
                  onChange={(e) => {
                    setPricePerGram(e.target.value);
                    handleWeightOrPriceChange(grams, habba, juz, e.target.value);
                  }}
                  placeholder="اتركه فارغاً وأدخل الإجمالي يدوياً"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  المبلغ الإجمالي ({kCurrency}):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-amber-400 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none text-right"
                />
              </div>
            </div>

            {/* Paid Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                المبلغ المدفوع كاش/بنكك ({kCurrency}):
              </label>
              <input
                type="number"
                step="any"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="اتركه فارغاً إذا تم سداده كاملاً"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none text-right"
              />
            </div>

            {/* Karat Selection (Manual / Custom or Standard) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                العيار (تحديد يدوي أو اختياري):
              </label>
              
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {['-', '18', '21', '22', '24'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCustomKarat(k)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      customKarat === k
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {k === '-' ? 'بدون (-)' : `${k}k`}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={customKarat === '-' ? '' : customKarat}
                onChange={(e) => setCustomKarat(e.target.value || '-')}
                placeholder="أو اكتب عيار يدوي مخصص (مثال: 19.5 أو 21.2)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none text-right"
              />
            </div>

            {/* Seller & Notes */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم البائع:</label>
                <input
                  type="text"
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                  placeholder="محمد أحمد"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ذهب كسر / مسبوك"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
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
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                {editingPurchase ? 'حفظ التعديلات' : 'حفظ المشترى'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkEdit && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
        <form onSubmit={(e) => { e.preventDefault(); filteredPurchases.forEach(p => updatePurchase({ ...p, seller: bulkSeller.trim() || p.seller, notes: bulkNotes.trim() || p.notes, purity: bulkPurity === '' ? p.purity : (parseFloat(bulkPurity) || 0) })); setShowBulkEdit(false); setBulkSeller(''); setBulkNotes(''); setBulkPurity(''); }} className="bg-slate-900 border-2 border-blue-500/50 rounded-3xl p-5 max-w-sm w-full space-y-4">
          <div className="flex justify-between items-center"><h3 className="font-black text-blue-300">تعديل الفواتير الظاهرة</h3><button type="button" onClick={() => setShowBulkEdit(false)} className="text-slate-400 text-xl">✕</button></div>
          <p className="text-xs text-slate-400">اترك أي حقل فارغاً للاحتفاظ بقيمته الحالية.</p>
          <input value={bulkSeller} onChange={e => setBulkSeller(e.target.value)} placeholder="البائع الجديد" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm" />
          <input value={bulkPurity} onChange={e => setBulkPurity(e.target.value)} placeholder="العيار الجديد" inputMode="decimal" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm" />
          <textarea value={bulkNotes} onChange={e => setBulkNotes(e.target.value)} placeholder="الملاحظات الجديدة" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm" />
          <button className="w-full py-3 rounded-xl bg-blue-500 text-slate-950 font-black">حفظ التعديل الجماعي</button>
        </form>
      </div>}

      {/* Modal: View / Pay Selected Purchase */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-amber-400">تفاصيل فاتورة الشراء</h3>
              <button
                onClick={() => setSelectedPurchase(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">التاريخ:</span>
                <span className="font-mono text-white">{formatInvoiceDate(selectedPurchase.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الوزن:</span>
                <span className="font-mono text-amber-400 font-bold">{unitsToGhJ(selectedPurchase.units)} ({unitsToWeight(selectedPurchase.units)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">العيار:</span>
                <span className="font-mono text-white">{selectedPurchase.purity > 0 ? `${selectedPurchase.purity}k` : 'بدون عيار'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">إجمالي المبلغ:</span>
                <span className="font-mono text-emerald-400 font-bold">{fmtMoney(selectedPurchase.amount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">المتبقي (المديونية):</span>
                <span className={`font-mono font-bold ${selectedPurchase.pendingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedPurchase.pendingAmount > 0 ? fmtMoney(selectedPurchase.pendingAmount) : 'مسدَّد بالكامل ✓'}
                </span>
              </div>
              {selectedPurchase.seller && (
                <div className="flex justify-between">
                  <span className="text-slate-400">البائع:</span>
                  <span className="text-white">{selectedPurchase.seller}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleOpenEdit(selectedPurchase)}
                className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black rounded-xl text-xs border border-amber-500/40 flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                تعديل
              </button>
              {selectedPurchase.pendingAmount > 0 && (
                <button
                  onClick={() => {
                    setShowPaymentModal(selectedPurchase);
                    setSelectedPurchase(null);
                  }}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
                >
                  تسديد دفعة
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm('هل تريد أرشفة هذه الفاتورة؟ ستبقى محفوظة ويمكن استعادتها من الأرشيف.')) {
                    archivePurchase(selectedPurchase.id);
                    setSelectedPurchase(null);
                  }
                }}
                className="py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold rounded-xl text-xs border border-rose-600/40"
              >
                <Archive className="w-4 h-4" />
                أرشفة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Payment */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddPayment}
            className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-emerald-400">تسديد دفعة للبائع</h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">مبلغ الدفعة ({kCurrency}):</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newPayAmount}
                  onChange={(e) => setNewPayAmount(e.target.value)}
                  placeholder={showPaymentModal.pendingAmount.toString()}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold focus:border-emerald-400 focus:outline-none text-right"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">بيان السداد (بنكك / كاش):</label>
                <input
                  type="text"
                  value={newPayNote}
                  onChange={(e) => setNewPayNote(e.target.value)}
                  placeholder="سداد تحويل بنكك"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
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
