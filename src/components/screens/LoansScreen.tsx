'use client';

import React, { useMemo, useState } from 'react';
import {
  HandCoins,
  Plus,
  ArrowUpLeft,
  ArrowDownRight,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  MessageCircle,
  CheckCircle2,
  Info,
  Scale,
  Phone,
  CalendarDays,
} from 'lucide-react';
import { ArchiveShortcut } from '../common/ArchiveShortcut';
import { useGoldStore } from '../../context/GoldStoreContext';
import { Loan, LoanDirection } from '../../types';
import { matchLoanQuery } from '../../core/globalSearch';
import { SmartSearchBar } from '../common/SmartSearchBar';
import { fmtNum, formatDateWithTime, kCurrency } from '../../core/format';
import {
  isLoanSettled,
  loanPaid,
  loanPending,
  loanProgress,
  loanReceiptText,
  loanStatusLabel,
  loanText,
} from '../../core/loans';
import { openWhatsApp } from '../../core/share';
import { daysBetween, relativeDays, startOfDay, toDateInputValue } from '../../core/dates';
import { StickyActionBar } from '../layout/StickyActionBar';
import { branchName } from '../../core/branches';
import { useBackClose } from '../../lib/backStack';

type FilterKey = 'all' | 'lent' | 'borrowed' | 'overdue' | 'settled';

const FILTERS: { id: FilterKey; label: string; tone: string }[] = [
  { id: 'all', label: 'الكل', tone: 'amber' },
  { id: 'lent', label: 'لنا عليهم', tone: 'emerald' },
  { id: 'borrowed', label: 'علينا لهم', tone: 'rose' },
  { id: 'overdue', label: 'متأخرة', tone: 'rose' },
  { id: 'settled', label: 'مسددة (مؤرشفة)', tone: 'slate' },
];

export const LoansScreen: React.FC = () => {
  const {
    loans,
    allLoans,
    loanSummary,
    addLoan,
    updateLoan,
    archiveLoan,
    restoreLoan,
    deleteLoan,
    addPaymentToLoan,
    storeName,
    branches,
  } = useGoldStore();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);

  // نموذج السلفة
  const [person, setPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<LoanDirection>('lent');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // نموذج السداد
  const [payLoan, setPayLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toDateInputValue(new Date()));
  const [payNote, setPayNote] = useState('');
  const [sendReceipt, setSendReceipt] = useState(false);
  const [toast, setToast] = useState('');

  // زر الرجوع في التلفون يقفل النوافذ بدل الخروج من التطبيق
  useBackClose(showForm, () => setShowForm(false));
  useBackClose(payLoan, () => setPayLoan(null));

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const today = startOfDay(new Date());

  const visible = useMemo(() => {
    return loans
      .filter((l) => {
        if (filter === 'lent') return !l.archived && l.direction === 'lent';
        if (filter === 'borrowed') return !l.archived && l.direction === 'borrowed';
        if (filter === 'overdue') {
          if (l.archived || !l.dueDate) return false;
          return daysBetween(l.dueDate, today) > 0;
        }
        if (filter === 'settled') return Boolean(l.archived);
        return !l.archived; // «الكل» = السلف النشطة فقط
      })
      .filter((l) => matchLoanQuery(l, query))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [loans, filter, query, today]);

  const overdueCount = useMemo(
    () => loans.filter((l) => !l.archived && l.dueDate && daysBetween(l.dueDate, today) > 0).length,
    [loans, today]
  );

  const handleOpenAdd = () => {
    setEditing(null);
    setPerson('');
    setPhone('');
    setAmount('');
    setDirection('lent');
    setDueDate('');
    setNotes('');
    setShowForm(true);
  };

  const handleOpenEdit = (loanItem: Loan) => {
    setEditing(loanItem);
    setPerson(loanItem.person);
    setPhone(loanItem.phone || '');
    setAmount(String(loanItem.amount));
    setDirection(loanItem.direction);
    setDueDate(loanItem.dueDate ? toDateInputValue(new Date(loanItem.dueDate)) : '');
    setNotes(loanItem.notes || '');
    setShowForm(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount) || 0;
    if (!person.trim() || parsedAmount <= 0) return;

    const payload = {
      person: person.trim(),
      phone: phone.trim(),
      amount: parsedAmount,
      direction,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      notes: notes.trim(),
    };

    if (editing) {
      updateLoan({ ...editing, ...payload });
      flash('تم تحديث السلفة');
    } else {
      addLoan({ ...payload, date: new Date().toISOString() });
      flash(direction === 'lent' ? 'تم تسجيل سلفة لنا — بدون تأثير على الربح' : 'تم تسجيل سلفة علينا');
    }
    setShowForm(false);
    setEditing(null);
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payLoan) return;
    const value = parseFloat(payAmount) || 0;
    if (value <= 0) return;

    const payment = {
      amount: Math.min(value, loanPending(payLoan)),
      date: new Date(payDate).toISOString(),
      note: payNote.trim() || (payLoan.direction === 'lent' ? 'استلام دفعة' : 'سداد دفعة'),
    };
    const willSettle = value >= loanPending(payLoan) - 0.5;

    if (sendReceipt) {
      openWhatsApp(payLoan.phone, loanReceiptText(payLoan, payment, storeName, kCurrency));
    }

    addPaymentToLoan(payLoan.id, payment);
    setPayLoan(null);
    setPayAmount('');
    setPayNote('');
    setSendReceipt(false);
    flash(
      willSettle
        ? 'تم السداد بالكامل — نُقلت السلفة إلى الأرشيف تلقائياً ✓'
        : 'تم تسجيل الدفعة — المتبقي محدَّث'
    );
  };

  const openPayModal = (loanItem: Loan) => {
    setPayLoan(loanItem);
    setPayAmount(String(loanPending(loanItem)));
    setPayDate(toDateInputValue(new Date()));
    setPayNote('');
    setSendReceipt(Boolean(loanItem.phone));
  };

  const netTone = loanSummary.netOutstanding >= 0 ? 'emerald' : 'rose';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* توضيح القاعدة المحاسبية */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-2xl shrink-0">
            <HandCoins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white">السلف والأمانات</h2>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
              السلفة <span className="text-amber-300 font-bold">ليست مصروفاً ولا إيراداً</span> — لا تدخل في
              حساب الربح إطلاقاً. الإقراض ينقص النقد ويزيد ذمتك، والسداد يعكسها. لا حاجة لحذف أي سجل:
              السلفة المسددة تُؤرشف تلقائياً وتبقى في السجل التاريخي.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-2.5 text-center">
            <span className="block text-[10px] text-slate-400 font-bold">لنا على الآخرين</span>
            <span className="block text-sm font-black font-mono text-emerald-400">
              {fmtNum(loanSummary.lentOutstanding)}
            </span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-2.5 text-center">
            <span className="block text-[10px] text-slate-400 font-bold">علينا للآخرين</span>
            <span className="block text-sm font-black font-mono text-rose-400">
              {fmtNum(loanSummary.borrowedOutstanding)}
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-center">
            <span className="block text-[10px] text-slate-400 font-bold">الصافي</span>
            <span
              className={`block text-sm font-black font-mono ${
                netTone === 'emerald' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {fmtNum(loanSummary.netOutstanding)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Scale className="w-3.5 h-3.5 text-slate-500" />
          نسبة التحصيل من السلف النشطة: <span className="font-mono text-amber-300">{loanSummary.collectedPercent}%</span>
          • سلف مفتوحة: <span className="font-mono text-amber-300">{loanSummary.openCount}</span>
          • مسددة: <span className="font-mono text-emerald-300">{loanSummary.settledCount}</span>
        </div>
      </div>

      {/* البحث والفلاتر — العدسة في نفس سطر الفلاتر */}
      <div className="space-y-2">
        <SmartSearchBar
          value={query}
          onChange={setQuery}
          placeholder="ابحث بالاسم أو الهاتف أو المبلغ أو دفعات السداد..."
        >
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const badge = f.id === 'overdue' ? overdueCount : 0;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? f.tone === 'rose'
                      ? 'bg-rose-500 text-white'
                      : f.tone === 'emerald'
                      ? 'bg-emerald-500 text-slate-950'
                      : f.tone === 'slate'
                      ? 'bg-slate-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-300'
                }`}
              >
                {f.label}
                {badge > 0 ? (
                  <span className="px-1.5 rounded-md bg-slate-950/40 font-mono">{badge}</span>
                ) : null}
              </button>
            );
          })}
          </div>
        </SmartSearchBar>
      <ArchiveShortcut kind="loan" />
      </div>

      {/* القائمة */}
      {visible.length === 0 ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl py-14 text-center">
          <HandCoins className="w-9 h-9 mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-500">
            {filter === 'settled'
              ? 'لا توجد سلف مسددة بعد — السلف المسددة تُؤرشف تلقائياً'
              : 'لا توجد سلف مسجّلة في هذا التصنيف'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((loanItem) => {
            const pending = loanPending(loanItem);
            const settled = isLoanSettled(loanItem);
            const isLent = loanItem.direction === 'lent';
            const overdue =
              !settled && Boolean(loanItem.dueDate) && daysBetween(loanItem.dueDate as string, today) > 0;
            return (
              <div
                key={loanItem.id}
                className={`bg-slate-900 border rounded-3xl p-4 space-y-3 ${
                  settled
                    ? 'border-slate-800 opacity-80'
                    : overdue
                    ? 'border-rose-500/50'
                    : isLent
                    ? 'border-emerald-500/40'
                    : 'border-amber-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white truncate">{loanItem.person}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                          isLent
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {isLent ? (
                          <ArrowUpLeft className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {isLent ? 'لنا عليه' : 'علينا له'}
                      </span>
                      {settled ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> مسددة
                        </span>
                      ) : overdue ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300">
                          متأخرة
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-3 mt-1">
                      <span>{formatDateWithTime(loanItem.date)}</span>
                      {loanItem.phone ? (
                        <a
                          href={`tel:${loanItem.phone}`}
                          className="flex items-center gap-1 text-slate-300"
                        >
                          <Phone className="w-3 h-3" /> {loanItem.phone}
                        </a>
                      ) : null}
                      {loanItem.branchId ? <span>فرع: {branchName(branches, loanItem.branchId)}</span> : null}
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div className="text-[10px] text-slate-400 font-bold">
                      {settled ? 'المسدد' : 'المتبقي'}
                    </div>
                    <div
                      className={`font-mono font-black text-base ${
                        settled ? 'text-slate-400' : overdue ? 'text-rose-300' : isLent ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {fmtNum(settled ? loanItem.amount : pending)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">من {fmtNum(loanItem.amount)}</div>
                  </div>
                </div>

                {/* شريط التقدم */}
                <div className="space-y-1">
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${settled ? 'bg-slate-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                      style={{ width: `${loanProgress(loanItem)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      سُدِّد <span className="font-mono text-emerald-300">{fmtNum(loanPaid(loanItem))}</span> (
                      {loanProgress(loanItem)}%)
                    </span>
                    <span className={overdue ? 'text-rose-300 font-bold' : ''}>
                      <CalendarDays className="w-3 h-3 inline -mt-0.5" /> {loanStatusLabel(loanItem)}
                    </span>
                  </div>
                </div>

                {loanItem.notes ? (
                  <p className="text-[10px] text-slate-400 bg-slate-950/60 rounded-xl px-3 py-2">
                    {loanItem.notes}
                  </p>
                ) : null}

                {!settled ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openPayModal(loanItem)}
                      className="py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-black rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <HandCoins className="w-4 h-4" />
                      {isLent ? 'تسجيل استلام' : 'تسجيل سداد'}
                    </button>
                    <button
                      onClick={() => openWhatsApp(loanItem.phone, loanText(loanItem, storeName, kCurrency))}
                      className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      {isLent ? 'تذكير واتساب' : 'إشعار واتساب'}
                    </button>
                  </div>
                ) : null}

                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                  {(loanItem.payments || []).length > 0 ? (
                    <span className="text-[10px] text-slate-500 flex-1">
                      سجل الدفعات:{(loanItem.payments || []).length} •
                      آخرها {relativeDays(daysBetween((loanItem.payments || [])[(loanItem.payments || []).length - 1].date, today))}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 flex-1">لا توجد دفعات بعد</span>
                  )}
                  <button
                    onClick={() => handleOpenEdit(loanItem)}
                    className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                    title="تعديل"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {loanItem.archived ? (
                    <button
                      onClick={() => restoreLoan(loanItem.id)}
                      className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400"
                      title="استعادة"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm('أرشفة السلفة؟ ستبقى في الأرشيف ويمكن استعادتها.')) {
                          archiveLoan(loanItem.id);
                        }
                      }}
                      className="p-2 rounded-xl bg-amber-500/15 text-amber-400"
                      title="أرشفة"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('حذف السلفة نهائياً؟ سيختفي السجل من كل الأجهزة ولا يمكن التراجع.')) {
                        deleteLoan(loanItem.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-rose-500/15 text-rose-400"
                    title="حذف نهائي"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* شريط ثابت */}
      <StickyActionBar
        stats={[
          { label: 'لنا على الآخرين', value: fmtNum(loanSummary.lentOutstanding), tone: 'emerald' },
          { label: 'علينا للآخرين', value: fmtNum(loanSummary.borrowedOutstanding), tone: 'rose' },
          { label: 'الصافي', value: fmtNum(loanSummary.netOutstanding), tone: netTone },
          { label: 'سلف مفتوحة', value: String(loanSummary.openCount), tone: 'slate' },
        ]}
        columns={4}
        hint={
          filter !== 'all' || query
            ? 'الإجماليات لكل السلف النشطة (لا تتأثر بالفلتر)'
            : overdueCount > 0
            ? `تنبيه: ${overdueCount} سلفة متأخرة عن موعد السداد`
            : `إجمالي السلف: لنا ${fmtNum(loanSummary.lentTotal)} • علينا ${fmtNum(loanSummary.borrowedTotal)} ${kCurrency}`
        }
        actions={[{ label: 'سلفة جديدة', onClick: handleOpenAdd, icon: Plus, tone: 'amber' }]}
      />

      {/* نافذة إضافة/تعديل سلفة */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSave}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-amber-400">
                {editing ? 'تعديل السلفة' : 'تسجيل سلفة جديدة'}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['lent', 'borrowed'] as LoanDirection[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`py-2.5 rounded-xl text-[11px] font-black border transition-colors ${
                    direction === d
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

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">اسم الشخص *</label>
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="مثال: عثمان محمد"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">المبلغ ({kCurrency}) *</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">الهاتف (واتساب)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="09xxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">
                تاريخ الاستحقاق المتوقع
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-2 mt-2">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() =>
                      setDueDate(
                        toDateInputValue(new Date(Date.now() + days * 86400000))
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold"
                  >
                    بعد {days} يوم
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">ملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="سبب السلفة أو تفاصيل الاتفاق..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {direction === 'lent'
                  ? 'يُسجَّل المبلغ كذمة لنا على الشخص (أصل) — لا يدخل في المصروفات ولا ينقص الربح.'
                  : 'يُسجَّل المبلغ كذمة علينا للشخص (التزام) — لا يدخل في الإيرادات ولا يزيد الربح.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                {editing ? 'حفظ التعديلات' : 'تسجيل السلفة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* نافذة تسجيل دفعة */}
      {payLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <form
            onSubmit={handlePay}
            className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-emerald-400">
                {payLoan.direction === 'lent' ? 'تسجيل استلام دفعة' : 'تسجيل سداد دفعة'}
              </h3>
              <button type="button" onClick={() => setPayLoan(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">الاسم:</span>
                <span className="text-white font-bold">{payLoan.person}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">إجمالي السلفة:</span>
                <span className="font-mono text-slate-200">{fmtNum(payLoan.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المتبقي الآن:</span>
                <span className="font-mono font-black text-amber-300">{fmtNum(loanPending(payLoan))}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">
                المبلغ المستلم ({kCurrency}) *
              </label>
              <input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                inputMode="decimal"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPayAmount(String(loanPending(payLoan)))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold"
                >
                  المتبقي بالكامل
                </button>
                {[0.5, 0.25].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPayAmount(String(Math.round(loanPending(payLoan) * r)))}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold"
                  >
                    {r === 0.5 ? 'النصف' : 'الربع'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">تاريخ الدفعة</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">ملاحظة</label>
                <input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="كاش / بنكك..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {payLoan.phone ? (
              <label className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <input
                  type="checkbox"
                  checked={sendReceipt}
                  onChange={(e) => setSendReceipt(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                إرسال إشعار استلام على واتساب ({payLoan.phone})
              </label>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPayLoan(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                تأكيد الدفعة
              </button>
            </div>
          </form>
        </div>
      )}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold px-4 py-2.5 rounded-2xl shadow-2xl text-center max-w-[90%]">
          {toast}
        </div>
      ) : null}
    </div>
  );
};

export default LoansScreen;
