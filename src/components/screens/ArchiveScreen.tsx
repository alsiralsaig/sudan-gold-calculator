'use client';
import React, { useMemo, useState } from 'react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { Expense, Loan, Partner, Purchase, Sale } from '../../types';
import { fmtNum, formatDateWithTime, unitsToGhJ } from '../../core/format';
import { StickyActionBar } from '../layout/StickyActionBar';
import { SmartSearchBar } from '../common/SmartSearchBar';
import { sortRecords } from '../../core/recordOrder';
import { useRecordOrder } from '../../hooks/useRecordOrder';
import { RecordOrderToggle } from '../common/RecordOrderToggle';
import { matchLoanQuery, matchPurchaseQuery, matchSaleQuery, matchExpenseQuery, smartMatch } from '../../core/globalSearch';
import { ARCHIVE_TAB_KEY, ArchiveKind } from '../../core/archiveNav';

type AnyItem = Purchase | Sale | Expense | Partner | Loan;

const TABS: { id: ArchiveKind; label: string; active: string }[] = [
  { id: 'purchase', label: 'المشتريات', active: 'bg-blue-500 text-white' },
  { id: 'sale', label: 'المبيعات', active: 'bg-emerald-500 text-slate-950' },
  { id: 'expense', label: 'المصروفات', active: 'bg-rose-500 text-white' },
  { id: 'loan', label: 'السلفيات', active: 'bg-violet-500 text-white' },
  { id: 'partner', label: 'الشركاء', active: 'bg-amber-500 text-slate-950' },
];

const readInitialTab = (): ArchiveKind => {
  if (typeof window === 'undefined') return 'purchase';
  const saved = window.sessionStorage.getItem(ARCHIVE_TAB_KEY) as ArchiveKind | null;
  return saved && TABS.some((t) => t.id === saved) ? saved : 'purchase';
};

/** أرشيف مقسّم: كل قسم (مشتريات، مبيعات، مصروفات، سلفيات، شركاء) في تبويب مستقل بعدده وإجمالياته */
export const ArchiveScreen: React.FC = () => {
  const store = useGoldStore();
  const [recordOrder, toggleRecordOrder] = useRecordOrder();
  const [tab, setTabState] = useState<ArchiveKind>(readInitialTab);
  const [query, setQuery] = useState('');

  const setTab = (t: ArchiveKind) => {
    setTabState(t);
    try {
      window.sessionStorage.setItem(ARCHIVE_TAB_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const archived = {
    purchase: store.purchases.filter((x) => x.archived),
    sale: store.sales.filter((x) => x.archived),
    expense: store.expenses.filter((x) => x.archived),
    loan: store.loans.filter((x) => x.archived),
    partner: store.partners.filter((x) => x.archived),
  } as Record<ArchiveKind, AnyItem[]>;

  const list = archived[tab];
  const items: AnyItem[] = sortRecords(
    list.map((item) => ({ ...item, date: (item as { date?: string }).date })),
    recordOrder
  ) as AnyItem[];

  const matches = (item: AnyItem, q: string): boolean => {
    if (tab === 'purchase') return matchPurchaseQuery(item as Purchase, q);
    if (tab === 'sale') return matchSaleQuery(item as Sale, q);
    if (tab === 'expense') return matchExpenseQuery(item as Expense, q);
    if (tab === 'loan') return matchLoanQuery(item as Loan, q);
    const partner = item as Partner;
    return smartMatch(q, { texts: [partner.name, partner.notes], phones: [partner.phone], amounts: [partner.capital, partner.profitPercent] });
  };

  const shown = useMemo(
    () => (query.trim() ? items.filter((x) => matches(x, query)) : items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, items.map((x) => `${x.id}:${x.updatedAt}`).join('|'), query]
  );

  const restoreOne = (kind: ArchiveKind, id: string) =>
    kind === 'purchase'
      ? store.restorePurchase(id)
      : kind === 'sale'
      ? store.restoreSale(id)
      : kind === 'expense'
      ? store.restoreExpense(id)
      : kind === 'loan'
      ? store.restoreLoan(id)
      : store.restorePartner(id);
  const deleteOne = (kind: ArchiveKind, id: string) =>
    kind === 'purchase'
      ? store.deletePurchase(id)
      : kind === 'sale'
      ? store.deleteSale(id)
      : kind === 'expense'
      ? store.deleteExpense(id)
      : kind === 'loan'
      ? store.deleteLoan(id)
      : store.deletePartner(id);

  const tabLabel = TABS.find((t) => t.id === tab)?.label || '';
  const remove = (id: string) => {
    if (confirm('حذف نهائي؟ لا يمكن استعادة هذا السجل بعد ذلك.')) deleteOne(tab, id);
  };
  const restoreAll = () => {
    if (shown.length && confirm(`استعادة ${shown.length} سجل إلى ${tabLabel}؟ ستُحسب ضمن الإجماليات من جديد.`))
      shown.forEach((x) => restoreOne(tab, x.id));
  };
  const deleteAll = () => {
    if (shown.length && confirm(`حذف ${shown.length} سجل من أرشيف ${tabLabel} نهائياً؟ لا يمكن التراجع.`))
      shown.forEach((x) => deleteOne(tab, x.id));
  };

  const title = (item: AnyItem) => {
    if (tab === 'purchase') {
      const p = item as Purchase;
      return `${p.seller || 'مورد عام'} — ${fmtNum(p.amount)} ج.س`;
    }
    if (tab === 'sale') {
      const s = item as Sale;
      return `${s.buyer || 'مشتري عام'} — ${fmtNum(s.sellAmount)} ج.س`;
    }
    if (tab === 'expense') {
      const e = item as Expense;
      return `${e.name} — ${fmtNum(e.amount)} ج.س`;
    }
    if (tab === 'loan') {
      const loan = item as Loan;
      return `${loan.direction === 'lent' ? 'لنا على' : 'علينا لـ'} ${loan.person} — ${fmtNum(loan.amount)} ج.س`;
    }
    return (item as Partner).name;
  };
  const sub = (item: AnyItem) => {
    const parts: string[] = [];
    const d = (item as { date?: string }).date;
    parts.push(d ? formatDateWithTime(d) : 'بيانات شريك');
    if (tab === 'purchase' || tab === 'sale') parts.push(`الوزن: ${unitsToGhJ((item as Purchase).units)}`);
    if ((item as { invoiceNo?: string }).invoiceNo) parts.push(`فاتورة ${(item as { invoiceNo?: string }).invoiceNo}`);
    return parts.join(' • ');
  };

  // إجماليات التبويب الحالي (لما يظهر في البحث)
  const totals = useMemo(() => {
    let amount = 0;
    let units = 0;
    shown.forEach((x) => {
      if (tab === 'purchase') {
        amount += (x as Purchase).amount || 0;
        units += (x as Purchase).units || 0;
      } else if (tab === 'sale') {
        amount += (x as Sale).sellAmount || 0;
        units += (x as Sale).units || 0;
      } else if (tab === 'expense') amount += (x as Expense).amount || 0;
      else if (tab === 'loan') amount += (x as Loan).amount || 0;
      else amount += (x as Partner).capital || 0;
    });
    return { amount, units };
  }, [shown, tab]);

  const stats: { label: string; value: string; tone: 'amber' | 'blue' | 'emerald' | 'rose' }[] = [
    { label: query.trim() ? 'مطابق للبحث' : `مؤرشف ${tabLabel}`, value: String(shown.length), tone: 'amber' },
    { label: tab === 'partner' ? 'رأس المال' : 'الإجمالي (ج.س)', value: fmtNum(totals.amount), tone: 'blue' },
  ];
  if (tab === 'purchase' || tab === 'sale') stats.push({ label: 'الوزن', value: unitsToGhJ(totals.units), tone: 'emerald' });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 text-center">
        <Archive className="w-9 h-9 mx-auto text-amber-400 mb-2" />
        <h2 className="text-lg font-black text-amber-300">الأرشيف</h2>
        <p className="text-xs text-slate-400 mt-1">كل قسم في تبويب منفصل — المؤرشف لا يُحسب في الإجماليات، والاستعادة ترجّعه للحساب فوراً</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-archive-tab={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 border transition ${
              tab === t.id ? `${t.active} border-transparent` : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            {t.label}
            <span className={`min-w-5 px-1.5 rounded-full text-[10px] ${tab === t.id ? 'bg-black/20' : 'bg-slate-800 text-slate-400'}`}>
              {archived[t.id].length}
            </span>
          </button>
        ))}
      </div>

      <SmartSearchBar value={query} onChange={setQuery} placeholder={`ابحث في أرشيف ${tabLabel}: اسم، مبلغ، وزن، هاتف...`}>
        <RecordOrderToggle order={recordOrder} onToggle={toggleRecordOrder} />
      </SmartSearchBar>

      {shown.length > 0 && (
        <div className="flex gap-2">
          <button onClick={restoreAll} className="flex-1 py-2 rounded-2xl bg-emerald-500/15 text-emerald-400 text-xs font-black flex items-center justify-center gap-1.5">
            <RotateCcw className="w-4 h-4" /> استعادة الكل ({shown.length})
          </button>
          <button onClick={deleteAll} className="flex-1 py-2 rounded-2xl bg-rose-500/15 text-rose-400 text-xs font-black flex items-center justify-center gap-1.5">
            <Trash2 className="w-4 h-4" /> حذف الكل نهائياً
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        {list.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">لا توجد سجلات مؤرشفة في {tabLabel}</div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">لا نتائج مطابقة للبحث</div>
        ) : (
          shown.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-4 border-b border-slate-800 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-bold truncate">{title(item)}</div>
                <div className="text-[11px] text-slate-400">{sub(item)}</div>
              </div>
              <button onClick={() => restoreOne(tab, item.id)} className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400" title="استعادة">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => remove(item.id)} className="p-2 rounded-xl bg-rose-500/15 text-rose-400" title="حذف نهائي">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <StickyActionBar
        stats={stats}
        columns={stats.length}
        hint="السجلات المؤرشفة مستثناة من الأرباح والمخزون — يمكن استعادتها في أي وقت"
      />
    </div>
  );
};
