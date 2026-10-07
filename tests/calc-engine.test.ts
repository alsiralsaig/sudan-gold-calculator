import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluate, formatNumber, formatExpr, rawNumber, applyKey, livePreview, currentValue,
  EMPTY_CALC, CalcState, CalcKey,
} from '../src/core/calcEngine';

const val = (e: string) => { const r = evaluate(e); return r.ok ? r.value : r.error; };

test('العمليات الأساسية وأولوية الضرب والقسمة', () => {
  assert.equal(val('2+3×4'), 14);
  assert.equal(val('(2+3)×4'), 20);
  assert.equal(val('10÷4'), 2.5);
  assert.equal(val('10−2−3'), 5);
  assert.equal(val('−5+2'), -3);
  assert.equal(val('3×−2'), -6);
});

test('يقبل رموز لوحة المفاتيح والفواصل والأرقام العربية', () => {
  assert.equal(val('1,000*3'), 3000);
  assert.equal(val('10/4-1'), 1.5);
  assert.equal(val('٢٥٠×٤'), 1000);
});

test('النسبة المئوية بالمعنى التجاري', () => {
  assert.equal(val('1000+10%'), 1100);
  assert.equal(val('1000−10%'), 900);
  assert.equal(val('1000×10%'), 100);
  assert.equal(val('50%'), 0.5);
  assert.equal(val('200÷50%'), 400);
  // نسبة داخل ضرب لا تُعامل كزيادة
  assert.equal(val('100+2×10%'), 100.2);
});

test('دقة الكسور: 0.1+0.2 = 0.3', () => {
  assert.equal(val('0.1+0.2'), 0.3);
  assert.equal(val('1.1×3'), 3.3);
});

test('الأخطاء: القسمة على صفر وتعبير فاسد', () => {
  assert.equal(val('5÷0'), 'لا يمكن القسمة على صفر');
  assert.equal(val('5..2'), 'تعبير غير صحيح');
  assert.equal(val('abc'), 'تعبير غير صحيح');
});

test('لا يُنفّذ أي كود — الحماية من الحقن', () => {
  const r = evaluate('alert(1)');
  assert.equal(r.ok, false);
  const r2 = evaluate('constructor.constructor("return 1")()');
  assert.equal(r2.ok, false);
});

test('أقواس غير مقفولة ومشغّل معلّق — للنتيجة الحية', () => {
  assert.equal(val('(2+3'), 5);
  assert.equal(val('2+3×'), 5);
  assert.equal(val('((4'), 4);
});

test('التنسيق بفواصل الآلاف', () => {
  assert.equal(formatNumber(1234567.5), '1,234,567.5');
  assert.equal(formatNumber(-2500), '−2,500');
  assert.equal(formatNumber(1 / 3), '0.333333');
  assert.equal(formatNumber(1 / 3, 2), '0.33');
  assert.equal(formatExpr('1000000×3+−5'), '1,000,000 × 3 + −5');
  assert.equal(formatExpr('12500−300'), '12,500 − 300');
  assert.equal(rawNumber(1e21 / 1e10), '100000000000');
  assert.equal(rawNumber(-0.5), '−0.5');
});

/* ---------- آلة الأزرار ---------- */
const press = (seq: (CalcKey | string)[], start: CalcState = EMPTY_CALC) => {
  let s = start;
  const commits: { expr: string; value: number }[] = [];
  for (const k of seq) {
    let key: CalcKey;
    if (typeof k !== 'string') key = k;
    else if (/^\d$/.test(k)) key = { k: 'digit', d: k };
    else if (k === '.') key = { k: 'dot' };
    else if (k === '000') key = { k: 'triple0' };
    else if (['+', '−', '×', '÷'].includes(k)) key = { k: 'op', op: k as any };
    else if (k === '()') key = { k: 'paren' };
    else if (k === '%') key = { k: 'pct' };
    else if (k === '±') key = { k: 'neg' };
    else if (k === '⌫') key = { k: 'back' };
    else if (k === 'C') key = { k: 'clear' };
    else if (k === '=') key = { k: 'equals' };
    else throw new Error(k);
    const r = applyKey(s, key);
    s = r.state;
    if (r.commit) commits.push(r.commit);
  }
  return { s, commits };
};

test('أزرار: حساب كامل مع السجل', () => {
  const { s, commits } = press(['8', '7', '5', '÷', '5', '=']);
  assert.equal(s.expr, '175');
  assert.equal(s.justEvaluated, true);
  assert.deepEqual(commits, [{ expr: '875÷5', value: 175 }]);
});

test('أزرار: بعد = الرقم يبدأ جديداً والمشغّل يكمل على النتيجة', () => {
  assert.equal(press(['2', '+', '3', '=', '7']).s.expr, '7');
  assert.equal(press(['2', '+', '3', '=', '×', '2', '=']).s.expr, '10');
});

test('أزرار: تبديل المشغّل وعدم تكراره', () => {
  assert.equal(press(['5', '+', '×']).s.expr, '5×');
  assert.equal(press(['5', '×', '−']).s.expr, '5×−');
  assert.equal(press(['5', '×', '−', '+']).s.expr, '5+');
  assert.equal(press(['+']).s.expr, '');
  assert.equal(press(['−', '3']).s.expr, '−3');
});

test('أزرار: النقطة مرة واحدة لكل رقم، و0. تلقائياً', () => {
  assert.equal(press(['.', '5']).s.expr, '0.5');
  assert.equal(press(['1', '.', '.', '5', '.']).s.expr, '1.5');
  assert.equal(press(['1', '.', '5', '+', '.', '2']).s.expr, '1.5+0.2');
});

test('أزرار: لا أصفار بادئة، و000', () => {
  assert.equal(press(['0', '0', '7']).s.expr, '7');
  assert.equal(press(['2', '5', '000']).s.expr, '25000');
  assert.equal(press(['000']).s.expr, '');
  assert.equal(press(['0', '000']).s.expr, '0');
});

test('أزرار: القوس الذكي', () => {
  assert.equal(press(['()', '2', '+', '3', '()', '×', '4', '=']).s.expr, '20');
  assert.equal(press(['5', '()', '2', '+', '1', '=']).s.expr, '15'); // 5×(2+1)
  assert.equal(press(['()', '2', '+', '3', '=']).commits[0].expr, '(2+3)');
});

test('أزرار: النسبة', () => {
  assert.equal(press(['2', '0', '0', '+', '1', '0', '%', '=']).s.expr, '220');
  assert.equal(press(['%']).s.expr, '');
});

test('أزرار: ± يقلب إشارة الرقم الأخير', () => {
  assert.equal(press(['5', '±']).s.expr, '−5');
  assert.equal(press(['5', '±', '±']).s.expr, '5');
  assert.equal(press(['8', '+', '5', '±']).s.expr, '8−5');
  assert.equal(press(['8', '−', '5', '±']).s.expr, '8+5');
  assert.equal(press(['8', '×', '5', '±']).s.expr, '8×−5');
  assert.equal(press(['8', '×', '5', '±', '=']).s.expr, '−40');
  assert.equal(press(['9', '=', '±']).s.expr, '−9');
});

test('أزرار: المسح والرجوع', () => {
  assert.equal(press(['1', '2', '3', '⌫']).s.expr, '12');
  assert.equal(press(['1', '+', '2', '=', '⌫']).s.expr, '');
  assert.equal(press(['1', '+', '2', 'C']).s.expr, '');
});

test('أزرار: الخطأ لا يمسح التعبير ويختفي بالضغطة التالية', () => {
  const { s } = press(['5', '÷', '0', '=']);
  assert.equal(s.error, 'لا يمكن القسمة على صفر');
  assert.equal(s.expr, '5÷0');
  const r = applyKey(s, { k: 'back' });
  assert.equal(r.state.error, undefined);
});

test('أزرار: = على رقم وحيد لا يُضاف للسجل', () => {
  assert.equal(press(['4', '2', '=']).commits.length, 0);
});

test('إدراج قيمة (سعر 21 / من السجل / الذاكرة)', () => {
  let s = applyKey(EMPTY_CALC, { k: 'insert', value: 992649 }).state;
  assert.equal(s.expr, '992649');
  s = press(['×', '1', '2']).s; // نبدأ جديد
  s = press(['5', '×']).s;
  s = applyKey(s, { k: 'insert', value: 1000 }).state;
  assert.equal(s.expr, '5×1000');
  s = applyKey(s, { k: 'insert', value: 2000 }).state; // يستبدل الرقم الأخير
  assert.equal(s.expr, '5×2000');
  s = applyKey(press(['()', '2', '()']).s, { k: 'insert', value: 3 }).state;
  assert.equal(s.expr, '(2)×3');
});

test('النتيجة الحية والقيمة الحالية', () => {
  assert.equal(livePreview(press(['1', '2']).s), null); // رقم واحد
  assert.equal(livePreview(press(['1', '2', '+', '3']).s), 15);
  assert.equal(livePreview(press(['1', '2', '+']).s), 12);
  assert.equal(livePreview(press(['5', '÷', '0']).s), null);
  assert.equal(currentValue(press(['7', '×', '6']).s), 42);
  assert.equal(currentValue(EMPTY_CALC), 0);
});

test('بعد «=» يبقى التعبير الأخير للعرض فوق النتيجة', () => {
  const { s } = press(['1', '2', '5', '000', '×', '3', '=']);
  assert.equal(s.lastExpr, '125000×3');
  assert.equal(formatExpr(s.lastExpr!), '125,000 × 3');
  assert.equal(press(['7']).s.lastExpr, undefined);
});
