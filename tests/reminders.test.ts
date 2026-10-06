import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDues, statusOf, suggestedDueDate } from '../src/core/reminders';
import {
  normalizePhone,
  whatsappUrl,
  buildInvoiceText,
  buildReminderText,
  buildReportText,
} from '../src/core/share';
import { daysBetween, relativeDays, toDateInputValue, arabicDate } from '../src/core/dates';
import type { Purchase, Sale } from '../src/types';

const sale = (over: Partial<Sale>): Sale => ({
  id: 's1',
  date: '2026-09-01T10:00:00.000Z',
  units: 1000,
  purity: 21,
  buyAmount: 900_000,
  sellAmount: 1_000_000,
  buyer: 'محمد أحمد',
  notes: '',
  ...over,
});

const purchase = (over: Partial<Purchase>): Purchase => ({
  id: 'p1',
  date: '2026-09-01T10:00:00.000Z',
  units: 1000,
  purity: 21,
  amount: 900_000,
  pendingAmount: 0,
  seller: 'بائع الذهب',
  bankAccount: '',
  notes: '',
  payments: [],
  ...over,
});

/* --------------------------------- المتأخرات -------------------------------- */

test('statusOf: يصنف الحالة حسب عدد الأيام', () => {
  assert.equal(statusOf(3, true), 'overdue');
  assert.equal(statusOf(0, true), 'today');
  assert.equal(statusOf(-2, true), 'soon');
  assert.equal(statusOf(-30, true), 'later');
  assert.equal(statusOf(5, false), 'nodate');
});

test('computeDues: يستخرج ذمم الزبائن والموردين غير المسددة', () => {
  const today = new Date('2026-10-06T12:00:00.000Z');
  const dues = computeDues(
    [
      sale({ id: 's1', pendingAmount: 400_000, dueDate: '2026-10-01' }), // متأخر 5 أيام
      sale({ id: 's2', pendingAmount: 0 }), // مسدد — يُستثنى
      sale({ id: 's3', pendingAmount: 250_000, dueDate: '2026-10-06' }), // يستحق اليوم
    ],
    [purchase({ id: 'p1', pendingAmount: 300_000, dueDate: '2026-10-03' })],
    today
  );

  assert.equal(dues.items.length, 3);
  assert.equal(dues.overdue.length, 2);
  assert.equal(dues.dueToday.length, 1);
  assert.equal(dues.receivablesTotal, 650_000);
  assert.equal(dues.payablesTotal, 300_000);
  assert.equal(dues.overdueTotal, 700_000);
});

test('computeDues: الأكثر تأخراً يأتي أولاً', () => {
  const today = new Date('2026-10-06T12:00:00.000Z');
  const dues = computeDues(
    [
      sale({ id: 'a', pendingAmount: 100, dueDate: '2026-10-05' }),
      sale({ id: 'b', pendingAmount: 100, dueDate: '2026-09-01' }),
    ],
    [],
    today
  );
  assert.equal(dues.items[0].id, 'b');
  assert.equal(dues.items[0].daysOverdue, 35);
});

test('computeDues: يتجاهل المؤرشف', () => {
  const dues = computeDues([sale({ archived: true, pendingAmount: 500 })], []);
  assert.equal(dues.items.length, 0);
});

test('computeDues: الديون بلا تاريخ استحقاق تُفصل في قائمة', () => {
  const dues = computeDues([sale({ pendingAmount: 500 })], [], new Date('2026-10-06'));
  assert.equal(dues.withoutDate.length, 1);
  assert.equal(dues.overdue.length, 0);
});

/* ---------------------------------- الهاتف --------------------------------- */

test('normalizePhone: يحوّل الأرقام السودانية للصيغة الدولية', () => {
  assert.equal(normalizePhone('0912345678'), '249912345678');
  assert.equal(normalizePhone('+249 91 234 5678'), '249912345678');
  assert.equal(normalizePhone('٠٩١٢٣٤٥٦٧٨'), '249912345678');
  assert.equal(normalizePhone('912345678'), '249912345678');
  assert.equal(normalizePhone('249912345678'), '249912345678');
  assert.equal(normalizePhone(''), '');
});

test('whatsappUrl: يستخدم رقم الطرف عند توفره وإلا نافذة اختيار جهة الاتصال', () => {
  const withPhone = whatsappUrl('0912345678', 'مرحبا');
  assert.ok(withPhone.startsWith('https://wa.me/249912345678?text='));
  const without = whatsappUrl(undefined, 'مرحبا');
  assert.ok(without.startsWith('https://wa.me/?text='));
  assert.ok(withPhone.includes(encodeURIComponent('مرحبا')));
});

/* -------------------------------- نصوص المشاركة -------------------------------- */

test('buildInvoiceText: يحتوي كل بيانات الفاتورة والمتبقي', () => {
  const text = buildInvoiceText({
    storeName: 'مجوهرات النيل',
    kind: 'sale',
    date: '2026-10-06T10:00:00.000Z',
    units: 1050,
    purity: 21,
    pricePerGram: 1_000_000,
    amount: 10_500_000,
    paid: 8_000_000,
    pending: 2_500_000,
    dueDate: '2026-11-05',
  });

  assert.match(text, /مجوهرات النيل/);
  assert.match(text, /فاتورة بيع ذهب/);
  assert.match(text, /10\.5\.0/); // الوزن بنظام جرام.حبة.جزء (10 جرام و5 حبة)
  assert.match(text, /العيار: 21k/);
  assert.match(text, /المتبقي: 2,500,000/);
  assert.match(text, /05 نوفمبر 2026|5 نوفمبر 2026/);
});

test('buildReminderText: يفرّق بين التذكير لنا والتذكير علينا', () => {
  const receivable = buildReminderText({
    storeName: 'المتجر',
    party: 'علي',
    amount: 500_000,
    dueDate: '2026-10-01',
    daysOverdue: 5,
    kind: 'receivable',
  });
  assert.match(receivable, /تذكير بسداد متبقي/);
  assert.match(receivable, /قبل 5 يوماً/);
  assert.match(receivable, /نرجو التكرم بالسداد/);

  const payable = buildReminderText({
    storeName: 'المتجر',
    party: 'مورد',
    amount: 1000,
    kind: 'payable',
  });
  assert.match(payable, /مستحق عليكم/);
});

test('buildReportText: يلخّص تقرير اليوم', () => {
  const text = buildReportText({
    storeName: 'المتجر',
    dateLabel: 'تقرير يوم 6/10/2026',
    salesCount: 3,
    salesAmount: 30_000_000,
    salesUnits: 3000,
    profit: 3_000_000,
    expenses: 500_000,
    net: 2_500_000,
    collected: 20_000_000,
    credit: 10_000_000,
    stockGramsK21: 132.86,
    price21: 1_008_772,
  });
  assert.match(text, /تقرير يوم/);
  assert.match(text, /عدد عمليات البيع: 3/);
  assert.match(text, /الصافي: 2,500,000/);
  assert.match(text, /132\.86 جرام/);
});

/* --------------------------------- التواريخ --------------------------------- */

test('daysBetween: يحسب الفرق بالاتجاه الصحيح', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-06'), 5);
  assert.equal(daysBetween('2026-10-06', '2026-10-01'), -5);
  assert.equal(daysBetween('2026-10-06T23:00:00', '2026-10-07T01:00:00'), 1);
});

test('relativeDays: صياغة عربية صحيحة', () => {
  assert.equal(relativeDays(0), 'اليوم');
  assert.equal(relativeDays(1), 'غداً');
  assert.equal(relativeDays(-1), 'أمس');
  assert.equal(relativeDays(-3), 'قبل 3 يوماً');
});

test('toDateInputValue: صيغة input[type=date]', () => {
  assert.equal(toDateInputValue(new Date(2026, 9, 6)), '2026-10-06');
});

test('suggestedDueDate: بعد 30 يوماً', () => {
  const base = new Date(2026, 9, 6);
  assert.equal(suggestedDueDate(base), '2026-11-05');
});

test('arabicDate: تاريخ عربي مقروء', () => {
  assert.equal(arabicDate('2026-10-06T10:00:00.000Z'), '6 أكتوبر 2026');
});
