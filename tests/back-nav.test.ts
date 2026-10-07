import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideBack,
  pushTabHistory,
  pullDistance,
  pullShouldTrigger,
  isVerticalPull,
  HOME_TAB,
  MAX_TAB_HISTORY,
  PULL_TRIGGER_PX,
  PULL_MAX_PX,
} from '../src/core/backNav';

const base = { overlayCount: 0, menuOpen: false, activeTab: HOME_TAB, tabHistory: [] as string[] };

test('رجوع: النافذة المفتوحة تُقفل أولاً قبل أي شيء', () => {
  assert.deepEqual(decideBack({ ...base, overlayCount: 2, menuOpen: true, activeTab: 'sales' }), { type: 'closeOverlay' });
});

test('رجوع: القائمة الجانبية تُقفل قبل تغيير الشاشة', () => {
  assert.deepEqual(decideBack({ ...base, menuOpen: true, activeTab: 'sales' }), { type: 'closeMenu' });
});

test('رجوع: من شاشة فرعية إلى السابقة', () => {
  const a = decideBack({ ...base, activeTab: 'sales', tabHistory: ['search'] });
  assert.deepEqual(a, { type: 'goTab', tab: 'search', history: [] });
});

test('رجوع: بلا سجل → الرئيسية', () => {
  assert.deepEqual(decideBack({ ...base, activeTab: 'loans' }), { type: 'goTab', tab: HOME_TAB, history: [] });
});

test('رجوع: يتخطى تكرار الشاشة الحالية في السجل', () => {
  const a = decideBack({ ...base, activeTab: 'sales', tabHistory: ['purchases', 'sales', 'sales'] });
  assert.deepEqual(a, { type: 'goTab', tab: 'purchases', history: [] });
});

test('رجوع: في الرئيسية → طلب تأكيد الخروج (لا خروج مباشر)', () => {
  assert.deepEqual(decideBack(base), { type: 'exitPrompt' });
});

test('سجل الشاشات: الرئيسية لا تُخزَّن والذهاب لها يمسح السجل', () => {
  assert.deepEqual(pushTabHistory([], HOME_TAB, 'sales'), []);
  assert.deepEqual(pushTabHistory([], 'sales', 'purchases'), ['sales']);
  assert.deepEqual(pushTabHistory(['sales', 'purchases'], 'loans', HOME_TAB), []);
});

test('سجل الشاشات: نفس الشاشة لا تُضاف، والرجوع لشاشة سابقة يقص الحلقة', () => {
  assert.deepEqual(pushTabHistory(['sales'], 'purchases', 'purchases'), ['sales']);
  assert.deepEqual(pushTabHistory(['sales', 'purchases'], 'loans', 'sales'), []);
  assert.deepEqual(pushTabHistory(['a', 'b', 'c'], 'd', 'c'), ['a', 'b']);
});

test('سجل الشاشات: له حد أقصى', () => {
  let h: string[] = [];
  for (let i = 0; i < 100; i++) h = pushTabHistory(h, `t${i}`, `t${i + 1}`);
  assert.equal(h.length, MAX_TAB_HISTORY);
});

test('سيناريو كامل: رئيسية → بحث → مبيعات → رجوع → رجوع → رجوع', () => {
  let tab = HOME_TAB;
  let hist: string[] = [];
  const go = (t: string) => { hist = pushTabHistory(hist, tab, t); tab = t; };
  go('search');
  go('sales');
  let a = decideBack({ ...base, activeTab: tab, tabHistory: hist });
  assert.equal(a.type, 'goTab');
  if (a.type === 'goTab') { tab = a.tab; hist = a.history; }
  assert.equal(tab, 'search');
  a = decideBack({ ...base, activeTab: tab, tabHistory: hist });
  if (a.type === 'goTab') { tab = a.tab; hist = a.history; }
  assert.equal(tab, HOME_TAB);
  assert.equal(decideBack({ ...base, activeTab: tab, tabHistory: hist }).type, 'exitPrompt');
});

test('السحب للتحديث: مقاومة وحد أقصى وعتبة', () => {
  assert.equal(pullDistance(-20), 0);
  assert.equal(pullDistance(0), 0);
  assert.equal(pullDistance(100), 50);
  assert.equal(pullDistance(10_000), PULL_MAX_PX);
  assert.equal(pullShouldTrigger(PULL_TRIGGER_PX - 1), false);
  assert.equal(pullShouldTrigger(PULL_TRIGGER_PX), true);
  // يحتاج سحباً حقيقياً (≈140px) — لا يتفعّل بلمسة عابرة
  assert.equal(pullShouldTrigger(pullDistance(120)), false);
  assert.equal(pullShouldTrigger(pullDistance(150)), true);
});

test('السحب للتحديث: العمودي فقط — لا يتعارض مع تمرير الجداول أفقياً', () => {
  assert.equal(isVerticalPull(0, 30), true);
  assert.equal(isVerticalPull(40, 30), false);
  assert.equal(isVerticalPull(0, 5), false);
  assert.equal(isVerticalPull(0, -30), false);
});
