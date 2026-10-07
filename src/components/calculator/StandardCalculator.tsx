'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import {
  applyKey,
  CalcKey,
  CalcState,
  currentValue,
  EMPTY_CALC,
  formatExpr,
  formatNumber,
  livePreview,
  normalizeExpr,
  evaluate,
} from '../../core/calcEngine';
import { makeEntry, TapeEntry } from '../../core/calcTape';

const MEM_KEY = 'gold_calc_memory_v1';

export interface InsertRequest {
  value: number;
  nonce: number;
}

const PressCtx = React.createContext<(k: CalcKey) => void>(() => undefined);

/** زر الحاسبة — خارج المكوّن حتى لا يُعاد إنشاؤه مع كل ضغطة */
const K = ({
  children,
  k,
  variant = 'num',
  span,
  label,
}: {
  children: React.ReactNode;
  k: CalcKey;
  variant?: 'num' | 'op' | 'fn' | 'clear' | 'eq';
  span?: number;
  label?: string;
}) => {
  const press = React.useContext(PressCtx);
  const cls = {
    num: 'bg-slate-950 text-white border border-slate-800 hover:bg-slate-800',
    op: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 text-2xl',
    fn: 'bg-slate-800 text-amber-300 hover:bg-slate-700',
    clear: 'bg-rose-700 text-white hover:bg-rose-600',
    eq: 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 text-2xl shadow-lg shadow-amber-500/25',
  }[variant];
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => press(k)}
      className={`h-14 sm:h-16 rounded-2xl font-black text-xl flex items-center justify-center active:scale-95 transition-transform select-none ${cls}`}
      style={span ? { gridColumn: `span ${span} / span ${span}` } : undefined}
    >
      {children}
    </button>
  );
};


/**
 * الحاسبة العادية:
 * نتيجة حية أثناء الكتابة، فواصل آلاف، نسبة تجارية، ذاكرة، 000،
 * إدراج سريع لسعر 21 والدولار، لوحة مفاتيح الكمبيوتر، وكل «=» يُحفظ في السجل.
 */
export const StandardCalculator: React.FC<{
  onCommit: (e: TapeEntry) => void;
  insert?: InsertRequest | null;
  quick: { label: string; value: number }[];
  onToast: (msg: string) => void;
}> = ({ onCommit, insert, quick, onToast }) => {
  const [state, setState] = useState<CalcState>(EMPTY_CALC);
  const [memory, setMemory] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const m = parseFloat(localStorage.getItem(MEM_KEY) || '0');
      if (Number.isFinite(m)) setMemory(m);
    } catch {
      /* تجاهل */
    }
  }, []);
  const saveMemory = (m: number) => {
    setMemory(m);
    try {
      localStorage.setItem(MEM_KEY, String(m));
    } catch {
      /* تجاهل */
    }
  };

  const press = useCallback(
    (key: CalcKey) => {
      const { state: next, commit } = applyKey(stateRef.current, key);
      stateRef.current = next;
      setState(next);
      if (commit) {
        onCommit(
          makeEntry({
            mode: 'std',
            title: 'الحاسبة',
            lines: [formatExpr(commit.expr)],
            result: formatNumber(commit.value),
            value: commit.value,
          })
        );
      }
    },
    [onCommit]
  );

  // إدراج من السجل أو الأزرار السريعة
  useEffect(() => {
    if (insert) press({ k: 'insert', value: insert.value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insert?.nonce]);

  // لوحة مفاتيح الكمبيوتر
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.fixed.inset-0')) return; // نافذة مفتوحة
      const k = e.key;
      let key: CalcKey | null = null;
      if (/^[0-9]$/.test(k)) key = { k: 'digit', d: k };
      else if (k === '.' || k === ',') key = { k: 'dot' };
      else if (k === '+') key = { k: 'op', op: '+' };
      else if (k === '-') key = { k: 'op', op: '−' };
      else if (k === '*' || k === 'x') key = { k: 'op', op: '×' };
      else if (k === '/') key = { k: 'op', op: '÷' };
      else if (k === '%') key = { k: 'pct' };
      else if (k === '(' || k === ')') key = { k: 'paren' };
      else if (k === 'Enter' || k === '=') key = { k: 'equals' };
      else if (k === 'Backspace') key = { k: 'back' };
      else if (k === 'Escape' || k === 'Delete') key = { k: 'clear' };
      if (key) {
        e.preventDefault();
        press(key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const preview = livePreview(state);
  const showResult = state.justEvaluated;
  const mainText = state.error
    ? state.error
    : showResult
      ? formatNumber(currentValue(state) ?? 0)
      : preview !== null
        ? formatNumber(preview)
        : state.expr
          ? formatExpr(state.expr)
          : '0';
  const topText = showResult && state.lastExpr ? formatExpr(state.lastExpr) : state.error || preview !== null ? formatExpr(state.expr) : '';
  const size = mainText.length > 16 ? 'text-2xl' : mainText.length > 11 ? 'text-3xl' : 'text-4xl';

  const copyValue = async () => {
    const v = currentValue(state);
    if (v === null) return;
    try {
      await navigator.clipboard.writeText(String(v));
      onToast(`نُسخ: ${formatNumber(v)}`);
    } catch {
      onToast('تعذّر النسخ');
    }
  };

  const pasteValue = async () => {
    try {
      const t = await navigator.clipboard.readText();
      const r = evaluate(normalizeExpr(t));
      if (r.ok === true) press({ k: 'insert', value: r.value });
      else onToast('الحافظة لا تحتوي رقماً');
    } catch {
      onToast('اسمح بالوصول للحافظة');
    }
  };

  const mem = (op: 'mc' | 'mr' | 'm+' | 'm-') => {
    if (op === 'mc') return saveMemory(0);
    if (op === 'mr') return press({ k: 'insert', value: memory });
    const v = currentValue(stateRef.current);
    if (v === null) return onToast('أكمل الحساب أولاً');
    saveMemory(op === 'm+' ? memory + v : memory - v);
    onToast(`الذاكرة: ${formatNumber(op === 'm+' ? memory + v : memory - v)}`);
  };

  return (
    <PressCtx.Provider value={press}>
    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-3 sm:p-5 space-y-3 shadow-2xl max-w-md mx-auto">
      {/* الشاشة */}
      <button
        type="button"
        onClick={copyValue}
        title="اضغط للنسخ"
        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 pt-3 pb-3.5 min-h-[118px] flex flex-col justify-end gap-1 text-right"
      >
        <div className="flex items-center justify-between w-full text-[11px] min-h-[16px]">
          <span className="text-slate-600">{memory !== 0 ? <span className="text-sky-400 font-black">M {formatNumber(memory, 2)}</span> : 'اضغط للنسخ'}</span>
          {preview !== null && !showResult && !state.error && <span className="text-slate-600">النتيجة الحية</span>}
        </div>
        <div dir="ltr" className="w-full text-right text-sm text-slate-400 font-mono overflow-x-auto whitespace-nowrap min-h-[20px] no-scrollbar">
          {topText}
          {showResult && topText ? ' =' : ''}
        </div>
        <div
          dir="ltr"
          className={`w-full text-right font-mono font-black overflow-x-auto whitespace-nowrap no-scrollbar ${size} ${
            state.error ? 'text-rose-400 !text-xl' : showResult ? 'text-amber-400' : preview !== null ? 'text-slate-300' : 'text-white'
          }`}
        >
          {mainText}
        </div>
      </button>

      {/* الذاكرة + لصق */}
      <div className="grid grid-cols-5 gap-1.5">
        {(
          [
            ['mc', 'MC'],
            ['mr', 'MR'],
            ['m+', 'M+'],
            ['m-', 'M−'],
          ] as const
        ).map(([op, label]) => (
          <button
            key={op}
            type="button"
            dir="ltr"
            onClick={() => mem(op)}
            className={`py-2 rounded-xl text-xs font-black border ${
              op === 'mr' && memory !== 0
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={pasteValue} className="py-2 rounded-xl text-xs font-black border bg-slate-950 border-slate-800 text-slate-400 hover:text-white">
          لصق
        </button>
      </div>

      {/* إدراج سريع */}
      {quick.some((q) => q.value > 0) && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {quick
            .filter((q) => q.value > 0)
            .map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => press({ k: 'insert', value: q.value })}
                className="shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-300"
              >
                {q.label}: <span className="font-mono">{formatNumber(q.value, 0)}</span>
              </button>
            ))}
        </div>
      )}

      {/* الأزرار */}
      <div className="grid grid-cols-4 gap-2">
        <K k={{ k: 'clear' }} variant="clear" label="مسح">C</K>
        <K k={{ k: 'paren' }} variant="fn" label="أقواس">( )</K>
        <K k={{ k: 'pct' }} variant="fn" label="نسبة">%</K>
        <K k={{ k: 'back' }} variant="fn" label="رجوع حرف">
          <Delete className="w-6 h-6 text-rose-400" />
        </K>

        <K k={{ k: 'digit', d: '7' }}>7</K>
        <K k={{ k: 'digit', d: '8' }}>8</K>
        <K k={{ k: 'digit', d: '9' }}>9</K>
        <K k={{ k: 'op', op: '÷' }} variant="op">÷</K>

        <K k={{ k: 'digit', d: '4' }}>4</K>
        <K k={{ k: 'digit', d: '5' }}>5</K>
        <K k={{ k: 'digit', d: '6' }}>6</K>
        <K k={{ k: 'op', op: '×' }} variant="op">×</K>

        <K k={{ k: 'digit', d: '1' }}>1</K>
        <K k={{ k: 'digit', d: '2' }}>2</K>
        <K k={{ k: 'digit', d: '3' }}>3</K>
        <K k={{ k: 'op', op: '−' }} variant="op">−</K>

        <K k={{ k: 'neg' }} variant="fn" label="تغيير الإشارة">±</K>
        <K k={{ k: 'digit', d: '0' }}>0</K>
        <K k={{ k: 'dot' }}>.</K>
        <K k={{ k: 'op', op: '+' }} variant="op">+</K>

        <K k={{ k: 'triple0' }} variant="num">000</K>
        <K k={{ k: 'equals' }} variant="eq" span={3} label="يساوي">=</K>
      </div>

      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
        النسبة تجارية:{' '}
        <span dir="ltr" className="inline-block font-mono">1,000 + 10% = 1,100</span> •{' '}
        <span dir="ltr" className="inline-block font-mono">1,000 − 10% = 900</span> •{' '}
        <span dir="ltr" className="inline-block font-mono">1,000 × 10% = 100</span>
      </p>
    </div>
    </PressCtx.Provider>
  );
};
