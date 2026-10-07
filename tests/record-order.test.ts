import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sortRecords,
  compareOldestFirst,
  parseRecordOrder,
  toggleRecordOrder,
  recordOrderLabel,
} from '../src/core/recordOrder';
import { mergeRecordsWithTombstones } from '../src/core/merge';

const r = (id: string, date: string, updatedAt?: string) => ({ id, date, updatedAt });

test('الأحدث أولاً افتراضياً — بتاريخ العملية لا بترتيب المصفوفة', () => {
  const items = [
    r('b', '2026-10-05T10:00:00.000Z'),
    r('a', '2026-10-01T09:00:00.000Z'),
    r('c', '2026-10-07T08:00:00.000Z'),
  ];
  assert.deepEqual(sortRecords(items).map((x) => x.id), ['c', 'b', 'a']);
});

test('الأقدم أولاً — ما أُدخل أولاً يظهر أولاً بالتسلسل', () => {
  const items = [
    r('3', '2026-10-07T12:00:00.000Z'),
    r('1', '2026-10-07T09:00:00.000Z'),
    r('2', '2026-10-07T10:30:00.000Z'),
  ];
  assert.deepEqual(sortRecords(items, 'oldest').map((x) => x.id), ['1', '2', '3']);
});

test('لا يعدّل المصفوفة الأصلية', () => {
  const items = [r('a', '2026-01-01'), r('b', '2026-02-01')];
  const copy = items.map((x) => x.id);
  sortRecords(items);
  assert.deepEqual(items.map((x) => x.id), copy);
});

test('نفس التاريخ: يفصل بينهما وقت الإدخال ثم المعرّف (ترتيب ثابت)', () => {
  const day = '2026-10-07';
  const items = [
    r('z', day, '2026-10-07T11:00:00.000Z'),
    r('x', day, '2026-10-07T09:00:00.000Z'),
    r('y', day, '2026-10-07T09:00:00.000Z'),
  ];
  assert.deepEqual(sortRecords(items, 'oldest').map((x) => x.id), ['x', 'y', 'z']);
  assert.deepEqual(sortRecords(items, 'newest').map((x) => x.id), ['z', 'y', 'x']);
});

test('تاريخ فاسد أو مفقود لا يكسر الترتيب — يذهب للآخر في «الأحدث أولاً»', () => {
  const items = [r('bad', 'not-a-date'), r('ok', '2026-10-07'), { id: 'none' }];
  const out = sortRecords(items as any).map((x: any) => x.id);
  assert.equal(out[0], 'ok');
  assert.equal(compareOldestFirst({ id: 'a' }, { id: 'a' }), 0);
});

test('بعد المزامنة: السجلات الجديدة المحلية لا تُرمى في الآخر', () => {
  const cloud = [r('old1', '2026-10-01T08:00:00.000Z', '2026-10-01T08:00:00.000Z'), r('old2', '2026-10-02T08:00:00.000Z', '2026-10-02T08:00:00.000Z')];
  const local = [r('new', '2026-10-07T08:00:00.000Z', '2026-10-07T08:00:00.000Z'), ...cloud];
  const merged = mergeRecordsWithTombstones(local, cloud).items;
  // الدمج وحده يضع السحابي أولاً (سبب اللخبطة)…
  assert.notEqual(merged[0].id, 'new');
  // …والترتيب يصلحه
  assert.deepEqual(sortRecords(merged).map((x) => x.id), ['new', 'old2', 'old1']);
});

test('الترتيب ثابت — تطبيقه مرتين يعطي نفس النتيجة (لا حلقة مزامنة)', () => {
  const items = [r('a', '2026-10-03'), r('b', '2026-10-01'), r('c', '2026-10-03', '2026-10-03T05:00:00Z')];
  const once = sortRecords(items);
  assert.deepEqual(sortRecords(once).map((x) => x.id), once.map((x) => x.id));
});

test('أدوات الاختيار', () => {
  assert.equal(parseRecordOrder('oldest'), 'oldest');
  assert.equal(parseRecordOrder(null), 'newest');
  assert.equal(parseRecordOrder('garbage'), 'newest');
  assert.equal(toggleRecordOrder('newest'), 'oldest');
  assert.equal(toggleRecordOrder('oldest'), 'newest');
  assert.equal(recordOrderLabel('newest'), 'الأحدث أولاً');
  assert.equal(recordOrderLabel('oldest'), 'الأقدم أولاً');
});
