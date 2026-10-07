'use client';
import React, { useMemo, useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { Expense, Loan, Partner, Purchase, Sale } from '../../types';
import { fmtNum, formatInvoiceDate, unitsToGhJ } from '../../core/format';
import { StickyActionBar } from '../layout/StickyActionBar';
import { SmartSearchBar } from '../common/SmartSearchBar';
import { matchLoanQuery, matchPurchaseQuery, matchSaleQuery, matchExpenseQuery, smartMatch } from '../../core/globalSearch';

type ArchivedItem = {
  kind: 'purchase' | 'sale' | 'expense' | 'partner' | 'loan';
  item: Purchase | Sale | Expense | Partner | Loan;
};
export const ArchiveScreen: React.FC = () => {
  const store = useGoldStore();
  const items: ArchivedItem[] = [
    ...store.purchases.filter(x => x.archived).map(item => ({ kind: 'purchase' as const, item })),
    ...store.sales.filter(x => x.archived).map(item => ({ kind: 'sale' as const, item })),
    ...store.expenses.filter(x => x.archived).map(item => ({ kind: 'expense' as const, item })),
    ...store.partners.filter(x => x.archived).map(item => ({ kind: 'partner' as const, item })),
    ...store.loans.filter(x => x.archived).map(item => ({ kind: 'loan' as const, item })),
  ];
  const [query, setQuery] = useState('');

  /** مطابقة السجل المؤرشف حسب نوعه — نفس المحرك الذكي */
  const matches = (x: ArchivedItem, q: string): boolean => {
    if (x.kind === 'purchase') return matchPurchaseQuery(x.item as Purchase, q);
    if (x.kind === 'sale') return matchSaleQuery(x.item as Sale, q);
    if (x.kind === 'expense') return matchExpenseQuery(x.item as Expense, q);
    if (x.kind === 'loan') return matchLoanQuery(x.item as Loan, q);
    const partner = x.item as Partner;
    return smartMatch(q, { texts: [partner.name, partner.notes], phones: [partner.phone], amounts: [partner.capital, partner.profitPercent] });
  };

  const shown = useMemo(
    () => (query.trim() ? items.filter((x) => matches(x, query)) : items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.map((x) => `${x.kind}-${x.item.id}`).join('|'), query]
  );

  const label = (x: ArchivedItem) =>
    x.kind === 'purchase'
      ? 'مشتريات'
      : x.kind === 'sale'
      ? 'مبيعات'
      : x.kind === 'expense'
      ? 'مصروفات'
      : x.kind === 'loan'
      ? 'سلفة مسددة'
      : 'شركاء';
  const title = (x: ArchivedItem) => {
    if (x.kind === 'purchase') return `شراء ${fmtNum((x.item as Purchase).amount)} ج.س`;
    if (x.kind === 'sale') return `بيع ${fmtNum((x.item as Sale).sellAmount)} ج.س`;
    if (x.kind === 'expense') return (x.item as Expense).name;
    if (x.kind === 'loan') {
      const loan = x.item as Loan;
      return `${loan.direction === 'lent' ? 'لنا على' : 'علينا لـ'} ${loan.person} — ${fmtNum(loan.amount)} ج.س`;
    }
    return (x.item as Partner).name;
  };
  const restore = (x: ArchivedItem) => x.kind === 'purchase' ? store.restorePurchase(x.item.id) : x.kind === 'sale' ? store.restoreSale(x.item.id) : x.kind === 'expense' ? store.restoreExpense(x.item.id) : x.kind === 'loan' ? store.restoreLoan(x.item.id) : store.restorePartner(x.item.id);
  const remove = (x: ArchivedItem) => { if (confirm('حذف نهائي؟ لا يمكن استعادة هذا السجل بعد ذلك.')) { if (x.kind === 'purchase') store.deletePurchase(x.item.id); else if (x.kind === 'sale') store.deleteSale(x.item.id); else if (x.kind === 'expense') store.deleteExpense(x.item.id); else if (x.kind === 'loan') store.deleteLoan(x.item.id); else store.deletePartner(x.item.id); } };
  return <div className="space-y-4 animate-in fade-in duration-200">
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 text-center"><Archive className="w-9 h-9 mx-auto text-amber-400 mb-2"/><h2 className="text-lg font-black text-amber-300">الأرشيف</h2><p className="text-xs text-slate-400 mt-1">السجلات المؤرشفة لا تظهر في القوائم وتبقى قابلة للاستعادة</p></div>
    <div className="mt-3">
      <SmartSearchBar
        value={query}
        onChange={setQuery}
        placeholder="ابحث في الأرشيف: اسم، مبلغ، وزن (5.3.2)، هاتف، بنك..."
      />
    </div>
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
      {items.length === 0 ? <div className="py-16 text-center text-slate-500 text-sm">الأرشيف فارغ</div> : shown.length === 0 ? <div className="py-16 text-center text-slate-500 text-sm">لا نتائج مطابقة للبحث في الأرشيف</div> : shown.map(x => <div key={`${x.kind}-${x.item.id}`} className="flex items-center gap-3 p-4 border-b border-slate-800 last:border-0"><div className="flex-1 min-w-0"><div className="text-[10px] text-amber-400 font-bold">{label(x)}</div><div className="text-sm text-white font-bold truncate">{title(x)}</div><div className="text-[11px] text-slate-400">{'date' in x.item ? formatInvoiceDate(x.item.date) : 'بيانات شريك'}</div>{x.kind === 'purchase' && <div className="text-[11px] text-slate-400">الوزن: {unitsToGhJ((x.item as Purchase).units)}</div>}</div><button onClick={() => restore(x)} className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400" title="استعادة"><RotateCcw className="w-4 h-4"/></button><button onClick={() => remove(x)} className="p-2 rounded-xl bg-rose-500/15 text-rose-400" title="حذف نهائي"><Trash2 className="w-4 h-4"/></button></div>)}
    </div>

    {/* شريط ثابت: عدد السجلات المؤرشفة */}
    <StickyActionBar
      stats={[
        { label: query.trim() ? 'مطابق للبحث' : 'إجمالي المؤرشف', value: String(shown.length), tone: 'amber' },
        { label: 'مشتريات', value: String(store.purchases.filter((x) => x.archived).length), tone: 'blue' },
        { label: 'مبيعات', value: String(store.sales.filter((x) => x.archived).length), tone: 'emerald' },
        { label: 'مصروفات', value: String(store.expenses.filter((x) => x.archived).length), tone: 'rose' },
      ]}
      columns={4}
      hint="السجلات المؤرشفة مستثناة من الأرباح والمخزون — يمكن استعادتها في أي وقت"
    />
  </div>;
};
