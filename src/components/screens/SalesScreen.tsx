import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Printer,
  Edit2,
  AlertTriangle,
  Filter,
  HandCoins,
  Wallet
} from 'lucide-react';
import { ArchiveShortcut } from '../common/ArchiveShortcut';
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
  formatEntryTime,
  formatDateWithTime,
  kCurrency
} from '../../core/format';
import { Sale } from '../../types';
import { purityLabel, unitsToK21 } from '../../core/purity';
import { salePending } from '../../core/accounting';
import { buildSaleInvoiceText, openWhatsApp, buildReminderText } from '../../core/share';
import { toDateInputValue, arabicDate, relativeDays } from '../../core/dates';
import { ShareButtons } from '../common/ShareButtons';
import { InvoicePrintModal } from '../common/InvoicePrintModal';
import { PrintableInvoice, buildSaleInvoice } from '../../core/invoice';
import { branchName } from '../../core/branches';
import { operationPriceWarning } from '../../core/pricing';
import { matchSaleQuery } from '../../core/globalSearch';
import { SmartSearchBar } from '../common/SmartSearchBar';
import { sortRecords } from '../../core/recordOrder';
import { useRecordOrder } from '../../hooks/useRecordOrder';
import { RecordOrderToggle } from '../common/RecordOrderToggle';
import { StickyActionBar } from '../layout/StickyActionBar';
import { useBackClose } from '../../lib/backStack';

export const SalesScreen: React.FC = () => {
  const {
    sales,
    addSale,
    updateSale,
    archiveSale,
    deleteSale,
    addPaymentToSale,
    rates,
    approvedPrice,
    storeName,
    branches,
    activeBranchName,
  } = useGoldStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | '7days' | 'month'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [printInvoice, setPrintInvoice] = useState<PrintableInvoice | null>(null);

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

  // البيع الآجل: المبلغ المحصّل والمتبقي
  const [paidFull, setPaidFull] = useState(true);
  const [paidInput, setPaidInput] = useState('');

  // هاتف الزبون وتاريخ الاستحقاق (للتنبيهات وواتساب)
  const [buyerPhone, setBuyerPhone] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');

  // تسجيل دفعة لاحقة
  const [payModal, setPayModal] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  // زر الرجوع في التلفون يقفل النوافذ بدل الخروج من التطبيق
  useBackClose(showAddModal, () => { setShowAddModal(false); setEditingSale(null); });
  useBackClose(selectedSale, () => setSelectedSale(null));
  useBackClose(payModal, () => setPayModal(null));

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
    setSellPricePerGram(String(approvedPrice?.sell || rates.karat21));
    setBuyCostPricePerGram(String(approvedPrice?.buy || Math.round(rates.karat21 * 0.98)));
    setCustomKarat('21');
    setSellAmount('');
    setBuyAmount('');
    setBuyer('');
    setNotes('');
    setBuyerPhone('');
    setDueDateInput('');
    setPaidFull(true);
    setPaidInput('');
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
    setBuyerPhone(sale.buyerPhone || '');
    setDueDateInput(sale.dueDate ? toDateInputValue(sale.dueDate) : '');
    const remaining = salePending(sale);
    setPaidFull(remaining <= 0);
    setPaidInput(remaining > 0 ? String((sale.sellAmount || 0) - remaining) : '');
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

    // البيع الآجل: المتبقي = الإجمالي − المحصّل
    const totalPaid = paidFull ? totalSell : Math.min(totalSell, Math.max(0, parseFloat(paidInput) || 0));
    const pending = Math.max(0, totalSell - totalPaid);

    const saleData = {
      date: editingSale?.date || new Date().toISOString(),
      units: totalUnits,
      purity: karatNum,
      sellAmount: totalSell,
      buyAmount: totalBuy,
      buyer: buyer.trim() || 'زبون عام',
      buyerPhone: buyerPhone.trim(),
      notes: notes.trim(),
      paidAmount: totalPaid,
      pendingAmount: pending,
      dueDate: pending > 0 && dueDateInput ? dueDateInput : undefined,
    };

    if (editingSale) {
      updateSale({ ...editingSale, ...saleData });
    } else {
      addSale(saleData);
    }

    setEditingSale(null);
    setShowAddModal(false);
  };

  // ترتيب السجلات (موحّد بين الشاشات)
  const [recordOrder, toggleRecordOrder] = useRecordOrder();

  // Filter & Search Logic
  const filteredSales = useMemo(() => {
    return sortRecords(sales, recordOrder).filter((item) => !item.archived).filter((item) => {
      // بحث ذكي موحّد: اسم/هاتف/مبلغ/وزن/فاتورة/ملاحظات
      if (!matchSaleQuery(item, searchQuery)) return false;

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
  }, [sales, searchQuery, filterPeriod, recordOrder]);

  // Totals for Summary Row
  const totalUnitsSum = filteredSales.reduce((sum, s) => sum + (s.units || 0), 0);
  const totalSellSum = filteredSales.reduce((sum, s) => sum + (s.sellAmount || 0), 0);
  const totalBuySum = filteredSales.reduce((sum, s) => sum + (s.buyAmount || 0), 0);
  const totalProfitSum = totalSellSum - totalBuySum;
  const totalPendingSum = filteredSales.reduce((sum, s) => sum + salePending(s), 0);

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    const value = parseFloat(payAmount) || 0;
    const remaining = salePending(payModal);
    if (value <= 0) return;
    if (value > remaining && !confirm('المبلغ أكبر من المتبقي، سيتم تسجيل المتبقي فقط. متابعة؟')) return;
    addPaymentToSale(payModal.id, {
      date: new Date().toISOString(),
      amount: value,
      note: payNote.trim() || 'تحصيل دفعة',
    });
    setPayModal(null);
    setPayAmount('');
    setPayNote('');
  };

  /** تجهيز فاتورة البيع للطباعة */
  const openPrint = (sale: Sale) => {
    setPrintInvoice(
      buildSaleInvoice(sale, {
        storeName,
        currency: kCurrency,
        branch: branches.find((b) => b.id === sale.branchId),
        purityLabel,
        weightLabel: (u) => `${unitsToGhJ(u)} ج.ح.ز (${(u / 100).toFixed(2)} جرام)`,
        invoiceNo: sale.invoiceNo || 'بدون رقم',
      })
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. العدسة + فلاتر الفترة في سطر واحد — البحث ينفتح عند الحاجة فقط */}
      <SmartSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="بحث بالاسم، الهاتف، المبلغ، الوزن (5.3.2)، الفاتورة..."
      >
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
        <RecordOrderToggle order={recordOrder} onToggle={toggleRecordOrder} />
      </SmartSearchBar>
      <ArchiveShortcut kind="sale" />

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
                <th className="py-3 px-3 text-center w-[13%]">متبقي</th>
                <th className="py-3 px-3 text-right w-[15%]">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 text-xs">
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
                        <div>{formatInvoiceDate(sale.date)}</div>
                        {formatEntryTime(sale.date) && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{formatEntryTime(sale.date)}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center text-white font-mono font-bold text-xs whitespace-nowrap">
                        {unitsToGhJ(sale.units)}
                      </td>

                      <td className="py-3.5 px-3 text-center text-slate-300 font-mono text-xs whitespace-nowrap">
                        {sale.purity > 0 ? purityLabel(sale.purity) : '—'}
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

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {salePending(sale) > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayModal(sale);
                              setPayAmount(salePending(sale).toString());
                            }}
                            className="font-mono text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1"
                            title="تسجيل دفعة"
                          >
                            {fmtNum(salePending(sale))}
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400">مسدد ✓</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right text-slate-400 text-[10px] truncate max-w-[150px]" title={sale.notes || ''}>
                        {sale.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* شريط ثابت: إجماليات المبيعات + زر بيع جديد */}
      <StickyActionBar
        stats={[
          { label: 'إجمالي الوزن', value: unitsToGhJ(totalUnitsSum), tone: 'emerald' },
          { label: 'إجمالي البيع', value: fmtNum(totalSellSum), tone: 'emerald' },
          { label: 'الربح', value: fmtNum(totalProfitSum), tone: totalProfitSum >= 0 ? 'emerald' : 'rose' },
          { label: 'متبقي (آجل)', value: fmtNum(totalPendingSum), tone: totalPendingSum > 0 ? 'amber' : 'slate' },
        ]}
        columns={4}
        hint={
          filterPeriod !== 'all' || searchQuery
            ? 'الإجماليات للنتائج الظاهرة حالياً فقط'
            : `تكلفة المبيعات: ${fmtNum(totalBuySum)} ${kCurrency}`
        }
        actions={[{ label: 'بيع جديد', onClick: handleOpenAdd, icon: Plus, tone: 'emerald' }]}
      />

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

            {/* مؤشر معادل عيار 21 — أساس التداول الرسمي */}
            {(() => {
              const u = weightToUnits(parseFloat(grams) || 0, parseFloat(habba) || 0, parseFloat(juz) || 0);
              if (u <= 0) return null;
              const karatNum = customKarat === '-' ? 0 : parseFloat(customKarat) || 0;
              const k21 = karatNum > 0 ? unitsToK21(u, karatNum) : u;
              const isOfficial = !karatNum || Math.abs(karatNum - 21) < 0.05;
              return (
                <div className="mt-2 flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px]">
                  <span className="text-slate-400">
                    {isOfficial ? 'الوزن بعيار 21 (الرسمي)' : 'معادل عيار 21 بعد التحويل من العيار المدخل'}:
                  </span>
                  <span className="font-mono font-black text-amber-300">{(k21 / 100).toFixed(2)} جرام21</span>
                </div>
              );
            })()}

            {/* Price Per Gram & Sell Amount Auto Calculation */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  سعر بيع الجرام — <span className="text-amber-400">عيار 21 (الرسمي)</span> ({kCurrency}):
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
                {operationPriceWarning(parseFloat(sellPricePerGram) || 0, approvedPrice?.sell || rates.karat21) && (
                  <p className="mt-1 text-[10px] text-amber-300 flex items-start gap-1 leading-relaxed">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    {operationPriceWarning(parseFloat(sellPricePerGram) || 0, approvedPrice?.sell || rates.karat21)} — السعر المعتمد هو المرجع
                  </p>
                )}
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

            {/* التحصيل: نقدي أم آجل */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                  طريقة التحصيل
                </span>
                <button
                  type="button"
                  onClick={() => setPaidFull((v) => !v)}
                  className={`text-[11px] font-black px-3 py-1.5 rounded-xl border transition-colors ${
                    paidFull
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {paidFull ? 'مدفوع بالكامل ✓' : 'آجل (جزئي)'}
                </button>
              </div>

              {!paidFull && (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1">
                      المبلغ المحصّل الآن ({kCurrency}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={paidInput}
                      onChange={(e) => setPaidInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:border-amber-400 focus:outline-none text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">المتبقي على الزبون:</span>
                    <span className="font-mono font-black text-amber-300">
                      {fmtNum(Math.max(0, (parseFloat(sellAmount) || 0) - (parseFloat(paidInput) || 0)))}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1">
                      تاريخ السداد المتفق عليه (للتنبيهات):
                    </label>
                    <input
                      type="date"
                      value={dueDateInput}
                      onChange={(e) => setDueDateInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:border-amber-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      سيظهر تذكير في «التنبيهات» قبل الموعد، مع إمكانية الإرسال على واتساب.
                    </p>
                  </div>
                </>
              )}
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
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  هاتف الزبون <span className="text-slate-500 font-normal">(اختياري — للواتساب)</span>:
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:border-emerald-400 focus:outline-none text-right"
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

      {/* نافذة معاينة وطباعة الفاتورة */}
      <InvoicePrintModal
        invoice={printInvoice}
        currency={kCurrency}
        onClose={() => setPrintInvoice(null)}
      />

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
                <span className="text-slate-400">رقم الفاتورة:</span>
                <span className="font-mono font-black text-amber-400">{selectedSale.invoiceNo || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الفرع:</span>
                <span className="text-white">{branchName(branches, selectedSale.branchId)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">التاريخ:</span>
                <span className="font-mono text-white">{formatDateWithTime(selectedSale.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الوزن:</span>
                <span className="font-mono text-emerald-400 font-bold">{unitsToGhJ(selectedSale.units)} ({unitsToWeight(selectedSale.units)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">العيار:</span>
                <span className="font-mono text-white">
                  {selectedSale.purity > 0 ? purityLabel(selectedSale.purity) : 'بدون عيار'}
                </span>
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
              <div className="flex justify-between">
                <span className="text-slate-400">المحصّل:</span>
                <span className="font-mono text-emerald-300">
                  {fmtMoney((selectedSale.sellAmount || 0) - salePending(selectedSale))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المتبقي:</span>
                <span className={`font-mono font-black ${salePending(selectedSale) > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                  {fmtMoney(salePending(selectedSale))}
                </span>
              </div>
              {selectedSale.buyer && (
                <div className="flex justify-between">
                  <span className="text-slate-400">المشتري:</span>
                  <span className="text-white">{selectedSale.buyer}</span>
                </div>
              )}
              {selectedSale.buyerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">الهاتف:</span>
                  <span className="text-white font-mono">{selectedSale.buyerPhone}</span>
                </div>
              )}
              {selectedSale.dueDate && (
                <div className="flex justify-between">
                  <span className="text-slate-400">تاريخ الاستحقاق:</span>
                  <span className={`font-mono font-bold ${salePending(selectedSale) > 0 && new Date(selectedSale.dueDate) < new Date() ? 'text-rose-300' : 'text-slate-200'}`}>
                    {arabicDate(selectedSale.dueDate)}
                    {salePending(selectedSale) > 0 && (
                      <span className="text-[10px] text-slate-500 mr-1">
                        ({relativeDays(-Math.round((new Date().setHours(0,0,0,0) - new Date(selectedSale.dueDate).setHours(0,0,0,0)) / 86400000))})
                      </span>
                    )}
                  </span>
                </div>
              )}
              {selectedSale.notes && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400 shrink-0">ملاحظات:</span>
                  <span className="text-slate-300 text-right">{selectedSale.notes}</span>
                </div>
              )}
            </div>

            {/* طباعة الفاتورة */}
            <button
              onClick={() => openPrint(selectedSale)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              طباعة الفاتورة / PDF
            </button>

            {/* مشاركة الفاتورة على واتساب */}
            <ShareButtons
              text={buildSaleInvoiceText(storeName, selectedSale, Math.round(approvedPrice?.sell || rates.karat21))}
              phone={selectedSale.buyerPhone}
              label="إرسال الفاتورة على واتساب"
            />

            {salePending(selectedSale) > 0 && (
              <button
                onClick={() =>
                  openWhatsApp(
                    selectedSale.buyerPhone,
                    buildReminderText({
                      storeName,
                      party: selectedSale.buyer || 'زبون عام',
                      amount: salePending(selectedSale),
                      dueDate: selectedSale.dueDate,
                      daysOverdue: selectedSale.dueDate
                        ? Math.round(
                            (new Date().setHours(0, 0, 0, 0) -
                              new Date(selectedSale.dueDate).setHours(0, 0, 0, 0)) /
                              86400000
                          )
                        : 0,
                      kind: 'receivable',
                    })
                  )
                }
                className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 font-bold rounded-xl text-xs border border-rose-500/40 flex items-center justify-center gap-1.5"
              >
                <HandCoins className="w-4 h-4" />
                إرسال تذكير بالسداد
              </button>
            )}

            {/* سجل الدفعات */}
            {(selectedSale.payments || []).length > 0 && (
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5 max-h-40 overflow-y-auto">
                <span className="text-[11px] font-bold text-slate-400 block">سجل التحصيل:</span>
                {(selectedSale.payments || []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{formatInvoiceDate(p.date)}</span>
                    <span className="text-slate-300 truncate max-w-[45%]">{p.note}</span>
                    <span className="font-mono text-emerald-300 font-bold">{fmtNum(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {salePending(selectedSale) > 0 && (
              <button
                onClick={() => {
                  setPayModal(selectedSale);
                  setPayAmount(salePending(selectedSale).toString());
                  setSelectedSale(null);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <HandCoins className="w-4 h-4" />
                تسجيل دفعة ({fmtNum(salePending(selectedSale))})
              </button>
            )}

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

      {/* Modal: تسجيل دفعة تحصيل */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddPayment}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-amber-400 flex items-center gap-2">
                <HandCoins className="w-4 h-4" />
                تسجيل دفعة تحصيل
              </h3>
              <button type="button" onClick={() => setPayModal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">الزبون:</span>
                <span className="text-white font-bold">{payModal.buyer || 'زبون عام'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">إجمالي الفاتورة:</span>
                <span className="font-mono text-white">{fmtNum(payModal.sellAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المتبقي حالياً:</span>
                <span className="font-mono font-black text-amber-300">{fmtNum(salePending(payModal))}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">مبلغ الدفعة ({kCurrency})</label>
              <input
                type="number"
                step="any"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm focus:border-amber-400 focus:outline-none text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">البيان / طريقة الدفع</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="نقداً / بنكك / فوري..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs"
              >
                حفظ الدفعة
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
