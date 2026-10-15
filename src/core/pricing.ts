/**
 * محرك التسعير — منطق خالص (بلا شبكة ولا React) قابل للاختبار.
 *
 * المبدأ:
 *   1) كل مصدر يُنتج «قراءة» (سعر + مصدر + وقت + ثقة).
 *   2) محرك التحقق يجمع القراءات ويستبعد الشاذة ويعطي درجة اتفاق.
 *   3) لا نأخذ المتوسط أعمى: شراء الذهب يعتمد سعر شراء الدولار،
 *      وبيع الذهب يعتمد سعر بيع الدولار (الفارق حقيقي في السوق).
 *   4) تغيّر كبير أو اختلاف بين المصادر ⇒ تحذير وعدم تحديث السعر المعتمد تلقائياً.
 */

export const GRAMS_PER_OUNCE = 31.1034768;

/** العيار الرسمي للتداول في السودان */
export const TRADE_KARAT = 21;

/* ------------------------------------------------------------------ */
/*                            قراءات المصادر                          */
/* ------------------------------------------------------------------ */

export type ReadingKind = 'parallel' | 'bank' | 'spot' | 'parallel-aed';

export interface SourceReading {
  /** اسم المصدر المعروض للمستخدم */
  source: string;
  kind: ReadingKind;
  /** سعر الشراء (المصدر يشتري/نتعامل بسعر أقل) */
  buy?: number | null;
  /** سعر البيع */
  sell?: number | null;
  /** سعر مفرد (للأونصة أو عندما ينشر المصدر رقماً واحداً) */
  price?: number | null;
  url?: string;
  /** وقت القراءة (ISO) */
  at: string;
  /** عنوان المقال/التحديث إن وُجد */
  label?: string;
}

export type AgreementLevel = 'high' | 'medium' | 'low' | 'none';

export interface RejectedReading {
  reading: SourceReading;
  reason: string;
}

export interface Aggregate {
  buy: number | null;
  sell: number | null;
  /** المتوسط — يُعرض للعلم فقط ولا يُستخدم للتسعير */
  avg: number | null;
  used: SourceReading[];
  rejected: RejectedReading[];
  /** أقصى فرق نسبي بين القراءات المقبولة (%) */
  spreadPercent: number;
  agreement: AgreementLevel;
  /** ثقة 0..1 */
  confidence: number;
  warnings: string[];
  /** عمر أحدث قراءة بالدقائق */
  freshestAgeMinutes: number | null;
}

/** حدود منطقية مطلقة — أي رقم خارجها يُرفض فوراً */
const PLAUSIBLE = {
  usd: { min: 500, max: 60_000 },
  ounce: { min: 800, max: 12_000 },
} as const;

/** أقصى عمر مقبول للقراءة (دقائق) — بعدها تُرفض لأنها لا تعبّر عن السوق الآن */
export const MAX_READING_AGE_MINUTES = 60 * 36; // 36 ساعة

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ageMinutesOf(at: string, now: number): number {
  const t = new Date(at).getTime();
  if (isNaN(t)) return Infinity;
  return Math.max(0, Math.round((now - t) / 60000));
}

function limitOf(kind: ReadingKind) {
  if (kind === 'spot') return PLAUSIBLE.ounce;
  if (kind === 'parallel-aed') return { min: 100, max: 20_000 }; // الدرهم بالجنيه (~2000-2800 حالياً)
  return PLAUSIBLE.usd;
}

function isValidValue(kind: ReadingKind, value: number): boolean {
  const { min, max } = limitOf(kind);
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * جمع قراءات متعددة لنفس القيمة (دولار السوق الموازي أو الأونصة) مع تحقق.
 *
 * - يرفض القيم غير المنطقية مطلقاً.
 * - يرفض القراءات القديمة جداً.
 * - يستبعد الشاذة (أبعد من 6% عن الوسيط).
 * - يحسب درجة الاتفاق: عالٍ <1.5% — متوسط <4% — منخفض <8% — لا اتفاق ≥8%.
 * - عند «لا اتفاق» لا يُنتج سعراً معتمداً (buy/sell = null) ويطلق تحذيراً.
 */
export function aggregateReadings(
  readings: SourceReading[],
  kind: ReadingKind,
  now: Date = new Date(),
  options: { minSources?: number } = {}
): Aggregate {
  const nowMs = now.getTime();
  const minSources = options.minSources ?? 1;
  const rejected: RejectedReading[] = [];
  const warnings: string[] = [];
  const accepted: SourceReading[] = [];
  let freshestAge: number | null = null;

  for (const reading of readings || []) {
    const age = ageMinutesOf(reading.at, nowMs);
    const label = reading.source;

    if (age > MAX_READING_AGE_MINUTES) {
      rejected.push({ reading, reason: `قراءة قديمة (${Math.round(age / 60)} ساعة)` });
      continue;
    }

    const values = [reading.buy, reading.sell, reading.price].filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v)
    );
    if (!values.length) {
      rejected.push({ reading, reason: 'لا تحتوي على قيمة رقمية' });
      continue;
    }
    if (values.some((v) => !isValidValue(kind, v))) {
      rejected.push({ reading, reason: `قيمة خارج النطاق المنطقي: ${values.join('/')}` });
      continue;
    }
    if (
      typeof reading.buy === 'number' &&
      typeof reading.sell === 'number' &&
      reading.buy > reading.sell * 1.02
    ) {
      rejected.push({ reading, reason: 'شراء أعلى من البيع — بيانات غير منطقية' });
      continue;
    }

    if (freshestAge === null || age < freshestAge) freshestAge = age;
    accepted.push(reading);
  }

  // القيم المرجعية: سعر البيع هو المرجع عند توفره، وإلا السعر المفرد
  const referenceValue = (r: SourceReading): number =>
    (typeof r.sell === 'number' && Number.isFinite(r.sell) ? r.sell : undefined) ??
    (typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : undefined) ??
    (typeof r.buy === 'number' && Number.isFinite(r.buy) ? r.buy : 0);

  const referenceValues = accepted.map(referenceValue).filter((v) => v > 0);
  const med = median(referenceValues);

  // استبعاد الشاذة: أبعد من 6% عن الوسيط
  const used: SourceReading[] = [];
  for (const reading of accepted) {
    const ref = referenceValue(reading);
    const deviation = med > 0 ? Math.abs(ref - med) / med : 0;
    if (referenceValues.length >= 3 && deviation > 0.06) {
      rejected.push({
        reading,
        reason: `شاذة (فرق ${(deviation * 100).toFixed(1)}% عن الوسيط)`,
      });
      continue;
    }
    used.push(reading);
  }

  if (!used.length) {
    return {
      buy: null,
      sell: null,
      avg: null,
      used: [],
      rejected,
      spreadPercent: 0,
      agreement: 'none',
      confidence: 0,
      warnings: [...warnings, 'لا توجد قراءة صالحة من أي مصدر'],
      freshestAgeMinutes: freshestAge,
    };
  }

  const usedReferences = used.map(referenceValue).filter((v) => v > 0);
  const spreadPercent =
    usedReferences.length > 1 && med > 0
      ? ((Math.max(...usedReferences) - Math.min(...usedReferences)) / med) * 100
      : 0;

  const agreement: AgreementLevel =
    used.length < 2
      ? 'low'
      : spreadPercent < 1.5
      ? 'high'
      : spreadPercent < 4
      ? 'medium'
      : spreadPercent < 8
      ? 'low'
      : 'none';

  if (agreement === 'none') {
    warnings.push(
      `⚠️ اختلاف غير طبيعي بين المصادر (${spreadPercent.toFixed(1)}%) — لم يُعتمد سعر جديد، يلزم تأكيد يدوي`
    );
  } else if (used.length >= 2 && agreement === 'low') {
    warnings.push(`اختلاف ملحوظ بين المصادر (${spreadPercent.toFixed(1)}%) — يُفضّل مراجعة السعر`);
  } else if (used.length < 2) {
    warnings.push('قراءة من مصدر واحد فقط — يُنصح بانتظار مصدر ثانٍ لتأكيد السعر');
  }
  if (used.length < minSources) {
    warnings.push(`عدد المصادر المتاحة (${used.length}) أقل من الحد المطلوب (${minSources})`);
  }
  if (freshestAge !== null && freshestAge > 12 * 60) {
    warnings.push(`أحدث قراءة عمرها ${Math.round(freshestAge / 60)} ساعة — قد لا تعكس السوق الآن`);
  }

  // القراءة التي تنشر رقماً واحداً (بلا شراء/بيع) تُعتبر سعراً وسطاً يدخل في
  // حساب الشراء والبيع معاً — وإلا ضاع مصدر كامل من أحد الجانبين.
  const buyValues: number[] = [];
  const sellValues: number[] = [];
  for (const r of used) {
    const ref = referenceValue(r);
    if (typeof r.buy === 'number' && r.buy > 0) buyValues.push(r.buy);
    else if (ref > 0) buyValues.push(ref);
    if (typeof r.sell === 'number' && r.sell > 0) sellValues.push(r.sell);
    else if (ref > 0) sellValues.push(ref);
  }

  const sellRef = sellValues.length ? median(sellValues) : med;
  const buyRef = buyValues.length ? median(buyValues) : med;
  const avg = usedReferences.length ? usedReferences.reduce((a, b) => a + b, 0) / usedReferences.length : null;

  // الثقة: عدد المصادر + الاتفاق + حداثة السعر
  const sourceScore = Math.min(1, used.length / 3);
  const agreementScore = agreement === 'high' ? 1 : agreement === 'medium' ? 0.7 : agreement === 'low' ? 0.45 : 0;
  const freshnessScore = typeof freshestAge === 'number' ? (freshestAge < 180 ? 1 : freshestAge < 720 ? 0.7 : 0.4) : 0.3;
  const confidence = Math.round(((sourceScore * 0.45 + agreementScore * 0.35 + freshnessScore * 0.2) * 100)) / 100;

  const blocked = agreement === 'none';
  return {
    buy: blocked ? null : Math.round(buyRef * 100) / 100,
    sell: blocked ? null : Math.round(sellRef * 100) / 100,
    avg: avg === null ? null : Math.round(avg * 100) / 100,
    used,
    rejected,
    spreadPercent: Math.round(spreadPercent * 100) / 100,
    agreement,
    confidence,
    warnings,
    freshestAgeMinutes: freshestAge,
  };
}

/* ------------------------------------------------------------------ */
/*                          حساب سعر الذهب                            */
/* ------------------------------------------------------------------ */

export interface GoldComputationInput {
  /** سعر الأونصة بالدولار */
  ounceUsd: number;
  /** الدولار السوق الموازي: سعر الشراء (نشتري به الدولار — أقل) */
  usdBuy: number;
  /** الدولار السوق الموازي: سعر البيع (نشتري الدولار به — أعلى) */
  usdSell: number;
  /** تعديل السوق المحلي % (موجب أو سالب) */
  localAdjustPercent?: number;
  /** نسبة التعديل لعيار 21 */
  karat?: number;
  /** سعر الدرهم الإماراتي بالجنيه (السوق الموازي) — سوق الذهب السوداني بيتسعّر بالدرهم */
  aedSdg?: number | null;
}

/** الدرهم مربوط بالدولار: 3.6725 درهم/دولار */
export const AED_PER_USD = 3.6725;

/**
 * حدود قبول نسبة المعايرة (الدرهم الحقيقي ÷ المحسوب من الدولار).
 * مفتوح عمداً (من 5% لـ 20 ضعف) لأن الحارس الفعلي هو نطاق الدرهم الناتج أدناه —
 * فالنسبة الغريبة بس ما تكفيش للرفض، المهم الرقم اللي بيطلع في النهاية.
 */
export const AED_RATIO_MIN = 0.05;
export const AED_RATIO_MAX = 20;

/** نطاق سعر الدرهم المقبول بالجنيه — نفس نطاق قراءات السوق الموازي (limitOf('parallel-aed')) */
export const AED_SDG_MIN = 100;
export const AED_SDG_MAX = 20_000;

export type AedBasis = 'manual' | 'anchored' | 'market' | 'computed' | null;

export interface AedResolution {
  /** سعر الدرهم بالجنيه المعتمد (null = ما فيش أي مصدر) */
  aedSdg: number | null;
  /** مصدر الرقم — يظهر للمستخدم عشان يعرف على أي أساس اتسعّر */
  basis: AedBasis;
}

export interface AedResolutionInput {
  /** قيمة ثابتة من المستخدم (?aed=) — لا تمشي مع الدولار */
  overrideAed?: number | null;
  /** نسبة المعايرة (?aedRatio=) = الدرهم الحقيقي ÷ المحسوب من الدولار وقت الإدخال */
  aedRatio?: number | null;
  /** قراءة منشورة للدرهم من السوق الموازي */
  aedMarket?: number | null;
  /** سعر بيع الدولار الفعّال (بعد التجاوزات) */
  usdSell?: number | null;
}

/**
 * اختيار سعر الدرهم — ترتيب الأولوية (v6.20.4):
 *
 *   1. manual   — قيمة ثابتة أدخلها المستخدم: تُستخدم كما هي ولا تتأثر بحركة الدولار.
 *   2. anchored — معايرة المستخدم: الدرهم = النسبة × (الدولار ÷ 3.6725) في كل جلب،
 *                 فيمشي مع السوق لحظياً بنفس النسبة التي عاير بها مرة واحدة.
 *   3. market   — قراءة منشورة من السوق الموازي، بشرط ألا تكون مجرد اشتقاق من الدولار
 *                 (بعض المواقع تنشر «الدرهم» = الدولار ÷ 3.6725، ونكشف ذلك بفرق < 0.5%).
 *   4. computed — الدولار ÷ 3.6725 كآخر حل.
 *
 * ملاحظة: المعايرة تتقدّم على القراءة المنشورة لأنها رقم صراف حقيقي، بس ما تتقدّمش
 * على التدخل اليدوي الصريح.
 */
export function resolveAedSdg(input: AedResolutionInput): AedResolution {
  const computed = input.usdSell && input.usdSell > 0 ? input.usdSell / AED_PER_USD : null;

  const ratio = Number(input.aedRatio);
  const ratioValid = Number.isFinite(ratio) && ratio >= AED_RATIO_MIN && ratio <= AED_RATIO_MAX;
  // المعايرة مقبولة لو ناتجها درهم معقول — ده اللي يمنع كباية زي 2500 مكان 25000
  const anchoredValue = ratioValid && computed ? ratio * computed : null;
  const anchored =
    anchoredValue !== null && anchoredValue >= AED_SDG_MIN && anchoredValue <= AED_SDG_MAX ? anchoredValue : null;

  const override = Number(input.overrideAed);
  const market = Number(input.aedMarket);
  const hasOverride = Number.isFinite(override) && override > 0;
  const hasMarket = Number.isFinite(market) && market > 0;
  const derivedFromUsd = !!(hasMarket && computed && Math.abs(market - computed) / market < 0.005);

  if (hasOverride) return { aedSdg: override, basis: 'manual' };
  if (anchored) return { aedSdg: anchored, basis: 'anchored' };
  if (hasMarket) return { aedSdg: market, basis: derivedFromUsd ? 'computed' : 'market' };
  if (computed) return { aedSdg: computed, basis: 'computed' };
  return { aedSdg: null, basis: null };
}

/**
 * نسبة المعايرة من رقم صراف حقيقي: الدرهم ÷ (الدولار ÷ 3.6725)، مقرّبة لـ 4 خانات.
 * ترجع null لو النسبة برّه المدى المعقول — وقتها الأفضل استخدام الرقم كما هو (ثابت).
 */
export function aedAnchorRatio(aed: number, usdSell: number): number | null {
  if (!(aed > 0) || !(usdSell > 0)) return null;
  if (aed < AED_SDG_MIN || aed > AED_SDG_MAX) return null;
  const computed = usdSell / AED_PER_USD;
  const ratio = Math.round((aed / computed) * 10000) / 10000;
  return ratio >= AED_RATIO_MIN && ratio <= AED_RATIO_MAX ? ratio : null;
}

/* ------------------------------------------------------------------ */
/*              معايرة السوق: من سعر الجرام → الدرهم الفعلي             */
/* ------------------------------------------------------------------ */

export interface MarketCalibrationInput {
  /** سعر بيع الجرام (العيار المطلوب) اللي طلّعه المحرك الحين */
  currentSell: number;
  /** سعر السوق الحقيقي اللي قاله المستخدم لنفس العيار */
  targetSell: number;
  /** الدرهم المستخدم في الحسبة الحالية (null/0 = التسعير ماشي بالدولار) */
  aedSdg?: number | null;
  /** تعديل السوق المحلي الحالي % — يُبنى عليه في وضع الدولار */
  localAdjustPercent?: number;
}

export interface MarketCalibration {
  /** 'dirham' = استنتجنا درهم سوق الذهب (الوضع الطبيعي) | 'adjust' = ما فيش درهم، استنتجنا نسبة التعديل */
  mode: 'dirham' | 'adjust';
  /** الدرهم المستنتج (في وضع dirham) */
  aedSdg?: number;
  /** نسبة تعديل السوق المستنتجة (في وضع adjust) */
  adjustPercent?: number;
  /** نسبة فرق السوق عن حسبة المحرك (للعرض: -5.31%) */
  gapPercent: number;
}

/** أقصى فرق مقبول بين سعر المستخدم وحسبة المحرك — أكثر منه غالباً كباية في الأصفار */
export const MARKET_CALIBRATION_MIN_RATIO = 0.5;
export const MARKET_CALIBRATION_MAX_RATIO = 2;

/**
 * معايرة بسعر السوق: المستخدم يعرف سعر الجرام الحقيقي في الشارع، واحنا نستنتج منه
 * الدرهم الفعلي اللي بيتعامل بيه سوق الذهب (مش 3.6725 النظري).
 *
 * الحسبة خطّية في الدرهم:
 *   sell = (أونصة ÷ 31.1034768) × 3.6725 × درهم × (عيار ÷ 24) × (1 + تعديل%)
 * فالدرهم المستنتج = الدرهم الحالي × (سعر السوق ÷ حسبة المحرك) — بالنسبة نفسها بالظبط.
 *
 * ترجع null لو الرقم بعيد عن المعقول (أكثر من ±50%) — غالباً صفر ناقص أو زايد.
 */
export function calibrateToMarketPrice(input: MarketCalibrationInput): MarketCalibration | null {
  const current = Number(input.currentSell);
  const target = Number(input.targetSell);
  if (!(current > 0) || !(target > 0)) return null;

  const ratio = target / current;
  if (ratio < MARKET_CALIBRATION_MIN_RATIO || ratio > MARKET_CALIBRATION_MAX_RATIO) return null;

  const gapPercent = Math.round((ratio - 1) * 10000) / 100;
  const aed = Number(input.aedSdg);

  // الوضع الطبيعي: التسعير ماشي بالدرهم → نستنتج درهم سوق الذهب
  if (aed > 50) {
    const implied = Math.round(aed * ratio);
    if (implied >= AED_SDG_MIN && implied <= AED_SDG_MAX) return { mode: 'dirham', aedSdg: implied, gapPercent };
    return null;
  }

  // ما فيش درهم (التسعير بالدولار) → نستنتج نسبة تعديل السوق المحلي بدلاً منه
  const currentAdjust = Number(input.localAdjustPercent) || 0;
  const impliedAdjust = Math.max(-20, Math.min(50, Math.round((currentAdjust + (ratio - 1) * 100) * 10) / 10));
  return { mode: 'adjust', adjustPercent: impliedAdjust, gapPercent };
}

export interface GoldComputation {
  /** سعر الجرام لذهب خالص (24) بالجنيه */
  gram24: number;
  /** سعر الجرام للعيار المطلوب — سعر الشراء (نشتري الذهب من الزبون) */
  buy: number;
  /** سعر الجرام للعيار المطلوب — سعر البيع (نبيع الذهب للزبون) */
  sell: number;
  /** المتوسط (للعرض فقط) */
  mid: number;
  /** الفارق بين الشراء والبيع % */
  spreadPercent: number;
  /** الأساس قبل تعديل السوق المحلي */
  baseBeforeAdjust: { buy: number; sell: number };
  localAdjustPercent: number;
  karat: number;
  /** أساس التسعير: 'dirham' = سلسلة الدرهم (سوق الذهب الفعلي) أو 'dollar' = الدولار مباشرة */
  basis: 'dirham' | 'dollar';
  /** سعر الدرهم المستخدم في التسعير بالجنيه (0 لو التسعير بالدولار) */
  aedSdg: number;
  /** هل الأدخال صالح */
  ok: boolean;
  warnings: string[];
}

const round0 = (n: number) => Math.round(n);

/**
 * سعر جرام الذهب بالجنيه السوداني.
 *
 *   سعر الجرام 24 = (الأونصة ÷ 31.1034768) × الدولار
 *   سعر العيار    = سعر 24 × (العيار ÷ 24)
 *
 * الفرق بين الشراء والبيع يأتي من فارق الدولار في السوق الموازي
 * (نشتري الذهب بسعر شراء الدولار، ونبيعه بسعر بيعه) + تعديل السوق المحلي.
 */
export function computeGoldPrice(input: GoldComputationInput): GoldComputation {
  const warnings: string[] = [];
  const karat = input.karat && input.karat > 0 ? input.karat : TRADE_KARAT;
  const adjust = Number(input.localAdjustPercent) || 0;

  const ounce = Number(input.ounceUsd) || 0;
  const usdBuy = Number(input.usdBuy) || 0;
  const usdSell = Number(input.usdSell) || 0;

  const ok =
    ounce > PLAUSIBLE.ounce.min &&
    ounce < PLAUSIBLE.ounce.max &&
    usdBuy >= PLAUSIBLE.usd.min &&
    usdSell <= PLAUSIBLE.usd.max &&
    usdSell >= usdBuy;

  if (!ok) warnings.push('مدخلات غير صالحة لحساب السعر (أونصة/دولار) — تحقق من الأسعار');

  // سوق الذهب السوداني يتعامل بالدرهم الإماراتي: جرام 24 بالدرهم (من السعر العالمي × 3.6725)
  // ثم بالجنيه بسعر الدرهم الموازي. فارق الشراء/البيع بنفس نسبة زوج الدولار.
  const aed = Number(input.aedSdg) || 0;
  const useDirham = aed > 50;
  const gram24Usd = ounce / GRAMS_PER_OUNCE;
  let gram24AtBuyRate: number;
  let gram24AtSellRate: number;
  if (useDirham) {
    const gram24Aed = gram24Usd * AED_PER_USD; // درهم لكل جرام 24
    gram24AtSellRate = gram24Aed * aed;
    gram24AtBuyRate = gram24AtSellRate * (usdBuy > 0 ? usdBuy / usdSell : 1);
  } else {
    gram24AtBuyRate = gram24Usd * usdBuy;
    gram24AtSellRate = gram24Usd * usdSell;
  }
  const basis: 'dirham' | 'dollar' = useDirham ? 'dirham' : 'dollar';
  const factor = karat / 24;
  const adjustFactor = 1 + adjust / 100;

  const baseBuy = gram24AtBuyRate * factor;
  const baseSell = gram24AtSellRate * factor;
  const buy = baseBuy * adjustFactor;
  const sell = baseSell * adjustFactor;

  const gram24 = ((gram24AtBuyRate + gram24AtSellRate) / 2) * adjustFactor;

  return {
    gram24: round0(gram24),
    buy: round0(buy),
    sell: round0(sell),
    mid: round0((buy + sell) / 2),
    spreadPercent: buy > 0 ? Math.round(((sell - buy) / buy) * 10000) / 100 : 0,
    baseBeforeAdjust: { buy: round0(baseBuy), sell: round0(baseSell) },
    localAdjustPercent: adjust,
    karat,
    basis,
    aedSdg: useDirham ? aed : 0,
    ok,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/*                       حماية من تغيّر السعر المفاجئ                  */
/* ------------------------------------------------------------------ */

export interface BigChangeResult {
  changed: boolean;
  percent: number;
  direction: 'up' | 'down' | 'none';
  message?: string;
}

/**
 * كشف التغيّر الكبير عن السعر السابق.
 * الافتراضي 5% — أي أكثر يُعتبر «يحتاج تأكيد» ولا يُعتمد تلقائياً.
 */
export function detectBigChange(
  previous: number | null | undefined,
  next: number | null | undefined,
  thresholdPercent = 5
): BigChangeResult {
  const prev = Number(previous) || 0;
  const now = Number(next) || 0;
  if (prev <= 0 || now <= 0) return { changed: false, percent: 0, direction: 'none' };

  const percent = Math.round(((now - prev) / prev) * 10000) / 100;
  if (Math.abs(percent) < thresholdPercent) {
    return { changed: false, percent, direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'none' };
  }
  const direction = percent > 0 ? 'up' : 'down';
  return {
    changed: true,
    percent,
    direction,
    message: `⚠️ تغيّر ${direction === 'up' ? 'كبير بالارتفاع' : 'كبير بالانخفاض'} في السعر: ${percent > 0 ? '+' : ''}${percent}% عن السعر المعتمد — يحتاج تأكيداً قبل التحديث`,
  };
}

/* ------------------------------------------------------------------ */
/*                         السعر المعتمد                              */
/* ------------------------------------------------------------------ */

export interface ApprovedPrice {
  /** سعر جرام 21 للشراء (نشتري من الزبون) */
  buy: number;
  /** سعر جرام 21 للبيع (نبيع للزبون) */
  sell: number;
  at: string;
  /** يدوي = اعتمده التاجر بنفسه، تلقائي = اعتماد مقترح من المحرك */
  source: 'manual' | 'auto';
  note?: string;
}

export interface ApprovedPriceCheck {
  /** هل التغيّر يستوجب تأكيداً قبل الاعتماد التلقائي */
  needsConfirmation: boolean;
  buying: BigChangeResult;
  selling: BigChangeResult;
  messages: string[];
}

/** مقارنة سعر مقترح بسعر معتمد — لتقرير هل يُعتمد تلقائياً */
export function checkApproval(
  current: ApprovedPrice | null,
  suggestion: { buy: number; sell: number },
  thresholdPercent = 5
): ApprovedPriceCheck {
  const buying = detectBigChange(current?.buy ?? null, suggestion.buy, thresholdPercent);
  const selling = detectBigChange(current?.sell ?? null, suggestion.sell, thresholdPercent);
  const messages: string[] = [];
  if (buying.changed && buying.message) messages.push(buying.message.replace('السعر المعتمد', 'سعر الشراء المعتمد'));
  if (selling.changed && selling.message) messages.push(selling.message.replace('السعر المعتمد', 'سعر البيع المعتمد'));
  return {
    needsConfirmation: buying.changed || selling.changed,
    buying,
    selling,
    messages,
  };
}

/** تحذير عند تعديل سعر العملية يدوياً بعيداً عن المعتمد */
export function operationPriceWarning(
  operationPrice: number,
  approvedPrice: number,
  thresholdPercent = 2
): string | null {
  const op = Number(operationPrice) || 0;
  const ap = Number(approvedPrice) || 0;
  if (op <= 0 || ap <= 0) return null;
  const percent = Math.round(((op - ap) / ap) * 10000) / 100;
  if (Math.abs(percent) < thresholdPercent) return null;
  return `السعر المدخل ${percent > 0 ? 'أعلى' : 'أقل'} من السعر المعتمد بنسبة ${Math.abs(percent)}%`;
}

/* ------------------------------------------------------------------ */
/*                    التحقق المتقاطع مع السوق المنشور                */
/* ------------------------------------------------------------------ */

export interface LocalPublishedCheck {
  ok: boolean;
  deviationPercent: number;
  message?: string;
}

/**
 * مقارنة سعرنا المحسوب بسعر محلي منشور (إن توفّر من مصدر سوداني).
 * فرق أكثر من 8% ⇒ تحذير قوي بالمراجعة.
 */
export function compareWithPublished(
  computed: number,
  published: number | null | undefined,
  tolerancePercent = 8
): LocalPublishedCheck {
  const c = Number(computed) || 0;
  const p = Number(published) || 0;
  if (c <= 0 || p <= 0) return { ok: true, deviationPercent: 0 };
  const deviation = Math.round((Math.abs(c - p) / p) * 10000) / 100;
  if (deviation <= tolerancePercent) return { ok: true, deviationPercent: deviation };
  return {
    ok: false,
    deviationPercent: deviation,
    message: `⚠️ سعرنا المحسوب يبعد ${deviation}% عن سعر محلي منشور (${Math.round(p)} ج.س) — راجع المصادر قبل الاعتماد`,
  };
}
