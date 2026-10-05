'use client';
import React from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { Expense, Partner, Purchase, Sale } from '../../types';
import { fmtNum, formatInvoiceDate, unitsToGhJ } from '../../core/format';

type ArchivedItem = { kind: 'purchase' | 'sale' | 'expense' | 'partner'; item: Purchase | Sale | Expense | Partner };
export const ArchiveScreen: React.FC = () => {
  const store = useGoldStore();
  const items: ArchivedItem[] = [
    ...store.purchases.filter(x => x.archived).map(item => ({ kind: 'purchase' as const, item })),
    ...store.sales.filter(x => x.archived).map(item => ({ kind: 'sale' as const, item })),
    ...store.expenses.filter(x => x.archived).map(item => ({ kind: 'expense' as const, item })),
    ...store.partners.filter(x => x.archived).map(item => ({ kind: 'partner' as const, item })),
  ];
  const label = (x: ArchivedItem) => x.kind === 'purchase' ? 'مشتريات' : x.kind === 'sale' ? 'مبيعات' : x.kind === 'expense' ? 'مصروفات' : 'شركاء';
  const title = (x: ArchivedItem) => {
    if (x.kind === 'purchase') return `شراء ${fmtNum((x.item as Purchase).amount)} ج.س`;
    if (x.kind === 'sale') return `بيع ${fmtNum((x.item as Sale).sellAmount)} ج.س`;
    if (x.kind === 'expense') return (x.item as Expense).name;
    return (x.item as Partner).name;
  };
  const restore = (x: ArchivedItem) => x.kind === 'purchase' ? store.restorePurchase(x.item.id) : x.kind === 'sale' ? store.restoreSale(x.item.id) : x.kind === 'expense' ? store.restoreExpense(x.item.id) : store.restorePartner(x.item.id);
  const remove = (x: ArchivedItem) => { if (confirm('حذف نهائي؟ لا يمكن استعادة هذا السجل بعد ذلك.')) { if (x.kind === 'purchase') store.deletePurchase(x.item.id); else if (x.kind === 'sale') store.deleteSale(x.item.id); else if (x.kind === 'expense') store.deleteExpense(x.item.id); else store.deletePartner(x.item.id); } };
  return <div className="space-y-4 pb-24 animate-in fade-in duration-200">
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 text-center"><Archive className="w-9 h-9 mx-auto text-amber-400 mb-2"/><h2 className="text-lg font-black text-amber-300">الأرشيف</h2><p className="text-xs text-slate-400 mt-1">السجلات المؤرشفة لا تظهر في القوائم وتبقى قابلة للاستعادة</p></div>
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
      {items.length === 0 ? <div className="py-16 text-center text-slate-500 text-sm">الأرشيف فارغ</div> : items.map(x => <div key={`${x.kind}-${x.item.id}`} className="flex items-center gap-3 p-4 border-b border-slate-800 last:border-0"><div className="flex-1 min-w-0"><div className="text-[10px] text-amber-400 font-bold">{label(x)}</div><div className="text-sm text-white font-bold truncate">{title(x)}</div><div className="text-[11px] text-slate-400">{'date' in x.item ? formatInvoiceDate(x.item.date) : 'بيانات شريك'}</div>{x.kind === 'purchase' && <div className="text-[11px] text-slate-400">الوزن: {unitsToGhJ((x.item as Purchase).units)}</div>}</div><button onClick={() => restore(x)} className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400" title="استعادة"><RotateCcw className="w-4 h-4"/></button><button onClick={() => remove(x)} className="p-2 rounded-xl bg-rose-500/15 text-rose-400" title="حذف نهائي"><Trash2 className="w-4 h-4"/></button></div>)}
    </div>
  </div>;
};
