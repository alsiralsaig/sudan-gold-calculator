/**
 * محرك الحاسبة العادية — نقي بلا React ولا DOM، مُختبر.
 *
 * - محلّل تعابير آمن (بدل Function/eval).
 * - النسبة المئوية بالمعنى التجاري:
 *     1,000 + 10%  = 1,100     (زيادة 10٪ على الرقم)
 *     1,000 − 10%  = 900       (خصم 10٪)
 *     1,000 × 10%  = 100       (10٪ من الرقم)
 *     50%          = 0.5
 * - آلة حالة لأزرار الحاسبة (applyKey) حتى يكون السلوك مُختبراً بالكامل.
 *
 * التعبير يُخزَّن خاماً بلا فواصل ولا مسافات، بالرموز: + − × ÷ ( ) % .
 */

export const OPS = ['+', '−', '×', '÷'] as const;
export type Op = (typeof OPS)[number];

const isOp = (c: string | undefined): c is Op => !!c && (OPS as readonly string[]).includes(c);
const isDigit = (c: string | undefined) => !!c && c >= '0' && c <= '9';

/* ============================ المحلّل ============================ */

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: Op }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'pct' };

/** توحيد الرموز: - * / والفواصل والأرقام العربية */
export function normalizeExpr(raw: string): string {
  return String(raw || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[,،٬\s]/g, '')
    .replace(/[-–—]/g, '−')
    .replace(/[*xX]/g, '×')
    .replace(/[/]/g, '÷');
}

function tokenize(expr: string): Token[] | null {
  const s = normalizeExpr(expr);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (isDigit(c) || c === '.') {
      let j = i;
      while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++;
      const str = s.slice(i, j);
      if ((str.match(/\./g) || []).length > 1) return null;
      const v = str === '.' ? 0 : parseFloat(str);
      if (!Number.isFinite(v)) return null;
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (isOp(c)) out.push({ t: 'op', v: c });
    else if (c === '(') out.push({ t: 'lp' });
    else if (c === ')') out.push({ t: 'rp' });
    else if (c === '%') out.push({ t: 'pct' });
    else return null;
    i++;
  }
  return out;
}

/** نتيجة التقييم — value صالحة فقط عند ok، وerror عند الفشل */
export interface EvalResult {
  ok: boolean;
  value?: number;
  error?: string;
}

class CalcError extends Error {}

/**
 * تقييم تعبير. الأقواس غير المقفولة تُقفل تلقائياً، والمشغّل المعلّق
 * في الآخر يُتجاهل (حتى تعمل «النتيجة الحية» أثناء الكتابة).
 */
export function evaluate(raw: string): EvalResult {
  const tokens = tokenize(raw);
  if (!tokens) return { ok: false, error: 'تعبير غير صحيح' };
  // تجاهل المشغّلات والأقواس المفتوحة المعلّقة في الآخر
  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    if (last.t === 'op' || last.t === 'lp') tokens.pop();
    else break;
  }
  if (tokens.length === 0) return { ok: false, error: 'فارغ' };

  let pos = 0;
  const peek = () => tokens[pos];

  // term يرجع القيمة + هل هو «نسبة مجرّدة» (مثل 10%) لمعاملة + و − التجارية
  type TermVal = { v: number; pct: boolean };

  const parsePrimary = (): number => {
    const tk = peek();
    if (!tk) throw new CalcError('تعبير ناقص');
    if (tk.t === 'num') {
      pos++;
      return tk.v;
    }
    if (tk.t === 'lp') {
      pos++;
      const v = parseExpr();
      if (peek()?.t === 'rp') pos++; // قوس مفقود في الآخر = يُقفل تلقائياً
      return v;
    }
    throw new CalcError('تعبير غير صحيح');
  };

  const parseUnary = (): TermVal => {
    const tk = peek();
    if (tk && tk.t === 'op' && (tk.v === '−' || tk.v === '+')) {
      pos++;
      const inner = parseUnary();
      return { v: tk.v === '−' ? -inner.v : inner.v, pct: inner.pct };
    }
    let v = parsePrimary();
    let pct = false;
    while (peek()?.t === 'pct') {
      pos++;
      v = v / 100;
      pct = true;
    }
    return { v, pct };
  };

  const parseTerm = (): TermVal => {
    let left = parseUnary();
    let single = true;
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== 'op' || (tk.v !== '×' && tk.v !== '÷')) break;
      pos++;
      const right = parseUnary();
      single = false;
      if (tk.v === '×') left = { v: left.v * right.v, pct: false };
      else {
        if (right.v === 0) throw new CalcError('لا يمكن القسمة على صفر');
        left = { v: left.v / right.v, pct: false };
      }
    }
    return { v: left.v, pct: single && left.pct };
  };

  function parseExpr(): number {
    let acc = parseTerm().v;
    for (;;) {
      const tk = peek();
      if (!tk || tk.t !== 'op' || (tk.v !== '+' && tk.v !== '−')) break;
      pos++;
      const right = parseTerm();
      // a ± b%  →  a ± a×b/100
      const delta = right.pct ? acc * right.v : right.v;
      acc = tk.v === '+' ? acc + delta : acc - delta;
    }
    return acc;
  }

  try {
    const value = parseExpr();
    if (pos < tokens.length) {
      // ما تبقى: قوس إغلاق زائد مثلاً
      if (tokens.slice(pos).every((t) => t.t === 'rp')) {
        /* تجاهل أقواس الإغلاق الزائدة */
      } else return { ok: false, error: 'تعبير غير صحيح' };
    }
    if (!Number.isFinite(value)) return { ok: false, error: 'الرقم كبير جداً' };
    return { ok: true, value: cleanFloat(value) };
  } catch (e) {
    return { ok: false, error: e instanceof CalcError ? e.message : 'تعبير غير صحيح' };
  }
}

/** إزالة ذيول الكسور العائمة: 0.1+0.2 = 0.3 لا 0.30000000000000004 */
export function cleanFloat(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Number(n.toPrecision(12));
}

/* ============================ التنسيق ============================ */

/** رقم بفواصل الآلاف وحتى 6 كسور عشرية: 1234567.5 → 1,234,567.5 */
export function formatNumber(n: number, maxDecimals = 6): string {
  if (!Number.isFinite(n)) return '—';
  const v = cleanFloat(n);
  const neg = v < 0;
  const abs = Math.abs(v);
  let [int, dec = ''] = abs.toFixed(maxDecimals).split('.');
  dec = dec.replace(/0+$/, '');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '−' : ''}${int}${dec ? '.' + dec : ''}`;
}

/** رقم خام بلا فواصل وبلا صيغة أسية — للإدخال في التعبير */
export function rawNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = cleanFloat(n);
  let s = Math.abs(v).toFixed(8).replace(/\.?0+$/, '');
  if (s === '') s = '0';
  return (v < 0 ? '−' : '') + s;
}

/** عرض التعبير بفواصل الآلاف ومسافات حول المشغّلات */
export function formatExpr(raw: string): string {
  return normalizeExpr(raw)
    .replace(/\d+(\.\d*)?/g, (m) => {
      const [i, d] = m.split('.');
      const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return d !== undefined ? `${int}.${d}` : int;
    })
    .replace(/([+×÷])/g, ' $1 ')
    // ناقص ثنائي فقط يأخذ مسافات (لا الأحادي مثل −5)
    .replace(/(\d|\)|%)−/g, '$1 − ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ============================ آلة الأزرار ============================ */

export interface CalcState {
  /** التعبير الخام */
  expr: string;
  /** آخر ضغطة كانت «=» — الرقم التالي يبدأ حساباً جديداً */
  justEvaluated: boolean;
  /** رسالة خطأ ظاهرة (تُمسح بأي ضغطة) */
  error?: string;
  /** آخر تعبير حُسب بـ«=» — يظهر فوق النتيجة */
  lastExpr?: string;
}

export const EMPTY_CALC: CalcState = { expr: '', justEvaluated: false };

export type CalcKey =
  | { k: 'digit'; d: string }
  | { k: 'dot' }
  | { k: 'triple0' }
  | { k: 'op'; op: Op }
  | { k: 'paren' }
  | { k: 'pct' }
  | { k: 'neg' }
  | { k: 'back' }
  | { k: 'clear' }
  | { k: 'insert'; value: number }
  | { k: 'equals' };

/** ناتج «=» الناجح — يُضاف للسجل */
export interface CalcCommit {
  expr: string;
  value: number;
}

const lastChar = (s: string) => s[s.length - 1];

/** الرقم الأخير في التعبير (للتعامل مع النقطة و000 و±) */
function lastNumberSpan(expr: string): { start: number; end: number; text: string } | null {
  let j = expr.length;
  let i = j;
  while (i > 0 && (isDigit(expr[i - 1]) || expr[i - 1] === '.')) i--;
  if (i === j) return null;
  return { start: i, end: j, text: expr.slice(i, j) };
}

const openParens = (e: string) => (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;

/** هل نهاية التعبير «قيمة» (رقم أو قوس إغلاق أو %) */
const endsWithValue = (e: string) => {
  const c = lastChar(e);
  return isDigit(c) || c === ')' || c === '%' || c === '.';
};

export function applyKey(state: CalcState, key: CalcKey): { state: CalcState; commit?: CalcCommit } {
  let expr = state.expr;
  const fresh = state.justEvaluated;
  const base = { justEvaluated: false } as const;

  switch (key.k) {
    case 'clear':
      return { state: { ...EMPTY_CALC } };

    case 'back':
      if (fresh || state.error) return { state: { ...EMPTY_CALC } };
      return { state: { ...base, expr: expr.slice(0, -1) } };

    case 'digit': {
      if (fresh) expr = '';
      if (lastChar(expr) === ')' || lastChar(expr) === '%') expr += '×';
      const num = lastNumberSpan(expr);
      if (num && num.text === '0') expr = expr.slice(0, -1); // لا أصفار بادئة: 07 → 7
      return { state: { ...base, expr: expr + key.d } };
    }

    case 'triple0': {
      if (fresh) return { state };
      const num = lastNumberSpan(expr);
      // يحتاج رقماً قائماً غير الصفر: 5 → 5000، 0 → لا شيء
      if (!num || /^0+$/.test(num.text)) return { state };
      return { state: { ...base, expr: expr + '000' } };
    }

    case 'dot': {
      if (fresh) expr = '';
      if (lastChar(expr) === ')' || lastChar(expr) === '%') expr += '×';
      const num = lastNumberSpan(expr);
      if (num && num.text.includes('.')) return { state: { ...state, justEvaluated: false } };
      return { state: { ...base, expr: expr + (num ? '.' : '0.') } };
    }

    case 'op': {
      const op = key.op;
      if (expr === '') {
        // يبدأ بسالب فقط
        return { state: { ...base, expr: op === '−' ? '−' : '' } };
      }
      const c = lastChar(expr);
      if (c === '(') return { state: { ...base, expr: op === '−' ? expr + '−' : expr } };
      if (isOp(c)) {
        const prev = expr[expr.length - 2];
        // × − ← سالب بعد ضرب/قسمة مسموح
        if (op === '−' && (c === '×' || c === '÷')) return { state: { ...base, expr: expr + '−' } };
        // تبديل المشغّل (وإزالة سالب أحادي معلّق مثل ×− )
        let e = expr.slice(0, -1);
        if (isOp(prev) && e.length > 0) e = e.slice(0, -1);
        if (e === '') return { state: { ...base, expr: op === '−' ? '−' : '' } };
        return { state: { ...base, expr: e + op } };
      }
      if (c === '.') expr = expr.slice(0, -1);
      return { state: { ...base, expr: expr + op } };
    }

    case 'paren': {
      if (fresh) {
        // بعد «=»: القوس يبدأ تعبيراً جديداً مضروباً في النتيجة
        return { state: { ...base, expr: expr + '×(' } };
      }
      if (openParens(expr) > 0 && endsWithValue(expr)) return { state: { ...base, expr: expr + ')' } };
      if (endsWithValue(expr)) return { state: { ...base, expr: expr + '×(' } };
      return { state: { ...base, expr: expr + '(' } };
    }

    case 'pct': {
      const c = lastChar(expr);
      if (!(isDigit(c) || c === ')')) return { state: { ...state, justEvaluated: false } };
      return { state: { ...base, expr: expr + '%' } };
    }

    case 'neg': {
      if (expr === '' ) return { state: { ...base, expr: '−' } };
      if (fresh) {
        const v = evaluate(expr);
        if (v.ok) return { state: { ...base, expr: rawNumber(-v.value) } };
        return { state };
      }
      const num = lastNumberSpan(expr);
      if (!num) {
        if (lastChar(expr) === '−') return { state: { ...base, expr: expr.slice(0, -1) } };
        return { state };
      }
      const before = expr.slice(0, num.start);
      const prev = lastChar(before);
      const prev2 = before[before.length - 2];
      // −5 أحادي (بداية/بعد مشغّل/بعد قوس) → إزالة
      if (prev === '−' && (before.length === 1 || isOp(prev2) || prev2 === '(')) {
        return { state: { ...base, expr: before.slice(0, -1) + num.text } };
      }
      // 8+5 ↔ 8−5
      if (prev === '+') return { state: { ...base, expr: before.slice(0, -1) + '−' + num.text } };
      if (prev === '−') return { state: { ...base, expr: before.slice(0, -1) + '+' + num.text } };
      return { state: { ...base, expr: before + '−' + num.text } };
    }

    case 'insert': {
      const val = rawNumber(key.value);
      if (fresh || expr === '') return { state: { ...base, expr: val } };
      const num = lastNumberSpan(expr);
      if (num) {
        // استبدال الرقم الأخير بالقيمة المُدرجة (مع سالبه الأحادي إن وُجد)
        let before = expr.slice(0, num.start);
        if (lastChar(before) === '−' && (before.length === 1 || isOp(before[before.length - 2]) || before[before.length - 2] === '(')) {
          before = before.slice(0, -1);
        }
        return { state: { ...base, expr: before + val } };
      }
      if (lastChar(expr) === ')' || lastChar(expr) === '%') return { state: { ...base, expr: expr + '×' + val } };
      // بعد سالب أحادي ودخول قيمة سالبة: −(−5) → نتجنب «−−»
      if (lastChar(expr) === '−' && val.startsWith('−')) {
        return { state: { ...base, expr: expr.slice(0, -1) + (expr.length > 1 && !isOp(expr[expr.length - 2]) ? '+' : '') + val.slice(1) } };
      }
      return { state: { ...base, expr: expr + val } };
    }

    case 'equals': {
      if (expr === '' || fresh) return { state };
      const r = evaluate(expr);
      if (!r.ok) return { state: { ...state, error: r.error } };
      // تعبير هو رقم واحد فقط — لا داعي للسجل
      const trivial = /^−?\d*\.?\d*$/.test(expr);
      const closed = expr + ')'.repeat(Math.max(0, openParens(expr)));
      return {
        state: { expr: rawNumber(r.value), justEvaluated: true, lastExpr: closed },
        commit: trivial ? undefined : { expr: closed, value: r.value },
      };
    }
  }
  return { state };
}

/** النتيجة الحية أثناء الكتابة (null لو التعبير رقم واحد أو غير صالح) */
export function livePreview(state: CalcState): number | null {
  if (state.justEvaluated || !state.expr) return null;
  if (/^−?\d*\.?\d*$/.test(state.expr)) return null;
  const r = evaluate(state.expr);
  return r.ok ? r.value : null;
}

/** القيمة الحالية للحاسبة (للذاكرة M+ M− والنسخ) */
export function currentValue(state: CalcState): number | null {
  if (!state.expr) return 0;
  const r = evaluate(state.expr);
  return r.ok ? r.value : null;
}
