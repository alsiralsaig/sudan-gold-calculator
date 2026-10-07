import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  amountMatch,
  hitShareText,
  isNumericQuery,
  normalizeArabic,
  phoneMatch,
  searchAll,
  weightMatch,
} from '../src/core/globalSearch';
import { Branch, Expense, Loan, Partner, Purchase, Sale } from '../src/types';

/* ------------------------------ التطبيع ------------------------------ */

test('normalizeArabic: الهمزات والتاء المربوطة والياء والتشكيل', () => {
  assert.equal(normalizeArabic('إبراهيم'), normalizeArabic('ابراهيم'));
  assert.equal(normalizeArabic('أحمد'), normalizeArabic('احمد'));
  assert.equal(normalizeArabic('فاطمة'), normalizeArabic('فاطمه'));
  assert.equal(normalizeArabic('مصطفى'), normalizeArabic('مصطفي'));
  assert.equal(normalizeArabic('مُحَمَّد'), 'محمد', 'التشكيل يُحذف');
  assert.equal(normalizeArabic('عبداللـه'), 'عبدالله', 'التطويل يُحذف');
  assert.equal(normalizeArabic('٥٠٠'), '500', 'الأرقام العربية تُحوَّل');
});

test('isNumericQuery: يميّز الأرقام عن الأسماء', () => {
  assert.equal(isNumericQuery('500'), true);
  assert.equal(isNumericQuery('5.3.2'), true);
  assert.equal(isNumericQuery('٥٠٠'), true);
  assert.equal(isNumericQuery('500,000'), true);
  assert.equal(isNumericQuery('أحمد'), false);
  assert.equal(isNumericQuery(''), false);
});

/* ------------------------------ المبالغ ------------------------------ */

test('amountMatch: «500» تجد 500 و 500,000 و 1,500,500', () => {
  assert.equal(amountMatch(500, '500'), true);
  assert.equal(amountMatch(500000, '500'), true);
  assert.equal(amountMatch(1500500, '500'), true);
  assert.equal(amountMatch(500000, '500000'), true);
  assert.equal(amountMatch(500000, '٥٠٠٠٠٠'), true, 'أرقام عربية');
  assert.equal(amountMatch(250000, '800'), false);
  assert.equal(amountMatch(0, '500'), false);
});

test('amountMatch: الفواصل في الاستعلام لا تعطّل البحث', () => {
  assert.equal(amountMatch(500000, '500,000'), true);
  assert.equal(amountMatch(500000, '500000'), true);
});

/* ------------------------------ الأوزان ------------------------------ */

test('weightMatch: صيغة ج.ح.ز كاملة — 5 جرام و3 حبة و2 جزء', () => {
  const units = 5 * 100 + 3 * 10 + 2; // 532
  assert.equal(weightMatch(units, '5.3.2'), true);
  assert.equal(weightMatch(units, '5.3'), true, 'جرام وحبة');
  assert.equal(weightMatch(units, '5'), true, 'جرام فقط');
  assert.equal(weightMatch(units, '5.3.1'), false, 'جزء مختلف');
  assert.equal(weightMatch(units, '6'), false);
});

test('weightMatch: البحث بالجرام العشري', () => {
  assert.equal(weightMatch(550, '5.5'), true, '550 جزء = 5.5 جرام');
  assert.equal(weightMatch(550, '5.50'), true);
  assert.equal(weightMatch(1000, '10'), true, '10 جرام');
  assert.equal(weightMatch(1005, '10'), true, '10.05 جرام يبدأ بـ 10');
});

test('weightMatch: وزن بلا قيمة أو استعلام غير رقمي', () => {
  assert.equal(weightMatch(0, '5'), false);
  assert.equal(weightMatch(500, 'أحمد'), false);
});

/* ------------------------------ الهواتف ------------------------------ */

test('phoneMatch: 3 أرقام تكفي، والفاصل لا يهم', () => {
  assert.equal(phoneMatch('0912345678', '1234'), true);
  assert.equal(phoneMatch('+249 91 234 5678', '91234'), true, 'المسافات تُتجاهل');
  assert.equal(phoneMatch('0912345678', '777'), false);
  assert.equal(phoneMatch('0912345678', '12'), false, 'أقل من 3 أرقام لا تُطابق');
  assert.equal(phoneMatch('', '123'), false);
});

/* ------------------------------ البحث الشامل ------------------------------ */

const purchase = (over: Partial<Purchase> = {}): Purchase => ({
  id: 'pu1',
  date: '2026-10-01T10:00:00.000Z',
  units: 532,
  purity: 21,
  amount: 550000,
  pendingAmount: 0,
  seller: 'إبراهيم محمد',
  sellerPhone: '0912345678',
  bankAccount: 'بنك الخرطوم',
  notes: 'كسر ذهب قديم',
  payments: [],
  invoiceNo: 'KH1-0001',
  ...over,
});

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 'sa1',
  date: '2026-10-02T10:00:00.000Z',
  units: 1000,
  purity: 21,
  buyAmount: 900000,
  sellAmount: 1050000,
  buyer: 'أحمد الصائغ',
  buyerPhone: '0999888777',
  notes: 'بيع مشغولات',
  payments: [],
  ...over,
});

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'ex1',
  date: '2026-10-03T10:00:00.000Z',
  amount: 25000,
  category: 'مسحوبات شريك',
  target: 'أحمد الصائغ',
  name: 'عشاء',
  notes: '',
  ...over,
});

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'lo1',
  date: '2026-10-04T10:00:00.000Z',
  person: 'عثمان الطيب',
  phone: '0123456789',
  amount: 300000,
  direction: 'lent',
  payments: [{ id: 'p1', date: '2026-10-05T10:00:00.000Z', amount: 100000, note: '' }],
  notes: 'سلفة نقدية',
  ...over,
});

const partner = (over: Partial<Partner> = {}): Partner => ({
  id: 'pa1',
  name: 'تاج السر',
  capital: 5000000,
  profitPercent: 40,
  phone: '0911111111',
  notes: 'شريك مؤسس',
  ...over,
});

const branch = (over: Partial<Branch> = {}): Branch => ({
  id: 'br1',
  name: 'فرع الخرطوم',
  code: 'KH1',
  phone: '0155555555',
  address: 'سوق الذهب',
  ...over,
});

const DATA = {
  purchases: [purchase()],
  sales: [sale()],
  expenses: [expense()],
  loans: [loan()],
  partners: [partner()],
  branches: [branch()],
};

test('searchAll: يجد الاسم في كل الأنواع (مبيعات + مصروفات)', () => {
  const r = searchAll(DATA, 'أحمد');
  assert.equal(r.total, 2, 'بيع لأحمد + مسحوبات أحمد');
  assert.deepEqual(r.hits.map((h) => h.kind).sort(), ['expense', 'sale']);
  assert.ok(r.hits.every((h) => h.matched.some((m) => m.includes('اسم') || m === 'الشريك')));
});

test('searchAll: الهمزات لا تفرق — «ابراهيم» يجد «إبراهيم»', () => {
  const r = searchAll(DATA, 'ابراهيم');
  assert.equal(r.total, 1);
  assert.equal(r.hits[0].kind, 'purchase');
  assert.equal(r.hits[0].title, 'إبراهيم محمد');
  assert.ok(r.hits[0].matched.includes('اسم البائع'));
});

test('searchAll: المبلغ يجد السجلات بجزء الرقم', () => {
  const r = searchAll(DATA, '1050000');
  assert.equal(r.total, 1);
  assert.equal(r.hits[0].kind, 'sale');
  assert.ok(r.hits[0].matched.includes('مبلغ البيع'));

  const partial = searchAll(DATA, '250');
  assert.ok(partial.hits.some((h) => h.kind === 'expense'), '250 يجد 25,000');
});

test('searchAll: الوزن بصيغة ج.ح.ز يجد فاتورة الشراء (5.3.2)', () => {
  const r = searchAll(DATA, '5.3.2');
  assert.equal(r.total, 1);
  assert.equal(r.hits[0].kind, 'purchase');
  assert.ok(r.hits[0].matched.includes('الوزن'));
  assert.equal(r.hits[0].units, 532);
});

test('searchAll: الوزن بالجرام (10) يجد فاتورة البيع', () => {
  const r = searchAll(DATA, '10');
  assert.ok(r.hits.some((h) => h.kind === 'sale' && h.matched.includes('الوزن')), '10 جرام في البيع');
});

test('searchAll: رقم الهاتف يجد الزبون والمورد', () => {
  const r = searchAll(DATA, '09123');
  assert.equal(r.total, 1);
  assert.equal(r.hits[0].kind, 'purchase');
  assert.ok(r.hits[0].matched.includes('هاتف البائع'));

  const buyer = searchAll(DATA, '999888');
  assert.equal(buyer.hits[0].kind, 'sale');
  assert.ok(buyer.hits[0].matched.includes('هاتف الزبون'));
});

test('searchAll: رقم الفاتورة يعمل', () => {
  const r = searchAll(DATA, 'KH1-0001');
  assert.equal(r.total, 1);
  assert.ok(r.hits[0].matched.includes('رقم الفاتورة'));
  assert.ok(r.hits[0].score >= 75);
});

test('searchAll: الملاحظات تُبحث أيضاً', () => {
  const r = searchAll(DATA, 'مشغولات');
  assert.equal(r.total, 1);
  assert.equal(r.hits[0].kind, 'sale');
  assert.ok(r.hits[0].matched.includes('ملاحظات'));

  const bank = searchAll(DATA, 'بنك الخرطوم');
  assert.equal(bank.hits[0].kind, 'purchase');
});

test('searchAll: السلف — الاسم والدفعة والمتبقي', () => {
  const byName = searchAll(DATA, 'عثمان');
  assert.equal(byName.hits[0].kind, 'loan');
  assert.match(byName.hits[0].subtitle, /سلفة لنا عليه/);
  assert.match(byName.hits[0].subtitle, /200,000/, 'المتبقي = 300,000 − 100,000');

  const byPayment = searchAll(DATA, '100000');
  assert.ok(byPayment.hits.some((h) => h.kind === 'loan' && h.matched.includes('دفعة سداد')));
});

test('searchAll: الشركاء والفروع (الرمز أيضاً)', () => {
  assert.equal(searchAll(DATA, 'تاج السر').hits[0].kind, 'partner');
  const codeQuery = searchAll(DATA, 'KH1');
  assert.equal(codeQuery.hits[0].kind, 'branch', 'مطابقة رمز الفرع الدقيقة أولاً');
  assert.ok(codeQuery.hits[0].matched.includes('رمز الفرع'));
  assert.ok(codeQuery.hits.some((h) => h.kind === 'purchase'), 'وفاتورة KH1-0001 تظهر أيضاً');
  const byCapital = searchAll(DATA, '5000000');
  assert.ok(byCapital.hits.some((h) => h.kind === 'partner' && h.matched.includes('رأس المال')));
});

test('searchAll: الترتيب — الاسم المطابق تماماً أولاً، ثم الأحدث', () => {
  const data = {
    sales: [
      sale({ id: 's1', buyer: 'محمد', date: '2026-10-01T00:00:00.000Z' }),
      sale({ id: 's2', buyer: 'محمد', date: '2026-10-05T00:00:00.000Z' }),
      sale({ id: 's3', buyer: 'محمد الأمين', date: '2026-10-06T00:00:00.000Z' }),
    ],
  };
  const r = searchAll(data, 'محمد');
  assert.equal(r.total, 3);
  // المطابق تماماً (score 100) يتقدمان على «محمد الأمين» (score 80)
  assert.equal(r.hits[2].title, 'محمد الأمين');
  // وبين المطابقين تماماً: الأحدث أولاً
  assert.equal(r.hits[0].id, 's2');
});

test('searchAll: يتجاهل النتائج بلا تطابق ويعطي أصفاراً', () => {
  const r = searchAll(DATA, 'زينب');
  assert.equal(r.total, 0);
  assert.equal(r.hits.length, 0);
  assert.equal(r.counts.sale, 0);
});

test('searchAll: استعلام فارغ لا يُرجع شيئاً', () => {
  const r = searchAll(DATA, '   ');
  assert.equal(r.total, 0);
  assert.equal(r.truncated, false);
});

test('searchAll: العدّادات لكل نوع والنتائج المؤرشفة تُعلَّم', () => {
  const data = {
    ...DATA,
    sales: [sale(), sale({ id: 'sa2', archived: true, buyer: 'أحمد الصائغ' })],
  };
  const r = searchAll(data, 'أحمد');
  assert.equal(r.counts.sale, 2, 'المؤرشف يظهر أيضاً');
  assert.ok(r.hits.some((h) => h.archived), 'مع علامة أرشيف');
  assert.equal(r.counts.expense, 1);
});

test('searchAll: كلمتان معاً (AND) — «أحمد الصائغ»', () => {
  const r = searchAll(DATA, 'أحمد الصائغ');
  assert.equal(r.total, 2, 'البيع والمصروف كلاهما باسم أحمد الصائغ');
  const partial = searchAll(DATA, 'أحمد الطيب');
  assert.equal(partial.total, 0, 'لا يوجد من يجمع الاسمين');
});

test('searchAll: حد النتائج يُعلَّم (truncated)', () => {
  const many = {
    sales: Array.from({ length: 12 }, (_, i) => sale({ id: `s${i}`, buyer: 'محمد' })),
  };
  const r = searchAll(many, 'محمد', 5);
  assert.equal(r.hits.length, 5);
  assert.equal(r.total, 12);
  assert.equal(r.truncated, true);
});

test('hitShareText: نص عربي فيه المبلغ والوزن', () => {
  const hit = searchAll(DATA, 'KH1-0001').hits[0];
  const text = hitShareText('مجوهرات الذهب', hit);
  assert.match(text, /مشتريات/);
  assert.match(text, /إبراهيم محمد/);
  assert.match(text, /550,000 ج\.س/);
  assert.match(text, /5\.3\.2 ج\.ح\.ز/);
});
