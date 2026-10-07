/**
 * تجميع وفلترة المنصرفات — منطق خالص (بلا React) قابل للاختبار.
 *
 * الفكرة: كل مصروف له `target` إما 'عام' أو اسم شريك.
 * المشكلة القديمة: يمكن رؤية الإجمالي العام والخاص فقط، أما «كم صرف أحمد»
 * فكان يتطلب جمع السجلات واحدة واحدة يدوياً.
 */

import { Expense } from '../types';

export type PeriodFilter = 'all' | 'today' | '7days' | 'month';

export interface TargetSummary {
  /** 'عام' أو اسم الشريك */
  target: string;
  isGeneral: boolean;
  count: number;
  total: number;
  /** نسبة من إجمالي الفترة المعروضة (0–100) */
  percent: number;
  /** أول تاريخ وآخر تاريخ داخل التجميع */
  firstDate: string | null;
  lastDate: string | null;
}

export interface ExpenseSummary {
  /** كل التجميعات مرتبة تنازلياً بالإجمالي (عام في مكانه الطبيعي) */
  byTarget: TargetSummary[];
  /** الشركاء فقط (بدون 'عام') */
  partners: TargetSummary[];
  general: TargetSummary | null;
  total: number;
  count: number;
  generalTotal: number;
  privateTotal: number;
}

const isGeneral = (expense: Expense): boolean => !expense.target || expense.target === 'عام';

/** هل يقع التاريخ داخل الفترة المطلوبة؟ */
export function matchesPeriod(dateIso: string, period: PeriodFilter, now: Date = new Date()): boolean {
  if (period === 'all') return true;
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return false;

  if (period === 'today') return d.toDateString() === now.toDateString();
  if (period === '7days') {
    const diffDays = (now.getTime() - d.getTime()) / 86400000;
    return diffDays >= 0 && diffDays <= 7;
  }
  // month
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export interface ExpenseFilterInput {
  /** 'all' | 'عام' | 'خاصة' (كل الشركاء) | اسم شريك بعينه */
  target?: 'all' | 'عام' | 'خاصة' | string;
  period?: PeriodFilter;
  query?: string;
  now?: Date;
}

/** نفس قواعد الشاشة: نوع + فترة + بحث */
export function filterExpenses(expenses: Expense[], input: ExpenseFilterInput = {}): Expense[] {
  const { target = 'all', period = 'all', query = '', now = new Date() } = input;
  const q = query.trim().toLowerCase();

  return expenses
    .filter((e) => !e.archived)
    .filter((e) => {
      if (target === 'all') return true;
      if (target === 'عام') return isGeneral(e);
      if (target === 'خاصة') return !isGeneral(e);
      return e.target === target;
    })
    .filter((e) => matchesPeriod(e.date, period, now))
    .filter((e) => {
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q) ||
        (e.target || '').toLowerCase().includes(q) ||
        String(e.amount).includes(q)
      );
    });
}

/**
 * تجميع المنصرفات حسب الجهة (عام / كل شريك) مع العدد والإجمالي والنسبة.
 * يُستخدم لعرض «كم صرف كل شريك» دفعة واحدة بلا جمع يدوي.
 */
export function summarizeExpenses(expenses: Expense[], input: ExpenseFilterInput = {}): ExpenseSummary {
  const filtered = filterExpenses(expenses, input);

  const map = new Map<string, TargetSummary>();
  for (const e of filtered) {
    const key = isGeneral(e) ? 'عام' : e.target || 'شريك';
    const existing = map.get(key);
    const amount = e.amount || 0;
    if (existing) {
      existing.count += 1;
      existing.total += amount;
      if (!existing.firstDate || e.date < existing.firstDate) existing.firstDate = e.date;
      if (!existing.lastDate || e.date > existing.lastDate) existing.lastDate = e.date;
    } else {
      map.set(key, {
        target: key,
        isGeneral: key === 'عام',
        count: 1,
        total: amount,
        percent: 0,
        firstDate: e.date,
        lastDate: e.date,
      });
    }
  }

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
  const byTarget = Array.from(map.values())
    .map((t) => ({ ...t, percent: total > 0 ? Math.round((t.total / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);

  const partners = byTarget.filter((t) => !t.isGeneral);
  const general = byTarget.find((t) => t.isGeneral) || null;

  return {
    byTarget,
    partners,
    general,
    total,
    count: filtered.length,
    generalTotal: general?.total || 0,
    privateTotal: partners.reduce((sum, p) => sum + p.total, 0),
  };
}

/** نص مشاركة تجميع الشريك — للواتساب */
export function partnerExpenseText(storeName: string, summary: TargetSummary, periodLabel: string): string {
  const lines = [
    `*${storeName}*`,
    `*منصرفات ${summary.target}* — ${periodLabel}`,
    '—————————————',
    `عدد العمليات: ${summary.count}`,
    `الإجمالي: ${summary.total.toLocaleString('en-US')} ج.س`,
  ];
  return lines.join('\n');
}
