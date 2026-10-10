import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCommand, readNumber, readWeight, normalizeVoiceText } from '../src/core/voiceCommands';

const v = (raw: string) => parseCommand(raw);

/* ------------------------------- الأرقام ------------------------------- */

test('readNumber: أرقام متفوّتة ومركّبة', () => {
  const T = (s: string) => s.split(' ');
  assert.equal(readNumber(T('خمسه وعشرين'), 0)?.value, 25);
  assert.equal(readNumber(T('عشرين وخمسه'), 0)?.value, 25);
  assert.equal(readNumber(T('تلاته الاف وخمسميه'), 0)?.value, 3500);
  assert.equal(readNumber(T('ميه الف'), 0)?.value, 100000);
  assert.equal(readNumber(T('مليون وخمسميه الف'), 0)?.value, 1500000);
  assert.equal(readNumber(T('عشرين الف'), 0)?.value, 20000);
  assert.equal(readNumber(T('الفين'), 0)?.value, 2000);
  assert.equal(readNumber(T('ميتين وخمسين'), 0)?.value, 250);
  assert.equal(readNumber(T('1,500'), 0)?.value, 1500);
  assert.equal(readNumber(T('٢٥'), 0)?.value, 25);
});

test('readNumber: «و» بتقطع الأعداد البسيطة (للجمع)', () => {
  const T = (s: string) => s.split(' ');
  const r = readNumber(T('5 و 8'), 0);
  assert.equal(r?.value, 5);
  assert.equal(r?.next, 1); // وقف عند «و8»
});

/* ------------------------------- الوزن ------------------------------- */

test('readWeight: غرام وحبة ومثقال', () => {
  const T = (s: string) => s.split(' ');
  assert.equal(readWeight(T('10 غرام'), 0)?.units, 1000);
  assert.equal(readWeight(T('5 غرام و 3 حبات'), 0)?.units, 530);
  assert.equal(readWeight(T('3 مثقال'), 0)?.units, 1500); // المثقال = 5 غرام
  assert.equal(readWeight(T('نص غرام'), 0)?.units, 50);
  assert.equal(readWeight(T('خمسه ونص غرام'), 0)?.units, 550);
  assert.equal(readWeight(T('غرام'), 0)?.units, 100); // غرام واحد
  assert.equal(readWeight(T('5.3'), 0)?.units, 530);
});

/* ------------------------------- حساب القيمة ------------------------------- */

test('calc_value: صيغ مختلفة', () => {
  assert.deepEqual(v('احسب 10 غرام عيار 21'), { type: 'calc_value', units: 1000, purity: 21 });
  assert.deepEqual(v('احسب عشرين غرام عيار 18'), { type: 'calc_value', units: 2000, purity: 18 });
  assert.deepEqual(v('قيمة 5 غرام دهب'), { type: 'calc_value', units: 500, purity: 21 });
  assert.deepEqual(v('احسب ٥ غرام عيار ٢١'), { type: 'calc_value', units: 500, purity: 21 });
  assert.deepEqual(v('احسب خمسة غرام عيار واحد وعشرين'), { type: 'calc_value', units: 500, purity: 21 });
  assert.deepEqual(v('شحال 10 غرام عيار 24'), { type: 'calc_value', units: 1000, purity: 24 });
  assert.deepEqual(v('احسب 22 غرام و 6 حبات عيار 21'), { type: 'calc_value', units: 2260, purity: 21 });
  assert.deepEqual(v('10 غرام عيار 21'), { type: 'calc_value', units: 1000, purity: 21 }); // بدون فعل
  assert.deepEqual(v('احسب 3 مثقال عيار 21'), { type: 'calc_value', units: 1500, purity: 21 });
});

/* ------------------------------- الوزن من المبلغ ------------------------------- */

test('calc_weight: شحال غرام بمبلغ...', () => {
  assert.deepEqual(v('شحال غرام بميه الف'), { type: 'calc_weight', money: 100000, purity: 21 });
  assert.deepEqual(v('شحال غرام بخمسميه الف عيار 21'), { type: 'calc_weight', money: 500000, purity: 21 });
  assert.deepEqual(v('شحال غرام ب 200 الف'), { type: 'calc_weight', money: 200000, purity: 21 });
  assert.deepEqual(v('كام غرام بمليون'), { type: 'calc_weight', money: 1000000, purity: 21 });
  assert.deepEqual(v('شحال غرام دهب بميه الف'), { type: 'calc_weight', money: 100000, purity: 21 });
});

/* ------------------------------- تحويل العيار ------------------------------- */

test('calc_karat: حول من عيار إلى عيار', () => {
  assert.deepEqual(v('حول 10 غرام من 18 إلى 21'), { type: 'calc_karat', units: 1000, from: 18, to: 21 });
  assert.deepEqual(v('10 غرام عيار 18 يعادل كام في 21')!.type, 'calc_karat');
});

/* ------------------------------- جمع الأوزان ------------------------------- */

test('calc_sum: اجمع أوزان', () => {
  const cmd = v('اجمع 5 و 8 و 10 غرام');
  assert.equal(cmd.type, 'calc_sum');
  if (cmd.type === 'calc_sum') {
    assert.deepEqual(cmd.items, [
      { units: 500, purity: 21 },
      { units: 800, purity: 21 },
      { units: 1000, purity: 21 },
    ]);
  }
  const cmd2 = v('اجمع 3 مثقال و 5 غرام');
  assert.equal(cmd2.type, 'calc_sum');
  if (cmd2.type === 'calc_sum') {
    assert.deepEqual(cmd2.items, [
      { units: 1500, purity: 21 },
      { units: 500, purity: 21 },
    ]);
  }
});

/* ------------------------------- الأسعار ------------------------------- */

test('gold_price و usd_price', () => {
  assert.equal(v('سعر الذهب')!.type, 'gold_price');
  assert.equal(v('شحال الذهب')!.type, 'gold_price');
  assert.equal(v('الدهب كام اليوم')!.type, 'gold_price');
  assert.equal(v('سعر الذهب اليوم')!.type, 'gold_price');
  assert.equal(v('شحال الدولار')!.type, 'usd_price');
  assert.equal(v('سعر الدولار اليوم')!.type, 'usd_price');
  assert.equal(v('الدولر')!.type, 'usd_price');
});

/* ------------------------------- التنقل ------------------------------- */

test('navigate: فتح الشاشات', () => {
  assert.deepEqual(v('افتح المبيعات'), { type: 'navigate', tab: 'sales' });
  assert.deepEqual(v('افتح القروض'), { type: 'navigate', tab: 'loans' });
  assert.deepEqual(v('فوت الحاسبه'), { type: 'navigate', tab: 'calculator' });
  assert.deepEqual(v('افتح سعر الذهب'), { type: 'navigate', tab: 'gold_price' });
  assert.deepEqual(v('روح المصاريف'), { type: 'navigate', tab: 'expenses' });
});

/* ------------------------------- مساعدة وغير مفهوم ------------------------------- */

test('help و unknown', () => {
  assert.equal(v('مساعدة')!.type, 'help');
  assert.equal(v('إيه اللي تعرفه؟')!.type, 'help');
  assert.equal(v('شكراً جزيلاً')!.type, 'unknown');
  assert.equal(v('')!.type, 'unknown');
});

/* ------------------------------- التطبيع ------------------------------- */

test('normalizeVoiceText: همزات وتشكيل وأرقام عربية', () => {
  assert.equal(normalizeVoiceText('أَحسِب ٥ غراماً'), 'احسب 5 غراما');
  assert.equal(normalizeVoiceText('إلى العشرة'), 'الي العشره');
});

/* ==================== أوامر التسجيل ==================== */

test('add_purchase: سجل مشتريات', () => {
  assert.deepEqual(
    v('سجل في المشتريات 2 غرام عيار 21 بسعر 104 الف'),
    { type: 'add_purchase', units: 200, purity: 21, price: 104000, priceMode: 'auto', person: '', deferred: false }
  );
  assert.deepEqual(
    v('سجل مشتريات 2 غرام بسعر 104 الف للجرام'),
    { type: 'add_purchase', units: 200, purity: 21, price: 104000, priceMode: 'per_gram', person: '', deferred: false }
  );
  const c = v('شريت من ابوجويه 5 غرام بمبلغ 500 الف');
  assert.equal(c.type, 'add_purchase');
  if (c.type === 'add_purchase') {
    assert.equal(c.units, 500);
    assert.equal(c.person, 'ابوجويه');
    assert.equal(c.priceMode, 'total');
    assert.equal(c.price, 500000);
  }
  const d = v('سجل مشتريات 3 غرام عيار 18 بسعر كده آجل');
  assert.equal(d.type, 'add_purchase');
  if (d.type === 'add_purchase') {
    assert.equal(d.purity, 18);
    assert.equal(d.price, undefined);
    assert.equal(d.deferred, true);
  }
});

test('add_sale: سجل مبيعات بوزن مركب واسم', () => {
  const c = v('سجل في المبيعات وزن 30 غرام واتنين حبة عيار 21 بسعر 89 الف لفراس');
  assert.equal(c.type, 'add_sale');
  if (c.type === 'add_sale') {
    assert.equal(c.units, 3020);
    assert.equal(c.purity, 21);
    assert.equal(c.price, 89000);
    assert.equal(c.person, 'فراس');
    assert.equal(c.deferred, false);
  }
  const d = v('بعت 5 غرام عيار 24 على الحساب');
  assert.equal(d.type, 'add_sale');
  if (d.type === 'add_sale') {
    assert.equal(d.units, 500);
    assert.equal(d.purity, 24);
    assert.equal(d.deferred, true);
  }
});

test('add_expense: صرفت/مصروف', () => {
  assert.deepEqual(v('صرفت 50 الف كهرباء'), { type: 'add_expense', amount: 50000, name: 'كهرباء' });
  assert.deepEqual(v('سجل مصروف 20 الف'), { type: 'add_expense', amount: 20000, name: 'مصروف' });
  const c = v('دفعيت مليون ونص ايجار الدكان');
  assert.equal(c.type, 'add_expense');
  if (c.type === 'add_expense') {
    assert.equal(c.amount, 1500000);
    assert.equal(c.name.includes('ايجار'), true);
  }
});

test('add_loan: سلفة مع استحقاق', () => {
  const c = v('سجل سلفة 100 الف لخالد يستحق بعد شهر');
  assert.equal(c.type, 'add_loan');
  if (c.type === 'add_loan') {
    assert.equal(c.amount, 100000);
    assert.equal(c.person, 'خالد');
    assert.equal(c.direction, 'lent');
    assert.equal(c.dueDays, 30);
  }
  const d = v('استلفيت من عمر 200 الف');
  assert.equal(d.type, 'add_loan');
  if (d.type === 'add_loan') {
    assert.equal(d.amount, 200000);
    assert.equal(d.person, 'عمر');
    assert.equal(d.direction, 'borrowed');
  }
  const e = v('سلفة خمسميه الف لس امين بعد اسبوعين');
  assert.equal(e.type, 'add_loan');
  if (e.type === 'add_loan') {
    assert.equal(e.amount, 500000);
    assert.equal(e.person, 'امين');
    assert.equal(e.dueDays, 14);
  }
});

test('add_payment: دفعة/تسديد', () => {
  assert.deepEqual(v('سجل دفعة 50 الف لأحمد'), { type: 'add_payment', amount: 50000, person: 'احمد' });
  assert.deepEqual(v('تسديد 200 الف لعمر'), { type: 'add_payment', amount: 200000, person: 'عمر' });
});

test('الأوامر القديمة ما اتكسرتش', () => {
  assert.deepEqual(v('احسب 10 غرام عيار 21'), { type: 'calc_value', units: 1000, purity: 21 });
  assert.deepEqual(v('شحال غرام بمية ألف'), { type: 'calc_weight', money: 100000, purity: 21 });
  assert.equal(v('افتح المبيعات')!.type, 'navigate');
  assert.equal(v('سعر الذهب')!.type, 'gold_price');
});
