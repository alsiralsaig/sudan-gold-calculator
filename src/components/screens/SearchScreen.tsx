'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  HandCoins,
  Users,
  Building2,
  Archive,
  Copy,
  Check,
  ArrowLeft,
  Filter,
  Sparkles,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  KIND_LABELS,
  KIND_SCREEN,
  SearchHit,
  SearchKind,
  hitShareText,
  searchAll,
} from '../../core/globalSearch';
import { fmtNum, formatInvoiceDate, kCurrency, unitsToGhJ, unitsToGramsDecimal } from '../../core/format';
import { ShareButtons } from '../common/ShareButtons';

interface SearchScreenProps {
  onNavigate: (tab: string) => void;
}

const KIND_ICON: Record<SearchKind, React.ComponentType<{ className?: string }>> = {
  purchase: ShoppingBag,
  sale: DollarSign,
  expense: TrendingDown,
  loan: HandCoins,
  partner: Users,
  branch: Building2,
};

const KIND_TONE: Record<SearchKind, string> = {
  purchase: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  sale: 'text-green-400 bg-green-500/10 border-green-500/30',
  expense: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  loan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  partner: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  branch: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

const ALL_KINDS: SearchKind[] = ['purchase', 'sale', 'expense', 'loan', 'partner', 'branch'];

const EXAMPLES = ['أحمد', '500000', '5.3.2', 'عيار 21', '0912', 'KH1'];

export const SearchScreen: React.FC<SearchScreenProps> = ({ onNavigate }) => {
  const {
    allPurchases,
    allSales,
    allExpenses,
    allLoans,
    partners,
    branches,
    storeName,
  } = useGoldStore();

  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | SearchKind>('all');
  const [showArchived, setShowArchived] = useState(true);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(
    () =>
      searchAll(
        {
          purchases: allPurchases,
          sales: allSales,
          expenses: allExpenses,
          loans: allLoans,
          partners,
          branches,
        },
        query
      ),
    [allPurchases, allSales, allExpenses, allLoans, partners, branches, query]
  );

  const hits = useMemo(
    () =>
      result.hits
        .filter((h) => kindFilter === 'all' || h.kind === kindFilter)
        .filter((h) => showArchived || !h.archived),
    [result.hits, kindFilter, showArchived]
  );

  const archivedCount = result.hits.filter((h) => h.archived).length;
  const hasQuery = query.trim().length > 0;

  const copyHit = async (hit: SearchHit) => {
    try {
      await navigator.clipboard.writeText(hitShareText(storeName, hit));
    } catch {
      /* بعض المتصفحات تمنع النسخ */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ==================== حقل البحث ==================== */}
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في كل شيء: اسم، مبلغ، وزن، هاتف، رقم فاتورة..."
              className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-2xl py-3 px-4 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
              autoFocus
            />
            {hasQuery && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* أمثلة سريعة */}
        {!hasQuery && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              جرّب:
            </span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-500 leading-relaxed">
          يبحث في <span className="text-slate-300 font-bold">كل الصفحات</span>: المشتريات، المبيعات، المصروفات،
          السلف، الشركاء، الفروع — بما فيها المؤرشفة. الأسماء تُطابق بأي تشكيل (إبراهيم = ابراهيم)، والمبالغ
          بجزء الرقم (500 يجد 500,000)، والأوزان بـ <span className="font-mono text-slate-300">ج.ح.ز</span> (مثل 5.3.2)
          أو بالجرام.
        </p>
      </div>

      {/* ==================== الفلاتر ==================== */}
      {hasQuery && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setKindFilter('all')}
              className={`shrink-0 py-2 px-3 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 ${
                kindFilter === 'all'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              الكل ({result.total})
            </button>
            {ALL_KINDS.map((kind) => {
              const Icon = KIND_ICON[kind];
              const count = result.counts[kind];
              if (count === 0) return null;
              return (
                <button
                  key={kind}
                  onClick={() => setKindFilter(kind)}
                  className={`shrink-0 py-2 px-3 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 border ${
                    kindFilter === kind ? KIND_TONE[kind] : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {KIND_LABELS[kind]} ({count})
                </button>
              );
            })}
          </div>

          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`w-full py-2 rounded-2xl text-[11px] font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                showArchived
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? `المؤرشف ظاهر (${archivedCount}) — اضغط لإخفائه` : `إظهار المؤرشف (${archivedCount})`}
            </button>
          )}
        </>
      )}

      {/* ==================== النتائج ==================== */}
      {hasQuery && (
        <div className="space-y-2">
          {hits.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl py-12 text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p className="text-sm text-slate-300 font-bold">لا توجد نتائج لـ «{query}»</p>
              <p className="text-[11px] text-slate-500">
                جرّب جزءاً من الاسم، أو جزءاً من المبلغ (500 بدل 500,000)، أو الوزن بصيغة ج.ح.ز
              </p>
            </div>
          ) : (
            <>
              <div className="text-[11px] text-slate-400 px-1">
                {hits.length} نتيجة{result.truncated ? ` (من أصل ${result.total} — أضف تفاصيل للبحث أدق)` : ''}
              </div>
              {hits.map((hit) => {
                const Icon = KIND_ICON[hit.kind];
                return (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    onClick={() => setSelected(hit)}
                    className="w-full text-right bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3.5 transition-colors space-y-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${KIND_TONE[hit.kind]}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-white truncate">{hit.title}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${KIND_TONE[hit.kind]}`}>
                            {KIND_LABELS[hit.kind]}
                          </span>
                          {hit.archived && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
                              مؤرشف
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">{hit.subtitle}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {hit.date && (
                            <span className="text-[10px] text-slate-500">{formatInvoiceDate(hit.date)}</span>
                          )}
                          {hit.matched.slice(0, 3).map((m) => (
                            <span key={m} className="text-[9px] text-slate-500 bg-slate-950 border border-slate-800 rounded-md px-1.5 py-0.5">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      {hit.amount !== undefined && hit.amount > 0 && (
                        <div className="text-left shrink-0">
                          <div className="text-sm font-black font-mono text-amber-300">{fmtNum(hit.amount)}</div>
                          <div className="text-[9px] text-slate-500">{kCurrency}</div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ==================== شاشة قبل الكتابة ==================== */}
      {!hasQuery && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
          <h3 className="text-xs font-black text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-400" />
            بحث واحد في كل البيانات
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'أسماء أشخاص', hint: 'البائع، الزبون، الشريك، السلفة' },
              { label: 'مبالغ', hint: 'جزء من الرقم يكفي: 500' },
              { label: 'أوزان', hint: '5.3.2 بجرام وحبة وجزء' },
              { label: 'هواتف وفواتير', hint: '0912 أو KH1-0001' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                <div className="text-[11px] font-black text-slate-200">{item.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{item.hint}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            مثال: اكتب «أحمد» لتظهر كل عملياته في المبيعات والمصروفات والمشتريات، أو اكتب «5.3.2» ليجد الفاتورة
            بوزنها أينما كانت.
          </p>
        </div>
      )}

      {/* ==================== تفاصيل النتيجة ==================== */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${KIND_TONE[selected.kind]}`}>
                  {React.createElement(KIND_ICON[selected.kind], { className: 'w-4 h-4' })}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-black truncate">{selected.title}</div>
                  <div className="text-[10px] text-slate-400">{KIND_LABELS[selected.kind]}</div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <DetailRow label="التفاصيل" value={selected.subtitle} />
              {selected.amount !== undefined && selected.amount > 0 && (
                <DetailRow label="المبلغ" value={`${fmtNum(selected.amount)} ${kCurrency}`} strong />
              )}
              {selected.units !== undefined && selected.units > 0 && (
                <DetailRow
                  label="الوزن"
                  value={`${unitsToGhJ(selected.units)} ج.ح.ز (${unitsToGramsDecimal(selected.units).toFixed(2)} جرام)`}
                />
              )}
              {selected.date && <DetailRow label="التاريخ" value={formatInvoiceDate(selected.date)} />}
              <DetailRow label="سبب الظهور" value={selected.matched.join('، ')} />
              {selected.archived && <DetailRow label="الحالة" value="مؤرشف — في الأرشيف" />}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const screen = KIND_SCREEN[selected.kind];
                  setSelected(null);
                  onNavigate(screen);
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                افتح في {KIND_LABELS[selected.kind]}
              </button>
              <button
                onClick={() => copyHit(selected)}
                className="py-3 px-4 bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-200 font-black text-xs rounded-2xl flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم' : 'نسخ'}
              </button>
            </div>

            {(selected.kind === 'sale' || selected.kind === 'purchase' || selected.kind === 'loan') && (
              <ShareButtons text={hitShareText(storeName, selected)} label="إرسال التفاصيل على واتساب" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-start justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span className={`text-left ${strong ? 'font-black text-amber-300 font-mono' : 'text-slate-200'}`}>{value}</span>
  </div>
);

export default SearchScreen;
