/**
 * ردود المساعد — باللهجة السودانية، من بيانات المحل الحقيقية.
 * الأسئلة تجي هنا. أوامر التسجيل (سجل/بعت/اشتريت) تفضل للمحرك الصوتي.
 */
import { fmtNum } from './format';
import type { Financials, Inventory, PartnerShare } from './accounting';
import type { GoldRates } from '../types/index';

export type GoldChatCtx = {
  storeName: string;
  rates: GoldRates;
  financials: Financials;
  inventory: Inventory;
  partnerShares: PartnerShare[];
  approved?: { buy: number; sell: number } | null;
};

function westernDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function looksLikeCommand(text: string): boolean {
  const t = text.trim();
  if (/(كم|كيف|شنو|ليه|ما هو|عاوز|أريد|حوّل|حول)/.test(t)) return false;
  return /^(سجل|سجّل|بعت|اشتريت|سلفت|استلف)|منصرف\s+(عام|خاص)|احسب\s+\d|(غرام|جرام)\s+\d/.test(t);
}

export function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeCommand(t) && !/(كم|كيف|شنو|سعر|رأس)/.test(t)) return false;
  return /(كم|كيف|شنو|وين|ليه|ما هو|سعر|رأس|مخزون|مرحبا|السلام|أهلا|يا مساعد|الدولار|الذهب|شريك|منصرف|أرباح|ربح|خسارة|فاتورة|أرشيف|معاير|بضاع|هامش|حوّل|حول|تساوي)/.test(
    t
  );
}

export function extractUsdAmount(raw: string): number | null {
  const t = westernDigits(raw);
  const m =
    t.match(/(\d+(?:[.,]\d+)?)\s*(?:دولار|\$|usd)/i) ||
    t.match(/(?:دولار|\$|usd)\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractMarginPercent(raw: string): number | null {
  const t = westernDigits(raw);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*%/) || t.match(/هامش\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 500 ? n : null;
}

function priceLine(usd: number, rate: number, pct: number): string {
  const cost = usd * rate;
  const profit = cost * (pct / 100);
  const sell = cost + profit;
  return `هامش ${pct}% — الربح ${fmtNum(profit)} • البيع ${fmtNum(sell)} ج.س`;
}

export function convertUsdGoods(raw: string, ctx: GoldChatCtx): string | null {
  const q = raw.trim();
  const wantsConvert = /(بضاع|هامش|حوّل|حول|ابيع|أبيعه|تساوي|مشتريها|شتريتها|كلفة.*دولار|دولار.*جنيه)/.test(q);
  const usdAmt = extractUsdAmount(q);
  if (!wantsConvert && usdAmt == null) return null;
  if (!wantsConvert) return null;

  const rate = ctx.rates.usdRate || 0;
  if (!rate) {
    return 'ما عندي سعر دولار حيّ هسي. افتح محرك الأسعار وجيب المصادر بعدين ارجع اسأل.';
  }
  const src = ctx.rates.usdSource ? `المصدر: ${ctx.rates.usdSource}` : 'من محرك الأسعار';
  const bank = ctx.rates.bankUsdRate ? `\nسعر البنوك (رسمي، مش للبيع): ${fmtNum(ctx.rates.bankUsdRate)} ج.س` : '';

  if (usdAmt == null) {
    return `سعر الدولار الموازي هسي ${fmtNum(rate)} ج.س (${src}).${bank}
قول لي مبلغ البضاعة بالدولار — مثلاً «100 دولار بهامش 20%» — وأحسب ليك الكلفة وسعر البيع بالجنيه.`;
  }

  const cost = usdAmt * rate;
  const margin = extractMarginPercent(q);
  const stale = ctx.rates.isStale ? '\n⚠️ الرقم محفوظ قديم — حدّث المحرك قبل ما تعتمد.' : '';

  if (margin != null) {
    const profit = cost * (margin / 100);
    const sell = cost + profit;
    return `حبابك. حسب السوق الموازي (${src}):

• الدولار: ${fmtNum(rate)} ج.س${bank}
• كلفة ${fmtNum(usdAmt)} دولار: ${fmtNum(cost)} ج.س
• هامش ${margin}%: ربح ${fmtNum(profit)} ج.س
• سعر البيع: ${fmtNum(sell)} ج.س${stale}

ده مش الدولار الجمركي. لو حابب هامش تاني قول الرقم.`;
  }

  return `حبابك. حسب السوق الموازي (${src}):

• الدولار: ${fmtNum(rate)} ج.س${bank}
• كلفة ${fmtNum(usdAmt)} دولار: ${fmtNum(cost)} ج.س

${priceLine(usdAmt, rate, 20)}
${priceLine(usdAmt, rate, 30)}${stale}

قول لي الهامش بالظبط (مثلاً 15% أو 25%) وأحسب ليك رقم واحد.
ده سعر السوق الموازي — مو الجمركي.`;
}

export function answerGoldQuestion(raw: string, ctx: GoldChatCtx): string {
  const q = raw.trim();
  const k21 = ctx.approved?.sell || ctx.rates.karat21 || 0;
  const usd = ctx.rates.usdRate || 0;
  const ounce = ctx.rates.globalOunceUsd || 0;

  const converted = convertUsdGoods(q, ctx);
  if (converted) return converted;

  if (/(مرحبا|السلام|أهلا|هاي|هلو)/.test(q)) {
    return `حبابك في ${ctx.storeName} 👋
اسألني عن سعر الذهب والدولار، حوّل بضاعة بالدولار للجنيه بهامش ربح، رأس المال، المخزون، أو كيف تسجّل بيع و شراء.
تقدر تكتب أو تضغط المايك.`;
  }

  if (/(دولار|صرف|عملة|العملات)/.test(q) && !/ذهب|عيار|جرام/.test(q)) {
    const bank = ctx.rates.bankUsdRate ? `\nالبنوك: ${fmtNum(ctx.rates.bankUsdRate)} ج.س` : '';
    const src = ctx.rates.usdSource ? `\nالمصدر: ${ctx.rates.usdSource}` : '';
    const stale = ctx.rates.isStale ? '\n⚠️ الرقم ده آخر قيمة محفوظة — حدّث من محرك الأسعار.' : '';
    return `دولار السوق الموازي (بيع): ${fmtNum(usd)} ج.س${bank}${src}${stale}
افتح «محرك الأسعار» لو حابب المصادر واحدة واحدة.`;
  }

  if (/(ذهب|عيار|أونصة|اونصة|جرام|سعر)/.test(q)) {
    const buy = ctx.approved?.buy;
    const sell = ctx.approved?.sell;
    const approved =
      buy && sell
        ? `\nالمعتمد عندكم — شراء: ${fmtNum(buy)} • بيع: ${fmtNum(sell)} ج.س/جرام 21`
        : '\nما في سعر معتمد بعد — ادخل محرك الأسعار واضغط اعتماد.';
    return `عيار 21 (محسوب من الأونصة × الدولار): ${fmtNum(k21)} ج.س/جرام
الأونصة العالمية: $${ounce.toFixed(2)}${approved}
${ctx.rates.isStale ? '⚠️ حدّث المصادر قبل ما تعتمد الرقم.' : 'الأرقام من المصادر الحيّة.'}`;
  }

  if (/(رأس المال|راس المال|المستحق|شركاء)/.test(q)) {
    const lines = ctx.partnerShares.slice(0, 8).map((p) => {
      const net = p.partner.capital + p.netShare;
      return `• ${p.partner.name}: رأس مال ${fmtNum(p.partner.capital)} — صافي ${fmtNum(net)}`;
    });
    return `إجمالي رأس مال الشركاء: ${fmtNum(ctx.financials.totalCapital)} ج.س
${lines.join('\n') || 'ما في شركاء ظاهرين.'}
المنصرف العام المأرشف يفضل محسوب هنا.`;
  }

  if (/(مخزون|جرد|عيار 21|وزن)/.test(q)) {
    const inv = ctx.inventory;
    const karats = (inv.byKarat || [])
      .slice(0, 6)
      .map((k) => `• عيار ${k.purity}: ${k.grams.toFixed(2)} ج`)
      .join('\n');
    return `المخزون بمعادل عيار 21: ${inv.gramsK21.toFixed(2)} جرام
قيمة سوقية تقريبية: ${fmtNum(inv.marketValue)} ج.س
${karats || 'المخزون فاضي.'}`;
  }

  if (/(ربح|خسارة|مبيعات|أرباح)/.test(q)) {
    const n = ctx.financials.netProfit;
    const label = n < 0 ? 'صافي الخسارة' : 'صافي الربح';
    return `إجمالي المبيعات: ${fmtNum(ctx.financials.totalSales)}
تكلفة المبيعات: ${fmtNum(ctx.financials.totalCost)}
${label}: ${fmtNum(Math.abs(n))} ج.س
منصرفات عامة: ${fmtNum(ctx.financials.generalExpenses)} • خاصة: ${fmtNum(ctx.financials.privateExpenses)}`;
  }

  if (/(منصرف|مصروف)/.test(q)) {
    return `المنصرفات العامة: ${fmtNum(ctx.financials.generalExpenses)} ج.س
الخاصة (مسحوبات الشركاء): ${fmtNum(ctx.financials.privateExpenses)} ج.س
الأرشيف يخفي من القائمة بس الفلوس تفضل محسوبة على رأس المال.
للتسجيل قول: «منصرف عام إيجار بخمسين ألف» أو «منصرف خاص على أحمد».`;
  }

  if (/(كيف.*بيع|سجّل بيع|سجل بيع|فاتورة بيع)/.test(q)) {
    return `تسجّل البيع من شاشة المبيعات أو بالصوت:
«بعت 10 جرام عيار 21 بـ مليون ونص»
لو آجل قول «آجل». بعدين اكتب اسم الزبون.`;
  }

  if (/(كيف.*شر|مشتري|فاتورة شراء)/.test(q)) {
    return `من شاشة المشتريات أو بالصوت:
«اشتريت 5 جرام عيار 21 من محمد بتلاتة مليون»`;
  }

  if (/(أرشيف|ارشيف)/.test(q)) {
    return `الأرشيف للتنظيف اليومي. المأرشف ما يظهر في القوائم، لكن المنصرفات تفضل تخصم من رأس المال. الحذف النهائي من شاشة الأرشيف فقط.`;
  }

  if (/(معاير|محرك|مصدر)/.test(q)) {
    return `محرك الأسعار يجيب السوق الموازي من أكتر من مصدر (اخبار السودان + alsoug) ويرفض الدولار الجمركي وخلط العملات.
افتح تبويب محرك الأسعار → جلب المصادر → اعتمد شراء/بيع جرام عيار 21.`;
  }

  return `حبابك. أنا مساعد ${ctx.storeName}.
أقدر أجاوبك عن: سعر الذهب والدولار، تحويل بضاعة بالدولار للجنيه بهامش ربح، رأس المال، المخزون، الأرباح، المنصرفات، وكيف تسجّل بيع أو شراء.
لو داير تسجّل حركة قول مثلاً: «بعت 2 جرام عيار 21 بمليون».
لو داير تحويل قول: «بضاعة بـ 100 دولار بهامش 20%».`;
}
