'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Share2, Copy, Check } from 'lucide-react';
import { PrintableInvoice, invoiceText } from '../../core/invoice';
import { shareText, openWhatsApp } from '../../core/share';
import { InvoiceSheet } from './InvoiceSheet';

type Props = {
  invoice: PrintableInvoice | null;
  currency?: string;
  onClose: () => void;
};

/**
 * معاينة الفاتورة + الطباعة.
 * الطباعة تعتمد على window.print و CSS «@media print» الذي يُظهر #print-area فقط.
 * نفس الورقة الحالية تُستخدم كمعاينة على الشاشة وكورقة A4 عند الطباعة.
 */
export const InvoicePrintModal: React.FC<Props> = ({ invoice, currency = 'ج.س', onClose }) => {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!invoice) return null;

  const text = invoiceText(invoice, currency);

  const handlePrint = () => {
    // مهلة قصيرة حتى تكتمل المعاينة قبل استدعاء نافذة الطباعة
    setTimeout(() => window.print(), 60);
  };

  const handleWhatsApp = () => {
    openWhatsApp(invoice.partyPhone, text);
  };

  const handleShare = async () => {
    await shareText(text, invoice.partyPhone);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* المتصفح لا يسمح بالنسخ — نكتفي بالطباعة/واتساب */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full max-w-md mx-auto p-3 space-y-3">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-white">{invoice.title}</div>
              <div className="text-[11px] text-amber-400 font-mono">{invoice.invoiceNo}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700" title="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* المعاينة على الشاشة — نفس ورقة الطباعة */}
        <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
          <InvoiceSheet invoice={invoice} currency={currency} />
        </div>

        <div className="grid grid-cols-2 gap-2 pb-4">
          <button
            onClick={handlePrint}
            className="col-span-2 py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Printer className="w-5 h-5" />
            <span className="text-sm">طباعة / حفظ PDF</span>
          </button>
          <button
            onClick={handleWhatsApp}
            className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            واتساب {invoice.partyPhone ? '(لرقم الزبون)' : ''}
          </button>
          <button
            onClick={handleShare}
            className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            مشاركة
          </button>
          <button
            onClick={handleCopy}
            className="col-span-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'تم نسخ نص الفاتورة' : 'نسخ نص الفاتورة'}
          </button>
        </div>

        <p className="text-[10px] text-slate-500 text-center pb-6 leading-relaxed">
          عند الطباعة يظهر كعب الفاتورة فقط بحجم A4، ويمكن اختيار «حفظ كـ PDF» من نافذة الطباعة.
        </p>
      </div>

      {/* الورقة التي تُطبع فعلياً — تُرسل إلى body مباشرة حتى لا تُقتطع عند الطباعة */}
      {mounted
        ? createPortal(
            <div id="print-area" aria-hidden="true">
              <InvoiceSheet invoice={invoice} currency={currency} />
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
