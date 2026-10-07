'use client';

import React from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { RecordOrder, recordOrderLabel } from '../../core/recordOrder';

/** زر صغير يجلس في سطر الفلاتر: يبدّل بين «الأحدث أولاً» و«الأقدم أولاً» */
export const RecordOrderToggle: React.FC<{ order: RecordOrder; onToggle: () => void; compact?: boolean }> = ({
  order,
  onToggle,
  compact,
}) => {
  const Icon = order === 'oldest' ? ArrowUpNarrowWide : ArrowDownWideNarrow;
  return (
    <button
      type="button"
      onClick={onToggle}
      title="تبديل ترتيب السجلات"
      aria-label={`الترتيب: ${recordOrderLabel(order)} — اضغط للتبديل`}
      className={`${compact ? 'py-1.5 px-3' : 'py-2 px-3'} rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 bg-slate-900 text-sky-300 border border-sky-500/30 hover:bg-slate-800 transition-all`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{recordOrderLabel(order)}</span>
    </button>
  );
};
