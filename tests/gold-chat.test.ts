import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerGoldQuestion,
  looksLikeCommand,
  looksLikeQuestion,
  type GoldChatCtx,
} from '../src/core/goldChat';
import type { Financials, Inventory, PartnerShare } from '../src/core/accounting';
import type { GoldRates } from '../src/types/index';

const rates: GoldRates = {
  karat18: 0,
  karat21: 1162062,
  karat22: 0,
  karat24: 0,
  usdRate: 10221,
  usdBuyRate: 10100,
  bankUsdRate: 4886,
  sarRate: 0,
  aedRate: 2808,
  egpRate: 0,
  globalOunceUsd: 4007,
  lastUpdated: '2026-10-27',
  usdSource: 'اخبار السودان',
  isStale: false,
};

const financials: Financials = {
  totalSales: 5_000_000,
  totalCost: 4_000_000,
  grossProfit: 1_000_000,
  generalExpenses: 50_000,
  privateExpenses: 20_000,
  netProfit: 930_000,
  receivables: 0,
  payables: 0,
  totalCapital: 10_000_000,
  activePurchasesCount: 1,
  activeSalesCount: 1,
  activeExpensesCount: 2,
  archivedCount: 0,
  profitMarginPercent: 18.6,
  openCreditSales: 0,
};

const inventory: Inventory = {
  totalUnits: 1500,
  totalGrams: 15,
  unitsK21: 1500,
  gramsK21: 15,
  costBasis: 15_000_000,
  marketValue: 17_430_930,
  unrealizedProfit: 2_430_930,
  avgCostPerGramK21: 1_000_000,
  byKarat: [{ purity: 21, units: 1500, grams: 15, unitsK21: 1500 }],
  negativeKarats: [],
  hasData: true,
};

const partnerShares: PartnerShare[] = [
  {
    partner: {
      id: 'p1',
      name: 'أحمد',
      capital: 6_000_000,
      profitPercent: 60,
      phone: '',
      notes: '',
    },
    profitShare: 558_000,
    privateExpenses: 0,
    generalExpenses: 30_000,
    netShare: 528_000,
    capitalPercent: 60,
    privateExpensesCount: 0,
  },
];

const ctx: GoldChatCtx = {
  storeName: 'برادايس',
  rates,
  financials,
  inventory,
  partnerShares,
  approved: { buy: 1_150_000, sell: 1_162_000 },
};

test('looksLikeQuestion vs command', () => {
  assert.equal(looksLikeQuestion('كم سعر الذهب؟'), true);
  assert.equal(looksLikeQuestion('رأس المال'), true);
  assert.equal(looksLikeQuestion('المنصرفات'), true);
  assert.equal(looksLikeCommand('المنصرفات'), false);
  assert.equal(looksLikeCommand('بعت 10 جرام عيار 21 بمليون'), true);
  assert.equal(looksLikeCommand('منصرف عام إيجار بخمسين ألف'), true);
  assert.equal(looksLikeCommand('كيف أسجّل بيع'), false);
  assert.equal(looksLikeQuestion('حوّل 100 دولار'), true);
  assert.equal(looksLikeCommand('حوّل 100 دولار'), false);
});

test('سعر الذهب يذكر العيار المعتمد والأونصة', () => {
  const a = answerGoldQuestion('كم سعر الذهب؟', ctx);
  assert.match(a, /عيار 21/);
  assert.match(a, /1,162,000|1٫162٫000|1162000/);
  assert.match(a, /4007/);
  assert.doesNotMatch(a, /\\n/);
});

test('الدولار من السوق الموازي مش الجمركي', () => {
  const a = answerGoldQuestion('كم سعر الدولار؟', ctx);
  assert.match(a, /10,221/);
  assert.match(a, /4,886/);
  assert.match(a, /اخبار السودان/);
});

test('رأس المال من الشركاء', () => {
  const a = answerGoldQuestion('رأس المال', ctx);
  assert.match(a, /10,000,000|10000000/);
  assert.match(a, /أحمد/);
});

test('المخزون بمعادل 21', () => {
  const a = answerGoldQuestion('المخزون', ctx);
  assert.match(a, /15\.00 جرام/);
});

test('كيف أسجّل بيع', () => {
  const a = answerGoldQuestion('كيف أسجّل بيع', ctx);
  assert.match(a, /بعت/);
});

test('تحويل بضاعة 100 دولار بهامش 20 و 30', () => {
  const q =
    'عندي بضاعه مشتريها مثلا ب 100 دولار عاوز اعمليها هامش ربح وابيعه بالجنيه السوداني تساوي كم كده؟';
  const a = answerGoldQuestion(q, ctx);
  assert.match(a, /1,022,100/);
  assert.match(a, /10,221/);
  assert.match(a, /20%/);
  assert.match(a, /30%/);
  assert.match(a, /موازي/);
  assert.doesNotMatch(a, /system prompt|Let's produce|Wait,/i);
});

test('تحويل بهامش محدد 25%', () => {
  const a = answerGoldQuestion('حوّل 100 دولار بهامش 25%', ctx);
  assert.match(a, /1,022,100/);
  assert.match(a, /25%/);
  assert.match(a, /1,277,625/);
  assert.doesNotMatch(a, /30%/);
});
