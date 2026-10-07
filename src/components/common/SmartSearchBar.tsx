'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search, X, ChevronUp } from 'lucide-react';
import { PasteButton } from './PasteButton';

interface SmartSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** لون الحدود عند الكتابة */
  accent?: 'amber' | 'rose';
  /** الفلاتر التي تُعرض في نفس سطر العدسة (توفير مساحة أعلى الصفحة) */
  children?: React.ReactNode;
}

/**
 * عدسة بحث مطوية: زر عدسة صغير يجلس في سطر الفلاتر،
 * وعند الضغط ينفتح حقل البحث كاملاً (مع زر اللصق) ويُلغي الضغط زر الإغلاق.
 *
 * الهدف: البحث موجود دائماً لكنه لا يأكل مساحة أعلى الشاشة على التلفون.
 * التصفية النشطة تبقى مطبّقة بعد الطي، وتُعلَّم العدسة بنقطة كهرمانية.
 */
export const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  value,
  onChange,
  placeholder,
  accent = 'amber',
  children,
}) => {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = value.trim().length > 0;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const focusClass = accent === 'rose' ? 'focus:border-rose-400' : 'focus:border-amber-400';

  // مغلق: زر عدسة صغير في نفس سطر الفلاتر — لا يستهلك أي سطر إضافي
  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="بحث"
          title={active ? `بحث نشط: ${value}` : 'بحث (اسم، هاتف، مبلغ، وزن...)'}
          className={`relative shrink-0 p-2.5 rounded-2xl border transition-colors ${
            active
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40'
          }`}
        >
          <Search className="w-4 h-4" />
          {active && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950" />
          )}
        </button>

        {children && (
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center gap-2">{children}</div>
        )}
      </div>
    );
  }

  // مفتوح: حقل البحث كاملاً + لصق + إغلاق
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={placeholder}
            className={`w-full bg-slate-900 border border-slate-800 ${focusClass} rounded-2xl py-3 px-4 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none shadow-md transition-colors`}
          />
          {active ? (
            <button
              type="button"
              onClick={() => {
                onChange('');
                inputRef.current?.focus();
              }}
              aria-label="مسح البحث"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          )}
        </div>

        <PasteButton onPaste={onChange} compact />

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق البحث"
          title="إغلاق البحث (تبقى التصفية مطبّقة)"
          className="shrink-0 p-2.5 rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:border-amber-500/40 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {children && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">{children}</div>
      )}
    </div>
  );
};

export default SmartSearchBar;
