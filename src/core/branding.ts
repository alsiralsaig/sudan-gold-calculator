/**
 * اسم المحل (الهوية الظاهرة في الرسائل والفواتير والتقارير).
 *
 * مصدر واحد للاسم الافتراضي، مع تطبيع الأسماء الافتراضية القديمة حتى
 * لا يظل مستخدم قديم على اسم لم يختره بنفسه أصلاً.
 */

/** الاسم الافتراضي الحالي — يظهر في ترويسة الواتساب والفواتير والتقارير */
export const DEFAULT_STORE_NAME = 'محلات أبو أحمد';

/** أسماء افتراضية قديمة (لم يكن هناك حقل لتغييرها) — تُستبدل تلقائياً بالجديد */
export const LEGACY_STORE_NAMES: string[] = ['مجوهرات الذهب', 'مجوهرات السر الصائغ'];

/**
 * تطبيع اسم المحل: الفراغ → الافتراضي الجديد، والاسم الافتراضي القديم → الجديد.
 * أي اسم كتبه المستخدم بنفسه يبقى كما هو.
 */
export function normalizeStoreName(name?: string | null): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return DEFAULT_STORE_NAME;
  if (LEGACY_STORE_NAMES.includes(trimmed)) return DEFAULT_STORE_NAME;
  return trimmed;
}

/** ترويسة الرسالة كما تظهر في الواتساب */
export function storeHeader(name?: string | null): string {
  return `*${normalizeStoreName(name)}*`;
}
