'use client';

import React from 'react';
import { EyeOff } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { ALL_BRANCHES, hiddenByBranchCount } from '../../core/branches';
import { fmtNum } from '../../core/format';

/**
 * تنبيه صغير: الفرع النشط يخفي سجلات موجودة فعلاً.
 *
 * يظهر **فقط** عندما يكون هناك فرع نشط حقيقي + توجد سجلات خارجه
 * (من فروع أخرى أو سجلات قديمة بلا فرع). ضغطة واحدة → «كل الفروع».
 */
export const BranchScopedNotice: React.FC = () => {
  const { allPurchases, allSales, allExpenses, allLoans, activeBranchId, activeBranchName, setActiveBranchId } =
    useGoldStore();

  if (activeBranchId === ALL_BRANCHES) return null;

  const hidden =
    hiddenByBranchCount(allPurchases, activeBranchId) +
    hiddenByBranchCount(allSales, activeBranchId) +
    hiddenByBranchCount(allExpenses, activeBranchId) +
    hiddenByBranchCount(allLoans, activeBranchId);

  if (hidden <= 0) return null;

  return (
    <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3 py-2.5 flex items-center gap-2.5 animate-in fade-in duration-200">
      <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0 text-[11px] leading-snug">
        <span className="font-black text-amber-300">{fmtNum(hidden)} سجل مخفي</span>
        <span className="text-slate-300"> — العرض الحالي مقيّد بـ«{activeBranchName}» فقط</span>
      </div>
      <button
        type="button"
        onClick={() => setActiveBranchId(ALL_BRANCHES)}
        className="shrink-0 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-colors"
        title="عرض كل السجلات من كل الفروع (مجمّع)"
      >
        اعرض الكل
      </button>
    </div>
  );
};

export default BranchScopedNotice;
