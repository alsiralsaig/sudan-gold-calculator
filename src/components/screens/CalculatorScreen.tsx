import React, { useState } from 'react';
import {
  Calculator as CalcIcon,
  Coins,
  Scale,
  Sparkles,
  ArrowRightLeft,
  Flame,
  Delete,
  Check,
  RefreshCw,
  Percent,
  Plus,
  Minus,
  X as Multiply,
  Divide
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  kUnitsPerGram,
  kUnitsPerHabba,
  weightToUnits,
  unitsToWeight,
  fmtMoney,
  fmtNum,
  kCurrency
} from '../../core/format';

export const CalculatorScreen: React.FC = () => {
  const { rates } = useGoldStore();

  // Top Level Tab: 'gold' (حاسبة الذهب) vs 'standard' (حاسبة عادية)
  const [mainCalcMode, setMainCalcMode] = useState<'gold' | 'standard'>('gold');

  // Gold Calculator Sub-tabs
  const [goldTab, setGoldTab] = useState<'value' | 'weight' | 'scrap' | 'melting'>('value');

  // Gold Value Calculation Inputs (Gram, Habba, Juz)
  const [gramsInput, setGramsInput] = useState<string>('10');
  const [habbaInput, setHabbaInput] = useState<string>('0');
  const [juzInput, setJuzInput] = useState<string>('0');
  const [pricePerGramInput, setPricePerGramInput] = useState<string>(rates.karat21.toString());

  // Gold Weight Calculation from Cash Amount
  const [totalMoneyInput, setTotalMoneyInput] = useState<string>('10000000');
  const [weightCalcPriceInput, setWeightCalcPriceInput] = useState<string>(rates.karat21.toString());

  // Scrap / Karat Conversion
  const [scrapWeight, setScrapWeight] = useState<string>('10');
  const [scrapKarat, setScrapKarat] = useState<number>(21);
  const [scrapPrice, setScrapPrice] = useState<string>(rates.karat21.toString());

  // Melting & Mixing
  const [rawWeight, setRawWeight] = useState<string>('50');
  const [rawKarat, setRawKarat] = useState<number>(21);
  const [pureGoldToAdd, setPureGoldToAdd] = useState<string>('10');

  // ================= Standard Calculator State =================
  const [stdDisplay, setStdDisplay] = useState<string>('0');
  const [stdEquation, setStdEquation] = useState<string>('');
  const [isEvaluated, setIsEvaluated] = useState<boolean>(false);

  // Standard Calc Handlers
  const handleStdNumber = (digit: string) => {
    if (isEvaluated) {
      setStdDisplay(digit);
      setStdEquation(digit);
      setIsEvaluated(false);
      return;
    }
    if (stdDisplay === '0' && digit !== '.') {
      setStdDisplay(digit);
      setStdEquation(digit);
    } else {
      setStdDisplay((prev) => prev + digit);
      setStdEquation((prev) => prev + digit);
    }
  };

  const handleStdOperator = (op: string) => {
    setIsEvaluated(false);
    const lastChar = stdEquation.slice(-1);
    if (['+', '-', '×', '÷', '*', '/'].includes(lastChar)) {
      setStdEquation((prev) => prev.slice(0, -1) + op);
      return;
    }
    setStdEquation((prev) => (prev ? prev + ' ' + op + ' ' : stdDisplay + ' ' + op + ' '));
    setStdDisplay('0');
  };

  const handleStdClear = () => {
    setStdDisplay('0');
    setStdEquation('');
    setIsEvaluated(false);
  };

  const handleStdBackspace = () => {
    if (isEvaluated) {
      handleStdClear();
      return;
    }
    if (stdDisplay.length <= 1) {
      setStdDisplay('0');
    } else {
      setStdDisplay((prev) => prev.slice(0, -1));
    }
    if (stdEquation.length > 0) {
      setStdEquation((prev) => prev.trimEnd().slice(0, -1).trimEnd());
    }
  };

  const handleStdToggleSign = () => {
    if (stdDisplay === '0') return;
    if (stdDisplay.startsWith('-')) {
      setStdDisplay((prev) => prev.slice(1));
    } else {
      setStdDisplay((prev) => '-' + prev);
    }
  };

  const handleStdPercent = () => {
    const val = parseFloat(stdDisplay);
    if (!isNaN(val)) {
      const res = val / 100;
      setStdDisplay(res.toString());
      setStdEquation(res.toString());
    }
  };

  const handleStdParentheses = () => {
    const openCount = (stdEquation.match(/\(/g) || []).length;
    const closeCount = (stdEquation.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      setStdEquation((prev) => prev + ')');
    } else {
      setStdEquation((prev) => (prev ? prev + ' (' : '('));
    }
  };

  const handleStdEquals = () => {
    try {
      let expr = (stdEquation || stdDisplay)
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');
      
      // Sanitized evaluate
      if (!/^[\d\s+\-*/().%]+$/.test(expr)) {
        setStdDisplay('خطأ');
        return;
      }
      
      // eslint-disable-next-line no-eval
      const result = Function(`'use strict'; return (${expr})`)();
      if (result !== undefined && !isNaN(result)) {
        const formatted = Number(result.toFixed(6)).toString();
        setStdDisplay(formatted);
        setStdEquation(formatted);
        setIsEvaluated(true);
      } else {
        setStdDisplay('خطأ');
      }
    } catch (_) {
      setStdDisplay('خطأ');
    }
  };

  // ================= Gold Calculations =================
  const gVal = parseFloat(gramsInput) || 0;
  const hVal = parseFloat(habbaInput) || 0;
  const jVal = parseFloat(juzInput) || 0;
  const priceVal = parseFloat(pricePerGramInput) || rates.karat21;

  // Normalization / Reorder (ترتيب)
  const handleReorderUnits = () => {
    const totalUnits = weightToUnits(gVal, hVal, jVal);
    const newGrams = Math.floor(totalUnits / kUnitsPerGram);
    const remUnits = totalUnits % kUnitsPerGram;
    const newHabba = Math.floor(remUnits / kUnitsPerHabba);
    const newJuz = remUnits % kUnitsPerHabba;

    setGramsInput(newGrams.toString());
    setHabbaInput(newHabba.toString());
    setJuzInput(newJuz.toString());
  };

  // 1. Calculate Value from Units
  const totalUnits = weightToUnits(gVal, hVal, jVal);
  const totalGramsEquivalent = totalUnits / kUnitsPerGram;
  const calculatedTotalCash = totalGramsEquivalent * priceVal;
  const pure24Equivalent = (totalGramsEquivalent * 21) / 24;

  // 2. Calculate Weight from Cash
  const moneyVal = parseFloat(totalMoneyInput) || 0;
  const wPriceVal = parseFloat(weightCalcPriceInput) || rates.karat21;
  const derivedGrams = wPriceVal > 0 ? moneyVal / wPriceVal : 0;
  const derivedUnits = Math.round(derivedGrams * kUnitsPerGram);
  const derivedWeightStr = unitsToWeight(derivedUnits);

  // 3. Scrap Karat Equivalent
  const scW = parseFloat(scrapWeight) || 0;
  const scP = parseFloat(scrapPrice) || (scrapKarat === 24 ? rates.karat24 : scrapKarat === 21 ? rates.karat21 : rates.karat18);
  const scrapTotalValue = scW * scP;
  const scrapPure24k = (scW * scrapKarat) / 24;

  // 4. Melting Result
  const rW = parseFloat(rawWeight) || 0;
  const pAdd = parseFloat(pureGoldToAdd) || 0;
  const meltedTotalWeight = rW + pAdd;
  const totalPureContent = (rW * rawKarat) / 24 + pAdd;
  const resultingKarat = meltedTotalWeight > 0 ? (totalPureContent / meltedTotalWeight) * 24 : 0;

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-200">
      
      {/* 1. Top Mode Switcher: حاسبة الذهب vs حاسبة عادية */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-3xl shadow-lg">
        <button
          onClick={() => setMainCalcMode('gold')}
          className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            mainCalcMode === 'gold'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>حاسبة الذهب</span>
        </button>

        <button
          onClick={() => setMainCalcMode('standard')}
          className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
            mainCalcMode === 'standard'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CalcIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>حاسبة عادية</span>
        </button>
      </div>

      {/* ================= MODE 1: حاسبة عادية (Standard Keypad Calculator) ================= */}
      {mainCalcMode === 'standard' && (
        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xl max-w-md mx-auto">
          
          {/* Display Screen */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 text-left min-h-[110px] flex flex-col justify-end space-y-1">
            <div className="text-xs sm:text-sm text-slate-400 font-mono overflow-x-auto text-right min-h-[20px] select-all">
              {stdEquation || ' '}
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-black text-white text-right overflow-x-auto select-all">
              {stdDisplay}
            </div>
          </div>

          {/* Keypad Grid (Exact match to Screenshot 4) */}
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            
            {/* Row 1 */}
            <button
              onClick={handleStdClear}
              className="h-14 sm:h-16 rounded-3xl bg-rose-700 hover:bg-rose-600 text-white font-black text-xl flex items-center justify-center shadow-md active:scale-90 transition-transform"
            >
              C
            </button>
            <button
              onClick={handleStdParentheses}
              className="h-14 sm:h-16 rounded-3xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-lg flex items-center justify-center shadow-md active:scale-90 transition-transform"
            >
              ( )
            </button>
            <button
              onClick={handleStdPercent}
              className="h-14 sm:h-16 rounded-3xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-lg flex items-center justify-center shadow-md active:scale-90 transition-transform"
            >
              %
            </button>
            <button
              onClick={handleStdBackspace}
              className="h-14 sm:h-16 rounded-3xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-lg flex items-center justify-center shadow-md active:scale-90 transition-transform"
            >
              ⌫
            </button>

            {/* Row 2 */}
            <button
              onClick={() => handleStdNumber('7')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              7
            </button>
            <button
              onClick={() => handleStdNumber('8')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              8
            </button>
            <button
              onClick={() => handleStdNumber('9')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              9
            </button>
            <button
              onClick={() => handleStdOperator('÷')}
              className="h-14 sm:h-16 rounded-3xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-black text-2xl flex items-center justify-center border border-amber-500/30 active:scale-90 transition-transform"
            >
              ÷
            </button>

            {/* Row 3 */}
            <button
              onClick={() => handleStdNumber('4')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              4
            </button>
            <button
              onClick={() => handleStdNumber('5')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              5
            </button>
            <button
              onClick={() => handleStdNumber('6')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              6
            </button>
            <button
              onClick={() => handleStdOperator('×')}
              className="h-14 sm:h-16 rounded-3xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-black text-2xl flex items-center justify-center border border-amber-500/30 active:scale-90 transition-transform"
            >
              ×
            </button>

            {/* Row 4 */}
            <button
              onClick={() => handleStdNumber('1')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              1
            </button>
            <button
              onClick={() => handleStdNumber('2')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              2
            </button>
            <button
              onClick={() => handleStdNumber('3')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              3
            </button>
            <button
              onClick={() => handleStdOperator('-')}
              className="h-14 sm:h-16 rounded-3xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-black text-2xl flex items-center justify-center border border-amber-500/30 active:scale-90 transition-transform"
            >
              -
            </button>

            {/* Row 5 */}
            <button
              onClick={handleStdToggleSign}
              className="h-14 sm:h-16 rounded-3xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg flex items-center justify-center active:scale-90 transition-transform"
            >
              -/+
            </button>
            <button
              onClick={() => handleStdNumber('0')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              0
            </button>
            <button
              onClick={() => handleStdNumber('.')}
              className="h-14 sm:h-16 rounded-3xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center border border-slate-800 active:scale-90 transition-transform"
            >
              .
            </button>
            <button
              onClick={handleStdEquals}
              className="h-14 sm:h-16 rounded-3xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-xl shadow-amber-500/30 active:scale-90 transition-transform"
            >
              =
            </button>

          </div>

        </div>
      )}

      {/* ================= MODE 2: حاسبة الذهب (Sudanese Gold Calculator) ================= */}
      {mainCalcMode === 'gold' && (
        <div className="space-y-4">
          
          {/* Sub Tab Switcher (حساب القيمة / حساب الوزن / حساب الكسر / السباكة) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-3xl">
            <button
              onClick={() => setGoldTab('value')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                goldTab === 'value'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>حساب القيمة</span>
              {goldTab === 'value' && <Check className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setGoldTab('weight')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                goldTab === 'weight'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>حساب الوزن</span>
              {goldTab === 'weight' && <Check className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setGoldTab('scrap')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                goldTab === 'scrap'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>تحويل العيار</span>
              {goldTab === 'scrap' && <Check className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setGoldTab('melting')}
              className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                goldTab === 'melting'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>السباكة والخلط</span>
              {goldTab === 'melting' && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 1. TAB: حساب القيمة (Gram, Habba, Juz -> Total Value) */}
          {goldTab === 'value' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
              
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">حساب قيمة الذهب</h3>
                  <p className="text-xs text-slate-400">حساب السعر الإجمالي بالجرام والحبة والجزء</p>
                </div>
                <button
                  onClick={handleReorderUnits}
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                  title="إعادة ترتيب الكسور"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ترتيب</span>
                </button>
              </div>

              {/* 3 Unit Boxes: [جرام] [حبة] [جزء] */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">الوزن:</label>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold mb-1 text-center">جرام</span>
                    <input
                      type="number"
                      step="any"
                      value={gramsInput}
                      onChange={(e) => setGramsInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white text-center font-mono text-base font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold mb-1 text-center">حبة</span>
                    <input
                      type="number"
                      step="any"
                      value={habbaInput}
                      onChange={(e) => setHabbaInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white text-center font-mono text-base font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold mb-1 text-center">جزء</span>
                    <input
                      type="number"
                      step="any"
                      value={juzInput}
                      onChange={(e) => setJuzInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white text-center font-mono text-base font-bold focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono mt-2 px-1">
                  <span>الوزن الكلي: {totalGramsEquivalent.toFixed(3)} جرام</span>
                  <span className="text-amber-400 font-bold">({unitsToWeight(totalUnits)})</span>
                </div>
              </div>

              {/* Price Per Gram */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-300">سعر الجرام الحالي:</span>
                  <button
                    onClick={() => setPricePerGramInput(rates.karat21.toString())}
                    className="text-amber-400 hover:underline font-mono text-[11px]"
                  >
                    السعر الافتراضي (21k): {fmtNum(rates.karat21)} ج.س
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  value={pricePerGramInput}
                  onChange={(e) => setPricePerGramInput(e.target.value)}
                  placeholder="مثال: 956,529"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3.5 text-white font-mono text-lg font-bold focus:outline-none text-right"
                />
              </div>

              {/* Result Summary Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40 space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">القيمة الإجمالية</span>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {fmtMoney(calculatedTotalCash)}
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">معادل الخالص (عيار 24)</span>
                  <div className="text-2xl font-black font-mono text-cyan-400">
                    {pure24Equivalent.toFixed(3)} <span className="text-sm font-sans font-bold">جرام</span>
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                النظام السوداني المعتمد: كل 1 جرام = 4 حبات = 40 جزء
              </div>

            </div>
          )}

          {/* 2. TAB: حساب الوزن (Cash -> Grams & Units) */}
          {goldTab === 'weight' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">حساب وزن الذهب من المبلغ المالي</h3>
                <p className="text-xs text-slate-400">معرفة كم جرام وحبة تشتري بهذا المبلغ</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">المبلغ المالي المتاح (ج.س):</label>
                <input
                  type="number"
                  step="any"
                  value={totalMoneyInput}
                  onChange={(e) => setTotalMoneyInput(e.target.value)}
                  placeholder="10,000,000"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3.5 text-white font-mono text-lg font-bold focus:outline-none text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">سعر الجرام (ج.س):</label>
                <input
                  type="number"
                  step="any"
                  value={weightCalcPriceInput}
                  onChange={(e) => setWeightCalcPriceInput(e.target.value)}
                  placeholder="956,529"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3.5 text-white font-mono text-lg font-bold focus:outline-none text-right"
                />
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border-2 border-emerald-500/40 space-y-2 text-center">
                <span className="text-xs text-slate-400 font-bold block">الوزن الناتج بالجرام والنظام السوداني</span>
                <div className="text-3xl font-black font-mono text-emerald-400">
                  {derivedGrams.toFixed(3)} <span className="text-base font-sans font-bold">جرام</span>
                </div>
                <div className="text-sm font-bold text-amber-300">
                  {derivedWeightStr}
                </div>
              </div>
            </div>
          )}

          {/* 3. TAB: تحويل العيار والكسر */}
          {goldTab === 'scrap' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">حاسبة الذهب الكسر والعيارات</h3>
                <p className="text-xs text-slate-400">حساب قيمة الذهب ومعادل الذهب الخالص عيار 24</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">الوزن بالجرام (g):</label>
                <input
                  type="number"
                  step="any"
                  value={scrapWeight}
                  onChange={(e) => setScrapWeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white font-mono text-lg font-bold focus:outline-none text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">العيار (Karat):</label>
                <div className="grid grid-cols-4 gap-2">
                  {[24, 22, 21, 18].map((k) => (
                    <button
                      key={k}
                      onClick={() => setScrapKarat(k)}
                      className={`py-2.5 rounded-2xl text-xs font-black transition-all ${
                        scrapKarat === k
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {k}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-4 rounded-2xl border-2 border-amber-500/40">
                  <span className="text-[11px] text-slate-400 font-bold block mb-1">القيمة الإجمالية</span>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {fmtMoney(scrapTotalValue)}
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold block mb-1">معادل الخالص (عيار 24)</span>
                  <div className="text-2xl font-black font-mono text-cyan-400">
                    {scrapPure24k.toFixed(3)} <span className="text-sm font-sans font-bold">جرام</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. TAB: السباكة والخلط */}
          {goldTab === 'melting' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">حاسبة سباكة وخلط الذهب</h3>
                <p className="text-xs text-slate-400">حساب العيار الناتج بعد صهر وإضافة الذهب الخالص</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">وزن الذهب المراد صهره (جرام):</label>
                  <input
                    type="number"
                    step="any"
                    value={rawWeight}
                    onChange={(e) => setRawWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white font-mono text-base font-bold focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">عيار الذهب الأصلي:</label>
                  <input
                    type="number"
                    step="any"
                    value={rawKarat}
                    onChange={(e) => setRawKarat(parseFloat(e.target.value) || 21)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white font-mono text-base font-bold focus:outline-none text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">وزن الذهب الخالص (عيار 24) المضاف (جرام):</label>
                <input
                  type="number"
                  step="any"
                  value={pureGoldToAdd}
                  onChange={(e) => setPureGoldToAdd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-white font-mono text-base font-bold focus:outline-none text-right"
                />
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border-2 border-amber-500/40 text-center space-y-2">
                <span className="text-xs text-slate-400 font-bold block">العيار الناتج بعد السباكة</span>
                <div className="text-3xl font-black font-mono text-amber-400">
                  {resultingKarat.toFixed(2)}k
                </div>
                <div className="text-xs text-slate-300 font-semibold">
                  الوزن الإجمالي الجديد: {meltedTotalWeight.toFixed(2)} جرام
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
