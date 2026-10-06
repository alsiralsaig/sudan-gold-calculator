/**
 * الفواتير — الترقيم وبناء بيانات الفاتورة المطبوعة/المشاركة.
 * منطق نقي قابل للاختبار، بلا React وبلا شبكة.
 */
import { Branch, Purchase, Sale } from '../types';
import { formatInvoiceDate } from './format';

export type InvoiceKind = 'sale' | 'purchase';

/** بادئة رقم الفاتورة لكل نوع */
export const INVOICE_PREFIX: Record<InvoiceKind, string> = { sale: 'SAL', purchase: 'PUR' };

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  sale: 'فاتورة بيع',
  purchase: 'فاتورة شراء',
};

/** أكثر من هذا الرقم = آخر رقم مستخدم (لتفادي التكرار بعد الحذف) */
const COUNTER_KEY: Record<InvoiceKind, string> = { sale: 'inv_sale', purchase: 'inv_purchase' };

export function invoiceCounterKey(kind: InvoiceKind): string {
  return COUNTER_KEY[kind];
}

/** تنسيق الرقم: PUR-0007 أو PUR-KH1-0007 عند وجود رمز فرع */
export function formatInvoiceNo(kind: InvoiceKind, seq: number, branchCode?: string): string {
  const body = String(Math.max(1, Math.floor(seq))).padStart(4, '0');
  const prefix = branchCode ? `${INVOICE_PREFIX[kind]}-${branchCode.toUpperCase()}` : INVOICE_PREFIX[kind];
  return `${prefix}-${body}`;
}

/** استخراج آخر رقم مستخدم للفواتير القديمة (بلا عدّاد) */
export function lastInvoiceSeq(items: { invoiceNo?: string }[], kind: InvoiceKind, branchCode?: string): number {
  const prefix = branchCode ? `${INVOICE_PREFIX[kind]}-${branchCode.toUpperCase()}` : INVOICE_PREFIX[kind];
  let max = 0;
  for (const item of items || []) {
    const no = (item?.invoiceNo || '').trim().toUpperCase();
    if (!no || !no.startsWith(prefix + '-')) continue;
    const tail = no.slice(prefix.length + 1);
    if (!/^\d+$/.test(tail)) continue;
    const n = parseInt(tail, 10);
    if (n > max) max = n;
  }
  return max;
}

/**
 * الرقم التالي للفاتورة.
 * يُراعي العدّاد المحفوظ وآخر رقم موجود في السجلات (أيهما أكبر).
 */
export function nextInvoiceNo(
  items: { invoiceNo?: string }[],
  kind: InvoiceKind,
  options: { branchCode?: string; counter?: number } = {}
): string {
  const fromItems = lastInvoiceSeq(items, kind, options.branchCode);
  const fromCounter = Math.max(0, Math.floor(options.counter || 0));
  return formatInvoiceNo(kind, Math.max(fromItems, fromCounter) + 1, options.branchCode);
}

/** ترقيم الفواتير القديمة التي بلا رقم — بالترتيب الزمني */
export function assignMissingInvoiceNumbers<T extends { date?: string; invoiceNo?: string }>(
  items: T[],
  kind: InvoiceKind,
  options: { branchCode?: string; counter?: number } = {}
): { items: T[]; assigned: number; nextCounter: number } {
  const list = items || [];
  const order = list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ta = a.item.date ? new Date(a.item.date).getTime() : 0;
      const tb = b.item.date ? new Date(b.item.date).getTime() : 0;
      return ta - tb;
    });

  let counter = Math.max(Math.floor(options.counter || 0), lastInvoiceSeq(list, kind, options.branchCode));
  let assigned = 0;
  const replacements = new Map<number, string>();
  for (const { item, index } of order) {
    if (item.invoiceNo && item.invoiceNo.trim()) continue;
    counter += 1;
    assigned += 1;
    replacements.set(index, formatInvoiceNo(kind, counter, options.branchCode));
  }

  return {
    items: list.map((item, index) =>
      replacements.has(index) ? ({ ...item, invoiceNo: replacements.get(index) } as T) : item
    ),
    assigned,
    nextCounter: counter,
  };
}

export type PrintableInvoice = {
  kind: InvoiceKind;
  invoiceNo: string;
  title: string;
  date: string;
  partyLabel: string;
  partyName: string;
  partyPhone?: string;
  karat: number;
  purityLabel: string;
  weightLabel: string;
  pricePerGram: number;
  amount: number;
  paid: number;
  pending: number;
  dueDate?: string;
  bankAccount?: string;
  notes?: string;
  branchName?: string;
  branchPhone?: string;
  storeName: string;
  extra?: { label: string; value: string }[];
};

export type InvoiceBuildOptions = {
  storeName: string;
  currency?: string;
  branch?: Branch;
  purityLabel: (karat: number) => string;
  weightLabel: (units: number) => string;
  invoiceNo: string;
};

function perGram(amount: number, units: number): number {
  const grams = (units || 0) / 100;
  if (grams <= 0) return 0;
  return Math.round(amount / grams);
}

function branchFields(branch?: Branch) {
  if (!branch) return {};
  return {
    branchName: (branch.receiptName || '').trim() || branch.name,
    branchPhone: branch.phone,
  };
}

export function buildSaleInvoice(sale: Sale, opts: InvoiceBuildOptions): PrintableInvoice {
  const paid = sale.paidAmount ?? sale.sellAmount ?? 0;
  const pending = sale.pendingAmount ?? Math.max(0, (sale.sellAmount || 0) - paid);
  return {
    kind: 'sale',
    invoiceNo: opts.invoiceNo,
    title: INVOICE_KIND_LABEL.sale,
    date: sale.date,
    partyLabel: 'الزبون',
    partyName: sale.buyer || '—',
    partyPhone: sale.buyerPhone,
    karat: sale.purity,
    purityLabel: opts.purityLabel(sale.purity),
    weightLabel: opts.weightLabel(sale.units),
    pricePerGram: perGram(sale.sellAmount, sale.units),
    amount: sale.sellAmount || 0,
    paid,
    pending,
    dueDate: sale.dueDate,
    notes: sale.notes,
    storeName: opts.storeName,
    extra: [{ label: 'تكلفة الجرام شراءً', value: `${perGram(sale.buyAmount, sale.units)} ${opts.currency || ''}`.trim() }],
    ...branchFields(opts.branch),
  };
}

export function buildPurchaseInvoice(purchase: Purchase, opts: InvoiceBuildOptions): PrintableInvoice {
  const paid = Math.max(0, (purchase.amount || 0) - (purchase.pendingAmount || 0));
  return {
    kind: 'purchase',
    invoiceNo: opts.invoiceNo,
    title: INVOICE_KIND_LABEL.purchase,
    date: purchase.date,
    partyLabel: 'المورد / البائع',
    partyName: purchase.seller || '—',
    partyPhone: purchase.sellerPhone,
    karat: purchase.purity,
    purityLabel: opts.purityLabel(purchase.purity),
    weightLabel: opts.weightLabel(purchase.units),
    pricePerGram: perGram(purchase.amount, purchase.units),
    amount: purchase.amount || 0,
    paid,
    pending: purchase.pendingAmount || 0,
    dueDate: purchase.dueDate,
    bankAccount: purchase.bankAccount,
    notes: purchase.notes,
    storeName: opts.storeName,
    ...branchFields(opts.branch),
  };
}

/** نص الفاتورة — للمشاركة على واتساب أو النسخ */
export function invoiceText(inv: PrintableInvoice, currency = 'ج.س'): string {
  const lines: string[] = [];
  lines.push(`🧾 ${inv.title} — ${inv.invoiceNo}`);
  lines.push(inv.storeName);
  if (inv.branchName) lines.push(`الفرع: ${inv.branchName}`);
  lines.push(`التاريخ: ${formatInvoiceDate(inv.date)}`);
  lines.push('-----------------------------');
  lines.push(`${inv.partyLabel}: ${inv.partyName}`);
  if (inv.partyPhone) lines.push(`الهاتف: ${inv.partyPhone}`);
  lines.push(`العيار: ${inv.purityLabel}`);
  lines.push(`الوزن: ${inv.weightLabel}`);
  lines.push(`سعر الجرام: ${Math.round(inv.pricePerGram).toLocaleString('en-US')} ${currency}`);
  lines.push('-----------------------------');
  lines.push(`الإجمالي: ${Math.round(inv.amount).toLocaleString('en-US')} ${currency}`);
  lines.push(`المدفوع: ${Math.round(inv.paid).toLocaleString('en-US')} ${currency}`);
  if (inv.pending > 0) {
    lines.push(`المتبقي: ${Math.round(inv.pending).toLocaleString('en-US')} ${currency}`);
    if (inv.dueDate) lines.push(`تاريخ الاستحقاق: ${formatInvoiceDate(inv.dueDate)}`);
  }
  if (inv.bankAccount) lines.push(`الحساب البنكي: ${inv.bankAccount}`);
  if (inv.notes) lines.push(`ملاحظات: ${inv.notes}`);
  lines.push('-----------------------------');
  lines.push('شكراً لتعاملكم معنا 🌟');
  return lines.join('\n');
}

/**
 * ترقيم الفواتير القديمة مع مراعاة فرع كل فاتورة:
 * كل فرع يأخذ تسلسله الخاص (SAL-KH1-0001, SAL-BH1-0001 …)
 * والفاتورة بلا فرع تأخذ التسلسل العام (SAL-0001).
 */
export function assignMissingInvoiceNumbersByBranch<
  T extends { id: string; date?: string; invoiceNo?: string; branchId?: string }
>(
  items: T[],
  kind: InvoiceKind,
  options: { branches?: Branch[]; counter?: number } = {}
): { items: T[]; assigned: number; nextCounter: number } {
  const list = items || [];
  const branches = options.branches || [];
  const codeOf = (branchId?: string): string | undefined => {
    if (!branchId) return undefined;
    const branch = branches.find((b) => b.id === branchId);
    const code = (branch?.code || '').trim();
    return code ? code.toUpperCase() : undefined;
  };

  const groups = new Map<string, number[]>();
  list.forEach((item, index) => {
    const key = codeOf(item.branchId) || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(index);
  });

  const results = new Map<number, string>();
  let assigned = 0;
  let nextCounter = Math.max(0, Math.floor(options.counter || 0));

  for (const [code, indexes] of groups) {
    const groupItems = indexes.map((i) => list[i]);
    const res = assignMissingInvoiceNumbers(groupItems, kind, {
      branchCode: code || undefined,
      counter: options.counter || 0,
    });
    assigned += res.assigned;
    nextCounter = Math.max(nextCounter, res.nextCounter);
    indexes.forEach((originalIndex, k) => {
      const numbered = res.items[k];
      if (numbered.invoiceNo && numbered.invoiceNo !== list[originalIndex].invoiceNo) {
        results.set(originalIndex, numbered.invoiceNo);
      }
    });
  }

  return {
    items: list.map((item, index) =>
      results.has(index) ? ({ ...item, invoiceNo: results.get(index) } as T) : item
    ),
    assigned,
    nextCounter,
  };
}
