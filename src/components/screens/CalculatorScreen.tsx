'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator as CalcIcon, Coins } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { StandardCalculator, InsertRequest } from '../calculator/StandardCalculator';
import { GoldCalculator, GoldTool, GOLD_TOOLS, RestoreRequest } from '../calculator/GoldCalculator';
import { CalcTape } from '../calculator/CalcTape';
import { useCalcTape } from '../../hooks/useCalcTape';
import { TapeEntry } from '../../core/calcTape';

const MODE_KEY = 'gold_calc_mode_v1';
type Mode = 'gold' | 'standard';

/**
 * شاشة الحاسبة: حاسبة عادية متطورة + حاسبة ذهب بست أدوات + سجل حسابات مشترك.
 * آخر وضع وأداة وكل المدخلات تُحفظ على الجهاز.
 */
export const CalculatorScreen: React.FC = () => {
  const { rates, approvedPrice, storeName } = useGoldStore();
  const { tape, add, remove, clear } = useCalcTape();

  const [mode, setModeState] = useState<Mode>('gold');
  const [tool, setToolState] = useState<GoldTool>('value');
  const [insert, setInsert] = useState<InsertRequest | null>(null);
  const [restore, setRestore] = useState<RestoreRequest | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MODE_KEY) || '{}');
      if (saved.mode === 'gold' || saved.mode === 'standard') setModeState(saved.mode);
      if (GOLD_TOOLS.some((t) => t.id === saved.tool)) setToolState(saved.tool);
    } catch {
      /* تجاهل */
    }
  }, []);

  const persist = (m: Mode, t: GoldTool) => {
    try {
      localStorage.setItem(MODE_KEY, JSON.stringify({ mode: m, tool: t }));
    } catch {
      /* تجاهل */
    }
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    persist(m, tool);
  };
  const setTool = useCallback(
    (t: GoldTool) => {
      setToolState(t);
      persist(mode, t);
    },
    [mode]
  );

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  }, []);

  const price21 = Number(rates.karat21) || 0;
  const approved = approvedPrice ? { buy: approvedPrice.buy, sell: approvedPrice.sell } : null;

  const sendToCalculator = (value: number) => {
    setModeState('standard');
    persist('standard', tool);
    setInsert({ value, nonce: Date.now() });
    showToast('أُدخل في الحاسبة');
  };

  const applyEntry = (e: TapeEntry) => {
    if (e.mode === 'gold' && e.restore) {
      setModeState('gold');
      setRestore({ ...e.restore, nonce: Date.now() });
      showToast(`فُتحت «${e.title}» بنفس المدخلات`);
    } else if (typeof e.value === 'number') {
      sendToCalculator(e.value);
    }
  };

  const quick = [
    { label: 'سعر 21', value: price21 },
    ...(approved ? [{ label: 'شراء', value: approved.buy }, { label: 'بيع', value: approved.sell }] : []),
    { label: 'الدولار', value: Number(rates.usdRate) || 0 },
  ];

  return (
    <div className="space-y-4 pb-6 animate-in fade-in duration-200">
      {/* الوضع */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-3xl shadow-lg">
        {(
          [
            ['gold', 'حاسبة الذهب', Coins],
            ['standard', 'حاسبة عادية', CalcIcon],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`py-3 px-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
              mode === id ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {mode === 'standard' ? (
        <StandardCalculator onCommit={add} insert={insert} quick={quick} onToast={showToast} />
      ) : (
        <GoldCalculator tool={tool} setTool={setTool} price21={price21} approved={approved} onSave={add} onToast={showToast} restore={restore} />
      )}

      <CalcTape tape={tape} storeName={storeName} onUse={applyEntry} onUseValue={sendToCalculator} onRemove={remove} onClear={clear} onToast={showToast} />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4" style={{ bottom: 'calc(var(--sab-h, 0px) + 20px)' }} role="status">
          <div className="rounded-full bg-slate-800/95 border border-slate-600 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-black/50">{toast}</div>
        </div>
      )}
    </div>
  );
};
