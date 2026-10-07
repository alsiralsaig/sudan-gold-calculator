/**
 * البحث الشامل — منطق خالص (بلا React) قابل للاختبار.
 *
 * يبحث في كل بيانات التطبيق دفعة واحدة:
 * المشتريات، المبيعات، المصروفات، السلف، الشركاء، الفروع.
 *
 * يقبل:
 *  - أسماء أشخاص (بأي تشكيل أو همزات: «إبراهيم» = «ابراهيم»)
 *  - مبالغ (500 يجد 500,000 — البحث بجزء الرقم)
 *  - أوزان بصيغة ج.ح.ز (5.3.2) أو بالجرام (5.32)
 *  - أرقام هواتف، أرقام فواتير، تواريخ، وملاحظات
 */

import { Expense, Loan, Partner, Purchase, Sale, Branch } from '../types';
import { unitsToGhJ, unitsToGramsDecimal } from './format';

export type SearchKind = 'purchase' | 'sale' | 'expense' | 'loan' | 'partner' | 'branch';

export const KIND_LABELS: Record<SearchKind, string> = {
  purchase: 'مشتريات',
  sale: 'مبيعات',
  expense: 'مصروفات',
  loan: 'سلف',
  partner: 'شركاء',
  branch: 'فروع',
};

/** الشاشة التي يُفتح فيها السجل */
export const KIND_SCREEN: Record<SearchKind, string> = {
  purchase: 'purchases',
  sale: 'sales',
  expense: 'expenses',
  loan: 'loans',
  partner: 'partners',
  branch: 'settings',
};

export interface SearchHit {
  id: string;
  kind: SearchKind;
  /** العنوان الرئيسي المعروض */
  title: string;
  /** سطر توضيحي */
  subtitle: string;
  amount?: number;
  units?: number;
  date: string;
  archived?: boolean;
  /** أسماء الحقول التي طابقها البحث (لماذا ظهرت النتيجة) */
  matched: string[];
  score: number;
  /** السجل الأصلي (للتفاصيل) */
  raw: Purchase | Sale | Expense | Loan | Partner | Branch;
}

export interface SearchInput {
  purchases?: Purchase[];
  sales?: Sale[];
  expenses?: Expense[];
  loans?: Loan[];
  partners?: Partner[];
  branches?: Branch[];
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  /** عدد النتائج لكل نوع */
  counts: Record<SearchKind, number>;
  total: number;
  /** هل يوجد أكثر من الحد المعروض */
  truncated: boolean;
}

/* ------------------------------------------------------------------ */
/*                        تطبيع النص العربي                            */
/* ------------------------------------------------------------------ */

/** توحيد الهمزات والألف والتاء المربوطة وحذف التشكيل والتطويل */
export function normalizeArabic(input: string): string {
  return String(input || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // تشكيل + تطويل
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ → ا
    .replace(/\u0629/g, '\u0647') // ة → ه
    .replace(/[\u0649\u064A]/g, '\u064A') // ى ي → ي
    .replace(/\u0624/g, '\u0648') // ؤ → و
    .replace(/\u0626/g, '\u064A') // ئ → ي
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // أرقام عربية
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // أرقام فارسية
    .replace(/[إأآ]/g, '\u0627')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const digitsOnly = (s: string): string => normalizeArabic(s).replace(/[^\d]/g, '');

/** هل الاستعلام رقمي (مبلغ أو وزن)؟ */
export function isNumericQuery(query: string): boolean {
  const q = normalizeArabic(query).replace(/[,\u066C\u060C\s]/g, '');
  return q.length > 0 && /^[\d.]+$/.test(q);
}

/* ------------------------------------------------------------------ */
/*                          مطابقات الحقول                             */
/* ------------------------------------------------------------------ */

/** مطابقة نص عام (اسم/ملاحظة/فاتورة...) — تكفي الكلمة المطابقة */
function textMatch(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack || !needle) return false;
  return normalizeArabic(haystack).includes(needle);
}

/** مطابقة مبلغ: «500» تجد 500 و 500,000 و 1,500,500 */
export function amountMatch(amount: number | undefined | null, query: string): boolean {
  const value = Number(amount) || 0;
  if (value <= 0) return false;
  const rounded = String(Math.round(value));
  const q = digitsOnly(query);
  if (!q) return false;
  return rounded.includes(q) || String(value).includes(q);
}

/**
 * مطابقة وزن:
 *  - «5.3.2» = 5 جرام و3 حبة و2 جزء (ج.ح.ز)
 *  - «5» أو «5.3» بالجرام
 *  - «532» مقارنة بالصيغة المتصلة
 */
export function weightMatch(units: number | undefined | null, query: string): boolean {
  const u = Number(units) || 0;
  if (u <= 0) return false;

  const q = normalizeArabic(query).replace(/[\s,]/g, '');
  const ghj = unitsToGhJ(u); // "5.3.2"
  const grams = unitsToGramsDecimal(u); // 5.32
  const gramsFixed = grams.toFixed(2); // "5.32"
  const gramsInt = String(Math.floor(grams)); // "5"

  // صيغة ج.ح.ز كاملة أو جزئية
  if (/^\d+(\.\d+){1,2}$/.test(q)) {
    const parts = q.split('.');
    const ghjParts = ghj.split('.');
    // مقارنة العناصر من اليسار (5 / 5.3 / 5.3.2)
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '' ) continue;
      if (ghjParts[i] !== undefined && Number(ghjParts[i]) === Number(parts[i])) continue;
      ok = false;
      break;
    }
    if (ok) return true;
    // أو مقارنة الجرام العشري نصياً: "5.3" داخل "5.32"
    if (gramsFixed.startsWith(q) || String(grams).startsWith(q)) return true;
  }

  // رقم صحيح: يوافق الجرام الكامل أو بداية الجرام العشري أو أي وزن يحتوي الرقم
  const qDigits = digitsOnly(q);
  if (!qDigits) return false;
  if (gramsInt === qDigits) return true;
  if (gramsFixed.startsWith(qDigits)) return true;
  if (gramsInt.startsWith(qDigits)) return true;
  // وزن متصل: 5.3.2 → 532
  if (ghj.replace(/\./g, '').includes(qDigits)) return true;
  return false;
}

/** مطابقة هاتف: تكفي 3 أرقام متصلة */
export function phoneMatch(phone: string | undefined | null, query: string): boolean {
  const q = digitsOnly(query);
  if (!q || q.length < 3) return false;
  const p = digitsOnly(phone || '');
  return p.length > 0 && p.includes(q);
}

/* ------------------------------------------------------------------ */
/*                            البحث الشامل                             */
/* ------------------------------------------------------------------ */

interface Candidate {
  hit: SearchHit;
}

/** تقييم معرّفات (فاتورة/رمز): المطابقة الدقيقة تتفوق على الاحتواء */
function scoreIdentifier(value: string | undefined | null, needle: string): number {
  if (!value) return 0;
  const v = normalizeArabic(value);
  if (!v) return 0;
  if (v === needle) return 100;
  if (v.includes(needle)) return 70;
  return 0;
}

function scoreTitle(titleNorm: string, needle: string): number {
  if (!titleNorm || !needle) return 0;
  if (titleNorm === needle) return 100;
  if (titleNorm.startsWith(needle)) return 80;
  if (titleNorm.includes(needle)) return 60;
  // مطابقة كل كلمات الاستعلام داخل العنوان
  return 0;
}

const DATE_MS = (iso?: string): number => {
  const t = new Date(iso || 0).getTime();
  return isNaN(t) ? 0 : t;
};

/** بحث شامل: كل الأنواع مع ترتيب بالأهمية ثم بالتاريخ */
export function searchAll(input: SearchInput, query: string, limit = 150): SearchResult {
  const raw = String(query || '').trim();
  const needle = normalizeArabic(raw);
  const empty: SearchResult = {
    query: raw,
    hits: [],
    counts: { purchase: 0, sale: 0, expense: 0, loan: 0, partner: 0, branch: 0 },
    total: 0,
    truncated: false,
  };
  if (needle.length < 1) return empty;

  // كلمات الاستعلام: كل الكلمات يجب أن تُطابق (AND) لأي حقل
  const tokens = needle.split(' ').filter(Boolean);
  const numeric = isNumericQuery(raw);
  const candidates: Candidate[] = [];

  const push = (candidate: Candidate) => candidates.push(candidate);

  const allTextMatch = (values: (string | undefined | null)[]): boolean =>
    tokens.every((t) => values.some((v) => textMatch(v, t)));

  /* ---------------------------- المشتريات ---------------------------- */
  for (const p of input.purchases || []) {
    const matched: string[] = [];
    let score = 0;

    if (tokens.every((t) => textMatch(p.seller, t))) {
      matched.push('اسم البائع');
      score = Math.max(score, scoreTitle(normalizeArabic(p.seller), needle) + 5);
    }
    if (p.sellerPhone && tokens.some((t) => phoneMatch(p.sellerPhone, t))) {
      matched.push('هاتف البائع');
      score = Math.max(score, 70);
    }
    const invoiceScore = scoreIdentifier(p.invoiceNo, needle);
    if (invoiceScore) {
      matched.push('رقم الفاتورة');
      score = Math.max(score, invoiceScore);
    }
    if (amountMatch(p.amount, raw) && numeric) {
      matched.push('المبلغ');
      score = Math.max(score, 50);
    }
    if (weightMatch(p.units, raw) && numeric) {
      matched.push('الوزن');
      score = Math.max(score, 45);
    }
    if (allTextMatch([p.notes, p.bankAccount])) {
      matched.push('ملاحظات');
      score = Math.max(score, 30);
    }
    if (!matched.length) continue;

    push({
      hit: {
        id: p.id,
        kind: 'purchase',
        title: p.seller || 'مورد',
        subtitle: `شراء — ${unitsToGhJ(p.units)} ج.ح.ز — عيار ${p.purity}`,
        amount: p.amount,
        units: p.units,
        date: p.date,
        archived: p.archived,
        matched,
        score,
        raw: p,
      },
    });
  }

  /* ----------------------------- المبيعات ----------------------------- */
  for (const s of input.sales || []) {
    const matched: string[] = [];
    let score = 0;

    if (tokens.every((t) => textMatch(s.buyer, t))) {
      matched.push('اسم الزبون');
      score = Math.max(score, scoreTitle(normalizeArabic(s.buyer), needle) + 5);
    }
    if (s.buyerPhone && tokens.some((t) => phoneMatch(s.buyerPhone, t))) {
      matched.push('هاتف الزبون');
      score = Math.max(score, 70);
    }
    const invoiceScore = scoreIdentifier(s.invoiceNo, needle);
    if (invoiceScore) {
      matched.push('رقم الفاتورة');
      score = Math.max(score, invoiceScore);
    }
    if (amountMatch(s.sellAmount, raw) && numeric) {
      matched.push('مبلغ البيع');
      score = Math.max(score, 50);
    }
    if (amountMatch(s.buyAmount, raw) && numeric) {
      matched.push('مبلغ التكلفة');
      score = Math.max(score, 40);
    }
    if (weightMatch(s.units, raw) && numeric) {
      matched.push('الوزن');
      score = Math.max(score, 45);
    }
    if (allTextMatch([s.notes])) {
      matched.push('ملاحظات');
      score = Math.max(score, 30);
    }
    if (!matched.length) continue;

    push({
      hit: {
        id: s.id,
        kind: 'sale',
        title: s.buyer || 'زبون',
        subtitle: `بيع — ${unitsToGhJ(s.units)} ج.ح.ز — عيار ${s.purity}`,
        amount: s.sellAmount,
        units: s.units,
        date: s.date,
        archived: s.archived,
        matched,
        score,
        raw: s,
      },
    });
  }

  /* ---------------------------- المصروفات ---------------------------- */
  for (const e of input.expenses || []) {
    const matched: string[] = [];
    let score = 0;

    if (tokens.every((t) => textMatch(e.name, t))) {
      matched.push('بيان المصروف');
      score = Math.max(score, scoreTitle(normalizeArabic(e.name), needle));
    }
    if (tokens.every((t) => textMatch(e.target, t))) {
      matched.push(e.target === 'عام' ? 'مصروف عام' : 'الشريك');
      score = Math.max(score, scoreTitle(normalizeArabic(e.target), needle) + 10);
    }
    if (amountMatch(e.amount, raw) && numeric) {
      matched.push('المبلغ');
      score = Math.max(score, 50);
    }
    if (allTextMatch([e.notes, e.category])) {
      matched.push('ملاحظات');
      score = Math.max(score, 30);
    }
    if (!matched.length) continue;

    push({
      hit: {
        id: e.id,
        kind: 'expense',
        title: e.name || 'مصروف',
        subtitle: `مصروف — ${e.target || 'عام'}`,
        amount: e.amount,
        date: e.date,
        archived: e.archived,
        matched,
        score,
        raw: e,
      },
    });
  }

  /* ------------------------------- السلف ------------------------------ */
  for (const l of input.loans || []) {
    const matched: string[] = [];
    let score = 0;

    if (tokens.every((t) => textMatch(l.person, t))) {
      matched.push('اسم الشخص');
      score = Math.max(score, scoreTitle(normalizeArabic(l.person), needle) + 5);
    }
    if (l.phone && tokens.some((t) => phoneMatch(l.phone, t))) {
      matched.push('الهاتف');
      score = Math.max(score, 70);
    }
    if (amountMatch(l.amount, raw) && numeric) {
      matched.push('المبلغ');
      score = Math.max(score, 50);
    }
    for (const pay of l.payments || []) {
      if (amountMatch(pay.amount, raw) && numeric) {
        matched.push('دفعة سداد');
        score = Math.max(score, 45);
        break;
      }
    }
    if (allTextMatch([l.notes])) {
      matched.push('ملاحظات');
      score = Math.max(score, 30);
    }
    if (!matched.length) continue;

    push({
      hit: {
        id: l.id,
        kind: 'loan',
        title: l.person || 'شخص',
        subtitle:
          (l.direction === 'lent' ? 'سلفة لنا عليه' : 'سلفة علينا له') +
          ` — المتبقي ${Math.max(0, (l.amount || 0) - (l.payments || []).reduce((sum, x) => sum + (x.amount || 0), 0)).toLocaleString('en-US')} ج.س`,
        amount: l.amount,
        date: l.date,
        archived: l.archived,
        matched,
        score,
        raw: l,
      },
    });
  }

  /* ----------------------------- الشركاء ----------------------------- */
  for (const p of input.partners || []) {
    const matched: string[] = [];
    let score = 0;

    if (tokens.every((t) => textMatch(p.name, t))) {
      matched.push('اسم الشريك');
      score = Math.max(score, scoreTitle(normalizeArabic(p.name), needle) + 10);
    }
    if (p.phone && tokens.some((t) => phoneMatch(p.phone, t))) {
      matched.push('الهاتف');
      score = Math.max(score, 70);
    }
    if (amountMatch(p.capital, raw) && numeric) {
      matched.push('رأس المال');
      score = Math.max(score, 45);
    }
    if (allTextMatch([p.notes])) {
      matched.push('ملاحظات');
      score = Math.max(score, 30);
    }
    if (!matched.length) continue;

    push({
      hit: {
        id: p.id,
        kind: 'partner',
        title: p.name || 'شريك',
        subtitle: `شريك — ${p.profitPercent}% من الربح`,
        amount: p.capital,
        date: p.updatedAt || '',
        archived: p.archived,
        matched,
        score,
        raw: p,
      },
    });
  }

  /* ------------------------------ الفروع ----------------------------- */
  for (const b of input.branches || []) {
    const matched: string[] = [];
    let score = 0;

    if (tokens.every((t) => textMatch(b.name, t))) {
      matched.push('اسم الفرع');
      score = Math.max(score, scoreTitle(normalizeArabic(b.name), needle) + 10);
    }
    const codeScore = scoreIdentifier(b.code, needle);
    if (codeScore) {
      matched.push('رمز الفرع');
      score = Math.max(score, codeScore);
    }
    if (b.phone && tokens.some((t) => phoneMatch(b.phone, t))) {
      matched.push('الهاتف');
      score = Math.max(score, 60);
    }
    if (allTextMatch([b.address, b.notes])) {
      matched.push('العنوان/ملاحظات');
      score = Math.max(score, 30);
    }
    if (!matched.length) continue;

    push({
      hit: {
        id: b.id,
        kind: 'branch',
        title: b.name || 'فرع',
        subtitle: `فرع${b.code ? ` — ${b.code}` : ''}${b.address ? ` — ${b.address}` : ''}`,
        date: b.createdAt || '',
        archived: b.archived,
        matched,
        score,
        raw: b,
      },
    });
  }

  /* ------------------------------ الترتيب ----------------------------- */
  candidates.sort((a, b) => {
    if (b.hit.score !== a.hit.score) return b.hit.score - a.hit.score;
    const da = DATE_MS(a.hit.date);
    const db = DATE_MS(b.hit.date);
    if (db !== da) return db - da;
    return 0;
  });

  const hits = candidates.slice(0, limit).map((c) => c.hit);
  const counts: Record<SearchKind, number> = {
    purchase: 0,
    sale: 0,
    expense: 0,
    loan: 0,
    partner: 0,
    branch: 0,
  };
  for (const c of candidates) counts[c.hit.kind] += 1;

  return {
    query: raw,
    hits,
    counts,
    total: candidates.length,
    truncated: candidates.length > hits.length,
  };
}

/** نص مشاركة نتيجة بحث (لإرسالها على واتساب) */
export function hitShareText(storeName: string, hit: SearchHit): string {
  const lines = [`*${storeName}*`, `*${KIND_LABELS[hit.kind]}*`, '—————————————', hit.title];
  if (hit.amount) lines.push(`المبلغ: ${hit.amount.toLocaleString('en-US')} ج.س`);
  if (hit.units) lines.push(`الوزن: ${unitsToGhJ(hit.units)} ج.ح.ز (${unitsToGramsDecimal(hit.units).toFixed(2)} جرام)`);
  if (hit.date) lines.push(`التاريخ: ${new Date(hit.date).toLocaleDateString('ar-EG')}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*                     تجميع النتائج لكل صفحة على حدة                  */
/* ------------------------------------------------------------------ */

export interface HitGroup {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
}

const KIND_ORDER: SearchKind[] = ['purchase', 'sale', 'expense', 'loan', 'partner', 'branch'];

/**
 * تجميع نتائج البحث حسب الصفحة (النوع) — كل صفحة في قسم مستقل
 * بترتيب ثابت: مشتريات ← مبيعات ← مصروفات ← سلف ← شركاء ← فروع.
 */
export function groupHitsByKind(hits: SearchHit[], order: SearchKind[] = KIND_ORDER): HitGroup[] {
  return order
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      hits: hits.filter((h) => h.kind === kind),
    }))
    .filter((group) => group.hits.length > 0);
}

/** سطر واحد مختصر لكل نتيجة — للنسخ السريع */
export function hitLine(hit: SearchHit, index?: number): string {
  const parts: string[] = [];
  if (index !== undefined) parts.push(`${index})`);
  parts.push(`[${KIND_LABELS[hit.kind]}]`, hit.title);
  if (hit.amount) parts.push(`— ${hit.amount.toLocaleString('en-US')} ج.س`);
  if (hit.units) parts.push(`— ${unitsToGhJ(hit.units)} ج.ح.ز`);
  if (hit.date) {
    const t = new Date(hit.date);
    if (!isNaN(t.getTime())) parts.push(`— ${t.toLocaleDateString('ar-EG')}`);
  }
  return parts.join(' ');
}

/** نص كل النتائج — لزر «نسخ كل النتائج» وإرسالها على واتساب */
export function searchResultsText(storeName: string, query: string, hits: SearchHit[]): string {
  const lines: string[] = [
    `*${storeName}*`,
    `*نتائج البحث عن:* ${query}`,
    `عدد النتائج: ${hits.length}`,
    '—————————————',
  ];
  const groups = groupHitsByKind(hits);
  for (const group of groups) {
    lines.push(`*${group.label}* (${group.hits.length})`);
    group.hits.forEach((hit, i) => lines.push(hitLine(hit, i + 1)));
    lines.push('');
  }
  return lines.join('\n').trim();
}

/* ------------------------------------------------------------------ */
/*                مطابقة موحّدة لكل شاشة (بحث داخلي ذكي)               */
/* ------------------------------------------------------------------ */

export interface MatchFields {
  /** أسماء، ملاحظات، أرقام فواتير، تصنيفات */
  texts?: (string | null | undefined)[];
  /** أرقام هواتف */
  phones?: (string | null | undefined)[];
  /** مبالغ نقدية */
  amounts?: (number | null | undefined)[];
  /** أوزان بوحدات التخزين */
  weights?: (number | null | undefined)[];
}

/** مطابقة نص عربي مطبَّع (تصدير مباشر للاستخدام في الشاشات) */
export function textIn(haystack: string | undefined | null, needle: string): boolean {
  return textMatch(haystack, needle);
}

/**
 * مطابقة ذكية موحّدة — تُستخدم في شاشات السجلات (بيع/شراء/مصروف/سلفة).
 * نفس منطق البحث الشامل: تطبيع عربي، مبالغ جزئية، أوزان ج.ح.ز، هواتف،
 * وكلمتان فأكثر يجب أن تتطابقا معاً (AND).
 */
export function smartMatch(query: string, fields: MatchFields): boolean {
  const raw = String(query || '').trim();
  if (!raw) return true;

  const needle = normalizeArabic(raw);
  const tokens = needle.split(' ').filter(Boolean);
  const { texts = [], phones = [], amounts = [], weights = [] } = fields;

  // نص: كل كلمة في الاستعلام يجب أن تُوجد في أحد النصوص
  if (tokens.length && tokens.every((t) => texts.some((v) => textMatch(v, t)))) return true;

  if (isNumericQuery(raw)) {
    if (amounts.some((a) => amountMatch(a, raw))) return true;
    if (weights.some((w) => weightMatch(w, raw))) return true;
  }

  if (phones.some((p) => phoneMatch(p, raw))) return true;
  return false;
}

export function matchSaleQuery(s: Sale, query: string): boolean {
  return smartMatch(query, {
    texts: [s.buyer, s.notes, s.invoiceNo],
    phones: [s.buyerPhone],
    amounts: [s.sellAmount, s.buyAmount],
    weights: [s.units],
  });
}

export function matchPurchaseQuery(p: Purchase, query: string): boolean {
  return smartMatch(query, {
    texts: [p.seller, p.notes, p.invoiceNo, p.bankAccount],
    phones: [p.sellerPhone],
    amounts: [p.amount, p.pendingAmount],
    weights: [p.units],
  });
}

export function matchExpenseQuery(e: Expense, query: string): boolean {
  return smartMatch(query, {
    texts: [e.name, e.notes, e.target, e.category],
    amounts: [e.amount],
  });
}

export function matchLoanQuery(l: Loan, query: string): boolean {
  return smartMatch(query, {
    texts: [l.person, l.notes],
    phones: [l.phone],
    amounts: [l.amount, ...(l.payments || []).map((p) => p.amount)],
  });
}
