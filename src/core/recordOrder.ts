/**
 * ترتيب السجلات زمنياً — مصدر واحد لكل الشاشات.
 *
 * المشكلة التي يحلّها: الشاشات كانت تعرض السجلات بترتيب المصفوفة كما هي،
 * والمزامنة تدمج السحابي أولاً ثم المحلي الجديد في الآخر، فيظهر ما أُدخل
 * أولاً وما بعده متفرقين. الآن: الترتيب دائماً بتاريخ العملية نفسه.
 *
 * نقي بلا React ولا DOM — مُختبر.
 */

export type RecordOrder = 'newest' | 'oldest';

export const DEFAULT_RECORD_ORDER: RecordOrder = 'newest';
export const RECORD_ORDER_STORAGE_KEY = 'gold_record_order_v1';

export interface Orderable {
  id?: string;
  date?: string;
  updatedAt?: string;
}

const timeOf = (d?: string): number => {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * مقارنة «الأقدم أولاً»:
 * 1) تاريخ العملية
 * 2) عند التساوي: وقت آخر تعديل (أقرب مؤشر لوقت الإدخال)
 * 3) عند التساوي: المعرّف — حتى يبقى الترتيب ثابتاً بين الأجهزة
 */
export function compareOldestFirst(a: Orderable, b: Orderable): number {
  const byDate = timeOf(a.date) - timeOf(b.date);
  if (byDate !== 0) return byDate;
  const byUpdate = timeOf(a.updatedAt) - timeOf(b.updatedAt);
  if (byUpdate !== 0) return byUpdate;
  const ai = String(a.id ?? '');
  const bi = String(b.id ?? '');
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}

/** ترتيب نسخة من السجلات — لا نلمس المصفوفة الأصلية */
export function sortRecords<T extends Orderable>(
  items: T[] | undefined | null,
  order: RecordOrder = DEFAULT_RECORD_ORDER
): T[] {
  const list = [...(items || [])];
  list.sort((a, b) => (order === 'oldest' ? compareOldestFirst(a, b) : compareOldestFirst(b, a)));
  return list;
}

export function parseRecordOrder(v: unknown): RecordOrder {
  return v === 'oldest' ? 'oldest' : 'newest';
}

export const toggleRecordOrder = (o: RecordOrder): RecordOrder => (o === 'newest' ? 'oldest' : 'newest');

export const recordOrderLabel = (o: RecordOrder): string =>
  o === 'oldest' ? 'الأقدم أولاً' : 'الأحدث أولاً';
