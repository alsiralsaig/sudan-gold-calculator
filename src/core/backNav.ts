/**
 * منطق زر الرجوع (التلفون) — نقي بلا DOM، مُختبر.
 *
 * المشكلة: التطبيق يبدّل الشاشات داخلياً بلا سجل تصفح، فزر الرجوع في
 * أندرويد لا يجد صفحة سابقة فيُغلق التطبيق تماماً.
 *
 * الترتيب المتّبع عند الضغط على رجوع:
 *   1) نافذة مفتوحة (فاتورة/إضافة/دفعة...) → تُقفل
 *   2) القائمة الجانبية مفتوحة → تُقفل
 *   3) شاشة غير الرئيسية → الشاشة السابقة (أو الرئيسية)
 *   4) في الرئيسية → «اضغط رجوع مرة تانية للخروج»
 */

export const HOME_TAB = 'dashboard';
export const MAX_TAB_HISTORY = 30;

export type BackAction =
  | { type: 'closeOverlay' }
  | { type: 'closeMenu' }
  | { type: 'goTab'; tab: string; history: string[] }
  | { type: 'exitPrompt' };

export interface BackState {
  overlayCount: number;
  menuOpen: boolean;
  activeTab: string;
  /** الشاشات السابقة — آخر عنصر هو الأقرب */
  tabHistory: string[];
}

export function decideBack(s: BackState): BackAction {
  if (s.overlayCount > 0) return { type: 'closeOverlay' };
  if (s.menuOpen) return { type: 'closeMenu' };
  if (s.activeTab !== HOME_TAB) {
    const history = [...s.tabHistory];
    // تخطّي أي تكرار للشاشة الحالية
    let prev = history.pop();
    while (prev === s.activeTab) prev = history.pop();
    return { type: 'goTab', tab: prev || HOME_TAB, history: prev ? history : [] };
  }
  return { type: 'exitPrompt' };
}

/**
 * سجل الشاشات عند الانتقال من `from` إلى `to`.
 * - الذهاب للرئيسية يمسح السجل (الرئيسية هي الجذر دائماً).
 * - نفس الشاشة لا تُضاف.
 * - الرئيسية لا تُخزَّن في السجل (هي الوجهة الافتراضية).
 */
export function pushTabHistory(history: string[], from: string, to: string): string[] {
  if (to === HOME_TAB) return [];
  if (from === to) return history;
  const next = from === HOME_TAB ? [...history] : [...history, from];
  // لو الوجهة موجودة سابقاً، نقص السجل عندها حتى لا ندور في حلقات
  const idx = next.indexOf(to);
  const trimmed = idx >= 0 ? next.slice(0, idx) : next;
  return trimmed.slice(-MAX_TAB_HISTORY);
}

/* ------------------------- السحب للتحديث ------------------------- */

export const PULL_TRIGGER_PX = 70;
export const PULL_MAX_PX = 110;

/** مسافة المؤشر مع مقاومة (كلما سحبت أكثر يبطأ) */
export function pullDistance(rawDy: number): number {
  if (rawDy <= 0) return 0;
  const damped = rawDy * 0.5;
  return Math.min(PULL_MAX_PX, Math.round(damped));
}

export const pullShouldTrigger = (distance: number): boolean => distance >= PULL_TRIGGER_PX;

/** السحب العمودي فقط — حتى لا يتعارض مع تمرير الجداول أفقياً */
export function isVerticalPull(dx: number, dy: number): boolean {
  return dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.2;
}
