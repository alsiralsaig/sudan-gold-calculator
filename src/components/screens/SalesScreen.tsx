import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  Calendar,
  X,
  ChevronLeft,
  ArrowUpRight
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
import { Sale } from '../../types';

export const SalesScreen: React.FC = () => {
  const {
    sales,
    addSale,
    updateSale,
    archiveSale,
    deleteSale,
    rates,
  } = useGoldStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | '7days' | 'month'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Form State
  const [grams, setGrams] = useState('');
  const [habba, setHabba] = useState('');
  const [juz, setJuz] = useState('');
  const [sellPricePerGram, setSellPricePerGram] = useState('');
  const [buyCostPricePerGram, setBuyCostPricePerGram] = useState('');
  const [customKarat, setCustomKarat] = useState<string>('21');
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [buyer, setBuyer] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-calculate Total Sell & Buy Amounts when Weight or Price changes
  const handleWeightOrPriceChange = (
    newG: string,
    newH: string,
    newJ: string,
    newSellP: string,
    newBuyP: string,
    karatOverride?: string
  ) => {
    const g = parseFloat(newG) || 0;
    const h = parseFloat(newH) || 0;
    const j = parseFloat(newJ) || 0;
    const sp = parseFloat(newSellP) || 0;
    const enteredPurity = parseFloat(karatOverride ?? customKarat) || 0;
    const fineness = enteredPurity > 0 && enteredPurity <= 24
      ? (enteredPurity / 24) * 1000
      : enteredPurity;
    const purityRatio = fineness > 0 ? fineness / 875 : 0;

    const totalU = weightToUnits(g, h, j);
    const totalG = unitsToGramsDecimal(totalU);
    if (totalG > 0 && sp > 0 && purityRatio > 0) {
      // Sale value is based on the entered purity, converted to 21k (875).
      // Example: 6g at 650 purity = 6 × 956,468 × 650 / 875.
      setSellAmount(Math.round(totalG * sp * purityRatio).toString());
    }
  };

  const handleKaratChange = (value: string) => {
    setCustomKarat(value);
    handleWeightOrPriceChange(grams, habba, juz, sellPricePerGram, buyCostPricePerGram, value);
  };

  const handleOpenAdd = () => {
    setEditingSale(null);
    setGrams('');
    setHabba('');
    setJuz('');
    setSellPricePerGram(rates.karat21.toString());
    setBuyCostPricePerGram((rates.karat21 * 0.98).toFixed(0));
    setCustomKarat('21');
    setSellAmount('');
    setBuyAmount('');
    setBuyer('');
    setNotes('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setGrams(Math.floor(sale.units / kUnitsPerGram).toString());
    setHabba(Math.floor((sale.units % kUnitsPerGram) / kUnitsPerHabba).toString());
    setJuz((sale.units % kUnitsPerHabba).toString());
    setSellPricePerGram('');
    setBuyCostPricePerGram('');
    setCustomKarat(sale.purity > 0 ? sale.purity.toString() : '-');
    setSellAmount(sale.sellAmount.toString());
    setBuyAmount(sale.buyAmount.toString());
    setBuyer(sale.buyer || '');
    setNotes(sale.notes || '');
    setSelectedSale(null);
    setShowAddModal(true);
  };

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grams) || 0;
    const h = parseFloat(habba) || 0;
    const j = parseFloat(juz) || 0;
    const totalUnits = weightToUnits(g, h, j);
    const enteredPurity = parseFloat(customKarat) || 0;
    const fineness = enteredPurity > 0 && enteredPurity <= 24
      ? (enteredPurity / 24) * 1000
      : enteredPurity;
    const totalGrams = unitsToGramsDecimal(totalUnits);
    const calculatedSell = totalGrams > 0 && parseFloat(sellPricePerGram) > 0 && fineness > 0
      ? Math.round(totalGrams * parseFloat(sellPricePerGram) * (fineness / 875))
      : 0;
    // Always use the purity-adjusted formula when a weight and sale price exist.
    // The manual amount remains a fallback for entries without those inputs.
    const totalSell = calculatedSell || (parseFloat(sellAmount) || 0);
    const totalBuy = parseFloat(buyAmount) || 0;

    if (totalUnits <= 0 && totalSell <= 0) {
      alert('يرجى إدخال الوزن (جرام أو حبة أو جزء) أو المبلغ');
      return;
    }

    const karatNum = customKarat === '-' ? 0 : parseFloat(customKarat) || 0;

    const saleData = {
      date: editingSale?.date || new Date().toISOString(),
      units: totalUnits,
      purity: karatNum,
      sellAmount: totalSell,
      buyAmount: totalBuy,
      buyer: buyer.trim() || 'زبون عام',
      notes: notes.trim(),
    };

    if (editingSale) {
      updateSale({ ...editingSale, ...saleData });
    } else {
      addSale(saleData);
    }

    setEditingSale(null);
    setShowAddModal(false);
  };

  // Filter & Search Logic
  const filteredSales = useMemo(() => {
    return sales.filter((item) => !item.archived).filter((item) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.buyer.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        item.sellAmount.toString().includes(q) ||
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
  }, [sales, searchQuery, filterPeriod]);

  // Totals for Summary Row
  const totalUnitsSum = filteredSales.reduce((sum, s) => sum + (s.units || 0), 0);
  const totalSellSum = filteredSales.reduce((sum, s) => sum + (s.sellAmount || 0), 0);
  const totalBuySum = filteredSales.reduce((sum, s) => sum + (s.buyAmount || 0), 0);
  const totalProfitSum = totalSellSum - totalBuySum;

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-200">
      
      {/* 1. Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالمشتري أو الملاحظات أو المبلغ..."
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

      {filteredSales.length > 0 && <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-3 space-y-2">
        <div className="text-[11px] text-slate-400">إجراءات الصفحة على السجلات الظاهرة فقط</div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => { if (confirm('أرشفة كل السجلات الظاهرة؟')) filteredSales.forEach(x => archiveSale(x.id)); }} className="py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black">أرشفة الكل</button>
          <button onClick={() => { const value = prompt('الملاحظات الجديدة'); if (value !== null) filteredSales.forEach(x => updateSale({ ...x, notes: value })); }} className="py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-black">تعديل الكل</button>
          <button onClick={() => { if (confirm('حذف نهائي لكل السجلات الظاهرة؟')) filteredSales.forEach(x => deleteSale(x.id)); }} className="py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black">حذف الكل</button>
        </div>
      </div>}

      {/* 3. Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[780px] text-xs border-collapse" dir="rtl">
            <thead>
              <tr className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 font-black">
                <th className="py-3 px-3 text-right w-[15%]">تاريخ</th>
                <th className="py-3 px-3 text-center w-[16%]">وزن</th>
                <th className="py-3 px-3 text-center w-[10%]">عيار</th>
                <th className="py-3 px-3 text-center w-[15%]">البيع</th>
                <th className="py-3 px-3 text-center w-[15%]">الشراء</th>
                <th className="py-3 px-3 text-center w-[14%]">الربح</th>
                <th className="py-3 px-3 text-right w-[15%]">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                    <DollarSign className="w-8 h-8 mx-auto text-slate-600 opacity-60 mb-2" />
                    <p>لا توجد فواتير بيع مسجلة في هذه الفترة</p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const profit = (sale.sellAmount || 0) - (sale.buyAmount || 0);

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {formatInvoiceDate(sale.date)}
                      </td>

                      <td className="py-3.5 px-3 text-center text-white font-mono font-bold text-xs whitespace-nowrap">
                        {unitsToGhJ(sale.units)}
                      </td>

                      <td className="py-3.5 px-3 text-center text-slate-300 font-mono text-xs whitespace-nowrap">
                        {sale.purity > 0 ? `${sale.purity}k` : '—'}
                      </td>

                      <td className="py-3.5 px-3 text-center text-white font-mono font-black text-xs whitespace-nowrap">
                        {fmtNum(sale.sellAmount)}
                      </td>

                      <td className="py-3.5 px-3 text-center text-amber-300 font-mono font-bold text-xs whitespace-nowrap">
                        {fmtNum(sale.buyAmount)}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-xs ${
                            profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {fmtNum(profit)}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right text-slate-400 text-[10px] truncate max-w-[150px]" title={sale.notes || ''}>
                        {sale.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSales.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-500/20 border-t-2 border-emerald-500/60 font-black text-xs text-emerald-300">
                  <td className="py-3.5 px-3 text-right font-black">الإجمالي</td>
                  <td className="py-3.5 px-3 text-center font-mono text-emerald-400 text-sm whitespace-nowrap">
                    {unitsToGhJ(totalUnitsSum)}
                  </td>
                  <td className="py-3.5 px-3 text-center text-slate-400">—</td>
                  <td className="py-3.5 px-3 text-center font-mono text-emerald-400 text-sm whitespace-nowrap">
                    {fmtNum(totalSellSum)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-amber-300 text-sm whitespace-nowrap">
                    {fmtNum(totalBuySum)}
                  </td>
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    <span
                      className={`font-mono text-sm font-black ${
                        totalProfitSum >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {fmtNum(totalProfitSum)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-400">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Action Button: + بيع جديد */}
      <div className="pt-1">
        <button
          onClick={handleOpenAdd}
          className="w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 text-slate-950 font-black py-3 px-4 rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          <span className="text-xs font-bold">تسجيل بيع جديد</span>
        </button>
      </div>

      {/* Modal: Add New Sale Invoice */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveSale}
            className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-white relative animate-in zoom-in-95 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-emerald-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>{editingSale ? 'تعديل فاتورة البيع' : 'إضافة فاتورة بيع جديدة'}</span>
              </h3>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingSale(null); }}
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
                      handleWeightOrPriceChange(e.target.value, habba, juz, sellPricePerGram, buyCostPricePerGram);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-center font-mono font-bold focus:border-emerald-400 focus:outline-none"
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
                      handleWeightOrPriceChange(grams, e.target.value, juz, sellPricePerGram, buyCostPricePerGram);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-center font-mono font-bold focus:border-emerald-400 focus:outline-none"
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
                      handleWeightOrPriceChange(grams, habba, e.target.value, sellPricePerGram, buyCostPricePerGram);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-center font-mono font-bold focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Price Per Gram & Sell Amount Auto Calculation */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  سعر بيع الجرام ({kCurrency}):
                </label>
                <input
                  type="number"
                  step="any"
                  value={sellPricePerGram}
                  onChange={(e) => {
                    setSellPricePerGram(e.target.value);
                    handleWeightOrPriceChange(grams, habba, juz, e.target.value, buyCostPricePerGram);
                  }}
                  placeholder="956,529"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-emerald-400 focus:outline-none text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  إجمالي مبلغ البيع ({kCurrency}):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-emerald-400 font-mono font-bold text-sm focus:border-emerald-400 focus:outline-none text-right"
                />
              </div>
            </div>

            {/* Cost Amount (for Profit calculation) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                مبلغ الشراء ({kCurrency}) (يدوي):
              </label>
              <input
                type="number"
                step="any"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="أدخل مبلغ الشراء لحساب الربح"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-emerald-400 focus:outline-none text-right"
              />
            </div>

            {/* Karat Selection (Manual / Custom or Standard) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                العيار / النقاوة (مثال: 21 أو 650):
              </label>
              
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {['-', '18', '21', '22', '24'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKaratChange(k)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      customKarat === k
                        ? 'bg-emerald-500 text-slate-950 font-black'
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
                onChange={(e) => handleKaratChange(e.target.value || '-')}
                placeholder="اكتب النقاوة يدوياً (مثال: 650) أو العيار (21)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:border-emerald-400 focus:outline-none text-right"
              />
            </div>

            {/* Buyer & Notes */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المشتري / الزبون:</label>
                <input
                  type="text"
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value)}
                  placeholder="محمد أحمد"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
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
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                {editingSale ? 'حفظ التعديلات' : 'حفظ البيع'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: View Selected Sale Details */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-emerald-400">تفاصيل فاتورة البيع</h3>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">التاريخ:</span>
                <span className="font-mono text-white">{formatInvoiceDate(selectedSale.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الوزن:</span>
                <span className="font-mono text-emerald-400 font-bold">{unitsToGhJ(selectedSale.units)} ({unitsToWeight(selectedSale.units)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">العيار:</span>
                <span className="font-mono text-white">{selectedSale.purity > 0 ? `${selectedSale.purity}k` : 'بدون عيار'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">مبلغ البيع:</span>
                <span className="font-mono text-emerald-400 font-bold">{fmtMoney(selectedSale.sellAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">سعر التكلفة:</span>
                <span className="font-mono text-slate-300">{fmtMoney(selectedSale.buyAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1">
                <span className="text-slate-400">الربح الصافي:</span>
                <span className="font-mono font-black text-emerald-400">
                  {fmtMoney(selectedSale.sellAmount - selectedSale.buyAmount)}
                </span>
              </div>
              {selectedSale.buyer && (
                <div className="flex justify-between">
                  <span className="text-slate-400">المشتري:</span>
                  <span className="text-white">{selectedSale.buyer}</span>
                </div>
              )}
              {selectedSale.notes && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400 shrink-0">ملاحظات:</span>
                  <span className="text-slate-300 text-right">{selectedSale.notes}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleOpenEdit(selectedSale)}
                className="flex-1 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-black rounded-xl text-xs border border-emerald-500/40 flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                تعديل
              </button>
              <button onClick={() => { if (confirm('أرشفة هذه الفاتورة؟')) { archiveSale(selectedSale.id); setSelectedSale(null); } }} className="flex-1 py-2.5 bg-rose-600/20 text-rose-400 font-bold rounded-xl text-xs border border-rose-600/40">أرشفة</button>
              <button onClick={() => { if (confirm('حذف نهائي؟ لا يمكن الاستعادة.')) { deleteSale(selectedSale.id); setSelectedSale(null); } }} className="py-2.5 px-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs border border-slate-700">حذف</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
