import { AppTombstones } from '../types';

export interface MergeResult<T extends { id: string; updatedAt?: string }> {
  items: T[];
  tombstones: AppTombstones;
}

/**
 * دمج السجلات المحلية مع السحابية مع احترام سجل الحذف (tombstones).
 * بدون هذا السجل، أي سجل محذوف يعود من السحابة عند المزامنة التالية.
 */
export function mergeRecordsWithTombstones<T extends { id: string; updatedAt?: string }>(
  local: T[] | undefined,
  cloud: T[] | undefined,
  localTombstones: AppTombstones = {},
  cloudTombstones: AppTombstones = {}
): MergeResult<T> {
  const tombstones: AppTombstones = { ...cloudTombstones };
  Object.entries(localTombstones || {}).forEach(([id, at]) => {
    if (!tombstones[id] || new Date(at) > new Date(tombstones[id])) tombstones[id] = at;
  });

  const byId = new Map<string, T>();
  (cloud || []).forEach((item) => {
    if (item && item.id) byId.set(item.id, item);
  });
  (local || []).forEach((item) => {
    if (!item || !item.id) return;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      return;
    }
    // الأحدث تعديلاً يفوز، والمحلي يفوز عند التساوي.
    const localTime = new Date(item.updatedAt || 0).getTime();
    const cloudTime = new Date(existing.updatedAt || 0).getTime();
    byId.set(item.id, localTime >= cloudTime ? item : existing);
  });

  const items: T[] = [];
  byId.forEach((item) => {
    const deletedAt = tombstones[item.id];
    if (deletedAt) {
      const deletedTime = new Date(deletedAt).getTime();
      const updatedTime = new Date(item.updatedAt || 0).getTime();
      // إذا عُدّل السجل بعد الحذف، يُعتبر حياً من جديد.
      if (!item.updatedAt || deletedTime >= updatedTime) return;
    }
    items.push(item);
  });

  return { items, tombstones };
}
