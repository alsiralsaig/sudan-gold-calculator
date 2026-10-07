import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWeight, fmtWeight, karatDisplay, convertKarat, pricePerGramFor, calcValue,
  calcWeightFromMoney, sumWeights, calcProfit, calcMeltToTarget, calcMix,
} from '../src/core/goldCalc';
import { addToTape, makeEntry, parseTape, sumSelected, tapeToText, removeFromTape, TAPE_MAX } from '../src/core/calcTape';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('قراءة الوزن السوداني: 1 جرام = 10 حبات = 100 جزء', () => {
  assert.equal(parseWeight('22.6.0'), 2260);
  assert.equal(parseWeight('22.6'), 2260);
  assert.equal(parseWeight('22'), 2200);
  assert.equal(parseWeight('0.9.5'), 95);
  assert.equal(parseWeight('0.12.0'), 120); // حبات فوق 9
  assert.equal(parseWeight('٢٢٫٦٫٠'), 2260);
  assert.equal(parseWeight(''), null);
  assert.equal(parseWeight('1.2.3.4'), null);
  assert.equal(parseWeight('abc'), null);
  assert.equal(fmtWeight(2265), '22.6.5');
  assert.equal(fmtWeight(120), '1.2.0');
});

test('عرض العيار بالقيراط والنقاوة', () => {
  assert.equal(karatDisplay(21), '21 (875)');
  assert.equal(karatDisplay(875), '21 (875)');
  assert.equal(karatDisplay(18), '18 (750)');
  assert.equal(karatDisplay(692), '692 (≈16.6k)');
  assert.equal(karatDisplay(0), '—');
});

test('تحويل العيار يحفظ الذهب الخالص', () => {
  near(convertKarat(10000, 18, 21), 10000 * 750 / 875);
  near(convertKarat(10000, 24, 21), 10000 * 1000 / 875);
  near(convertKarat(10000, 692, 875), 10000 * 692 / 875);
  assert.equal(convertKarat(100, 0, 21), 0);
});

test('سعر الجرام لأي عيار من سعر 21', () => {
  assert.equal(pricePerGramFor(875000, 21), 875000);
  assert.equal(pricePerGramFor(875000, 24), 1000000);
  assert.equal(pricePerGramFor(875000, 18), 750000);
  assert.equal(pricePerGramFor(875000, 692), 692000);
});

test('القيمة مع المصنعية', () => {
  const r = calcValue({ units: 1000, purity: 18, price21: 875000, workmanshipPerGram: 20000 });
  assert.equal(r.grams, 10);
  assert.equal(r.pricePerGram, 750000);
  assert.equal(r.goldValue, 7500000);
  assert.equal(r.workmanship, 200000);
  assert.equal(r.total, 7700000);
  near(r.k21Grams, 10 * 750 / 875);
  near(r.pureGrams, 7.5);
});

test('الوزن من المبلغ: يقرّب للأسفل لأقرب جزء ويرجع الباقي', () => {
  const r = calcWeightFromMoney({ money: 10_000_000, purity: 21, price21: 1_000_000 });
  assert.equal(r.units, 1000);
  assert.equal(r.change, 0);
  const r2 = calcWeightFromMoney({ money: 1_000_000, purity: 21, price21: 3_000_000 });
  assert.equal(r2.units, 33); // 0.3.3
  assert.ok(r2.exactCost <= 1_000_000);
  near(r2.change, 1_000_000 - 0.33 * 3_000_000);
  // مع المصنعية: السعر الفعلي للجرام أعلى
  const r3 = calcWeightFromMoney({ money: 1_100_000, purity: 21, price21: 1_000_000, workmanshipPerGram: 100_000 });
  assert.equal(r3.units, 100);
  assert.equal(calcWeightFromMoney({ money: 0, purity: 21, price21: 1 }).units, 0);
});

test('جمع الأوزان بعيارات مختلفة', () => {
  const r = sumWeights(
    [
      { units: 1000, purity: 21 },
      { units: 1000, purity: 18 },
      { units: 0, purity: 21 }, // يُتجاهل
      { units: 500, purity: 0 }, // يُتجاهل
    ],
    875000
  );
  assert.equal(r.count, 2);
  assert.equal(r.totalUnits, 2000);
  near(r.avgFineness, (875 + 750) / 2);
  near(r.k21Units, 1000 + 1000 * 750 / 875);
  near(r.value, (r.k21Units / 100) * 875000);
});

test('الربح بسعر البيع وبنسبة مستهدفة', () => {
  const a = calcProfit({ units: 1000, purity: 21, buyPrice21: 1_000_000, sellPrice21: 1_100_000 });
  assert.equal(a.cost, 10_000_000);
  assert.equal(a.revenue, 11_000_000);
  assert.equal(a.profit, 1_000_000);
  near(a.markupPercent, 10);
  near(a.marginPercent, 100 / 11);
  assert.equal(a.profitPerGram, 100_000);
  const b = calcProfit({ units: 1000, purity: 21, buyPrice21: 1_000_000, targetMarkupPercent: 5 });
  near(b.sellPrice21, 1_050_000);
  near(b.profit, 500_000);
  // عيار 18 يُقيَّم بمعادل 21
  const c = calcProfit({ units: 875, purity: 18, buyPrice21: 1_000_000, sellPrice21: 1_000_000 });
  near(c.cost, 7.5 * 1_000_000);
});

test('السباكة للعيار المستهدف: رفع بالخالص وخفض بالنحاس', () => {
  // 100 جرام 18 → 21: خالص = 100×(875−750)÷(1000−875) = 100
  const up = calcMeltToTarget({ units: 10000, purity: 18, targetPurity: 21 });
  assert.equal(up.action, 'pure');
  near(up.addUnits, 10000);
  near(up.finalUnits, 20000);
  // 100 جرام 21 → 18: نحاس = 100×(875−750)÷750 = 16.667
  const down = calcMeltToTarget({ units: 10000, purity: 21, targetPurity: 18 });
  assert.equal(down.action, 'alloy');
  near(down.addUnits, 10000 * 125 / 750);
  assert.equal(calcMeltToTarget({ units: 100, purity: 21, targetPurity: 875 }).action, 'none');
  assert.equal(calcMeltToTarget({ units: 100, purity: 21, targetPurity: 24 }).action, 'impossible');
});

test('التحقق العكسي: الخلط يعطي العيار المستهدف', () => {
  const up = calcMeltToTarget({ units: 5000, purity: 692, targetPurity: 21 });
  const mix = calcMix([{ units: 5000, fineness: 692 }, { units: up.addUnits, fineness: 1000 }]);
  near(mix.fineness, 875, 1e-6);
  const down = calcMeltToTarget({ units: 5000, purity: 22, targetPurity: 18 });
  const mix2 = calcMix([{ units: 5000, fineness: 22 / 24 * 1000 }, { units: down.addUnits, fineness: 0 }]);
  near(mix2.fineness, 750, 1e-6);
  near(mix2.karat, 18, 1e-6);
});

/* ---------- السجل ---------- */
const e = (title: string, result: string, value?: number) => makeEntry({ mode: 'std', title, lines: [title], result, value });

test('السجل: الأحدث أولاً، منع التكرار المتتالي، وحد أقصى', () => {
  let t = addToTape([], e('a', '1', 1));
  t = addToTape(t, e('b', '2', 2));
  assert.deepEqual(t.map((x) => x.title), ['b', 'a']);
  t = addToTape(t, e('b', '2', 2));
  assert.equal(t.length, 2);
  for (let i = 0; i < TAPE_MAX + 20; i++) t = addToTape(t, e(`x${i}`, String(i), i));
  assert.equal(t.length, TAPE_MAX);
  assert.equal(removeFromTape(t, t[0].id).length, TAPE_MAX - 1);
});

test('السجل: قراءة آمنة لبيانات تالفة', () => {
  assert.deepEqual(parseTape(null), []);
  assert.deepEqual(parseTape('not json'), []);
  assert.deepEqual(parseTape('{"a":1}'), []);
  const good = e('a', '1', 1);
  assert.equal(parseTape(JSON.stringify([good, { junk: true }])).length, 1);
});

test('السجل: جمع المحدد والنص للمشاركة', () => {
  const a = e('حاسبة', '1,000', 1000);
  const b = e('حاسبة', '2,500', 2500);
  const c = makeEntry({ mode: 'gold', title: 'وزن', lines: [], result: '1.2.0' }); // بلا قيمة
  const list = [b, a, c];
  assert.deepEqual(sumSelected(list, new Set([a.id, b.id, c.id])), { count: 2, total: 3500 });
  const txt = tapeToText([b, a], 'محلات أبو أحمد');
  assert.ok(txt.startsWith('*محلات أبو أحمد*'));
  assert.ok(txt.indexOf('1,000') < txt.indexOf('2,500')); // الأقدم أولاً
  assert.ok(txt.includes('المجموع: *3,500*'));
});
