import { Purchase, Sale } from '../types';
import { purchasePending, salePending } from './accounting';
import { unitsToGhJ, fmtNum, kCurrency } from './format';
import { purityLabel } from './purity';
import { arabicDate, relativeDays } from './dates';

/**
 * بناء نصوص الفواتير والتذكيرات ومشاركتها عبر واتساب.
 * الدوال النصية نقية (قابلة للاختبار)، ودوال المشاركة تعمل في المتصفح فقط.
 */

/** توحيد رقم الهاتف السوداني: 09xxxxxxxx → 2499xxxxxxxx */
export function normalizePhone(raw?: string): string {
  if (!raw) return '';
  let digits = String(raw)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('249')) return digits;
  if (digits.startsWith('0')) return `249${digits.slice(1)}`;
  if (digits.length === 9) return `249${digits}`;
  return digits;
}

export function whatsappUrl(phone: string | undefined, text: string): string {
  const normalized = normalizePhone(phone);
  const encoded = encodeURIComponent(text);
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export interface InvoiceShareInput {
  storeName: string;
  kind: 'sale' | 'purchase';
  date: string;
  units: number;
  purity: number;
  pricePerGram?: number;
  amount: number;
  paid: number;
  pending: number;
  notes?: string;
  dueDate?: string;
  currency?: string;
}

/** نص فاتورة منسّق للإرسال على واتساب */
export function buildInvoiceText(input: InvoiceShareInput): string {
  const currency = input.currency || kCurrency;
  const isSale = input.kind === 'sale';
  const lines: string[] = [];

  lines.push(`*${input.storeName}*`);
  lines.push(isSale ? '*فاتورة بيع ذهب*' : '*فاتورة شراء ذهب*');
  lines.push('—————————————');
  lines.push(`التاريخ: ${arabicDate(input.date)}`);
  lines.push(`الوزن: ${unitsToGhJ(input.units)} ج.ح.ز (${(input.units / 100).toFixed(2)} جرام)`);
  if (input.purity > 0) {
    lines.push(`العيار: ${purityLabel(input.purity)}${input.purity <= 24 ? 'k' : ' (نقاوة)'}`);
  }
  if (input.pricePerGram && input.pricePerGram > 0) {
    lines.push(`سعر الجرام (عيار 21): ${fmtNum(input.pricePerGram)} ${currency}`);
  }
  lines.push('—————————————');
  lines.push(`الإجمالي: ${fmtNum(input.amount)} ${currency}`);
  lines.push(`المدفوع: ${fmtNum(input.paid)} ${currency}`);
  if (input.pending > 0) {
    lines.push(`*المتبقي: ${fmtNum(input.pending)} ${currency}*`);
  }
  if (input.pending > 0 && input.dueDate) {
    lines.push(`تاريخ السداد المتفق عليه: ${arabicDate(input.dueDate)}`);
  }
  if (input.notes) lines.push(`ملاحظات: ${input.notes}`);
  lines.push('—————————————');
  lines.push('شكراً لتعاملكم معنا 🌟');

  return lines.join('\n');
}

export interface ReminderShareInput {
  storeName: string;
  party: string;
  amount: number;
  dueDate?: string;
  daysOverdue?: number;
  kind: 'receivable' | 'payable';
  currency?: string;
}

/** نص تذكير بالتحصيل أو بالسداد */
export function buildReminderText(input: ReminderShareInput): string {
  const currency = input.currency || kCurrency;
  const lines: string[] = [];
  const isReceivable = input.kind === 'receivable';

  lines.push(`*${input.storeName}*`);
  lines.push(isReceivable ? '*تذكير بسداد متبقي*' : '*تذكير بسداد مستحق عليكم*');
  lines.push('—————————————');
  lines.push(`الأخ/الأخت: ${input.party}`);
  lines.push(`المبلغ المتبقي: *${fmtNum(input.amount)} ${currency}*`);
  if (input.dueDate) {
    lines.push(`تاريخ الاستحقاق: ${arabicDate(input.dueDate)}`);
    if (typeof input.daysOverdue === 'number') {
      lines.push(`الحالة: ${relativeDays(-input.daysOverdue)}`);
    }
  }
  lines.push('—————————————');
  lines.push(
    isReceivable
      ? 'نرجو التكرم بالسداد في أقرب وقت. شكراً لتعاملكم معنا 🙏'
      : 'نود تذكيركم بموعد السداد المتفق عليه. شكراً لكم 🙏'
  );

  return lines.join('\n');
}

export interface ReportShareInput {
  storeName: string;
  dateLabel: string;
  salesCount: number;
  salesAmount: number;
  salesUnits: number;
  profit: number;
  expenses: number;
  net: number;
  collected: number;
  credit: number;
  stockGramsK21: number;
  price21: number;
  currency?: string;
}

/** نص التقرير اليومي لمشاركته مع الشريك */
export function buildReportText(input: ReportShareInput): string {
  const currency = input.currency || kCurrency;
  const lines: string[] = [];
  lines.push(`*${input.storeName}*`);
  lines.push(`*${input.dateLabel}*`);
  lines.push('—————————————');
  lines.push(`عدد عمليات البيع: ${input.salesCount}`);
  lines.push(`إجمالي المبيعات: ${fmtNum(input.salesAmount)} ${currency}`);
  lines.push(`وزن المبيعات: ${unitsToGhJ(input.salesUnits)} ج.ح.ز`);
  lines.push(`الربح الإجمالي: ${fmtNum(input.profit)} ${currency}`);
  lines.push(`المصروفات: ${fmtNum(input.expenses)} ${currency}`);
  lines.push(`*الصافي: ${fmtNum(input.net)} ${currency}*`);
  lines.push('—————————————');
  lines.push(`المحصّل نقداً: ${fmtNum(input.collected)} ${currency}`);
  lines.push(`آجل (غير محصّل): ${fmtNum(input.credit)} ${currency}`);
  lines.push('—————————————');
  lines.push(`رصيد المخزون: ${input.stockGramsK21.toFixed(2)} جرام (معادل عيار 21)`);
  lines.push(`سعر جرام عيار 21: ${fmtNum(input.price21)} ${currency}`);

  return lines.join('\n');
}

/* ------------------------- المشاركة من المتصفح ------------------------- */

export function openWhatsApp(phone: string | undefined, text: string): void {
  if (typeof window === 'undefined') return;
  const url = whatsappUrl(phone, text);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** مشاركة عامة: تفضّل مشاركة النظام إن توفرت، وإلا واتساب، وإلا النسخ */
export async function shareText(text: string, phone?: string): Promise<'shared' | 'copied' | 'whatsapp'> {
  if (typeof window === 'undefined') return 'copied';
  const nav = window.navigator as Navigator & { share?: (data: any) => Promise<void> };
  if (nav.share && !phone) {
    try {
      await nav.share({ text });
      return 'shared';
    } catch {
      /* المستخدم أغلق نافذة المشاركة — نتابع للبديل */
    }
  }
  if (phone) {
    openWhatsApp(phone, text);
    return 'whatsapp';
  }
  try {
    await window.navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'copied';
  }
}

export function buildSaleInvoiceText(storeName: string, sale: Sale, pricePerGram?: number): string {
  const paid = (sale.sellAmount || 0) - salePending(sale);
  return buildInvoiceText({
    storeName,
    kind: 'sale',
    date: sale.date,
    units: sale.units,
    purity: sale.purity,
    pricePerGram,
    amount: sale.sellAmount || 0,
    paid,
    pending: salePending(sale),
    notes: sale.notes,
    dueDate: sale.dueDate,
  });
}

export function buildPurchaseInvoiceText(storeName: string, purchase: Purchase, pricePerGram?: number): string {
  const paid = (purchase.amount || 0) - purchasePending(purchase);
  return buildInvoiceText({
    storeName,
    kind: 'purchase',
    date: purchase.date,
    units: purchase.units,
    purity: purchase.purity,
    pricePerGram,
    amount: purchase.amount || 0,
    paid,
    pending: purchasePending(purchase),
    notes: purchase.notes,
    dueDate: purchase.dueDate,
  });
}
