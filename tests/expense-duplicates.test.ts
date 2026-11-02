import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DUPLICATE_WINDOW_MS,
  duplicateAmount,
  duplicateCount,
  findDuplicateExpenses,
} from '../src/core/expenseDuplicates';
import { Expense } from '../src/types';

const at = (iso: string) => iso;

const exp = (id: string, amount: number, name: string, target: string, date: string, extra: Partial<Expense> = {}): Expense => ({
  id,
  date,
  amount,
  name,
  target,
  category: target === 'عام' ? 'منصرفات عامة' : 'مسحوبات شريك',
  notes: '',
  ...extra,
});

test('نفس المبلغ والبيان والجهة خلال دقائق = مكرر (نُبقي الأقدم)', () => {
  const groups = findDuplicateExpenses([
    exp('a', 12_000, 'عشاء قديم', 'عام', at('2026-11-02T08:48:00.000Z')),
    exp('b', 12_000, 'عشاء قديم', 'عام', at('2026-11-02T08:48:30.000Z')),
    exp('c', 12_000, 'عشاء قديم', 'عام', at('2026-11-02T08:49:10.000Z')),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].keep.id, 'a');
  assert.deepEqual(groups[0].duplicates.map((d) => d.id), ['b', 'c']);
  assert.equal(duplicateCount(groups), 2);
  assert.equal(duplicateAmount(groups), 24_000);
});

test('مبالغ مختلفة أو بيان مختلف = ليست مكررة', () => {
  assert.equal(
    findDuplicateExpenses([
      exp('a', 12_000, 'عشاء قديم', 'عام', at('2026-11-02T08:48:00.000Z')),
      exp('b', 18_000, 'عشاء امبارح', 'عام', at('2026-11-02T08:46:00.000Z')),
      exp('c', 12_000, 'موية', 'عام', at('2026-11-02T08:48:00.000Z')),
    ]).length,
    0
  );
});

test('نفس البيان والمبلغ لكن على شريكين مختلفين = ليست مكررة', () => {
  assert.equal(
    findDuplicateExpenses([
      exp('a', 200_000, 'مصاريف', 'السر الصائغ', at('2026-11-02T12:02:00.000Z')),
      exp('b', 200_000, 'مصاريف', 'أحمد تاجو', at('2026-11-02T12:02:00.000Z')),
    ]).length,
    0
  );
});

test('الفواتير المتكررة على مدار الأيام ليست مكررة (نافذة زمنية)', () => {
  const groups = findDuplicateExpenses([
    exp('a', 650_000, 'إيجار البيت', 'عام', at('2026-10-01T12:00:00.000Z')),
    exp('b', 650_000, 'إيجار البيت', 'عام', at('2026-11-01T12:00:00.000Z')),
  ]);
  assert.equal(groups.length, 0, `الافتراضي ${DEFAULT_DUPLICATE_WINDOW_MS} مللي ثانية`);
});

test('المؤرشف يُستثنى — لا يُقترح مرتين ولا يبقى في الحساب', () => {
  const groups = findDuplicateExpenses([
    exp('a', 600_000, 'مصاريف البيت', 'عام', at('2026-11-02T12:02:00.000Z')),
    exp('b', 600_000, 'مصاريف البيت', 'عام', at('2026-11-02T12:02:00.000Z'), { archived: true }),
  ]);
  assert.equal(groups.length, 0);
});

test('مبلغ صفر لا يُعتبر تكراراً', () => {
  assert.equal(
    findDuplicateExpenses([
      exp('a', 0, 'قيد', 'عام', at('2026-11-02T10:00:00.000Z')),
      exp('b', 0, 'قيد', 'عام', at('2026-11-02T10:00:00.000Z')),
    ]).length,
    0
  );
});

test('الفرع جزء من التطابق', () => {
  assert.equal(
    findDuplicateExpenses([
      exp('a', 100_000, 'كهرباء', 'عام', at('2026-11-02T10:00:00.000Z'), { branchId: 'br1' }),
      exp('b', 100_000, 'كهرباء', 'عام', at('2026-11-02T10:00:00.000Z'), { branchId: 'br2' }),
    ]).length,
    0
  );
});

test('الأكبر أثراً يرجع أولاً', () => {
  const groups = findDuplicateExpenses([
    exp('a1', 5_000, 'كيف', 'عام', at('2026-11-02T10:51:00.000Z')),
    exp('a2', 5_000, 'كيف', 'عام', at('2026-11-02T10:51:10.000Z')),
    exp('b1', 500_000, 'صندوق', 'عام', at('2026-11-02T11:56:00.000Z')),
    exp('b2', 500_000, 'صندوق', 'عام', at('2026-11-02T11:56:20.000Z')),
  ]);
  assert.equal(groups[0].keep.id, 'b1');
});

test('مسافة/حالة الأحرف في البيان لا تمنع كشف التكرار', () => {
  const groups = findDuplicateExpenses([
    exp('a', 200_000, 'مصاريف', 'عام', at('2026-11-02T12:02:00.000Z')),
    exp('b', 200_000, '  مصاريف ', 'عام', at('2026-11-02T12:02:05.000Z')),
  ]);
  assert.equal(groups.length, 1);
});
