'use client';

import React, { useState } from 'react';
import { ClipboardPaste, Check } from 'lucide-react';

interface PasteButtonProps {
  /** يُستدعى بالنص الملصوق (منظّفاً من الفراغات الطرفية) */
  onPaste: (text: string) => void;
  title?: string;
  /** حجم أصغر للاستخدام داخل الشاشات المزدحمة */
  compact?: boolean;
}

/**
 * زر لصق من الحافظة — لإدخال اسم أو رقم هاتف أو وزن منسوخ من واتساب.
 *
 * المتصفحات تمنع قراءة الحافظة أحياناً (بلا HTTPS أو بلا صلاحية)،
 * فنقع إلى إدخال يدوي بدل الفشل الصامت.
 */
export const PasteButton: React.FC<PasteButtonProps> = ({
  onPaste,
  title = 'الصق من الحافظة (اسم، هاتف، مبلغ...)',
  compact = false,
}) => {
  const [done, setDone] = useState(false);

  const handlePaste = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }

    if (!text || !text.trim()) {
      const manual = window.prompt('الصق النص هنا (المتصفح منع اللصق المباشر):');
      text = manual || '';
    }

    const clean = text.trim();
    if (!clean) return;

    onPaste(clean);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handlePaste}
      title={title}
      className={`shrink-0 flex items-center justify-center gap-1.5 rounded-2xl border transition-colors ${
        compact ? 'p-2.5' : 'p-3'
      } ${
        done
          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
          : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-amber-500/50 text-amber-400'
      }`}
    >
      {done ? <Check className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> : <ClipboardPaste className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {!compact && <span className="text-[11px] font-black hidden sm:inline">لصق</span>}
    </button>
  );
};

export default PasteButton;
