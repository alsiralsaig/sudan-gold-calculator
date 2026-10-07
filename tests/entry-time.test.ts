import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEntryTime, formatDateWithTime } from '../src/core/format';

// نبني التاريخ بالتوقيت المحلي حتى يعمل الاختبار في أي منطقة زمنية
const local = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m - 1, d, h, min).toISOString();

test('الزمن بنظام 12 ساعة مع ص/م', () => {
  assert.equal(formatEntryTime(local(2026, 10, 7, 9, 5)), '9:05 ص');
  assert.equal(formatEntryTime(local(2026, 10, 7, 15, 45)), '3:45 م');
});

test('منتصف الليل والظهر', () => {
  assert.equal(formatEntryTime(local(2026, 10, 7, 0, 0)), '12:00 ص');
  assert.equal(formatEntryTime(local(2026, 10, 7, 12, 30)), '12:30 م');
  assert.equal(formatEntryTime(local(2026, 10, 7, 23, 59)), '11:59 م');
});

test('تاريخ بلا زمن أو فاسد → لا نخترع زمناً', () => {
  assert.equal(formatEntryTime('2026-10-07'), '');
  assert.equal(formatEntryTime('garbage'), '');
  assert.equal(formatEntryTime(''), '');
  assert.equal(formatEntryTime(undefined), '');
  assert.equal(formatEntryTime(null), '');
});

test('التاريخ مع الزمن للتفاصيل', () => {
  assert.equal(formatDateWithTime(local(2026, 10, 7, 15, 5)), '7/10/2026 — 3:05 م');
  // تاريخ بلا زمن: التاريخ وحده بلا «—»
  assert.ok(!formatDateWithTime('2026-10-07').includes('—'));
});

import { buildSaleInvoiceText } from '../src/core/share';
import { buildSaleInvoice, invoiceText } from '../src/core/invoice';

const sale = {
  id: 's1',
  date: local(2026, 10, 7, 15, 45),
  units: 1000,
  purity: 21,
  buyAmount: 1000000,
  sellAmount: 1200000,
  buyer: 'زبون',
  notes: '',
} as any;

test('رسالة الواتساب فيها الزمن', () => {
  const txt = buildSaleInvoiceText('محل تجربة', sale);
  assert.ok(txt.includes('الساعة 3:45 م'), txt);
});

test('نص الفاتورة فيه التاريخ والزمن', () => {
  const inv = buildSaleInvoice(sale, { storeName: 'محل تجربة', purityLabel: (p: number) => String(p), weightLabel: (u: number) => String(u) } as any);
  assert.ok(invoiceText(inv).includes('7/10/2026 — 3:45 م'));
});
