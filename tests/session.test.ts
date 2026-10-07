import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countRecords,
  totalRecords,
  isEmptyDb,
  isAccountSwitch,
  snapshotDateLabel,
  describeSnapshot,
  SessionSnapshotMeta,
} from '../src/core/session';

test('countRecords يعدّ كل الأنواع ويتجاهل غير المصفوفات', () => {
  const c = countRecords({
    purchases: [1, 2, 3],
    sales: [1],
    expenses: [1, 2],
    partners: [1, 2, 3, 4],
    loans: [1],
    branches: [1],
  });
  assert.deepEqual(c, { purchases: 3, sales: 1, expenses: 2, partners: 4, loans: 1, branches: 1 });
  assert.deepEqual(countRecords({}), { purchases: 0, sales: 0, expenses: 0, partners: 0, loans: 0, branches: 0 });
  assert.deepEqual(countRecords({ purchases: 'x' } as any).purchases, 0);
});

test('totalRecords يستثني الفروع (إعداد لا سجل)', () => {
  assert.equal(totalRecords({ purchases: [1, 2], branches: [1, 2, 3] }), 2);
  assert.equal(isEmptyDb({}), true);
  assert.equal(isEmptyDb({ branches: [1] }), true);
  assert.equal(isEmptyDb({ sales: [1] }), false);
});

test('isAccountSwitch: فقط عند وجود حساب سابق وبريد مختلف', () => {
  // أول حساب على الجهاز → ليس تبديلاً
  assert.equal(isAccountSwitch('', 'a@b.com'), false);
  assert.equal(isAccountSwitch(null, 'a@b.com'), false);
  // نفس الحساب (مع اختلاف حالة الأحرف والفراغات) → ليس تبديلاً
  assert.equal(isAccountSwitch('Omar@Gmail.com', ' omar@gmail.com '), false);
  // حساب مختلف → تبديل
  assert.equal(isAccountSwitch('omar@gmail.com', 'ali@gmail.com'), true);
  // بلا بريد جديد → لا شيء
  assert.equal(isAccountSwitch('omar@gmail.com', ''), false);
});

test('snapshotDateLabel يعطي تاريخاً مقروءاً', () => {
  const label = snapshotDateLabel('2026-10-07T14:47:00Z');
  assert.match(label, /^7\/10\/2026 \d{2}:\d{2}$/);
  assert.equal(snapshotDateLabel('غير صالح'), '');
});

test('describeSnapshot يلخّص اللقطة للعرض', () => {
  const meta: SessionSnapshotMeta = {
    email: 'omarfaroq692@gmail.com',
    storeName: 'محلات أبو أحمد',
    at: '2026-10-07T14:47:00Z',
    counts: { purchases: 115, sales: 2, expenses: 88, partners: 2, loans: 9, branches: 1 },
  };
  const { title, breakdown } = describeSnapshot(meta);
  assert.match(title, /^216 سجل • 7\/10\/2026 \d{2}:\d{2} • omarfaroq692@gmail\.com$/);
  assert.match(breakdown, /مشتريات 115/);
  assert.match(breakdown, /مبيعات 2/);
  assert.match(breakdown, /مصروفات 88/);
  assert.match(breakdown, /سلف 9/);
  assert.match(breakdown, /شركاء 2/);
});
