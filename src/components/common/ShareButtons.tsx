'use client';

import React, { useState } from 'react';
import { MessageCircle, Copy, Share2, Check } from 'lucide-react';
import { openWhatsApp, shareText } from '../../core/share';

interface ShareButtonsProps {
  text: string;
  phone?: string;
  /** نص مختصر للزر */
  label?: string;
  /** إظهار زر النسخ */
  showCopy?: boolean;
  /** حجم صغير للأزرار داخل الجداول */
  compact?: boolean;
  onShared?: (result: 'shared' | 'copied' | 'whatsapp') => void;
}

/**
 * أزرار مشاركة: واتساب مباشر (مع رقم الطرف) + نسخ + مشاركة النظام.
 */
export const ShareButtons: React.FC<ShareButtonsProps> = ({
  text,
  phone,
  label = 'إرسال على واتساب',
  showCopy = true,
  compact = false,
  onShared,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* تجاهل — بعض المتصفحات تمنع النسخ */
    }
    setCopied(true);
    onShared?.('copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const result = await shareText(text, phone);
    onShared?.(result);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openWhatsApp(phone, text);
          }}
          className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300"
          title={phone ? 'إرسال على واتساب' : 'مشاركة على واتساب (اختر جهة الاتصال)'}
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
        {showCopy && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="نسخ نص الفاتورة"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border border-emerald-500/50"
      >
        <MessageCircle className="w-4 h-4" />
        {label}
      </button>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 flex items-center gap-1.5"
          title="نسخ النص"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      )}
    </div>
  );
};

interface ShareIconButtonProps {
  text: string;
  phone?: string;
  title?: string;
}

/** زر أيقونة فقط — للجداول والصفوف */
export const ShareIconButton: React.FC<ShareIconButtonProps> = ({ text, phone, title = 'إرسال' }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      openWhatsApp(phone, text);
    }}
    className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300"
    title={title}
  >
    <MessageCircle className="w-3.5 h-3.5" />
  </button>
);

interface ShareMenuProps {
  text: string;
  phone?: string;
  className?: string;
}

/** زر مشاركة عام (يفضّل مشاركة النظام ثم واتساب ثم النسخ) */
export const ShareMenu: React.FC<ShareMenuProps> = ({ text, phone, className }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await shareText(text, phone);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className={
        className ||
        'px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5'
      }
      title="مشاركة"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
      مشاركة
    </button>
  );
};
