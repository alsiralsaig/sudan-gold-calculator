/**
 * محرك الأوامر الصوتية — نقي بلا React، مُختبر.
 *
 * يحوّل جملة المستخدم (من المايك أو مكتوبة) إلى أمر واضح تنفّذه الواجهة:
 *   «احسب عشرين غرام عيار 18» → { type: 'calc_value', units: 2000, purity: 18 }
 *
 * الوحدات داخلياً (نظام التطبيق): 1 جرام = 10 حبات = 100 جزء، والمثقال = 5 غرام.
 * يفهم الأرقام المكتوبة (10، ٢٥) والمتفوّتة (خمسة، وعشرين، مية ألف، مليون)
 * واللهجة السودانية (تلاته، تمنيه، حداشر، تلتاشر...).
 */

export type VoiceCommand =
  | { type: 'gold_price' }
  | { type: 'usd_price' }
  | { type: 'calc_value'; units: number; purity: number; purityExplicit: boolean }
  | { type: 'calc_weight'; money: number; purity: number; purityExplicit: boolean }
  | { type: 'calc_karat'; units: number; from: number; to: number }
  | { type: 'calc_sum'; items: { units: number; purity: number }[] }
  | { type: 'navigate'; tab: string }
  | { type: 'add_purchase'; units: number; purity: number; purityExplicit: boolean; price?: number; priceMode: 'per_gram' | 'total' | 'auto'; person?: string; deferred: boolean }
  | { type: 'add_sale'; units: number; purity: number; purityExplicit: boolean; price?: number; priceMode: 'per_gram' | 'total' | 'auto'; person?: string; deferred: boolean; buyPrice?: number; buyPriceMode: 'per_gram' | 'total' | 'auto' }
  | { type: 'add_expense'; amount: number; name: string }
  | { type: 'add_loan'; amount: number; person: string; direction: 'lent' | 'borrowed'; dueDays?: number }
  | { type: 'add_payment'; amount: number; person: string }
  | { type: 'help' }
  | { type: 'unknown' };

/** أمثلة تُعرض للمستخدم في لوحة الأوامر */
export const VOICE_EXAMPLES = [
  'احسب 10 غرام عيار 21',
  'سجل مشتريات 2 غرام بسعر كده',
  'سجل مبيعات 30 غرام واتنين حبة',
  'سلفة 100 الف لخالد',
  'كام غرام بمية ألف؟',
  'الذهب كام؟',
  'افتح المبيعات',
];

/* ============================ تطبيع النص ============================ */

export function normalizeVoiceText(raw: string): string {
  return String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u0652\u0640]/g, '') // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[،؟!_:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokenize = (raw: string): string[] => normalizeVoiceText(raw).toLowerCase().split(' ').filter(Boolean);

/* ============================ كلمات الأرقام ============================ */

const ONES: Record<string, number> = {
  صفر: 0, واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, اتني: 2, تنتين: 2, تلاته: 3, ثلاثه: 3,
  اربعه: 4, خمسه: 5, سته: 6, سبعه: 7, تمنيه: 8, ثمانيه: 8, تسعه: 9,
  عشره: 10, عشر: 10,
};

const TEENS: Record<string, number> = {
  حداشر: 11, احدعشر: 11, اتناشر: 12, اثناعشر: 12, اثنعشر: 12,
  تلتاشر: 13, تلاتاشر: 13, ثلاثطاشر: 13, تلاتطاشر: 13,
  اربعتاشر: 14, اربطاشر: 14, اربعهعشر: 14,
  خمستاشر: 15, خمسطاشر: 15, خمسهعشر: 15,
  ستاشر: 16, ستهعشر: 16, ستطاشر: 16,
  سبعتاشر: 17, سبطاشر: 17, سبعهعشر: 17,
  تمنتاشر: 18, تمنطاشر: 18, ثمانطاشر: 18, تمنيهعشر: 18, ثمانيهعشر: 18,
  تسعتاشر: 19, تسعهعشر: 19,
};

const TENS: Record<string, number> = {
  عشرين: 20, تلاتين: 30, ثلاثين: 30, اربعين: 40, خمسين: 50,
  ستين: 60, سبعين: 70, تمانين: 80, ثمانين: 80, تسعين: 90,
};

const HUNDREDS: Record<string, number> = {
  ميه: 100, مئه: 100, ميا: 100, مائه: 100,
  ميتين: 200, مئتين: 200,
  تلميه: 300, ثلاثميه: 300, ثلاثمائه: 300,
  ربعميه: 400, اربعميه: 400, اربعمائه: 400,
  خسميه: 500, خمسميه: 500, خمسمائه: 500,
  ستميه: 600, ستمائه: 600,
  سبعميه: 700, سبعمائه: 700,
  تمنميه: 800, ثمنميه: 800, ثمانميه: 800, ثمانمائه: 800,
  تسعميه: 900, تسعمائه: 900,
};

const THOUSANDS = new Set(['الف', 'الاف', 'الفين', 'الافين']);
const MILLIONS = new Set(['مليون', 'مليونين', 'ملايين']);
const FRACTIONS: Record<string, number> = { نص: 0.5, ونص: 0.5, ربع: 0.25, وربع: 0.25 };

const stripWaw = (t: string) => (t.length > 2 && (t.startsWith('و') || t.startsWith('ف')) ? t.slice(1) : t);

const digitValue = (t: string): number | null => {
  const s = t.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/,/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

const numWordValue = (t0: string): number | null => {
  // نجرّب الكلمة كما هي، ثم بدون «و/ف» الأولى لو بقيت رقم صالح
  const candidates: string[] = [t0];
  if (t0.length >= 2 && (t0.startsWith('و') || t0.startsWith('ف'))) candidates.push(t0.slice(1));
  for (const t of candidates) {
    const d = digitValue(t);
    if (d !== null) return d;
    if (ONES[t] !== undefined) return ONES[t];
    if (TEENS[t] !== undefined) return TEENS[t];
    if (TENS[t] !== undefined) return TENS[t];
    if (HUNDREDS[t] !== undefined) return HUNDREDS[t];
    if (FRACTIONS[t] !== undefined) return FRACTIONS[t];
    if (THOUSANDS.has(t) || MILLIONS.has(t)) return -1; // كلمة مضاعف — تُقرأ في السياق
  }
  return null;
};

/** هل الرمز بداية عدد صالح؟ (يُستخدم بعد وحدة الوزن) */
const isNumStart = (t0: string): boolean => {
  if (t0 === 'و' || t0 === 'ف') return true; // واقعة منفصلة قبل رقم
  return numWordValue(t0) !== null;
};

/**
 * يقرأ «جملة رقمية» بدءاً من الموضع i:
 *  [خمسه, وعشرين] → 25 | [تلاته, الاف] → 3000 | [100] → 100 | [مليون, وخمسميه, الاف] → 1500000
 * ما يتجاوز «و» إلا مضاعفات (وعشرين، وميه، والاف...) — عشان «5 و 8» يفضلوا عنصرين.
 */
export function readNumber(tokens: string[], i: number): { value: number; next: number } | null {
  let total = 0;
  let current = 0;
  let saw = false;
  let lastMult = 0;
  let j = i;
  while (j < tokens.length) {
    const raw = tokens[j];
    // «و/ف» منفصلة؟ نكمل الجمع لو بعدها مضاعف (و عشرين، و ميه، و الف) — وإلا نقطع الجملة
    if ((raw === 'و' || raw === 'ف') && j > i) {
      const nxtT = stripWaw(tokens[j + 1] ?? '');
      const mergeable = TENS[nxtT] !== undefined || HUNDREDS[nxtT] !== undefined || THOUSANDS.has(nxtT) || MILLIONS.has(nxtT);
      if (mergeable) { j++; continue; }
      break;
    }
    const hasWaw = raw.length >= 2 && (raw.startsWith('و') || raw.startsWith('ف')) && numWordValue(raw.slice(1)) !== null;
    const t = hasWaw ? raw.slice(1) : raw;
    if (digitValue(t) !== null) {
      if (hasWaw && j > i) break; // «و5» → عنصر جديد (للجمع)
      current += digitValue(t) as number;
      saw = true; j++; continue;
    }
    if (ONES[t] !== undefined) { current += ONES[t]; saw = true; j++; continue; }
    if (TEENS[t] !== undefined) { current += TEENS[t]; saw = true; j++; continue; }
    if (FRACTIONS[t] !== undefined) {
      // «مليون ونص» = مليون وخمسمية ألف — النصف على المضاعف الأخير
      if (total > 0 && current === 0 && lastMult > 0) total += lastMult * FRACTIONS[t];
      else current = current > 0 ? current + FRACTIONS[t] : FRACTIONS[t];
      saw = true; j++; continue;
    }
    if (TENS[t] !== undefined) { current += TENS[t]; saw = true; j++; continue; }
    if (HUNDREDS[t] !== undefined) {
      current = current >= 1 && current <= 9 ? current * HUNDREDS[t] : current + HUNDREDS[t];
      saw = true; j++; continue;
    }
    if (THOUSANDS.has(t)) { total += (current || (t === 'الفين' || t === 'الافين' ? 2 : 1)) * 1000; lastMult = 1000; current = 0; saw = true; j++; continue; }
    if (MILLIONS.has(t)) { total += (current || (t === 'مليونين' ? 2 : 1)) * 1000000; lastMult = 1000000; current = 0; saw = true; j++; continue; }
    break;
  }
  if (!saw) return null;
  return { value: total + current, next: j };
}

/* ============================ الوزن ============================ */

/** عوامل الوزن بالجرام — المثقال السوداني = 5 غرام */
const WEIGHT_UNITS: { re: RegExp; grams: number }[] = [
  { re: /^(غرام|جرام|غرامات|جرامات|غ|جم)$/, grams: 1 },
  { re: /^(حبه|حبات|حبتين)$/, grams: 0.1 },
  { re: /^(مثقال|مثقالين|مثاقيل|متقال)$/, grams: 5 },
];

const unitGrams = (t: string): number | null => {
  for (const u of WEIGHT_UNITS) if (u.re.test(t)) return u.grams;
  return null;
};

export interface WeightPhrase {
  units: number; // بوحدات التطبيق (1 جرام = 100)
  endIndex: number; // أول موضع بعد نهاية جملة الوزن
  lastUnitIndex: number; // موضع آخر كلمة وحدة (-1 لو مافي)
}

/** يقرأ جملة وزن بدءاً من موضع محدد مثل: [10, غرام, و, 3, حبات] → 1030 وحدة */
export function readWeight(tokens: string[], start = 0): WeightPhrase | null {
  let grams = 0;
  let pending: number | null = null;
  let i = start;
  let lastUnitIndex = -1;
  let sawAny = false;

  while (i < tokens.length) {
    const t0 = tokens[i];
    // «و/ف» منفصلة — نتخطاها
    if ((t0 === 'و' || t0 === 'ف') && sawAny) { i++; continue; }
    const hasWaw = t0.length >= 2 && (t0.startsWith('و') || t0.startsWith('ف')) && numWordValue(t0.slice(1)) !== null;
    const t = hasWaw ? t0.slice(1) : t0;
    const frac = FRACTIONS[t] ?? null;
    const n = numWordValue(t0);
    const u = unitGrams(t);

    if (frac !== null) {
      pending = pending !== null ? pending + frac : frac;
      i++; continue;
    }
    if (n !== null && n !== -1) {
      if (pending !== null) break; // رقم جديد منفصل — جملة الوزن خلصت
      // رقم بعد الوحدة مباشرة (بدون «و») وقيمته عيار محتمل؟ يُترك للعيار: «10 غرام 21»
      if (lastUnitIndex >= 0 && lastUnitIndex === i - 1 && n <= 24) {
        const nxt2 = tokens[i + 1];
        if (!nxt2 || unitGrams(nxt2) === null) break;
      }
      pending = n; i++; continue;
    }
    if (u !== null) {
      grams += (pending ?? 1) * u;
      pending = null;
      sawAny = true;
      lastUnitIndex = i;
      i++;
      // نكمل فقط لو بعدها (و/ف +) رقم أو وحدة — وإلا وقف
      let k = i;
      while (k < tokens.length && (tokens[k] === 'و' || tokens[k] === 'ف')) k++;
      const nxt = tokens[k];
      if (nxt === undefined) break;
      if (!isNumStart(nxt) && unitGrams(nxt) === null) break;
      i = k;
      continue;
    }
    break;
  }
  if (pending !== null) { grams += pending; sawAny = true; }
  if (!sawAny || grams <= 0) return null;
  return { units: Math.round(grams * 100), endIndex: i, lastUnitIndex };
}

/** يجرّب قراءة وزن من كل موضع — يرجّع أول جملة وزن صالحة */
export function findWeight(tokens: string[]): WeightPhrase | null {
  for (let i = 0; i < tokens.length; i++) {
    const r = readWeight(tokens, i);
    if (r) return r;
  }
  return null;
}

/* ============================ العيار ============================ */

const readPurityState = (tokens: string[]): { purity: number; explicit: boolean } => {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'عيار' || tokens[i] === 'نقاوه') {
      const r = readNumber(tokens, i + 1);
      if (r && r.value > 0) return { purity: r.value, explicit: true };
    }
  }
  // رقم عيار صريح بعد الوحدة مباشرة: «احسب 10 غرام 21»
  for (let i = 0; i < tokens.length; i++) {
    if (unitGrams(tokens[i]) !== null) {
      const r = readNumber(tokens, i + 1);
      if (r && r.value > 0 && r.value <= 24) return { purity: r.value, explicit: true };
    }
  }
  return { purity: 21, explicit: false }; // العيار الأساسي في السودان — بس ما بنقولش عليه
};
const readPurity = (tokens: string[]): number => readPurityState(tokens).purity;

/* ============================ المبلغ ============================ */

/** يلفظ المبلغ: رقم بعد «ب/بمبلغ» أو أول رقم كبير (≥1000) بعد وحدة الوزن */
const scanMoney = (tokens: string[], from: number): { value: number; hasB: boolean } => {
  let best = 0;
  let hasB = false;
  for (let i = from; i < tokens.length; i++) {
    const t0 = tokens[i];
    if (t0 === 'ب' || t0 === 'بمبلغ' || t0 === 'بلغ') { hasB = true; continue; }
    let t = t0;
    if (t0.startsWith('بمبلغ') && t0.length > 'بمبلغ'.length) t = t0.slice('بمبلغ'.length);
    else if (t0.startsWith('ب') && t0.length > 2 && numWordValue(t0.slice(1)) !== null) { t = t0.slice(1); hasB = true; }
    const r = readNumber([t, ...tokens.slice(i + 1)], 0);
    if (r && r.value > best) { best = r.value; i = i + r.next - 1; }
  }
  return { value: best, hasB };
};

/* ============================ شاشات التنقل ============================ */

const SCREEN_WORDS: { tab: string; words: string[] }[] = [
  { tab: 'dashboard', words: ['الرئيسيه', 'الداشبورد', 'لوحه', 'البيت'] },
  { tab: 'calculator', words: ['الحاسبه', 'حاسبه', 'الاله'] },
  { tab: 'partners', words: ['الشركاء', 'شركاء', 'شريك', 'الارباح', 'ارباح'] },
  { tab: 'purchases', words: ['المشتريات', 'مشتريات', 'الشراء', 'شراء', 'المخزن', 'المخزون'] },
  { tab: 'sales', words: ['المبيعات', 'مبيعات', 'البيع', 'بيع'] },
  { tab: 'expenses', words: ['المصروفات', 'المصاريف', 'مصاريف', 'مصروفات'] },
  { tab: 'gold_price', words: ['سعر', 'اسعار', 'محرك', 'التسعير'] },
  { tab: 'reports', words: ['التقارير', 'تقارير', 'كشوفات', 'كشف', 'التقرير'] },
  { tab: 'analytics', words: ['التحليلات', 'تحليلات', 'رسوم', 'الاحصاء', 'احصاء', 'رسم'] },
  { tab: 'reminders', words: ['التذكيرات', 'تذكيرات', 'التنبيهات', 'تنبيهات', 'المتاخرات', 'متاخرات'] },
  { tab: 'loans', words: ['السلف', 'سلف', 'القروض', 'قروض', 'الديون', 'ديون', 'الامانات', 'امانات', 'امانه'] },
  { tab: 'archive', words: ['الارشيف', 'ارشيف'] },
  { tab: 'settings', words: ['الاعدادات', 'اعدادات', 'الضبط', 'ضبط'] },
  { tab: 'search', words: ['البحث', 'بحث', 'دور'] },
];

const NAV_VERBS = ['افتح', 'فوت', 'ودني', 'وديني', 'روح', 'روحلي', 'اعرض', 'هات'];

/* ============================ التسجيل (مشتريات/مبيعات/مصروفات/سلف/دفعات) ============================ */

const PURCHASE_WORDS = ['مشتريات', 'المشتريات', 'شراء', 'الشراء', 'اشتريت', 'شريت', 'اشتري', 'شري', 'بنشري'];
const SALE_WORDS = ['مبيعات', 'المبيعات', 'بيع', 'البيع', 'بعت', 'بعته', 'بعتو', 'ابيع', 'نبيع'];
/** النطق بيختلف: مشتريات/مشتروات/مشتريات... — نقبض العائلة كلها */
// ملاحظة: «المشتري» = الزبون (بتاع البيع) — ما بتدخلش في كلمات المشتريات أبداً
const isPurchaseWord = (t: string) => PURCHASE_WORDS.includes(t) || t.includes('مشترو');
const isSaleWord = (t: string) => SALE_WORDS.includes(t) || t.includes('مبيع') || t.startsWith('بعت');
const EXPENSE_WORDS = ['مصروف', 'مصاريف', 'المصروفات', 'المصاريف', 'صرفت', 'دفعيت', 'انفقت'];
const LOAN_WORDS = ['سلفه', 'سلف', 'اسلف', 'سلفيت', 'استلفيت', 'ادين', 'دين'];
const PAYMENT_WORDS = ['دفعه', 'تسديد', 'سدد', 'سددت', 'اقسط', 'قسط'];

/** كلمات ما تنفعش اسم شخص/وصف */
const NAME_STOP = new Set([
  'غرام', 'غرامات', 'حبه', 'حبات', 'مثقال', 'عيار', 'نقاوه', 'بسعر', 'السعر', 'سعر', 'بسعره',
  'مبلغ', 'بمبلغ', 'اجمالي', 'باجمالي', 'للجرام', 'للغرام', 'للغرامات', 'كاش', 'اجل', 'حساب',
  'الكتاب', 'سجل', 'سجلي', 'في', 'يستحق', 'بعد', 'مدفوع', 'وزن', 'الوزن', 'فلان', 'كده', 'ده',
  'دهب', 'ذهب', 'دولار', 'دولر', 'اليوم', 'امس', 'من', 'ل', 'لل', 'لس', 'لز', 'علي', 'مع',
  'مشتري', 'المشتري', 'المشتريه', 'البايع', 'الزبون', 'زبون', 'الكلفه', 'كلفه', 'كلفني', 'اشتريتو', 'شريتو',
]);

const isNameLike = (t: string): boolean => {
  if (!t || t.length < 2 || NAME_STOP.has(t)) return false;
  if (numWordValue(t) !== null) return false;
  if (unitGrams(t) !== null) return false;
  return true;
};

/** يشيل «ل/ال» من أول الاسم: لاحمد→احمد، للاحمد→احمد */
export const stripNamePrefix = (t: string): string => {
  let s = t;
  if (s.startsWith('لل')) s = s.slice(2);
  else if (s.startsWith('ل')) s = s.slice(1);
  if (s.startsWith('ال') && s.length > 3) s = s.slice(2);
  return s;
};

/** يلفظ الاسم بعد أدوات: ل/لل/لس/من أو ملتصقة: «لاحمد» */
export function capturePerson(tokens: string[]): string {
  const MARKERS = ['ل', 'لل', 'لس', 'لز', 'من', 'لصالح', 'لحساب', 'المشتري', 'مشتري', 'الزبون', 'زبون', 'البايع'];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (MARKERS.includes(t)) {
      const nxt = tokens[i + 1] ?? '';
      if (isNameLike(nxt)) return stripNamePrefix(nxt);
    } else if (t.startsWith('ل') && t.length >= 3) {
      const bare = stripNamePrefix(t);
      if (bare !== t && isNameLike(bare)) return bare;
    }
  }
  return '';
}

/** السعر: «بسعر 89 الف» / «بمبلغ مليون» / «للجرام» يحدد النمط */
export function capturePrice(tokens: string[]): { price?: number; mode: 'per_gram' | 'total' | 'auto' } {
  let price: number | undefined;
  let mentionsForGram = false;
  let mentionsTotal = false;
  // لو في كلمة كلفة («اشتريتو/كلفني...») — السعر قبلها بس، اللي بعدها كلفة
  let limit = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    if (COST_MARKERS.includes(stripWaw(tokens[i]))) { limit = i; break; }
  }
  for (let i = 0; i < limit; i++) {
    const t = tokens[i];
    if (['بمبلغ', 'مبلغ', 'اجمالي', 'باجمالي', 'الاجمالي'].includes(t)) {
      const r = readNumber(tokens, i + 1);
      if (r) { price = r.value; mentionsTotal = true; i = r.next - 1; continue; }
    }
    if (['بسعر', 'السعر', 'سعر', 'بسعره', 'ب'].includes(t)) {
      if (price === undefined) {
        const r = readNumber(tokens, i + 1);
        if (r) { price = r.value; i = r.next - 1; continue; }
      }
    }
    if (t === 'للجرام' || t === 'للغرام' || t === 'للغرامات') mentionsForGram = true;
  }
  const mode: 'per_gram' | 'total' | 'auto' = mentionsTotal ? 'total' : mentionsForGram ? 'per_gram' : 'auto';
  return { price, mode };
}

/** كلفة الشراء في جملة البيع: «واشتريتو بـ500 الف» / «كلفني 100 الف للجرام» */
const COST_MARKERS = ['كلفني', 'كلفه', 'كلفتو', 'كلفته', 'اشتريتو', 'شريتو', 'بتكلفه', 'تكلفتو', 'الكلفه', 'بتمنو'];
export function captureCost(tokens: string[]): { price?: number; mode: 'per_gram' | 'total' | 'auto' } {
  for (let i = 0; i < tokens.length; i++) {
    if (!COST_MARKERS.includes(stripWaw(tokens[i]))) continue;
    let k = i + 1;
    let saidTotal = false;
    while (k < tokens.length && ['ب', 'بمبلغ', 'مبلغ', 'بلغ'].includes(tokens[k])) {
      if (tokens[k] !== 'ب') saidTotal = true;
      k++;
    }
    const r = readNumber(tokens, k);
    if (!r) continue;
    const after = tokens.slice(r.next, r.next + 2);
    const perGram = after.includes('للجرام') || after.includes('للغرام');
    return { price: r.value, mode: perGram ? 'per_gram' : saidTotal ? 'total' : 'auto' };
  }
  return { mode: 'auto' as const };
}

/** آجل؟ («آجل»، «على الحساب»، «على الكتاب») */
const captureDeferred = (tokens: string[]): boolean =>
  tokens.some((t) => ['اجل', 'احجل', 'نصب'].includes(t)) ||
  (tokens.includes('علي') && tokens.some((t) => t === 'الحساب' || t === 'الكتاب' || t === 'حساب'));

/** «يستحق بعد شهر» → 30 يوم */
export function captureDueDays(tokens: string[]): number | undefined {
  const UNITS: { words: string[]; mult: number; dual?: number }[] = [
    { words: ['يوم', 'ايام', 'يومات'], mult: 1, dual: 2 },
    { words: ['يومين'], mult: 1, dual: 2 },
    { words: ['اسبوع', 'اسابيع', 'اسبوعات'], mult: 7, dual: 14 },
    { words: ['اسبوعين'], mult: 7, dual: 14 },
    { words: ['شهر', 'شهور', 'شهورات'], mult: 30, dual: 60 },
    { words: ['شهرين'], mult: 30, dual: 60 },
    { words: ['سنه', 'سنين', 'سنوات'], mult: 365, dual: 730 },
  ];
  const daysOf = (unitTok: string, count: number): number | null => {
    for (const u of UNITS) {
      if (u.words.includes(unitTok)) {
        return u.dual && (count === 2 || unitTok.endsWith('ين')) ? u.dual : count * u.mult;
      }
    }
    return null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t !== 'يستحق' && t !== 'بعد' && t !== 'الاستحقاق') continue;
    let k = i + 1;
    if (tokens[k] === 'بعد') k++;
    const r = readNumber(tokens, k);
    if (r) {
      const days = daysOf(tokens[r.next] ?? '', r.value);
      if (days) return days;
    } else {
      // «بعد شهر» من غير رقم = واحد
      const days = daysOf(tokens[k] ?? '', 1);
      if (days) return days;
    }
  }
  return undefined;
}

/** أول مبلغ في الجملة (للمصروف/السلف/الدفعة) */
export function captureAmount(tokens: string[]): number | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NAME_STOP.has(t)) continue;
    const r = readNumber(tokens, i);
    if (r && r.value > 0) return r.value;
  }
  return null;
}

/** وصف المصروف: كلمات بعد المبلغ مش أرقام ولا كلمات مفتاحية */
function captureExpenseName(tokens: string[]): string {
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (EXPENSE_WORDS.includes(t) || ['سجل', 'سجلي', 'في', 'مبلغ', 'بمبلغ'].includes(t)) continue;
    if (readNumber(tokens, i)) continue;
    if (isNameLike(t)) words.push(t);
    if (words.length >= 2) break;
  }
  return words.join(' ');
}

/* ============================ الأمر الرئيسي ============================ */

const hasAnyExact = (tokens: string[], words: string[]) => tokens.some((t) => words.includes(t));
const hasAnySub = (tokens: string[], words: string[]) => tokens.some((t) => words.some((w) => t.includes(w)));

export function parseCommand(raw: string): VoiceCommand {
  const tokens = tokenize(raw);
  if (!tokens.length) return { type: 'unknown' };

  /* ---------- 1) مساعدة ---------- */
  if (hasAnySub(tokens, ['مساعده', 'ساعدني', 'امثله', 'اوامر']) ||
      (hasAnySub(tokens, ['تعرف']) && hasAnySub(tokens, ['ايه', 'ايش', 'شو', 'شنو']))) {
    return { type: 'help' };
  }

  /* ---------- 2) تسجيل عمليات (ما تتخطفش أوامر التنقل) ---------- */
  const hasNavVerb = tokens.some((t) => NAV_VERBS.includes(t));
  if (!hasNavVerb) {
  const weightRec = findWeight(tokens);
  const purityRec = readPurityState(tokens);
  let person = capturePerson(tokens);
  const priceInfo = capturePrice(tokens);
  const deferred = captureDeferred(tokens);
  const dueDays = captureDueDays(tokens);

  // دفعة/تسديد: «سجل دفعة 50 الف لأحمد»
  const hasPaymentKw = tokens.some((t) => PAYMENT_WORDS.includes(stripWaw(t)));
  if (hasPaymentKw) {
    const amount = captureAmount(tokens);
    if (amount && person) return { type: 'add_payment', amount, person };
    if (amount && !person) return { type: 'add_expense', amount, name: captureExpenseName(tokens) || 'دفعة' };
  }

  // سلفة: «سلفة 100 الف لخالد» / «استلفيت من عمر 200 الف»
  const loanDir = tokens.find((t) => LOAN_WORDS.includes(stripWaw(t)));
  if (loanDir) {
    const amount = captureAmount(tokens);
    if (amount) {
      const mIdx = tokens.lastIndexOf('من');
      const borrowed =
        (mIdx >= 0 && person && tokens[mIdx + 1] && stripNamePrefix(tokens[mIdx + 1]) === person) ||
        ['استلفيت'].includes(stripWaw(loanDir));
      return { type: 'add_loan', amount, person: person || 'بدون اسم', direction: borrowed ? 'borrowed' : 'lent', dueDays };
    }
  }

  // مصروف: «صرفت 50 الف كهرباء» / «سجل مصروف 20 الف أجرة»
  const hasExpenseKw = tokens.some((t) => EXPENSE_WORDS.includes(stripWaw(t)));
  if (hasExpenseKw) {
    const amount = captureAmount(tokens);
    if (amount) return { type: 'add_expense', amount, name: captureExpenseName(tokens) || 'مصروف' };
  }

  // مبيعات أولاً — عشان جمل زي «سجل المشتري فلان...» و«بعت... واشتريتو...» ما تروحش للمشتريات
  const hasSaleKw = tokens.some((t) => isSaleWord(stripWaw(t)));
  const hasPurchaseKw = tokens.some((t) => isPurchaseWord(stripWaw(t)));
  // الاسم في أول الجملة: «ابوجيقه سجل في المبيعات...» — أول كلمة اسم مش فعل = صاحب العملية
  if (!person) {
    const first = tokens[0];
    const actionIdx = tokens.findIndex((t) =>
      hasSaleKw && (isSaleWord(t) || isPurchaseWord(t)) ||
      ['سجل', 'سجلي', 'بعت', 'بعته', 'شريت', 'اشتريت', 'صرفت', 'دفعيت'].includes(stripWaw(t)));
    if (actionIdx > 0 && tokens.slice(0, actionIdx).every((t) => isNameLike(stripWaw(t)))) {
      person = tokens.slice(0, actionIdx).map((t) => stripNamePrefix(stripWaw(t))).join(' ');
    }
  }
  // «المشتري/الزبون» في الجملة = بتاع بيع (ما عادش مشتريات)
  const buyerWord = tokens.some((t) => ['مشتري', 'المشتري'].includes(stripWaw(t)));
  if ((hasSaleKw || (buyerWord && !hasPurchaseKw)) && weightRec) {
    const cost = captureCost(tokens);
    return {
      type: 'add_sale',
      units: weightRec.units,
      purity: purityRec.purity,
      purityExplicit: purityRec.explicit,
      price: priceInfo.price,
      priceMode: priceInfo.mode,
      person,
      deferred,
      buyPrice: cost.price,
      buyPriceMode: cost.mode,
    };
  }

  // مشتريات: «سجل مشتريات 2 غرام عيار 21 بسعر 104 الف» / «شريت من فلان 5 غرام»
  if (hasPurchaseKw && weightRec) {
    return {
      type: 'add_purchase',
      units: weightRec.units,
      purity: purityRec.purity,
      purityExplicit: purityRec.explicit,
      price: priceInfo.price,
      priceMode: priceInfo.mode,
      person,
      deferred,
    };
  }

  // فيه كلمات تسجيل بس ناقص وزن/مبلغ → ما نفهمش (بدل ما ينفذ حاجة غلط)
  if (hasPaymentKw || loanDir || hasExpenseKw || hasPurchaseKw || hasSaleKw) {
    return { type: 'unknown' };
  }
  } // نهاية حارس التنقل

  /* ---------- 2) جمع الأوزان ---------- */
  const sumIdx = tokens.findIndex((t) => ['اجمع', 'اجمعلي', 'جمع', 'مجموع'].includes(t));
  if (sumIdx >= 0) {
    const items: { units: number; purity: number }[] = [];
    const purity = readPurity(tokens);
    let i = sumIdx + 1;
    while (i < tokens.length) {
      const r = readNumber(tokens, i);
      if (!r) { i++; continue; }
      i = r.next;
      let grams = 1;
      if (i < tokens.length) {
        const u = unitGrams(tokens[i]);
        if (u !== null) { grams = u; i++; }
      }
      items.push({ units: Math.round(r.value * grams * 100), purity });
    }
    if (items.length >= 1) return { type: 'calc_sum', items };
  }

  /* ---------- 3) تحويل العيار ---------- */
  if (hasAnySub(tokens, ['حول', 'معادل', 'يعادل', 'بدل', 'ساوي'])) {
    const fromIdx = tokens.findIndex((t) => t === 'من');
    const toIdx = tokens.findIndex((t) => ['الي', 'في', 'ل'].includes(t));
    const w = findWeight(tokens);
    if (w) {
      let from: number | null = null;
      let to: number | null = null;
      if (fromIdx > 0) {
        from = readNumber(tokens, fromIdx + 1)?.value ?? null;
        if (from && toIdx > fromIdx) to = readNumber(tokens, toIdx + 1)?.value ?? null;
      } else {
        // «10 غرام عيار 18 يعادل كام في 21»
        const ayIdx = tokens.findIndex((t) => t === 'عيار' || t === 'نقاوه');
        if (ayIdx >= 0) from = readNumber(tokens, ayIdx + 1)?.value ?? null;
        if (from && toIdx > 0) to = readNumber(tokens, toIdx + 1)?.value ?? null;
      }
      if (from && to && from !== to) return { type: 'calc_karat', units: w.units, from, to };
    }
  }

  /* ---------- 4) الوزن من المبلغ ---------- */
  const weight = findWeight(tokens);
  if (weight) {
    const searchFrom = weight.lastUnitIndex >= 0 ? weight.lastUnitIndex + 1 : weight.endIndex;
    const m = scanMoney(tokens, searchFrom);
    const bigNumber = m.value >= 1000;
    if ((m.hasB || bigNumber) && m.value > 0) {
      const ps = readPurityState(tokens);
      return { type: 'calc_weight', money: m.value, purity: ps.purity, purityExplicit: ps.explicit };
    }
  }

  /* ---------- 5) التنقل ---------- */
  const navIdx = tokens.findIndex((t) => NAV_VERBS.includes(t));
  if (navIdx >= 0) {
    for (const s of SCREEN_WORDS) {
      if (tokens.slice(navIdx + 1).some((t) => s.words.includes(t))) {
        return { type: 'navigate', tab: s.tab };
      }
    }
    if (hasAnySub(tokens, ['دهب', 'ذهب'])) return { type: 'navigate', tab: 'gold_price' };
    return { type: 'unknown' };
  }

  const mentionsGold = hasAnySub(tokens, ['دهب', 'ذهب']);
  const mentionsUsd = hasAnySub(tokens, ['دولار', 'دولر', 'عمله', 'عملات']);
  const isCalcWord = hasAnySub(tokens, ['احسب', 'حسب', 'قيمه', 'شكد', 'شحال', 'كام', 'كم', 'قدايه', 'قديه'])
    || (tokens.includes('قد') && tokens.includes('ايه'));
  const bareWeight = weight && tokens.length <= 4; // «10 غرام عيار 21» بدون فعل

  /* ---------- 6) حساب القيمة (قبل السعر عشان «احسب قيمة الذهب» تتحسب) ---------- */
  if (weight && (isCalcWord || bareWeight)) {
    const ps = readPurityState(tokens);
    return { type: 'calc_value', units: weight.units, purity: ps.purity, purityExplicit: ps.explicit };
  }

  /* ---------- 7) سعر الذهب / الدولار ---------- */
  if (mentionsGold) return { type: 'gold_price' };
  if (mentionsUsd) return { type: 'usd_price' };

  return { type: 'unknown' };
}
