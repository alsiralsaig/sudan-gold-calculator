/**
 * محرك فهم الأوامر بالذكاء الاصطناعي (Gemini) — للجمل اللي ما فهمهاش المحرك المحلي.
 *
 * الشغل:
 *  1. المحرك المحلي (voiceCommands.ts) بيجرّب الأول — سريع وبلا نت.
 *  2. لو رجّع «unknown»، بعت الجملة لـ Gemini مع شرح صارم لأنواع الأوامر.
 *  3. Gemini بيرجّع JSON بس — بيتحقق منه بدقة قبل التنفيذ.
 *  4. أي أمر ناجح بيتحفظ في قاموس التعلم (localStorage) — نفس الجملة المرة الجاية
 *     بتشتغل محلياً فوراً من غير نت ولا انتظار.
 */

/* ============================ تعريف الأوامر للذكاء الاصطناعي ============================ */

export const AI_SYSTEM_PROMPT = `انت زول سوداني من أم درمان، محرك أوامر لتطبيق محاسبة لتجار الذهب في السودان.
بتتكلم وتفهم اللهجة السودانية بس — مش شامي ولا مصري. المستخدم تاجر سوداني بيتكلم لهجته وأحياناً بحروف ناقصة أو أخطاء تعرف على الصوت.
مهمتك: تحويل جملته إلى أمر واحد من الأوامر دي بالضبط (JSON بس بدون أي شرح):

- {"type":"add_purchase","units":<جرام عشري>,"purity":<عيار أو 21>,"price":<مبلغ بالجنيه أو null>,"priceMode":"per_gram"|"total"|"auto","person":"<اسم أو ''>","deferred":true|false}
- {"type":"add_sale", ...نفس حقول add_purchase}
- {"type":"add_expense","amount":<مبلغ>,"name":"<وصف قصير>"}
- {"type":"add_loan","amount":<مبلغ>,"person":"<اسم>","direction":"lent"|"borrowed","dueDays":<أيام أو null>}
- {"type":"add_payment","amount":<مبلغ>,"person":"<اسم>"}
- {"type":"calc_value","units":<جرام عشري>,"purity":<عيار>,"purityExplicit":true|false}
- {"type":"calc_weight","money":<مبلغ>,"purity":<عيار>,"purityExplicit":true|false}
- {"type":"gold_price"} — يسأل عن سعر الذهب
- {"type":"usd_price"} — يسأل عن سعر الدولار
- {"type":"navigate","tab":"dashboard"|"calculator"|"purchases"|"sales"|"expenses"|"loans"|"reminders"|"reports"|"analytics"|"archive"|"settings"|"search"|"gold_price"|"partners"}
- {"type":"unknown"}

قواعد صارمة:
1. الوزن بالجرام العشري: «اتنين حبة» = 0.2، «خمسة ونص غرام» = 5.5، «مثقال» = 5 غرام، «رطل» = 0.453 غرام، «كيلو» = 1000 غرام.
2. العيار الافتراضي 21. purityExplicit=true فقط لو المستخدم ذكر العيار بنفسه.
3. priceMode: «بسعر X للجرام» = per_gram، «بمبلغ/بإجمالي X» = total، «بسعر X» بدون تحديد = auto (قرر بالمنطق: جرام × سعر السوق ≈ X → per_gram وإلا total). لو ما ذكرش سعر: price=null و priceMode="auto".
4. deferred=true لو قال «آجل/على الحساب/على الكتاب»، وإلا false.
5. «سلفة/سلفيت لفلان» = add_loan direction=lent. «استلفيت من فلان» = direction=borrowed.
6. «دفعة/تسديد لفلان» = add_payment (يُطابق حساب موجود).
7. أسماء الناس: انقلها كما نطقتها بدون «ل/لل/من».
8. أي كلام مش متعلق بالتطبيق = unknown. ما تخترعش أرقام مش موجودة.
9. في جملة البيع: «واشتريتو/كلفني/بتكلفة X» = سعر الكلفة buyPrice (وbuyPriceMode زي priceMode). «المشتري/الزبون فلان» = person.
10. «سجل المشتري فلان...» = بيع (add_sale) مش مشتريات.
أعد JSON فقط.`;

/* ============================ نداء Gemini (عبر /api/voice/parse) ============================ */

export type AiContext = {
  /** الصفحة المفتوحة الآن: sales / purchases / expenses / loans / dashboard ... */
  tab?: string;
  /** أسماء الشركاء والعملاء الموجودين (للتصحيح: احمد/أحمد) */
  people?: string[];
  today?: string;
  goldPrice21?: number;
};

export type AiResult = {
  /** أول أمر (للتوافق مع الكود القديم) */
  cmd: Record<string, unknown> | null;
  /** كل الأوامر في الجملة */
  commands: Record<string, unknown>[];
  /** سؤال قصير لو في معلومة ناقصة. اعرضو للمستخدم بدل ما تنفذ بالغلط */
  clarify: string;
  confidence: number;
};

// السيرفر ممكن يجرّب موديلين (12 ثانية لكل واحد)، فنديه وقت كافي
const AI_FETCH_TIMEOUT = 20000;

export async function aiParseFull(text: string, ctx?: AiContext): Promise<AiResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_FETCH_TIMEOUT);
  try {
    const res = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ text, ctx }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const isObj = (c: unknown): c is Record<string, unknown> => !!c && typeof c === 'object';
    const commands: Record<string, unknown>[] = Array.isArray(data?.commands)
      ? data.commands.filter(isObj)
      : isObj(data?.cmd)
        ? [data.cmd]
        : [];
    return {
      cmd: commands[0] ?? null,
      commands,
      clarify: typeof data?.clarify === 'string' ? data.clarify : '',
      confidence: typeof data?.confidence === 'number' ? data.confidence : 0.5,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** نفس الدالة القديمة (ترجع أول أمر بس) عشان ما ينكسر أي كود يستخدمها */
export async function aiParseCommand(text: string, ctx?: AiContext): Promise<Record<string, unknown> | null> {
  const r = await aiParseFull(text, ctx);
  return r?.cmd ?? null;
}

/* ============================ بوابة: متى ما نثق في المحرك المحلي ============================ */

const RECORD_WORDS =
  /(سجل|سجّل|بعت|بيع|اشتريت|شريت|مشتراها|مشتريها|شريتها|كلفتني|كلفني|بتكلفة|منصرف|مصروف|سلفة|سلفت|سلفيت|استلفت|استلفيت|دفعة|تسديد|سدد)/;

/**
 * استخدمها بعد ما المحرك المحلي يرجّع نتيجة:
 *   if (shouldDistrustLocal(text, local)) { ...اندهي aiParseFull بدل المحلي... }
 * لو الجملة فيها كلمات تسجيل والمحلي فهمها «حاسبة»، هو غالباً غلطان.
 */
export function shouldDistrustLocal(text: string, local: { type: string } | null | undefined): boolean {
  if (!local || local.type === 'unknown') return true;
  if ((local.type === 'calc_value' || local.type === 'calc_weight') && RECORD_WORDS.test(text)) return true;
  return false;
}

/* ============================ التحقق الصارم ============================ */

const NAV_TABS = new Set([
  'dashboard', 'calculator', 'purchases', 'sales', 'expenses', 'loans',
  'reminders', 'reports', 'analytics', 'archive', 'settings', 'search', 'gold_price', 'partners',
]);

const asNum = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

/**
 * يتحقق من أمر قادم من الـAI حقل بحقل — ما بيقبلش أي حاجة غريبة.
 * بيرجّع VoiceCommand صالح أو null.
 */
export function sanitizeAiCommand(raw: Record<string, unknown>): import('../core/voiceCommands').VoiceCommand | null {
  const type = asStr(raw.type);
  const num = (k: string): number | null => asNum(raw[k]);
  const purity = (() => {
    const p = num('purity');
    return p && p > 0 ? Math.min(p, 1000) : 21;
  })();
  const explicit = raw.purityExplicit === true;
  const units = num('units');
  const price = num('price');
  const modeRaw = asStr(raw.priceMode);
  const mode: 'per_gram' | 'total' | 'auto' =
    modeRaw === 'per_gram' || modeRaw === 'total' ? modeRaw : 'auto';

  switch (type) {
    case 'add_purchase':
    case 'add_sale': {
      if (!units || units <= 0) return null;
      const buyPrice = num('buyPrice') ?? undefined;
      const buyModeRaw = asStr(raw.buyPriceMode);
      const buyPriceMode: 'per_gram' | 'total' | 'auto' =
        buyModeRaw === 'per_gram' || buyModeRaw === 'total' ? buyModeRaw : 'auto';
      if (type === 'add_sale') {
        return {
          type: 'add_sale',
          units: Math.round(units * 100),
          purity,
          purityExplicit: explicit,
          price: price ?? undefined,
          priceMode: mode,
          person: asStr(raw.person),
          deferred: raw.deferred === true,
          buyPrice,
          buyPriceMode,
        };
      }
      return {
        type: 'add_purchase',
        units: Math.round(units * 100),
        purity,
        purityExplicit: explicit,
        price: price ?? undefined,
        priceMode: mode,
        person: asStr(raw.person),
        deferred: raw.deferred === true,
      };
    }
    case 'calc_value': {
      if (!units || units <= 0) return null;
      return { type: 'calc_value', units: Math.round(units * 100), purity, purityExplicit: explicit };
    }
    case 'calc_weight': {
      const money = num('money');
      if (!money || money <= 0) return null;
      return { type: 'calc_weight', money, purity, purityExplicit: explicit };
    }
    case 'add_expense': {
      const amount = num('amount');
      if (!amount || amount <= 0) return null;
      const target = asStr(raw.target);
      return {
        type: 'add_expense',
        amount,
        name: asStr(raw.name) || 'مصروف',
        ...(target ? { target } : {}),
        waitingPerson: false,
      };
    }
    case 'add_loan': {
      const amount = num('amount');
      if (!amount || amount <= 0) return null;
      const dir = asStr(raw.direction) === 'borrowed' ? 'borrowed' : 'lent';
      const due = num('dueDays');
      return { type: 'add_loan', amount, person: asStr(raw.person) || 'بدون اسم', direction: dir, dueDays: due && due > 0 && due <= 3650 ? due : undefined };
    }
    case 'add_payment': {
      const amount = num('amount');
      if (!amount || amount <= 0) return null;
      const person = asStr(raw.person);
      if (!person) return null;
      return { type: 'add_payment', amount, person };
    }
    case 'gold_price':
      return { type: 'gold_price' };
    case 'usd_price':
      return { type: 'usd_price' };
    case 'navigate': {
      const tab = asStr(raw.tab);
      return NAV_TABS.has(tab) ? { type: 'navigate', tab } : null;
    }
    default:
      return null;
  }
}

/* ============================ قاموس التعلم المحلي ============================ */

const LEARN_KEY = 'voice_learned_v1';
const MAX_LEARNED = 500;

type Learned = Record<string, Record<string, unknown>>; // نص مطبّع → أمر

/**
 * الجمل الطويلة أو المتكررة (من تراكم الميكروفون) ما تتعلم،
 * عشان ما يتحفظ تفسير غلط لجملة ملخبطة.
 */
export function isLearnable(phrase: string, confidence = 1): boolean {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 14) return false;
  if (words.length >= 5 && new Set(words).size / words.length < 0.7) return false; // تكرار كتير
  return confidence >= 0.8;
}

export function loadLearned(): Learned {
  try {
    return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}') as Learned;
  } catch {
    return {};
  }
}

/** يحفظ جملة → أمر (المحرك المحلي بيتفوق على أي أمر متعلم) */
export function teachPhrase(phrase: string, cmd: Record<string, unknown>): void {
  try {
    const norm = phrase.trim().toLowerCase();
    if (!norm || !isLearnable(norm)) return;
    const all = loadLearned();
    all[norm] = cmd;
    const keys = Object.keys(all);
    if (keys.length > MAX_LEARNED) {
      for (const k of keys.slice(0, keys.length - MAX_LEARNED)) delete all[k];
    }
    localStorage.setItem(LEARN_KEY, JSON.stringify(all));
  } catch {
    /* التخزين ممتلئ — ما مشكلة */
  }
}

export function lookupLearned(phrase: string): Record<string, unknown> | null {
  return loadLearned()[phrase.trim().toLowerCase()] ?? null;
}

/** لمسح القاموس المتعلم (جرّبو لو شاكّ إنو في تفسير غلط محفوظ) */
export function clearLearned(): void {
  try {
    localStorage.removeItem(LEARN_KEY);
  } catch {
    /* ما مشكلة */
  }
        }
