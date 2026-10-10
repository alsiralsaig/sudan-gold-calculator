import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/voice/parse
 * body: { text: string, ctx?: { today?: string, tab?: string, goldPrice21?: number, people?: string[] } }
 * response: { cmd, commands, confidence, clarify }
 */

const MODELS = (process.env.GEMINI_MODELS || 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// راجع القيمة المعتمدة عندكم للمثقال
const MITHQAL_G = 5;

const TYPES = new Set([
  'add_purchase', 'add_sale', 'add_expense', 'add_loan', 'add_payment',
  'calc_value', 'calc_weight', 'gold_price', 'usd_price', 'navigate', 'unknown',
]);
const TABS = new Set([
  'dashboard', 'calculator', 'purchases', 'sales', 'expenses', 'loans', 'reminders',
  'reports', 'analytics', 'archive', 'settings', 'search', 'gold_price', 'partners',
]);

const SYSTEM = `انت زول سوداني من أم درمان، محاسب شاطر شغال عند تجار الذهب. بتفهم كلام التاجر السوداني بلهجتو زي ما هو، بما في ذلك الكلام الناقص والمتقطع وأخطاء التعرف على الصوت، وبتحوّلو لأوامر لتطبيق محاسبة الذهب.
أرجع JSON فقط (بدون شرح أو markdown) بالشكل ده:
{"commands":[<أمر أو أكتر بالترتيب>],"confidence":<0 إلى 1>,"clarify":"<سؤال قصير بلهجة سودانية لو في معلومة أساسية ناقصة، وإلا ''>"}

أنواع الأوامر:
{"type":"add_purchase","units":<جرام>,"purity":<عيار>,"price":<مبلغ أو null>,"priceMode":"per_gram"|"total"|"auto","person":"<اسم أو ''>","deferred":true|false}
{"type":"add_sale","units":<جرام>,"purity":<عيار>,"price":<سعر البيع أو null>,"priceMode":"per_gram"|"total"|"auto","person":"<المشتري أو ''>","deferred":true|false,"buyPrice":<كلفة الشراء أو null>}
{"type":"add_expense","amount":<مبلغ>,"name":"<وصف قصير>","target":"<اسم أو ''>"}
{"type":"add_loan","amount":<مبلغ>,"person":"<اسم>","direction":"lent"|"borrowed","dueDays":<أيام أو null>}
{"type":"add_payment","amount":<مبلغ>,"person":"<اسم>"}
{"type":"calc_value","units":<جرام>,"purity":<عيار>,"purityExplicit":true|false}
{"type":"calc_weight","money":<مبلغ>,"purity":<عيار>,"purityExplicit":true|false}
{"type":"gold_price"}  {"type":"usd_price"}
{"type":"navigate","tab":"dashboard"|"calculator"|"purchases"|"sales"|"expenses"|"loans"|"reminders"|"reports"|"analytics"|"archive"|"settings"|"search"|"gold_price"|"partners"}
{"type":"unknown"}

قواعد صارمة:
1. الوزن بالجرام دايماً. جرام=1، حبة=0.1، جزء=0.01 (الجرام 10 حبات والحبة 10 أجزاء). «جرام وتلاتة حبات وستة»=1.36، «سبعة جرام وحبة»=7.1، «نص جرام»=0.5، «اتنين حبة»=0.2، «خمسة ونص غرام»=5.5، «مثقال»=${MITHQAL_G}، «كيلو»=1000. رقم مفرد بعد «حبات» مباشرة معناه أجزاء.
2. الفلوس: «الف»=1000، «مليون»=1000000، «مليون ونص»=1500000، «مية وخمسين الف»=150000، «تلاتين مليون»=30000000. أرجع الرقم كامل بدون فواصل.
3. العيار: رقم من خانتين أو أقل (21، 18، 24) هو قيراط. رقم من تلات خانات (600، 674، 537) انقلو زي ما هو ولا تحوّلو لقيراط. لو ما ذكر عيار: purity=21 (و purityExplicit=false في الحاسبة).
4. priceMode: «بسعر X للجرام»=per_gram، «بمبلغ/بإجمالي X»=total، «بسعر X» أو «ب X» بدون تحديد=auto. لو ما ذكر سعر: price=null و priceMode="auto".
5. deferred=true لو قال «آجل/على الحساب/على الكتاب/بكرة بدفع».
6. «سلفة/سلفيت لفلان»=add_loan direction="lent". «استلفيت من فلان»=direction="borrowed". «يستحق بعد N يوم/أسبوع/شهر»=dueDays (أسبوع=7، شهر=30). «دفعة/تسديد/سدد لي فلان»=add_payment.
7. أسماء الناس انقلها كما نطقها بدون ل/لل/من/على. لو في قائمة people في السياق وفي اسم قريب من اللي نطقو (احمد/أحمد، تاج السر/تاج السرّ) استخدم الاسم الموجود في القائمة.
8. جملة البيع: «مشتراها/مشتريها/شريتها/اشتريتها/جبتها/كلفتني/كلفني/بتكلفة/واشتريتو ب X» = buyPrice (كلفة الشراء) وليس price. «المشتري/الزبون/لفلان» = person. «سجل في المبيعات…» أو «بعت…» = add_sale مش مشتريات. سعر البيع لازم ينطق بوضوح، ما تخترعو أبداً.
9. المنصرف: «منصرف خاص/خاص على فلان» = add_expense و target=اسم الشخص. بدون «خاص» target=''. «name» وصف قصير (إيجار، كهرباء، رسوم…).
10. النص ممكن يحتوي تكرار من التعرف على الصوت («سجل سجل في سجل في المبيعات…»). اعتمد آخر صيغة كاملة وتجاهل المكرر.
11. لو صحّح المتكلم نفسو («بعت 15 لا 16 جرام»، «غلط، أقصد…») خد القيمة الأخيرة.
12. أكتر من أمر في جملة واحدة → كل أمر في عنصر مستقل في commands بالترتيب.
13. ما تخترع أرقام أبداً. لو معلومة أساسية ناقصة (الوزن في بيع/شراء، المبلغ في منصرف/سلفة/دفعة، الاسم في سلفة/دفعة) ضع null أو اتركها، وقلّل confidence، واكتب سؤال قصير في clarify (مثل «بعتها بكم؟» أو «الوزن كم؟»).
14. كلام ما متعلق بالتطبيق = unknown مع commands=[{"type":"unknown"}].
15. السياق (today, goldPrice21, people, tab) بيجيك مع الجملة؛ استخدمو للمساعدة في الفهم بس، وما تنقل منو أرقام للأمر.
16. الحاسبة (calc_value / calc_weight) فقط لما يسأل «بكم / تجيب كم / كم جرام / حاسب لي». أي جملة فيها «سجل / بعت / اشتريت / مشتراها / كلفتني / منصرف / سلفة» هي تسجيل وليست حاسبة، حتى لو فيها وزن وعيار ومبلغ.
17. لو قال «سجل» بدون ما يحدد بيع ولا شراء: استخدم tab من السياق (sales=add_sale، purchases=add_purchase، expenses=add_expense). لو tab مش واضح، لا تخمّن: commands=[] و clarify="ده بيع ولا شراء؟".

أمثلة (الجملة ← الناتج):
«سجل في المبيعات 15 جرام عيار 600 مشتراها ب 13,000,000»
← {"commands":[{"type":"add_sale","units":15,"purity":600,"price":null,"priceMode":"auto","person":"","deferred":false,"buyPrice":13000000}],"confidence":0.8,"clarify":"بعتها بكم؟"}
«اشتريت عشرة جرام عيار واحد وعشرين من أحمد بتلاتة مليون»
← {"commands":[{"type":"add_purchase","units":10,"purity":21,"price":3000000,"priceMode":"auto","person":"أحمد","deferred":false}],"confidence":0.9,"clarify":""}
«بعت جرام وتلاتة حبات وستة لتاج السر بمليون ونص آجل»
← {"commands":[{"type":"add_sale","units":1.36,"purity":21,"price":1500000,"priceMode":"auto","person":"تاج السر","deferred":true,"buyPrice":null}],"confidence":0.85,"clarify":""}
«منصرف خاص على احمد خمسين الف»
← {"commands":[{"type":"add_expense","amount":50000,"name":"منصرف","target":"احمد"}],"confidence":0.9,"clarify":""}
«سلفت محمد مية الف يسدد بعد اسبوع»
← {"commands":[{"type":"add_loan","amount":100000,"person":"محمد","direction":"lent","dueDays":7}],"confidence":0.9,"clarify":""}
«عشرة جرام عيار 18 بكم»
← {"commands":[{"type":"calc_value","units":10,"purity":18,"purityExplicit":true}],"confidence":0.9,"clarify":""}
«وريني المصروفات وبعدين سعر الذهب»
← {"commands":[{"type":"navigate","tab":"expenses"},{"type":"gold_price"}],"confidence":0.9,"clarify":""}
«سجل 15 جرام عيار 600 مشتراها ب 15,000,000» (السياق: tab=sales)
← {"commands":[{"type":"add_sale","units":15,"purity":600,"price":null,"priceMode":"auto","person":"","deferred":false,"buyPrice":15000000}],"confidence":0.8,"clarify":"بعتها بكم؟"}
«الجو حار شديد اليوم»
← {"commands":[{"type":"unknown"}],"confidence":0.9,"clarify":""}`;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** تحقق صارم من كل أمر قبل ما يرجع للمتصفح. بيرجع null لو الأمر غير صالح. */
function validate(c: any): any | null {
  if (!c || typeof c !== 'object' || !TYPES.has(c.type)) return null;
  switch (c.type) {
    case 'add_purchase':
    case 'add_sale': {
      if (!num(c.units) || c.units <= 0 || c.units > 100000) return null;
      const out: any = {
        type: c.type,
        units: Math.round(c.units * 100) / 100,
        purity: num(c.purity) && c.purity > 0 && c.purity <= 1000 ? c.purity : 21,
        price: num(c.price) && c.price > 0 ? c.price : null,
        priceMode: ['per_gram', 'total', 'auto'].includes(c.priceMode) ? c.priceMode : 'auto',
        person: str(c.person),
        deferred: c.deferred === true,
      };
      if (c.type === 'add_sale') out.buyPrice = num(c.buyPrice) && c.buyPrice > 0 ? c.buyPrice : null;
      return out;
    }
    case 'add_expense':
      if (!num(c.amount) || c.amount <= 0) return null;
      return { type: c.type, amount: c.amount, name: str(c.name) || 'منصرف', target: str(c.target) };
    case 'add_loan':
      if (!num(c.amount) || c.amount <= 0 || !str(c.person)) return null;
      return {
        type: c.type, amount: c.amount, person: str(c.person),
        direction: c.direction === 'borrowed' ? 'borrowed' : 'lent',
        dueDays: num(c.dueDays) ? Math.round(c.dueDays) : null,
      };
    case 'add_payment':
      if (!num(c.amount) || c.amount <= 0 || !str(c.person)) return null;
      return { type: c.type, amount: c.amount, person: str(c.person) };
    case 'calc_value':
      if (!num(c.units) || c.units <= 0) return null;
      return {
        type: c.type, units: c.units,
        purity: num(c.purity) && c.purity > 0 && c.purity <= 1000 ? c.purity : 21,
        purityExplicit: c.purityExplicit === true,
      };
    case 'calc_weight':
      if (!num(c.money) || c.money <= 0) return null;
      return {
        type: c.type, money: c.money,
        purity: num(c.purity) && c.purity > 0 && c.purity <= 1000 ? c.purity : 21,
        purityExplicit: c.purityExplicit === true,
      };
    case 'navigate':
      return TABS.has(c.tab) ? { type: c.type, tab: c.tab } : null;
    default:
      return { type: c.type };
  }
}

function cleanCtx(raw: any) {
  const ctx: Record<string, unknown> = {};
  if (raw && typeof raw === 'object') {
    if (typeof raw.today === 'string') ctx.today = raw.today.slice(0, 30);
    if (typeof raw.tab === 'string') ctx.tab = raw.tab.slice(0, 30);
    if (num(raw.goldPrice21)) ctx.goldPrice21 = raw.goldPrice21;
    if (Array.isArray(raw.people)) {
      ctx.people = raw.people.filter((p: unknown) => typeof p === 'string').slice(0, 50).map((p: string) => p.slice(0, 40));
    }
  }
  return ctx;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    return NextResponse.json({ error: 'الذكاء الاصطناعي مش مفعّل' }, { status: 503 });
  }

  // TODO: تحقق من جلسة المستخدم (Supabase) أو ضع rate limit قبل ما تكمل

  let text = '';
  let ctx: Record<string, unknown> = {};
  try {
    const body = await req.json();
    text = String(body?.text ?? '').slice(-300); // نحتفظ بآخر الكلام (فيه الأرقام عادةً)
    ctx = cleanCtx(body?.ctx);
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: 'نص فاضي' }, { status: 400 });
  }

  const userContent = `السياق: ${JSON.stringify(ctx)}\nالجملة: ${text}`;

  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          signal: ctrl.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      clearTimeout(timer);
      if (!res.ok) {
        console.error('[voice/parse] gemini', model, res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const data = await res.json();
      const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) {
        console.error('[voice/parse] empty response', model, data?.candidates?.[0]?.finishReason);
        continue;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(raw.trim().replace(/^```json\s*|```$/g, ''));
      } catch {
        console.error('[voice/parse] bad json', model, raw.slice(0, 200));
        continue;
      }

      const list: any[] = Array.isArray(parsed?.commands) ? parsed.commands : parsed?.type ? [parsed] : [];
      const commands = list.map(validate).filter(Boolean).slice(0, 5);
      const clarify = str(parsed?.clarify, 120);
      const confidence = typeof parsed?.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;

      if (!commands.length) {
        return NextResponse.json({ cmd: { type: 'unknown' }, commands: [], confidence, clarify });
      }
      return NextResponse.json({ cmd: commands[0], commands, confidence, clarify });
    } catch (e) {
      clearTimeout(timer);
      console.error('[voice/parse] request failed', model, e instanceof Error ? e.message : e);
      continue;
    }
  }
  return NextResponse.json({ error: 'ما قدرنا نفهمها دلوقتي' }, { status: 502 });
}
