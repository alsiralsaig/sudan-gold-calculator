/** فتح أرشيف قسم معيّن من أي شاشة (مشتريات/مبيعات/...) */
export type ArchiveKind = 'purchase' | 'sale' | 'expense' | 'loan' | 'partner';
export const ARCHIVE_TAB_KEY = 'archive_active_tab';
export const OPEN_ARCHIVE_EVENT = 'gold:open-archive';

export function openArchive(kind: ArchiveKind): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ARCHIVE_TAB_KEY, kind);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(OPEN_ARCHIVE_EVENT, { detail: kind }));
}
