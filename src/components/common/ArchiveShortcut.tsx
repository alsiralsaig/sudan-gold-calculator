'use client';
import React from 'react';
import { Archive, ChevronLeft } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { ArchiveKind, openArchive } from '../../core/archiveNav';

const LABELS: Record<ArchiveKind, string> = {
  purchase: 'أرشيف المشتريات',
  sale: 'أرشيف المبيعات',
  expense: 'أرشيف المصروفات',
  loan: 'أرشيف السلفيات',
  partner: 'أرشيف الشركاء',
};

/** شريط صغير يفتح أرشيف هذا القسم مباشرة — يظهر فقط إن وُجد مؤرشف */
export const ArchiveShortcut: React.FC<{ kind: ArchiveKind }> = ({ kind }) => {
  const store = useGoldStore();
  const source =
    kind === 'purchase'
      ? store.purchases
      : kind === 'sale'
      ? store.sales
      : kind === 'expense'
      ? store.expenses
      : kind === 'loan'
      ? store.loans
      : store.partners;
  const count = source.filter((x) => x.archived).length;
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={() => openArchive(kind)}
      data-archive-shortcut={kind}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold"
    >
      <span className="flex items-center gap-1.5">
        <Archive className="w-4 h-4" />
        {LABELS[kind]}
        <span className="px-1.5 rounded-full bg-amber-500/20 text-[10px]">{count}</span>
      </span>
      <ChevronLeft className="w-4 h-4" />
    </button>
  );
};
