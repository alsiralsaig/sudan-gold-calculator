/**
 * حسابات حاسبة الذهب — نقية بلا React، مُختبرة.
 *
 * الوحدات (نفس بقية التطبيق): 1 جرام = 10 حبات = 100 جزء،
 * وتُخزَّن داخلياً كوحدات (1 جرام = 100 وحدة).
 * الأساس: سعر جرام عيار 21 (نقاوة 875)، وباقي العيارات تُشتق بنسبة النقاوة.
 * العيار يُقبل بالقيراط (21) أو بالنقاوة بالألف (875، 692...).
 */
import { kUnitsPerGram, kUnitsPerHabba, unitsToGhJ } from './format';
import { K21_FINENESS, K24_FINENESS, purityToFineness, finenessToKarat } from './purity';

/* ============================ الوزن ============================ */

/**
 * قراءة وزن مكتوب بالصيغة السودانية:
 *   "22.6.0" → 22 جرام 6 حبات 0 جزء
 *   "22.6"   → 22 جرام 6 حبات
 *   "22"     → 22 جرام
 *   "0.12.0" → 12 حبة = 1.2 جرام (الحبات قد تتجاوز 9)
 * يقبل الأرقام العربية والفاصلة العربية. يرجع null لو غير صالح.
 */
export function parseWeight(raw: string): number | null {
  const s = String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,،]/g, '.')
    .replace(/\s+/g, '')
    .trim();
  if (!s) return null;
  if (!/^\d*(\.\d*){0,2}$/.test(s)) return null;
  const [g = '', h = '', j = ''] = s.split('.');
  const grams = g === '' ? 0 : parseInt(g, 10);
  const habba = h === '' ? 0 : parseInt(h, 10);
  const juz = j === '' ? 0 : parseInt(j, 10);
  if ([grams, habba, juz].some((n) => !Number.isFinite(n))) return null;
  return grams * kUnitsPerGram + habba * kUnitsPerHabba + juz;
}

/** وحدات → جرام عشري */
export const unitsToGrams = (units: number): number => (Number(units) || 0) / kUnitsPerGram;

/** وحدات → «22.6.0» (يقرّب لأقرب جزء) */
export const fmtWeight = (units: number): string => unitsToGhJ(Math.round(Number(units) || 0));

/* ============================ العيار ============================ */

/** عرض العيار: «21 (875)» أو «692» للنقاوات غير القياسية */
export function karatDisplay(purity: number): string {
  const f = purityToFineness(purity);
  if (f <= 0) return '—';
  const k = finenessToKarat(f);
  const rk = Math.round(k);
  if (Math.abs(k - rk) < 0.01) return `${rk} (${Math.round(f)})`;
  return `${Math.round(f)} (≈${k.toFixed(1)}k)`;
}

/** تحويل وزن من عيار إلى آخر بنفس الذهب الخالص */
export function convertKarat(units: number, fromPurity: number, toPurity: number): number {
  const f = purityToFineness(fromPurity);
  const t = purityToFineness(toPurity);
  if (f <= 0 || t <= 0) return 0;
  return ((Number(units) || 0) * f) / t;
}

/** الذهب الخالص (عيار 24) في وزن معيّن — بالوحدات */
export const pureUnits = (units: number, purity: number): number =>
  ((Number(units) || 0) * purityToFineness(purity)) / K24_FINENESS;

/** معادل عيار 21 — بالوحدات */
export const k21Units = (units: number, purity: number): number => convertKarat(units, purity, K21_FINENESS);

/** سعر جرام عيار معيّن من سعر جرام 21 */
export const pricePerGramFor = (price21: number, purity: number): number => {
  const f = purityToFineness(purity);
  return f > 0 ? ((Number(price21) || 0) * f) / K21_FINENESS : 0;
};

/* ============================ 1) القيمة ============================ */

export interface ValueResult {
  grams: number;
  pricePerGram: number;
  goldValue: number;
  workmanship: number;
  total: number;
  k21Grams: number;
  pureGrams: number;
}

/** قيمة وزن بعيار معيّن + مصنعية اختيارية للجرام */
export function calcValue(p: { units: number; purity: number; price21: number; workmanshipPerGram?: number }): ValueResult {
  const grams = unitsToGrams(p.units);
  const pricePerGram = pricePerGramFor(p.price21, p.purity);
  const goldValue = grams * pricePerGram;
  const workmanship = grams * (Number(p.workmanshipPerGram) || 0);
  return {
    grams,
    pricePerGram,
    goldValue,
    workmanship,
    total: goldValue + workmanship,
    k21Grams: unitsToGrams(k21Units(p.units, p.purity)),
    pureGrams: unitsToGrams(pureUnits(p.units, p.purity)),
  };
}

/* ============================ 2) الوزن من المبلغ ============================ */

export interface WeightFromMoneyResult {
  units: number;
  grams: number;
  pricePerGram: number;
  /** المبلغ الفعلي للوزن المقرّب لأقرب جزء */
  exactCost: number;
  /** الباقي من المبلغ بعد التقريب لأقرب جزء */
  change: number;
}

export function calcWeightFromMoney(p: { money: number; purity: number; price21: number; workmanshipPerGram?: number }): WeightFromMoneyResult {
  const pricePerGram = pricePerGramFor(p.price21, p.purity) + (Number(p.workmanshipPerGram) || 0);
  const money = Number(p.money) || 0;
  if (pricePerGram <= 0 || money <= 0) return { units: 0, grams: 0, pricePerGram, exactCost: 0, change: money > 0 ? money : 0 };
  // نقرّب للأسفل لأقرب جزء — لا نبيع وزناً أكبر من المبلغ
  const units = Math.floor((money / pricePerGram) * kUnitsPerGram + 1e-9);
  const exactCost = (units / kUnitsPerGram) * pricePerGram;
  return { units, grams: units / kUnitsPerGram, pricePerGram, exactCost, change: money - exactCost };
}

/* ============================ 3) جمع الأوزان ============================ */

export interface WeightRow {
  units: number;
  purity: number;
}

export interface SumResult {
  count: number;
  totalUnits: number;
  k21Units: number;
  pureUnits: number;
  /** متوسط النقاوة الموزون بالألف */
  avgFineness: number;
  value: number;
}

export function sumWeights(rows: WeightRow[], price21: number): SumResult {
  const valid = rows.filter((r) => (Number(r.units) || 0) > 0 && purityToFineness(r.purity) > 0);
  const totalUnits = valid.reduce((s, r) => s + r.units, 0);
  const pure = valid.reduce((s, r) => s + pureUnits(r.units, r.purity), 0);
  const k21 = valid.reduce((s, r) => s + k21Units(r.units, r.purity), 0);
  return {
    count: valid.length,
    totalUnits,
    k21Units: k21,
    pureUnits: pure,
    avgFineness: totalUnits > 0 ? (pure / totalUnits) * K24_FINENESS : 0,
    value: unitsToGrams(k21) * (Number(price21) || 0),
  };
}

/* ============================ 4) الربح والتسعير ============================ */

export interface ProfitResult {
  grams: number;
  cost: number;
  revenue: number;
  profit: number;
  /** الربح ÷ التكلفة */
  markupPercent: number;
  /** الربح ÷ البيع */
  marginPercent: number;
  profitPerGram: number;
  sellPrice21: number;
}

/**
 * ربح صفقة: الوزن والعيار وسعر الشراء (جرام 21)، ومعه إما سعر البيع (جرام 21)
 * أو نسبة ربح مستهدفة على التكلفة — فيُحسب سعر البيع منها.
 */
export function calcProfit(p: {
  units: number;
  purity: number;
  buyPrice21: number;
  sellPrice21?: number;
  targetMarkupPercent?: number;
}): ProfitResult {
  const k21g = unitsToGrams(k21Units(p.units, p.purity));
  const buy = Number(p.buyPrice21) || 0;
  const sell21 =
    p.targetMarkupPercent !== undefined && p.targetMarkupPercent !== null && !Number.isNaN(p.targetMarkupPercent)
      ? buy * (1 + (Number(p.targetMarkupPercent) || 0) / 100)
      : Number(p.sellPrice21) || 0;
  const cost = k21g * buy;
  const revenue = k21g * sell21;
  const profit = revenue - cost;
  const grams = unitsToGrams(p.units);
  return {
    grams,
    cost,
    revenue,
    profit,
    markupPercent: cost > 0 ? (profit / cost) * 100 : 0,
    marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
    profitPerGram: grams > 0 ? profit / grams : 0,
    sellPrice21: sell21,
  };
}

/* ============================ 5) السباكة ============================ */

export interface MeltTargetResult {
  /** 'pure' = أضف ذهب خالص لرفع العيار، 'alloy' = أضف نحاس/سبيكة لخفضه، 'none' = نفس العيار */
  action: 'pure' | 'alloy' | 'none' | 'impossible';
  addUnits: number;
  finalUnits: number;
  fromFineness: number;
  toFineness: number;
}

/**
 * كم نضيف للوصول لعيار مستهدف:
 *  - رفع العيار:  خالص = و × (هدف − حالي) ÷ (1000 − هدف)
 *  - خفض العيار:  نحاس = و × (حالي − هدف) ÷ هدف
 */
export function calcMeltToTarget(p: { units: number; purity: number; targetPurity: number }): MeltTargetResult {
  const w = Number(p.units) || 0;
  const f = purityToFineness(p.purity);
  const t = purityToFineness(p.targetPurity);
  const base = { fromFineness: f, toFineness: t };
  if (w <= 0 || f <= 0 || t <= 0) return { action: 'none', addUnits: 0, finalUnits: w, ...base };
  if (Math.abs(f - t) < 1e-9) return { action: 'none', addUnits: 0, finalUnits: w, ...base };
  if (t > f) {
    if (t >= K24_FINENESS) return { action: 'impossible', addUnits: 0, finalUnits: w, ...base };
    const add = (w * (t - f)) / (K24_FINENESS - t);
    return { action: 'pure', addUnits: add, finalUnits: w + add, ...base };
  }
  const add = (w * (f - t)) / t;
  return { action: 'alloy', addUnits: add, finalUnits: w + add, ...base };
}

export interface MixResult {
  totalUnits: number;
  fineness: number;
  karat: number;
}

/** خلط قطع بعيارات مختلفة (ذهب خالص = 1000، نحاس = 0) → العيار الناتج */
export function calcMix(rows: { units: number; fineness: number }[]): MixResult {
  const valid = rows.filter((r) => (Number(r.units) || 0) > 0 && (Number(r.fineness) || 0) >= 0);
  const total = valid.reduce((s, r) => s + r.units, 0);
  const pure = valid.reduce((s, r) => s + (r.units * r.fineness) / K24_FINENESS, 0);
  const fineness = total > 0 ? (pure / total) * K24_FINENESS : 0;
  return { totalUnits: total, fineness, karat: finenessToKarat(fineness) };
}

/* ============================ نص للمشاركة ============================ */

export const money = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
