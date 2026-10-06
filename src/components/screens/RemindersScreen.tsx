'use client';

import React, { useMemo, useState } from 'react';
import {
  BellRing,
  AlertTriangle,
  CalendarClock,
  HandCoins,
  Wallet,
  Users,
  Search,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { DueItem } from '../../core/reminders';
import { buildReminderText, openWhatsApp } from '../../core/share';
import { fmtNum, fmtMoney, kCurrency } from '../../core/format';
import { arabicDate, relativeDays } from '../../core/dates';

type Filter = 'all' | 'overdue' | 'today' | 'upcoming' | 'receivable' | 'payable';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'overdue', label: 'متأخر' },
  { id: 'today', label: 'يستحق اليوم' },
  { id: 'upcoming', label: 'قادم' },
  { id: 'receivable', label: 'لنا (زبائن)' },
  { id: 'payable', label: 'علينا (موردون)' },
  { id: 'all', label: 'الكل' },
];

function statusStyle(item: DueItem) {
  switch (item.status) {
    case 'overdue':
      return { chip: 'bg-rose-500/15 text-rose-300 border-rose-500/40', text: `متأخر ${item.daysOverdue} يوم` };
    case 'today':
      return { chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', text: 'يستحق اليوم' };
    case 'soon':
      return { chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40', text: relativeDays(item.daysOverdue) };
    case 'later':
      return { chip: 'bg-slate-700/40 text-slate-300 border-slate-600', text: relativeDays(item.daysOverdue) };
    default:
      return { chip: 'bg-slate-800 text-slate-400 border-slate-700', text: 'بلا تاريخ استحقاق' };
  }
}

export const RemindersScreen: React.FC = () => {
  const { dues, storeName, sales, purchases, addPaymentToSale, addPaymentToPurchase } = useGoldStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim();
    return dues.items.filter((item) => {
      if (filter === 'overdue' && item.status !== 'overdue') return false;
      if (filter === 'today' && item.status !== 'today') return false;
      if (filter === 'upcoming' && item.status !== 'soon' && item.status !== 'later') return false;
      if (filter === 'receivable' && item.kind !== 'receivable') return false;
      if (filter === 'payable' && item.kind !== 'payable') return false;
      if (q && !item.party.includes(q)) return false;
      return true;
    });
  }, [dues.items, filter, search]);

  const filteredTotal = filtered.reduce((sum, i) => sum + i.amount, 0);

  const reminderText = (item: DueItem) =>
    buildReminderText({
      storeName,
      party: item.party,
      amount: item.amount,
      dueDate: item.dueDate,
      daysOverdue: item.daysOverdue,
      kind: item.kind,
    });

  const markPaid = (item: DueItem) => {
    if (!confirm(`تسجيل سداد كامل للمبلغ ${fmtNum(item.amount)} ${kCurrency}؟`)) return;
    const payment = {
      date: new Date().toISOString(),
      amount: item.amount,
      note: 'سداد كامل من شاشة التنبيهات',
    };
    if (item.kind === 'receivable') addPaymentToSale(item.id, payment);
    else addPaymentToPurchase(item.id, payment);
    setToast('تم تسجيل السداد بالكامل ✅');
    setTimeout(() => setToast(''), 2500);
  };

  const sendAllReminders = () => {
    const overdue = dues.overdue;
    if (overdue.length === 0) {
      setToast('لا توجد متأخرات حالياً 🎉');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    const lines = [`*${storeName}* — تذكيرات التحصيل (${overdue.length})`, '—————————————'];
    overdue.forEach((i, idx) => {
      lines.push(`${idx + 1}) ${i.party}: ${fmtNum(i.amount)} ${kCurrency} — متأخر ${i.daysOverdue} يوم`);
    });
    lines.push('—————————————');
    lines.push(`الإجمالي المتأخر: ${fmtNum(dues.overdueTotal)} ${kCurrency}`);
    openWhatsApp(undefined, lines.join('\n'));
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-200">
      {/* الملخص */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-500/15 text-rose-400 rounded-2xl border border-rose-500/40">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white">التنبيهات والمتأخرات</h2>
              <p className="text-[11px] text-slate-400">مواعيد التحصيل من الزبائن والسداد للموردين</p>
            </div>
          </div>
          <button
            onClick={sendAllReminders}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            إرسال كل التذكيرات
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-rose-950/25 border border-rose-500/40 rounded-2xl p-3">
            <span className="text-[10px] text-rose-300 font-bold block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> متأخر
            </span>
            <span className="font-mono font-black text-rose-300 text-sm">{fmtNum(dues.overdueTotal)}</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">{dues.overdue.length} فاتورة</span>
          </div>
          <div className="bg-amber-950/25 border border-amber-500/40 rounded-2xl p-3">
            <span className="text-[10px] text-amber-300 font-bold block mb-1 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> يستحق اليوم
            </span>
            <span className="font-mono font-black text-amber-300 text-sm">
              {fmtNum(dues.dueToday.reduce((s, i) => s + i.amount, 0))}
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">{dues.dueToday.length} فاتورة</span>
          </div>
          <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-2xl p-3">
            <span className="text-[10px] text-emerald-300 font-bold block mb-1 flex items-center gap-1">
              <HandCoins className="w-3 h-3" /> لنا عند الزبائن
            </span>
            <span className="font-mono font-black text-emerald-300 text-sm">{fmtNum(dues.receivablesTotal)}</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              {dues.items.filter((i) => i.kind === 'receivable').length} فاتورة
            </span>
          </div>
          <div className="bg-cyan-950/25 border border-cyan-500/40 rounded-2xl p-3">
            <span className="text-[10px] text-cyan-300 font-bold block mb-1 flex items-center gap-1">
              <Wallet className="w-3 h-3" /> علينا للموردين
            </span>
            <span className="font-mono font-black text-cyan-300 text-sm">{fmtNum(dues.payablesTotal)}</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              {dues.items.filter((i) => i.kind === 'payable').length} فاتورة
            </span>
          </div>
        </div>
      </div>

      {/* البحث والفلاتر */}
      <div className="space-y-2">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الزبون أو المورد..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-2xl py-3 px-4 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => {
            const count =
              f.id === 'overdue'
                ? dues.overdue.length
                : f.id === 'today'
                ? dues.dueToday.length
                : f.id === 'receivable'
                ? dues.items.filter((i) => i.kind === 'receivable').length
                : f.id === 'payable'
                ? dues.items.filter((i) => i.kind === 'payable').length
                : f.id === 'upcoming'
                ? dues.upcoming.length
                : dues.items.length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                  filter === f.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* القائمة */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl p-8 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="font-extrabold text-sm text-white">لا توجد تنبيهات</h3>
          <p className="text-xs text-slate-400">
            {dues.items.length === 0
              ? 'كل الفواتير مسددة. أضف تاريخ استحقاق عند تسجيل أي بيع آجل ليصلك التنبيه هنا.'
              : 'لا توجد فواتير مطابقة للفلتر المختار.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
              <span>{filtered.length} فاتورة</span>
              <span className="font-mono">الإجمالي: {fmtMoney(filteredTotal)}</span>
            </div>
          )}

          {filtered.map((item) => {
            const style = statusStyle(item);
            const isReceivable = item.kind === 'receivable';
            return (
              <div
                key={`${item.kind}-${item.id}`}
                className={`bg-slate-900 border rounded-2xl p-3.5 space-y-2.5 ${
                  item.status === 'overdue' ? 'border-rose-500/40' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5 truncate">
                      {isReceivable ? (
                        <HandCoins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                      {item.party}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isReceivable ? 'لنا عند الزبون' : 'علينا للمورد'} · فاتورة {arabicDate(item.date)}
                      {item.phone ? ` · ${item.phone}` : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${style.chip}`}>
                    {style.text}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-950 rounded-xl px-3 py-2">
                  <span className="text-[11px] text-slate-400">المتبقي</span>
                  <span className="font-mono font-black text-amber-300 text-sm">{fmtMoney(item.amount)}</span>
                </div>

                {item.dueDate && (
                  <p className="text-[11px] text-slate-400">
                    تاريخ الاستحقاق: <span className="text-slate-200 font-bold">{arabicDate(item.dueDate)}</span>
                    {item.status === 'overdue' && (
                      <span className="text-rose-300 font-bold"> — متأخر {item.daysOverdue} يوم</span>
                    )}
                  </p>
                )}

                {item.notes && <p className="text-[10px] text-slate-500 truncate">ملاحظات: {item.notes}</p>}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markPaid(item)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] rounded-xl"
                  >
                    {isReceivable ? 'تحصيل كامل' : 'سداد كامل'}
                  </button>
                  <button
                    onClick={() => openWhatsApp(item.phone, reminderText(item))}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {isReceivable ? 'تذكير بالواتساب' : 'طلب مهلة/سداد'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ملاحظة إرشادية */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 text-[11px] text-slate-400 leading-relaxed">
        💡 لتستفيد من التنبيهات: عند تسجيل بيع آجل أو شراء بدين، أدخل{' '}
        <span className="text-amber-300 font-bold">تاريخ الاستحقاق</span> ورقم هاتف الطرف. سيظهر التنبيه
        هنا تلقائياً ويظهر عدّاد المتأخرات في الشريط العلوي. السجلات بلا تاريخ استحقاق تظهر في «الكل» فقط.
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-emerald-500 text-emerald-300 px-4 py-2 rounded-2xl shadow-2xl text-xs font-black">
          {toast}
        </div>
      )}
    </div>
  );
};

export default RemindersScreen;
