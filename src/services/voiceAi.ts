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

/* ============================ نداء Gemini ============================ */

const AI_TIMEOUT = 12000;

export async function aiParseCommand(text: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.cmd && typeof data.cmd === 'object' ? (data.cmd as Record<string, unknown>) : null;
  } catch {
    return null;
  }
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
      return { type: 'add_expense', amount, name: asStr(raw.name) || 'مصروف' };
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
    if (!norm) return;
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
