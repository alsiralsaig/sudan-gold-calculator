/**
 * سجل الحسابات (الشريط) — نقي، مُختبر.
 * يُحفظ على الجهاز فقط (لا يُزامَن) لأنه مسودة عمل لا بيانات محاسبية.
 */
import { formatNumber } from './calcEngine';

export const TAPE_STORAGE_KEY = 'gold_calc_tape_v1';
export const TAPE_MAX = 200;

export type TapeMode = 'std' | 'gold';

export interface TapeEntry {
  id: string;
  /** ISO */
  at: string;
  mode: TapeMode;
  /** اسم الأداة: «حاسبة» أو «قيمة الذهب» ... */
  title: string;
  /** سطر/أسطر الحساب */
  lines: string[];
  /** النتيجة كنص للعرض */
  result: string;
  /** القيمة الرقمية الرئيسية (للجمع والإدراج في الحاسبة) */
  value?: number;
  /** حالة لاستعادة الأداة كما كانت (حاسبة الذهب) */
  restore?: { tool: string; inputs: Record<string, string> };
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function makeEntry(e: Omit<TapeEntry, 'id' | 'at'> & { at?: string }): TapeEntry {
  return { ...e, id: newId(), at: e.at || new Date().toISOString() };
}

/** إضافة في الأعلى مع حد أقصى، ومنع التكرار المتتالي لنفس الحساب */
export function addToTape(list: TapeEntry[], entry: TapeEntry, max = TAPE_MAX): TapeEntry[] {
  const top = list[0];
  if (top && top.title === entry.title && top.result === entry.result && top.lines.join('|') === entry.lines.join('|')) {
    return list;
  }
  return [entry, ...list].slice(0, max);
}

export function removeFromTape(list: TapeEntry[], id: string): TapeEntry[] {
  return list.filter((e) => e.id !== id);
}

/** قراءة آمنة من التخزين — أي بيانات تالفة تُتجاهل */
export function parseTape(raw: string | null | undefined): TapeEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          typeof e.at === 'string' &&
          (e.mode === 'std' || e.mode === 'gold') &&
          typeof e.title === 'string' &&
          Array.isArray(e.lines) &&
          typeof e.result === 'string'
      )
      .slice(0, TAPE_MAX);
  } catch {
    return [];
  }
}

/** مجموع القيم المحددة */
export function sumSelected(list: TapeEntry[], ids: Set<string> | string[]): { count: number; total: number } {
  const set = ids instanceof Set ? ids : new Set(ids);
  const picked = list.filter((e) => set.has(e.id) && typeof e.value === 'number' && Number.isFinite(e.value));
  return { count: picked.length, total: picked.reduce((s, e) => s + (e.value as number), 0) };
}

const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getDate()}/${d.getMonth() + 1} ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
};

export { timeLabel as tapeTimeLabel };

/** نص للنسخ/الواتساب — الأقدم أولاً ليُقرأ بالتسلسل */
export function tapeToText(entries: TapeEntry[], storeName?: string): string {
  const out: string[] = [];
  if (storeName) out.push(`*${storeName}*`);
  out.push('*سجل الحسابات*');
  out.push('—————————————');
  [...entries].reverse().forEach((e) => {
    out.push(`${e.title} — ${timeLabel(e.at)}`);
    e.lines.forEach((l) => out.push(l));
    out.push(`= *${e.result}*`);
    out.push('');
  });
  const s = sumSelected(entries, entries.map((e) => e.id));
  if (entries.length > 1 && s.count === entries.length) {
    out.push(`المجموع: *${formatNumber(s.total, 2)}*`);
  }
  return out.join('\n').trim();
}
