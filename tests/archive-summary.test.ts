import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  archiveSearchText,
  archiveTotals,
  describeArchiveItem,
  describeExpense,
  describeLoan,
  describePartner,
  describePurchase,
  describeSale,
  expenseBearers,
} from '../src/core/archiveSummary';
import { Expense, Loan, Partner, Purchase, Sale } from '../src/types';

const branchCtx = { branches: [{ id: 'br1', name: 'الخرطوم' }] };

const generalExpense: Expense = {
  id: 'e1',
  date: '2026-10-27T01:07:00.000Z',
  amount: 5_062_000,
  category: 'منصرفات عامة',
  target: 'عام',
  partnerNames: ['السر الصائغ', 'أحمد تاجو'],
  name: 'إيجار المحل',
  notes: 'إيجار شهر أكتوبر',
  branchId: 'br1',
  archived: true,
  updatedAt: '2026-10-27T01:09:00.000Z',
};

const privateExpense: Expense = {
  id: 'e2',
  date: '2026-10-27T01:08:00.000Z',
  amount: 8_685_500,
  category: 'مسحوبات شريك',
  target: 'السر الصائغ',
  name: 'سحب شخصي',
  notes: '',
  archived: true,
};

test('المصروف المؤرشف يظهر ببيانه واسمه — مش رقم مجهول', () => {
  const v = describeExpense(privateExpense);
  assert.equal(v.title, 'سحب شخصي', 'البيان هو العنوان');
  assert.equal(v.badge.text, 'خاص: السر الصائغ');
  assert.equal(v.amount, '8,685,500 ج.س');
  const onPartner = v.fields.find((f) => f.label === 'على الشريك');
  assert.equal(onPartner?.value, 'السر الصائغ', 'اسم الشريك ظاهر صريح');
  assert.equal(v.badge.text, 'خاص: السر الصائغ', 'الشارة تحمل اسم الشريك');
  assert.match(v.subtitle, /خاص — السر الصائغ/, 'سطر النوع صريح: خاص + الاسم');
});

test('المصروف العام المؤرشف يوضّح من يتحمّله', () => {
  const v = describeExpense(generalExpense, branchCtx);
  assert.equal(v.title, 'إيجار المحل');
  assert.equal(v.badge.text, 'عام');
  const bearer = v.fields.find((f) => f.label === 'يتحمّله');
  assert.equal(bearer?.value, 'السر الصائغ، أحمد تاجو');
  assert.match(v.subtitle, /عام \(على المحل\)/, 'عام مكتوب صريح في السطر');
  assert.equal(v.fields.find((f) => f.label === 'النوع')?.value, 'منصرف عام');
  assert.equal(v.fields.find((f) => f.label === 'الفرع')?.value, 'الخرطوم');
  assert.match(v.note || '', /حُسب مرة واحدة/);
});

test('مصروف عام بلا شركاء محددين = كل الشركاء بنسب الربح', () => {
  assert.equal(expenseBearers({ ...generalExpense, partnerNames: [] }), 'كل الشركاء بنسب الربح');
  assert.equal(expenseBearers({ ...generalExpense, partnerNames: undefined }), 'كل الشركاء بنسب الربح');
});

test('مصروف بلا بيان لا يظهر كسطر أرقام — يظهر «بدون بيان»', () => {
  const v = describeExpense({ ...privateExpense, name: '   ' });
  assert.equal(v.title, 'بدون بيان');
  assert.ok(v.amount.includes('8,685,500'));
});

test('الشراء المؤرشف: اسم المورد + العيار + الوزن + المتبقي', () => {
  const purchase: Purchase = {
    id: 'p1',
    date: '2026-10-20T10:00:00.000Z',
    units: 1_500,
    purity: 21,
    amount: 3_848_000,
    pendingAmount: 848_000,
    seller: 'مورد الخرطوم',
    bankAccount: '',
    notes: '',
    payments: [],
    branchId: 'br1',
    archived: true,
  };
  const v = describePurchase(purchase, branchCtx);
  assert.equal(v.title, 'مورد الخرطوم');
  assert.equal(v.badge.text, 'عليه متبقي');
  assert.ok(v.fields.some((f) => f.label === 'العيار' && f.value === 'عيار 21'));
  assert.ok(v.fields.some((f) => f.label === 'المتبقي للمورد' && f.value === '848,000 ج.س'));
  assert.ok(v.fields.some((f) => f.label === 'الفرع' && f.value === 'الخرطوم'));
});

test('البيع المؤرشف: اسم الزبون + المحصَّل + المتبقي + الربح', () => {
  const sale: Sale = {
    id: 's1',
    date: '2026-10-21T10:00:00.000Z',
    units: 500,
    purity: 21,
    buyAmount: 1_000_000,
    sellAmount: 1_200_000,
    buyer: 'زبون السوق',
    notes: '',
    pendingAmount: 200_000,
    archived: true,
  };
  const v = describeSale(sale);
  assert.equal(v.title, 'زبون السوق');
  assert.ok(v.fields.some((f) => f.label === 'المحصَّل' && f.value === '1,000,000 ج.س'));
  assert.ok(v.fields.some((f) => f.label === 'المتبقي على الزبون' && f.value === '200,000 ج.س'));
  assert.ok(v.fields.some((f) => f.label === 'ربح العملية' && f.value === '200,000 ج.س'));
});

test('السلفة المؤرشفة: اسم الشخص + المسدَّد + المتبقي', () => {
  const loan: Loan = {
    id: 'l1',
    date: '2026-10-01T10:00:00.000Z',
    person: 'محمد الأمين',
    amount: 500_000,
    direction: 'lent',
    payments: [{ id: 'pay1', date: '2026-10-05T10:00:00.000Z', amount: 500_000, note: '' }],
    archived: true,
  };
  const v = describeLoan(loan);
  assert.equal(v.title, 'محمد الأمين');
  assert.equal(v.badge.text, 'سلفة لنا');
  assert.ok(v.fields.some((f) => f.label === 'المسدَّد' && f.value === '500,000 ج.س'));
  assert.match(v.note || '', /مكتملة السداد/);
});

test('الشريك المؤرشف يظهر بنسبته ورأس ماله', () => {
  const partner: Partner = { id: 'pt1', name: 'شريك قديم', capital: 2_000_000, profitPercent: 25, phone: '', notes: '', archived: true };
  const v = describePartner(partner);
  assert.equal(v.title, 'شريك قديم');
  assert.ok(v.fields.some((f) => f.label === 'نسبة الربح' && f.value === '25%'));
});

test('التوجيه حسب التبويب يرجع نفس النتيجة', () => {
  assert.equal(describeArchiveItem('expense', privateExpense).title, 'سحب شخصي');
  assert.equal(describeArchiveItem('expense', generalExpense).title, 'إيجار المحل');
});

test('البحث في الأرشيف يلاقي المصروف ببيانه وباسم الشريك', () => {
  const text = archiveSearchText('expense', generalExpense, branchCtx);
  assert.match(text, /إيجار المحل/);
  assert.match(text, /السر الصائغ/);
  assert.match(text, /الخرطوم/);
});

test('إجماليات الأرشيف: المبلغ والعدد والوزن', () => {
  const t = archiveTotals('expense', [generalExpense, privateExpense]);
  assert.equal(t.count, 2);
  assert.equal(t.amount, 13_747_500);
  assert.equal(t.units, 0);

  const saleTotals = archiveTotals('sale', [{ id: 's', units: 250, sellAmount: 100 } as Sale]);
  assert.equal(saleTotals.units, 250);
  assert.equal(saleTotals.amount, 100);
});

test('كل تفاصيل سجل المنصرفات تنتقل للأرشيف: النوع، الجهة، المبلغ، التاريخ، التصنيف، الملاحظات، الفرع', () => {
  const v = describeExpense(generalExpense, branchCtx);
  const labels = v.fields.map((f) => f.label);
  for (const required of ['النوع', 'يتحمّله', 'المبلغ', 'التاريخ', 'التصنيف', 'الملاحظات', 'الفرع', 'أُرشف في']) {
    assert.ok(labels.includes(required), `حقل ناقص: ${required}`);
  }
  assert.equal(v.fields.find((f) => f.label === 'الملاحظات')?.value, 'إيجار شهر أكتوبر');
  assert.equal(v.fields.find((f) => f.label === 'التصنيف')?.value, 'منصرفات عامة');
  assert.equal(v.fields.find((f) => f.label === 'المبلغ')?.value, '5,062,000 ج.س');
});

test('المصروف الخاص يوضّح من دفع بالاسم، والعام يوضّح أنه عام', () => {
  const privView = describeExpense(privateExpense);
  assert.match(privView.subtitle, /خاص/);
  assert.match(privView.subtitle, /السر الصائغ/);
  assert.equal(privView.fields.find((f) => f.label === 'النوع')?.value, 'منصرف خاص (مسحوبات شريك)');

  const pubView = describeExpense({ ...generalExpense, partnerNames: [] });
  assert.match(pubView.subtitle, /عام/);
  assert.equal(pubView.fields.find((f) => f.label === 'يتحمّله')?.value, 'كل الشركاء بنسب الربح');
});

test('المؤرشف: حُسب مرة واحدة، وهو الآن خارج الحساب — لا خصم ولا إضافة', () => {
  const v = describeExpense(privateExpense);
  assert.match(v.note || '', /حُسب مرة واحدة/);
  assert.match(v.note || '', /خارج الحساب/);
  assert.match(v.note || '', /لا خصم ولا إضافة/);
});
