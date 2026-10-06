/**
 * أدوات التواريخ للمتأخرات والتقارير.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** عدد الأيام بين تاريخين (موجب = التاريخ الأول أحدث) */
export function daysBetween(from: Date | string, to: Date | string): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toDateInputValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function arabicDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function arabicDayName(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return AR_DAYS[d.getDay()];
}

export function shortLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** وصف نسبي بالعربية: اليوم، أمس، قبل 3 أيام، بعد يومين... */
export function relativeDays(days: number): string {
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === -1) return 'أمس';
  if (days > 1) return `بعد ${days} يوماً`;
  return `قبل ${Math.abs(days)} يوماً`;
}
