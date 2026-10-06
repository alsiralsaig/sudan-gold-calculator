/**
 * حساب العيار والنقاوة.
 *
 * قاعدة تجارة الذهب في السودان: العيار 21 (نقاوة 875) هو العيار الرسمي
 * للبيع والشراء. لذلك كل الأسعار والمخزون والأرباح تُحسب على معادل 21،
 * وباقي العيارات (24، 22، 18، ...) تُشتق منه بنسبة النقاوة.
 */

/** نقاوة عيار 21 بالألف */
export const K21_FINENESS = 875;
/** نقاوة الذهب الخالص */
export const K24_FINENESS = 1000;

export const KARAT_OPTIONS = [24, 22, 21, 18] as const;

/**
 * تحويل قيمة حقل "العيار" إلى نقاوة بالألف.
 * يقبل عيار (21) أو نقاوة مباشرة (875، 650).
 */
export function purityToFineness(purity: number | undefined | null): number {
  const p = Number(purity) || 0;
  if (p <= 0) return 0;
  if (p <= 24) return (p / 24) * 1000;
  return p;
}

/** تحويل النقاوة بالألف إلى عيار */
export function finenessToKarat(fineness: number): number {
  const f = Number(fineness) || 0;
  if (f <= 0) return 0;
  return (f / 1000) * 24;
}

/** معامل التحويل من أي نقاوة إلى معادل عيار 21 */
export function toK21Ratio(purity: number | undefined | null): number {
  const f = purityToFineness(purity);
  if (f <= 0) return 0;
  return f / K21_FINENESS;
}

/** عرض مختصر للنقاوة: "21" أو "650" */
export function purityLabel(purity: number | undefined | null): string {
  const f = purityToFineness(purity);
  if (f <= 0) return 'غير محدد';
  const k = f / 1000 * 24;
  if (Math.abs(k - Math.round(k)) < 0.05) return `${Math.round(k)}`;
  return `${Math.round(f)}`;
}

/** تحويل وزن بعيار معيّن إلى معادل عيار 21 (بالوحدات) */
export function unitsToK21(units: number, purity: number): number {
  return (Number(units) || 0) * toK21Ratio(purity);
}

/** تحويل وزن معادل عيار 21 إلى وزن بعيار آخر (بالوحدات) */
export function unitsFromK21(unitsK21: number, purity: number): number {
  const ratio = toK21Ratio(purity);
  if (ratio <= 0) return 0;
  return (Number(unitsK21) || 0) / ratio;
}

/** قيمة وزن بعيار معيّن بسعر جرام عيار 21 */
export function valueAt21(units: number, purity: number, price21: number): number {
  return (unitsToK21(units, purity) / 100) * (Number(price21) || 0);
}

/** سعر جرام أي عيار مشتق من سعر جرام عيار 21 */
export function priceForKarat(price21: number, karat: number): number {
  const target = purityToFineness(karat);
  if (target <= 0) return 0;
  return (Number(price21) || 0) * (target / K21_FINENESS);
}

/** الفرق بين عيارين معبّراً عنه كنسبة وزن */
export function karatRatio(fromKarat: number, toKarat: number): number {
  const f = purityToFineness(fromKarat);
  const t = purityToFineness(toKarat);
  if (f <= 0 || t <= 0) return 0;
  return f / t;
}

export function roundMoney(n: number): number {
  const v = Number(n) || 0;
  return Math.round(v);
}
