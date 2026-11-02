/**
 * كشف المنصرفات المكررة.
 *
 * الواقع في التطبيق: نقرة مزدوجة على «حفظ» أو إعادة إدخال نفس المصروف
 * تسجّل العملية مرتين، فتتضاعف المنصرفات وتتضارب الأرقام بين الشاشات.
 * المنطق هنا يحدد «المكرر» بقاعدة صريحة:
 *
 *   نفس المبلغ + نفس البيان + نفس الجهة + نفس الفرع، وبفرق زمني صغير
 *   (افتراضياً 5 دقائق) ⇒ نسخة مكررة، ونُبقي الأقدم.
 *
 * لا نحذف شيئاً هنا — الواجهة تؤرشف المكرر (قابل للاستعادة من الأرشيف).
 * مُختبر في tests/expense-duplicates.test.ts.
 */
import { Expense } from '../types';

/** الافتراضي: 5 دقائق — يعالج النقر المزدوج وإعادة الإدخال السريعة */
export const DEFAULT_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export interface DuplicateGroup {
  /** مفتاح التطابق (للاستخدام كـ key في الواجهة) */
  key: string;
  /** النسخة الأصلية التي نُبقيها (الأقدم) */
  keep: Expense;
  /** النسخ المكررة المقترح أرشفتها */
  duplicates: Expense[];
}

const normalizeName = (name: string | undefined): string => (name || '').trim().toLowerCase();

const groupKey = (e: Expense): string =>
  [
    Math.round(Number(e.amount) || 0),
    normalizeName(e.name),
    (e.target || 'عام').trim(),
    e.branchId || '',
  ].join('|');

const timeOf = (e: Expense): number => {
  const t = new Date(e.date || e.updatedAt || 0).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * يرجع مجموعات المكرر فقط (المجموعات التي فيها أكثر من سجل).
 * السجلات المؤرشفة تُستثنى (الأرشيف خارج الحساب أصلاً)، والمبلغ صفر يُستثنى.
 */
export function findDuplicateExpenses(
  expenses: Expense[],
  windowMs: number = DEFAULT_DUPLICATE_WINDOW_MS
): DuplicateGroup[] {
  const byKey = new Map<string, Expense[]>();

  (expenses || []).forEach((e) => {
    if (!e || e.archived) return;
    if (!Number(e.amount)) return;
    const key = groupKey(e);
    const list = byKey.get(key);
    if (list) list.push(e);
    else byKey.set(key, [e]);
  });

  const groups: DuplicateGroup[] = [];

  byKey.forEach((list, key) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((a, b) => timeOf(a) - timeOf(b));
    const keep = sorted[0];
    const keepTime = timeOf(keep);
    const duplicates = sorted
      .slice(1)
      .filter((e) => keepTime === 0 || Math.abs(timeOf(e) - keepTime) <= windowMs);
    if (duplicates.length) groups.push({ key, keep, duplicates });
  });

  // الأكبر أثراً أولاً — عشان التاجر يشوف اللي بيلخبط الأرقام
  return groups.sort(
    (a, b) =>
      b.duplicates.reduce((s, e) => s + e.amount, 0) - a.duplicates.reduce((s, e) => s + e.amount, 0)
  );
}

/** إجمالي المبالغ المكررة (الفلوس الزائدة المحسوبة) */
export function duplicateAmount(groups: DuplicateGroup[]): number {
  return groups.reduce((sum, g) => sum + g.duplicates.reduce((s, e) => s + (e.amount || 0), 0), 0);
}

/** عدد السجلات المكررة */
export function duplicateCount(groups: DuplicateGroup[]): number {
  return groups.reduce((sum, g) => sum + g.duplicates.length, 0);
}
