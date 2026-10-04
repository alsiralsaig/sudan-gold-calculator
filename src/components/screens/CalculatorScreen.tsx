import React, { useState } from 'react';
import { Calculator, Scale, RefreshCw, Flame, ArrowRightLeft, Sparkles } from 'lucide-react';
import { kUnitsPerGram, kUnitsPerHabba, weightToUnits, unitsToWeight, fmtMoney, fmtNum } from '../../core/format';
import { useGoldStore } from '../../context/GoldStoreContext';

export const CalculatorScreen: React.FC = () => {
  const { rates } = useGoldStore();
  const [activeTab, setActiveTab] = useState<'scrap' | 'units' | 'karat' | 'melting'>('scrap');

  // Scrap Calculator State
  const [scrapWeight, setScrapWeight] = useState<string>('10');
  const [scrapKarat, setScrapKarat] = useState<number>(21);
  const [customPricePerGram, setCustomPricePerGram] = useState<string>('');

  // Units Converter State (Gram, Habba, Juz)
  const [uGrams, setUGrams] = useState<string>('1');
  const [uHabba, setUHabba] = useState<string>('0');
  const [uJuz, setUJuz] = useState<string>('0');

  // Karat Conversion State
  const [sourceWeight, setSourceWeight] = useState<string>('100');
  const [sourceKarat, setSourceKarat] = useState<number>(18);
  const [targetKarat, setTargetKarat] = useState<number>(24);

  // Melting State
  const [rawWeight, setRawWeight] = useState<string>('50');
  const [rawKarat, setRawKarat] = useState<number>(21);
  const [pureGoldToAdd, setPureGoldToAdd] = useState<string>('10');

  // Calculations
  const defaultPrice = scrapKarat === 24 ? rates.karat24 : scrapKarat === 21 ? rates.karat21 : rates.karat18;
  const currentPricePerGram = parseFloat(customPricePerGram) || defaultPrice;
  const scrapTotalValue = (parseFloat(scrapWeight) || 0) * currentPricePerGram;
  const pureGoldEquivalent = ((parseFloat(scrapWeight) || 0) * scrapKarat) / 24;

  // Units
  const totalCalculatedUnits = weightToUnits(
    parseFloat(uGrams) || 0,
    parseFloat(uHabba) || 0,
    parseFloat(uJuz) || 0
  );
  const totalGramsEquivalent = totalCalculatedUnits / kUnitsPerGram;

  // Karat Conversion
  const convertedKaratWeight =
    targetKarat > 0
      ? ((parseFloat(sourceWeight) || 0) * sourceKarat) / targetKarat
      : 0;

  // Melting
  const totalPureContent =
    ((parseFloat(rawWeight) || 0) * rawKarat) / 24 + (parseFloat(pureGoldToAdd) || 0);
  const totalNewWeight = (parseFloat(rawWeight) || 0) + (parseFloat(pureGoldToAdd) || 0);
  const newKaratResult = totalNewWeight > 0 ? (totalPureContent / totalNewWeight) * 24 : 0;

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-200">
      
      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('scrap')}
          className={`py-2 text-[11px] sm:text-xs font-black rounded-xl transition-all ${
            activeTab === 'scrap'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          حساب الكسر
        </button>
        <button
          onClick={() => setActiveTab('units')}
          className={`py-2 text-[11px] sm:text-xs font-black rounded-xl transition-all ${
            activeTab === 'units'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          حبة وزاوية
        </button>
        <button
          onClick={() => setActiveTab('karat')}
          className={`py-2 text-[11px] sm:text-xs font-black rounded-xl transition-all ${
            activeTab === 'karat'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          تحويل العيار
        </button>
        <button
          onClick={() => setActiveTab('melting')}
          className={`py-2 text-[11px] sm:text-xs font-black rounded-xl transition-all ${
            activeTab === 'melting'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          السباكة والخلط
        </button>
      </div>

      {/* 1. SCRAP CALCULATOR */}
      {activeTab === 'scrap' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">حاسبة الذهب الكسر والعيارات</h3>
              <p className="text-xs text-slate-400">حساب قيمة الذهب ومعادل الذهب الخالص عيار 24</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">الوزن بالجرام (g)</label>
              <input
                type="number"
                step="any"
                value={scrapWeight}
                onChange={(e) => setScrapWeight(e.target.value)}
                placeholder="10"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">العيار (Karat)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[18, 21, 22, 24].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setScrapKarat(k);
                      setCustomPricePerGram('');
                    }}
                    className={`py-3 rounded-xl font-bold text-xs transition-all ${
                      scrapKarat === k
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {k}k
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">سعر الجرام الحالي</label>
              <span className="text-[11px] text-amber-400">
                السعر الافتراضي: {fmtMoney(defaultPrice)}
              </span>
            </div>
            <input
              type="number"
              step="any"
              value={customPricePerGram}
              onChange={(e) => setCustomPricePerGram(e.target.value)}
              placeholder={defaultPrice.toString()}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Result Cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 text-center space-y-1">
              <span className="text-xs text-slate-400 font-bold block">القيمة الإجمالية</span>
              <span className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                {fmtMoney(scrapTotalValue)}
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/40 text-center space-y-1">
              <span className="text-xs text-slate-400 font-bold block">معادل الخالص (عيار 24)</span>
              <span className="text-lg sm:text-xl font-black text-cyan-400 font-mono">
                {pureGoldEquivalent.toFixed(3)} ج
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. UNITS CONVERTER (GRAM, HABBA, JUZ) */}
      {activeTab === 'units' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">نظام الأوزان السوداني</h3>
              <p className="text-xs text-slate-400">1 جرام = 4 حبات = 40 جزء (زاوية)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">جرام (g)</label>
              <input
                type="number"
                step="any"
                value={uGrams}
                onChange={(e) => setUGrams(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">حبة (ح)</label>
              <input
                type="number"
                step="any"
                value={uHabba}
                onChange={(e) => setUHabba(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">جزء/زاوية (ز)</label>
              <input
                type="number"
                step="any"
                value={uJuz}
                onChange={(e) => setUJuz(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">إجمالي الأجزاء (الوحدات):</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {totalCalculatedUnits} جزء
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-2">
              <span className="text-xs text-slate-400 font-bold">الوزن العشري بالجرام:</span>
              <span className="text-base font-black text-cyan-400 font-mono">
                {totalGramsEquivalent.toFixed(3)} جرام
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-2">
              <span className="text-xs text-slate-400 font-bold">الصيغة السوقية:</span>
              <span className="text-sm font-black text-emerald-400">
                {unitsToWeight(totalCalculatedUnits)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. KARAT CONVERTER */}
      {activeTab === 'karat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">تحويل العيار (Karat Converter)</h3>
              <p className="text-xs text-slate-400">تحويل وزن الذهب من عيار إلى عيار آخر بدقة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">الوزن الأولي (جرام)</label>
              <input
                type="number"
                step="any"
                value={sourceWeight}
                onChange={(e) => setSourceWeight(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">من عيار</label>
              <select
                value={sourceKarat}
                onChange={(e) => setSourceKarat(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-sm focus:outline-none focus:border-amber-400"
              >
                <option value={18}>عيار 18</option>
                <option value={21}>عيار 21</option>
                <option value={22}>عيار 22</option>
                <option value={24}>عيار 24 (خالص)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">إلى عيار</label>
              <select
                value={targetKarat}
                onChange={(e) => setTargetKarat(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-sm focus:outline-none focus:border-amber-400"
              >
                <option value={18}>عيار 18</option>
                <option value={21}>عيار 21</option>
                <option value={22}>عيار 22</option>
                <option value={24}>عيار 24 (خالص)</option>
              </select>
            </div>
          </div>

          <div className="p-5 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-2 border-amber-500/50 rounded-2xl text-center space-y-2">
            <span className="text-xs text-slate-400 font-bold block">
              الوزن الناتج بعيار {targetKarat}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {convertedKaratWeight.toFixed(3)} جرام
            </div>
            <div className="text-xs text-slate-400">
              ({unitsToWeight(weightToUnits(convertedKaratWeight))})
            </div>
          </div>
        </div>
      )}

      {/* 4. MELTING & ALLOY */}
      {activeTab === 'melting' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">السباكة وخلط السبائك</h3>
              <p className="text-xs text-slate-400">حساب العيار الناتج عند إضافة ذهب خالص عيار 24</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">وزن السبيكة الحالية (g)</label>
              <input
                type="number"
                step="any"
                value={rawWeight}
                onChange={(e) => setRawWeight(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">عيار السبيكة الحالية</label>
              <input
                type="number"
                step="any"
                value={rawKarat}
                onChange={(e) => setRawKarat(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">الذهب الخالص المضاف (24k)</label>
              <input
                type="number"
                step="any"
                value={pureGoldToAdd}
                onChange={(e) => setPureGoldToAdd(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-white text-base font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 text-center space-y-1">
              <span className="text-xs text-slate-400 font-bold block">الوزن النهائي الجديد</span>
              <span className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                {totalNewWeight.toFixed(3)} جرام
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/40 text-center space-y-1">
              <span className="text-xs text-slate-400 font-bold block">العيار الناتج الجديد</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                {newKaratResult.toFixed(2)}k
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
