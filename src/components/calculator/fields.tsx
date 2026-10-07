'use client';

import React from 'react';
import { parseWeight, fmtWeight, unitsToGrams, karatDisplay } from '../../core/goldCalc';
import { formatNumber } from '../../core/calcEngine';

/* ---------- أرقام ---------- */

/** نص الإدخال → رقم (يقبل الفواصل والأرقام العربية) */
export function toNum(s: string | undefined): number {
  const v = parseFloat(
    String(s ?? '')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/٫/g, '.')
      .replace(/[,،\s]/g, '')
  );
  return Number.isFinite(v) ? v : 0;
}

/** عرض مبلغ أثناء الكتابة بفواصل: 1250000 → 1,250,000 */
function groupTyping(raw: string): string {
  const clean = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g, '.').replace(/[^\d.]/g, '');
  const [i, ...rest] = clean.split('.');
  const int = (i || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? `${int}.${rest.join('').slice(0, 4)}` : int;
}

export const money = (n: number) => formatNumber(Math.round(n), 0);

const inputCls =
  'w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl px-3.5 py-3 text-white font-mono text-base font-bold focus:outline-none';

export const Label: React.FC<{ children: React.ReactNode; hint?: React.ReactNode }> = ({ children, hint }) => (
  <div className="flex items-center justify-between gap-2 mb-1.5">
    <span className="text-xs font-bold text-slate-300">{children}</span>
    {hint ? <span className="text-[11px] text-slate-500" dir="auto">{hint}</span> : null}
  </div>
);

/** حقل مبلغ بفواصل الآلاف أثناء الكتابة */
export const MoneyField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  chips?: { label: string; value: number }[];
  suffix?: string;
}> = ({ label, value, onChange, placeholder, chips, suffix = 'ج.س' }) => (
  <div>
    <Label>{label}</Label>
    <div className="relative">
      <input
        inputMode="decimal"
        dir="ltr"
        value={groupTyping(value)}
        onChange={(e) => onChange(e.target.value.replace(/,/g, ''))}
        placeholder={placeholder}
        className={`${inputCls} text-left pl-12`}
      />
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 font-bold">{suffix}</span>
    </div>
    {chips && chips.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {chips
          .filter((c) => c.value > 0)
          .map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onChange(String(Math.round(c.value)))}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                Math.round(toNum(value)) === Math.round(c.value)
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {c.label}: <span className="font-mono">{money(c.value)}</span>
            </button>
          ))}
      </div>
    )}
  </div>
);

/** حقل وزن بالصيغة السودانية 22.6.0 مع عرض الجرام */
export const WeightField: React.FC<{
  label?: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}> = ({ label = 'الوزن (جرام.حبة.جزء)', value, onChange, compact }) => {
  const units = parseWeight(value);
  const invalid = value.trim() !== '' && units === null;
  return (
    <div>
      {!compact && <Label hint="مثال: 22.6.0">{label}</Label>}
      <input
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.0.0"
        className={`${inputCls} text-center ${invalid ? 'border-rose-500' : ''}`}
      />
      {!compact && (
        <div className="text-[11px] mt-1 px-1 font-mono text-slate-500 text-center">
          {invalid ? (
            <span className="text-rose-400">صيغة غير صحيحة — اكتب مثل 22.6.0</span>
          ) : units ? (
            <>
              = {fmtWeight(units)} <span className="text-slate-600">•</span> {unitsToGrams(units).toFixed(2)} جرام
            </>
          ) : (
            '1 جرام = 10 حبات = 100 جزء'
          )}
        </div>
      )}
    </div>
  );
};

const KARATS = ['24', '22', '21', '18'];

/** اختيار العيار: أزرار سريعة + نقاوة مخصصة (692، 650...) */
export const PurityPicker: React.FC<{
  label?: string;
  value: string;
  onChange: (v: string) => void;
  extra?: { label: string; value: string }[];
}> = ({ label = 'العيار', value, onChange, extra = [] }) => {
  const isCustom = !KARATS.includes(value) && !extra.some((x) => x.value === value);
  const n = toNum(value);
  return (
    <div>
      <Label hint={n > 0 ? <span dir="ltr" className="font-mono">{karatDisplay(n)}</span> : undefined}>{label}</Label>
      <div className="flex gap-1.5">
        {[...KARATS.map((k) => ({ label: k, value: k })), ...extra].map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => onChange(k.value)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition-colors ${
              value === k.value
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            {k.label}
          </button>
        ))}
        <input
          inputMode="numeric"
          dir="ltr"
          value={isCustom ? value : ''}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="نقاوة"
          className={`w-[4.5rem] shrink-0 bg-slate-950 border rounded-xl px-2 text-center text-xs font-mono font-bold focus:outline-none ${
            isCustom && value ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-white'
          }`}
          title="نقاوة مخصصة بالألف مثل 692"
        />
      </div>
    </div>
  );
};

/** بطاقة نتيجة */
export const ResultBox: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: 'amber' | 'emerald' | 'cyan' | 'rose' | 'slate';
  big?: boolean;
  sub?: React.ReactNode;
}> = ({ label, value, tone = 'slate', big, sub }) => {
  const color = {
    amber: 'text-amber-400 border-amber-500/40',
    emerald: 'text-emerald-400 border-emerald-500/40',
    cyan: 'text-cyan-400 border-cyan-500/30',
    rose: 'text-rose-400 border-rose-500/40',
    slate: 'text-white border-slate-800',
  }[tone];
  return (
    <div className={`bg-slate-950 rounded-2xl border ${big ? 'border-2 p-4' : 'p-3'} ${color.split(' ')[1]} min-w-0`}>
      <div className="text-[11px] text-slate-400 font-bold">{label}</div>
      <div className={`font-mono font-black ${big ? 'text-2xl' : 'text-base'} ${color.split(' ')[0]} break-words`} dir="ltr" style={{ textAlign: 'right' }}>
        {value}
      </div>
      {sub ? <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div> : null}
    </div>
  );
};
