'use client';

import React, { useMemo, useState } from 'react';
import { History, Copy, Trash2, MessageCircle, Check, Circle, CornerDownLeft, X } from 'lucide-react';
import { sumSelected, tapeTimeLabel, tapeToText, TapeEntry } from '../../core/calcTape';
import { formatNumber } from '../../core/calcEngine';
import { openWhatsApp } from '../../core/share';

type Filter = 'all' | 'std' | 'gold';

/**
 * سجل الحسابات: كل «=» في الحاسبة وكل «حفظ» في حاسبة الذهب.
 * - «استخدم»: يرجع الرقم للحاسبة، أو يرجّع أداة الذهب بمدخلاتها.
 * - التحديد: اختر عدة حسابات → مجموعها يظهر ويمكن إدخاله في الحاسبة.
 * - نسخ / واتساب للمحدد أو للكل.
 */
export const CalcTape: React.FC<{
  tape: TapeEntry[];
  storeName: string;
  onUse: (e: TapeEntry) => void;
  onUseValue: (v: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onToast: (m: string) => void;
}> = ({ tape, storeName, onUse, onUseValue, onRemove, onClear, onToast }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const shown = useMemo(() => (filter === 'all' ? tape : tape.filter((e) => e.mode === filter)), [tape, filter]);
  const visible = showAll ? shown : shown.slice(0, 15);
  const sel = sumSelected(tape, selected);
  const selectedEntries = tape.filter((e) => selected.has(e.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const targetEntries = selectedEntries.length ? selectedEntries : shown;

  const copyText = async (entries: TapeEntry[]) => {
    try {
      await navigator.clipboard.writeText(tapeToText(entries, storeName));
      onToast(`نُسخ ${entries.length} حساب ✓`);
    } catch {
      onToast('تعذّر النسخ');
    }
  };

  if (tape.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-5 text-center space-y-1">
        <History className="w-6 h-6 mx-auto text-slate-600" />
        <div className="text-xs font-bold text-slate-400">سجل الحسابات فارغ</div>
        <div className="text-[11px] text-slate-500">كل «=» في الحاسبة وكل «حفظ» في حاسبة الذهب يظهر هنا</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
      {/* الرأس */}
      <div className="p-3 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-black text-white">سجل الحسابات</span>
            <span className="text-[11px] text-slate-500 font-mono">({tape.length})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm('مسح كل سجل الحسابات؟')) {
                onClear();
                setSelected(new Set());
              }
            }}
            className="text-[11px] text-rose-400/80 hover:text-rose-300 font-bold"
          >
            مسح السجل
          </button>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ['all', 'الكل'],
              ['std', 'العادية'],
              ['gold', 'الذهب'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border ${filter === id ? 'bg-slate-800 border-slate-600 text-amber-300' : 'border-slate-800 text-slate-500'}`}
            >
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button type="button" onClick={() => copyText(targetEntries)} className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300" title={selected.size ? 'نسخ المحدد' : 'نسخ الظاهر'}>
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => openWhatsApp(undefined, tapeToText(targetEntries, storeName))}
            className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            title={selected.size ? 'إرسال المحدد واتساب' : 'إرسال الظاهر واتساب'}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* شريط المجموع عند التحديد */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-sky-950/95 backdrop-blur border-b border-sky-500/30 px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-sky-300/80 font-bold">
              المحدد {selected.size}
              {sel.count < selected.size ? ` (${sel.count} برقم قابل للجمع)` : ''}
            </div>
            <div className="text-lg font-mono font-black text-sky-200 truncate" dir="ltr" style={{ textAlign: 'right' }}>
              {formatNumber(sel.total, 2)}
            </div>
          </div>
          <button type="button" onClick={() => onUseValue(sel.total)} disabled={sel.count === 0} className="px-3 py-2 rounded-xl bg-sky-500 text-slate-950 text-[11px] font-black disabled:opacity-40">
            للحاسبة
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="p-2 rounded-xl text-sky-300" aria-label="إلغاء التحديد">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* السطور */}
      <div className="divide-y divide-slate-800/70">
        {visible.map((e) => {
          const on = selected.has(e.id);
          return (
            <div key={e.id} className={`flex gap-2.5 px-3 py-2.5 ${on ? 'bg-sky-500/5' : ''}`}>
              <button type="button" onClick={() => toggle(e.id)} className="pt-0.5 shrink-0" aria-label={on ? 'إلغاء التحديد' : 'تحديد للجمع'}>
                {on ? (
                  <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-slate-950" />
                  </span>
                ) : (
                  <Circle className="w-5 h-5 text-slate-600" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded-md font-black ${e.mode === 'gold' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>{e.title}</span>
                  <span className="text-slate-500 font-mono">{tapeTimeLabel(e.at)}</span>
                </div>
                {e.lines.map((l, i) => (
                  <div key={i} className={`text-[11px] text-slate-400 mt-0.5 break-words ${e.mode === 'std' ? 'font-mono' : ''}`} dir={e.mode === 'std' ? 'ltr' : undefined} style={e.mode === 'std' ? { textAlign: 'right' } : undefined}>
                    {l}
                  </div>
                ))}
                <div className="text-sm font-black font-mono text-white mt-0.5 break-words" dir={e.mode === 'std' ? 'ltr' : undefined} style={e.mode === 'std' ? { textAlign: 'right' } : undefined}>
                  = {e.result}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onUse(e)}
                  className="p-1.5 rounded-lg bg-amber-500/10 text-amber-300"
                  title={e.mode === 'gold' ? 'افتح الأداة بنفس المدخلات' : 'أدخل النتيجة في الحاسبة'}
                  aria-label="استخدم"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onRemove(e.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400" aria-label="حذف">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {shown.length > visible.length && (
        <button type="button" onClick={() => setShowAll(true)} className="w-full py-3 text-xs font-bold text-amber-300 border-t border-slate-800">
          عرض الكل ({shown.length})
        </button>
      )}
    </div>
  );
};
