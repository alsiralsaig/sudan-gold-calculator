import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExportTable, buildCsv, EXPORT_COLUMNS, exportFileName } from '../src/core/dataExport';
import { Branch, Expense, Loan, Purchase, Sale } from '../src/types';

const purchase = (over: Partial<Purchase> = {}): Purchase =>
  ({
    id: 'p1',
    date: '2026-10-01T08:00:00Z',
    seller: 'بائع أول',
    amount: 1_000_000,
    pendingAmount: 400_000,
    units: 530,
    purity: 875,
    notes: '',
    ...over,
  } as Purchase);

const sale = (over: Partial<Sale> = {}): Sale =>
  ({
    id: 's1',
    date: '2026-10-02T08:00:00Z',
    buyer: 'زبون أول',
    sellAmount: 500_000,
    buyAmount: 450_000,
    units: 200,
    purity: 875,
    payments: [],
    notes: '',
    ...over,
  } as Sale);

const expense = (over: Partial<Expense> = {}): Expense =>
  ({
    id: 'e1',
    date: '2026-10-03T08:00:00Z',
    amount: 50_000,
    category: 'إيجار',
    target: 'عام',
    name: 'إيجار المحل',
    notes: '',
    ...over,
  } as Expense);

const loan = (over: Partial<Loan> = {}): Loan =>
  ({
    id: 'l1',
    date: '2026-10-04T08:00:00Z',
    person: 'عثمان',
    amount: 300_000,
    direction: 'lent',
    payments: [],
    notes: '',
    ...over,
  } as Loan);

const branches: Branch[] = [{ id: 'b1', name: 'فرع السوق', code: 'KH1' } as Branch];

test('الترتيب: الأقسام ثابتة (مشتريات → مبيعات → مصروفات → سلف) وداخل كل قسم الأحدث أولاً', () => {
  const rows = buildExportTable({
    storeName: 'محلات أبو أحمد',
    exportedAt: new Date('2026-10-07T12:00:00Z'),
    branches,
    purchases: [
      purchase({ id: 'p-old', date: '2026-09-01T08:00:00Z' }),
      purchase({ id: 'p-new', date: '2026-10-06T08:00:00Z' }),
    ],
    sales: [sale({ date: '2026-10-02T08:00:00Z' })],
    expenses: [expense({})],
    loans: [loan({})],
  });

  const types = rows.map((r) => r[0]);
  // رأس التصدير ثم الأعمدة
  assert.match(types[0], /محلات أبو أحمد — تصدير البيانات/);
  assert.deepEqual(rows.find((r) => r[0] === 'النوع'), EXPORT_COLUMNS);

  const dataTypes = rows.filter((r) =>
    ['شراء', 'بيع', 'مصروف', 'سلفة لنا', 'سلفة علينا'].includes(r[0])
  );
  assert.deepEqual(
    dataTypes.map((r) => r[0]),
    ['شراء', 'شراء', 'بيع', 'مصروف', 'سلفة لنا']
  );
  // داخل المشتريات: الأحدث (2026-10-06) قبل الأقدم (2026-09-01)
  const purchaseDates = dataTypes.filter((r) => r[0] === 'شراء').map((r) => r[1]);
  assert.deepEqual(purchaseDates, ['2026-10-06', '2026-09-01']);
});

test('كل الصفوف بنفس عدد الأعمدة (لا يختلّ Excel)', () => {
  const rows = buildExportTable({
    storeName: 'محلات أبو أحمد',
    branches,
    purchases: [purchase({}), purchase({ id: 'p2', date: '2026-10-05T08:00:00Z' })],
    sales: [sale({})],
    expenses: [expense({})],
    loans: [loan({}), loan({ id: 'l2', direction: 'borrowed', date: '2026-10-05T08:00:00Z' })],
  });
  rows.forEach((r, i) => assert.equal(r.length, EXPORT_COLUMNS.length, `صف ${i}`));
});

test('مجاميع كل قسم صحيحة (المبلغ/المسدد/المتبقي/العدد)', () => {
  const rows = buildExportTable({
    storeName: 'محلات أبو أحمد',
    branches,
    purchases: [
      purchase({ id: 'p1', amount: 1_000_000, pendingAmount: 400_000 }),
      purchase({ id: 'p2', amount: 500_000, pendingAmount: 0, date: '2026-09-20T08:00:00Z' }),
    ],
    sales: [sale({ sellAmount: 500_000, pendingAmount: 500_000 })],
    expenses: [expense({ amount: 50_000 })],
    loans: [loan({ amount: 300_000, payments: [{ id: 'x', date: '2026-10-05T00:00:00Z', amount: 100_000, note: '' }] })],
  });

  const find = (label: string) => rows.find((r) => r[0] === label)!;
  const purchases = find('إجمالي مشتريات (2)');
  assert.equal(purchases[7], '1500000'); // المبلغ
  assert.equal(purchases[8], '1100000'); // المسدد
  assert.equal(purchases[9], '400000'); // المتبقي

  const sales = find('إجمالي مبيعات (1)');
  assert.equal(sales[7], '500000');
  assert.equal(sales[8], '0'); // لم يُسدَّد شيء
  assert.equal(sales[9], '500000'); // المتبقي على الزبون

  const expenses = find('إجمالي مصروفات (1)');
  assert.equal(expenses[7], '50000');
  assert.equal(expenses[9], ''); // المصروف لا متبقي له

  const loans = find('إجمالي سلف (1)');
  assert.equal(loans[7], '300000');
  assert.equal(loans[8], '100000'); // المسدد
  assert.equal(loans[9], '200000'); // المتبقي
});

test('صفوف البيانات تحمل الفرع والفاتورة والوزن والجرام والاتجاه', () => {
  const rows = buildExportTable({
    storeName: 'محلات أبو أحمد',
    branches,
    purchases: [purchase({ invoiceNo: 'KH1-0007', branchId: 'b1', units: 530 })],
    loans: [loan({ direction: 'borrowed', dueDate: '2026-10-20T00:00:00Z' })],
  });
  const p = rows.find((r) => r[0] === 'شراء')!;
  assert.equal(p[2], 'فرع السوق');
  assert.equal(p[3], 'KH1-0007');
  assert.equal(p[4], '5.3.0'); // ج.ح.ز
  assert.equal(p[5], '5.30'); // جرام
  const l = rows.find((r) => r[0] === 'سلفة علينا')!;
  assert.match(l[11], /الاستحقاق: 2026-10-20/);
});

test('السجل بلا فرع يُكتب «بدون فرع» لا «كل الفروع»', () => {
  const rows = buildExportTable({
    storeName: 'محلات أبو أحمد',
    branches,
    purchases: [purchase({ branchId: undefined })],
  });
  const p = rows.find((r) => r[0] === 'شراء')!;
  assert.equal(p[2], 'بدون فرع');
});

test('CSV: BOM عربي + تهريب علامات الاقتباس + أسطر CRLF', () => {
  const rows = buildExportTable({
    storeName: 'محلات أبو أحمد',
    branches,
    purchases: [purchase({ notes: 'دفعة "خاصة" من البنك' })],
  });
  const csv = buildCsv(rows);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"دفعة ""خاصة"" من البنك"/);
  assert.ok(csv.includes('\r\n'));
  // الفواصل داخل الملاحظات لا تكسر الأعمدة
  const rows2 = buildExportTable({
    storeName: 'محلات أبو أحمد',
    branches,
    expenses: [expense({ notes: 'كهرباء، ماء، نت' })],
  });
  const csv2 = buildCsv(rows2);
  const eLine = csv2.split('\r\n').find((l) => l.includes('"مصروف"'))!;
  assert.equal(eLine.split(',').length, EXPORT_COLUMNS.length);
});

test('اسم الملف يحتوي التاريخ بصيغة مرتبة', () => {
  assert.equal(exportFileName(new Date('2026-10-07T12:00:00Z')), 'Gold_Export_2026-10-07.csv');
});

test('التصدير دون بيانات لا ينكسر: ترويسة وأعمدة ومجاميع صفرية', () => {
  const rows = buildExportTable({ storeName: 'محلات أبو أحمد' });
  assert.deepEqual(rows.find((r) => r[0] === 'النوع'), EXPORT_COLUMNS);
  assert.ok(rows.find((r) => r[0] === 'إجمالي مشتريات (0)'));
  assert.ok(rows.find((r) => r[0] === 'إجمالي سلف (0)'));
});
