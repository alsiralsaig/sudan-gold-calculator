import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/voice/parse — فهم أمر صوتي بالذكاء الاصطناعي.
 * المحرك المحلي في المتصفح بيجرّب الأول؛ لما يفشل بييجي هنا.
 * نداء واحد لـ Gemini بنظام JSON صارم، والنتيجة بتتحقق في المتصفح قبل التنفيذ.
 */

const MODELS = (process.env.GEMINI_MODELS || 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const SYSTEM = `انت محرك أوامر لتطبيق محاسبة لتجار الذهب في السودان.
المستخدم بيتكلم بالعامية السودانية وأحياناً بحروف ناقصة أو أخطاء التعرف على الصوت.
مهمتك: تحويل جملته إلى أمر واحد من الأوامر دي (أعد JSON فقط بدون أي شرح أو markdown):

{"type":"add_purchase","units":<جرام عشري>,"purity":<عيار أو 21>,"price":<مبلغ بالجنيه أو null>,"priceMode":"per_gram"|"total"|"auto","person":"<اسم أو ''>","deferred":true|false}
{"type":"add_sale",...نفس حقول add_purchase}
{"type":"add_expense","amount":<مبلغ>,"name":"<وصف قصير>"}
{"type":"add_loan","amount":<مبلغ>,"person":"<اسم>","direction":"lent"|"borrowed","dueDays":<أيام أو null>}
{"type":"add_payment","amount":<مبلغ>,"person":"<اسم>"}
{"type":"calc_value","units":<جرام عشري>,"purity":<عيار>,"purityExplicit":true|false}
{"type":"calc_weight","money":<مبلغ>,"purity":<عيار>,"purityExplicit":true|false}
{"type":"gold_price"}
{"type":"usd_price"}
{"type":"navigate","tab":"dashboard"|"calculator"|"purchases"|"sales"|"expenses"|"loans"|"reminders"|"reports"|"analytics"|"archive"|"settings"|"search"|"gold_price"|"partners"}
{"type":"unknown"}

قواعد صارمة:
1. الوزن بالجرام العشري: «اتنين حبة»=0.2، «خمسة ونص غرام»=5.5، «مثقال»=5، «رطل»=0.453، «كيلو»=1000.
2. العيار الافتراضي 21. purityExplicit=true فقط لو المستخدم ذكر العيار بنفسه.
3. priceMode: «بسعر X للجرام»=per_gram، «بمبلغ/بإجمالي X»=total، «بسعر X» بدون تحديد=auto (قرر: جرام×سعر السوق≈X → per_gram وإلا total). لو ما ذكرش سعر: price=null و priceMode="auto".
4. deferred=true لو قال «آجل/على الحساب/على الكتاب».
5. «سلفة/سلفيت لفلان»=add_loan direction="lent". «استلفيت من فلان»=direction="borrowed". «يستحق بعد N يوم/أسبوع/شهر»=dueDays.
6. «دفعة/تسديد لفلان»=add_payment.
7. أسماء الناس انقلها كما نطقتها بدون ل/لل/من.
8. كلام مش متعلق بالتطبيق = unknown. ما تخترعش أرقام.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    return NextResponse.json({ error: 'الذكاء الاصطناعي مش مفعّل' }, { status: 503 });
  }
  let text = '';
  try {
    const body = await req.json();
    text = String(body?.text ?? '').slice(0, 300);
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: 'نص فاضي' }, { status: 400 });
  }

  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 300, responseMimeType: 'application/json' },
          }),
        }
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;
      try {
        const cmd = JSON.parse(raw.trim().replace(/^```json\s*|```$/g, ''));
        if (cmd && typeof cmd === 'object') {
          return NextResponse.json({ cmd });
        }
      } catch {
        continue;
      }
    } catch {
      clearTimeout(timer);
      continue;
    }
  }
  return NextResponse.json({ error: 'ما قدرنا نفهمها دلوقتي' }, { status: 502 });
}
