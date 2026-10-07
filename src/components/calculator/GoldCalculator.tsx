'use client';

import React, { useEffect, useMemo } from 'react';
import { Coins, Scale, Layers, TrendingUp, ArrowLeftRight, Flame, Plus, X, Save, Copy } from 'lucide-react';
import {
  parseWeight,
  fmtWeight,
  unitsToGrams,
  karatDisplay,
  convertKarat,
  calcValue,
  calcWeightFromMoney,
  sumWeights,
  calcProfit,
  calcMeltToTarget,
  calcMix,
  pricePerGramFor,
} from '../../core/goldCalc';
import { purityToFineness } from '../../core/purity';
import { makeEntry, TapeEntry } from '../../core/calcTape';
import { usePersistentInputs } from '../../hooks/useCalcTape';
import { MoneyField, WeightField, PurityPicker, ResultBox, Label, toNum, money } from './fields';

export type GoldTool = 'value' | 'weight' | 'sum' | 'profit' | 'karat' | 'melt';

export const GOLD_TOOLS: { id: GoldTool; label: string; icon: React.ElementType }[] = [
  { id: 'value', label: 'القيمة', icon: Coins },
  { id: 'weight', label: 'الوزن من المبلغ', icon: Scale },
  { id: 'sum', label: 'جمع الأوزان', icon: Layers },
  { id: 'profit', label: 'الربح والتسعير', icon: TrendingUp },
  { id: 'karat', label: 'تحويل العيار', icon: ArrowLeftRight },
  { id: 'melt', label: 'السباكة', icon: Flame },
];

export interface RestoreRequest {
  tool: string;
  inputs: Record<string, string>;
  nonce: number;
}

type Row = { w: string; p: string };
const parseRows = (s: string): Row[] => {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) && a.length ? a.map((r) => ({ w: String(r.w ?? ''), p: String(r.p ?? '21') })) : [{ w: '', p: '21' }];
  } catch {
    return [{ w: '', p: '21' }];
  }
};

const pct = (n: number) => `${n.toFixed(2)}%`;
const fine = (f: number) => `${Math.round(f)} (≈${((f / 1000) * 24).toFixed(2)}k)`;

/* ---------- صفوف (جمع الأوزان / الخلط) ---------- */
export const RowsEditor: React.FC<{ rowsJson: string; onChange: (s: string) => void; withCopper?: boolean }> = ({ rowsJson, onChange, withCopper }) => {
  const rows = parseRows(rowsJson);
  const setRow = (i: number, patch: Partial<Row>) => onChange(JSON.stringify(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-black text-slate-300 flex items-center justify-center shrink-0">{i + 1}</span>
            <div className="flex-1">
              <WeightField compact value={r.w} onChange={(w) => setRow(i, { w })} />
            </div>
            {rows.length > 1 && (
              <button type="button" onClick={() => onChange(JSON.stringify(rows.filter((_, j) => j !== i)))} className="p-2 rounded-xl text-rose-400 bg-rose-500/10" aria-label="حذف السطر">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <PurityPicker label="" value={r.p} onChange={(p) => setRow(i, { p })} extra={withCopper ? [{ label: 'نحاس', value: '0' }] : []} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange(JSON.stringify([...rows, { w: '', p: rows[rows.length - 1]?.p || '21' }]))}
        className="w-full py-2.5 rounded-2xl border border-dashed border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:border-amber-500/50"
      >
        <Plus className="w-4 h-4" /> إضافة قطعة
      </button>
      {rows.length > 1 && (
        <button type="button" onClick={() => onChange(JSON.stringify([{ w: '', p: '21' }]))} className="w-full text-[11px] text-slate-500 hover:text-rose-300">
          تفريغ كل القطع
        </button>
      )}
    </div>
  );
};


export const GoldCalculator: React.FC<{
  tool: GoldTool;
  setTool: (t: GoldTool) => void;
  price21: number;
  approved: { buy: number; sell: number } | null;
  onSave: (e: TapeEntry) => void;
  onToast: (m: string) => void;
  restore?: RestoreRequest | null;
}> = ({ tool, setTool, price21, approved, onSave, onToast, restore }) => {
  const value = usePersistentInputs('gold_calc_value_v2', { w: '10', p: '21', price: '', work: '' });
  const weight = usePersistentInputs('gold_calc_weight_v2', { money: '', p: '21', price: '', work: '' });
  const sum = usePersistentInputs('gold_calc_sum_v2', { rows: JSON.stringify([{ w: '', p: '21' }]), price: '' });
  const profit = usePersistentInputs('gold_calc_profit_v2', { w: '10', p: '21', buy: '', mode: 'price', sell: '', target: '5' });
  const karat = usePersistentInputs('gold_calc_karat_v2', { w: '10', from: '18', to: '21', price: '' });
  const melt = usePersistentInputs('gold_calc_melt_v2', {
    mode: 'target',
    w: '50',
    p: '18',
    t: '21',
    rows: JSON.stringify([{ w: '', p: '21' }, { w: '', p: '24' }]),
  });

  const stores: Record<GoldTool, { replace: (v: Record<string, string>) => void }> = {
    value, weight, sum, profit, karat, melt,
  } as never;

  // استعادة من السجل
  useEffect(() => {
    if (!restore) return;
    const t = restore.tool as GoldTool;
    if (stores[t]) {
      stores[t].replace(restore.inputs);
      setTool(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restore?.nonce]);

  const priceChips = [
    { label: 'الرسمي', value: price21 },
    ...(approved ? [{ label: 'شراء', value: approved.buy }, { label: 'بيع', value: approved.sell }] : []),
  ];
  const priceOr = (s: string) => toNum(s) || price21;
  const priceHint = (s: string) => (toNum(s) ? '' : ` (فارغ = الرسمي ${money(price21)})`);

  /* ---------- الحسابات ---------- */
  const out = useMemo(() => {
    switch (tool) {
      case 'value': {
        const v = value.values;
        const units = parseWeight(v.w) ?? 0;
        const r = calcValue({ units, purity: toNum(v.p), price21: priceOr(v.price), workmanshipPerGram: toNum(v.work) });
        return {
          ok: units > 0 && r.pricePerGram > 0,
          result: `${money(r.total)} ج.س`,
          value: r.total,
          lines: [
            `الوزن: ${fmtWeight(units)} عيار ${karatDisplay(toNum(v.p))}`,
            `سعر الجرام: ${money(r.pricePerGram)} (من سعر 21: ${money(priceOr(v.price))})`,
            ...(r.workmanship > 0 ? [`قيمة الذهب: ${money(r.goldValue)}`, `المصنعية: ${money(r.workmanship)}`] : []),
          ],
          view: (
            <>
              <ResultBox big tone="amber" label={r.workmanship > 0 ? 'الإجمالي مع المصنعية' : 'القيمة الإجمالية'} value={`${money(r.total)} ج.س`} />
              <div className="grid grid-cols-2 gap-2">
                <ResultBox label="سعر جرام هذا العيار" value={money(r.pricePerGram)} />
                {r.workmanship > 0 ? <ResultBox label="المصنعية" value={money(r.workmanship)} tone="cyan" /> : <ResultBox label="معادل عيار 21" value={`${r.k21Grams.toFixed(2)} ج`} tone="cyan" />}
                {r.workmanship > 0 && <ResultBox label="قيمة الذهب" value={money(r.goldValue)} />}
                {r.workmanship > 0 && <ResultBox label="معادل عيار 21" value={`${r.k21Grams.toFixed(2)} ج`} tone="cyan" />}
                <ResultBox label="الذهب الخالص (24)" value={`${r.pureGrams.toFixed(3)} ج`} />
                <ResultBox label="الجرام العشري" value={r.grams.toFixed(2)} />
              </div>
            </>
          ),
        };
      }
      case 'weight': {
        const v = weight.values;
        const r = calcWeightFromMoney({ money: toNum(v.money), purity: toNum(v.p), price21: priceOr(v.price), workmanshipPerGram: toNum(v.work) });
        return {
          ok: r.units > 0,
          result: `${fmtWeight(r.units)} (${r.grams.toFixed(2)} جرام)`,
          value: undefined,
          lines: [
            `المبلغ: ${money(toNum(v.money))} ج.س — عيار ${karatDisplay(toNum(v.p))}`,
            `سعر الجرام${toNum(v.work) ? ' مع المصنعية' : ''}: ${money(r.pricePerGram)}`,
            `التكلفة الفعلية: ${money(r.exactCost)} — الباقي: ${money(r.change)}`,
          ],
          view: (
            <>
              <ResultBox big tone="emerald" label="الوزن (جرام.حبة.جزء)" value={fmtWeight(r.units)} sub={`${r.grams.toFixed(2)} جرام — مقرّب للأسفل لأقرب جزء`} />
              <div className="grid grid-cols-2 gap-2">
                <ResultBox label="التكلفة الفعلية" value={money(r.exactCost)} />
                <ResultBox label="الباقي من المبلغ" value={money(r.change)} tone="cyan" />
                <ResultBox label="سعر الجرام المستخدم" value={money(r.pricePerGram)} />
                <ResultBox label="معادل عيار 21" value={`${unitsToGrams(convertKarat(r.units, toNum(v.p), 21)).toFixed(2)} ج`} />
              </div>
            </>
          ),
        };
      }
      case 'sum': {
        const rows = parseRows(sum.values.rows);
        const parsed = rows.map((r) => ({ units: parseWeight(r.w) ?? 0, purity: toNum(r.p) }));
        const r = sumWeights(parsed, priceOr(sum.values.price));
        return {
          ok: r.count > 0,
          result: `${fmtWeight(r.totalUnits)} — قيمة ${money(r.value)} ج.س`,
          value: r.value,
          lines: [
            ...parsed.filter((x) => x.units > 0).map((x, i) => `${i + 1}) ${fmtWeight(x.units)} عيار ${karatDisplay(x.purity)}`),
            `معادل 21: ${fmtWeight(r.k21Units)} — متوسط النقاوة ${Math.round(r.avgFineness)}`,
          ],
          view: (
            <>
              <div className="grid grid-cols-2 gap-2">
                <ResultBox big tone="emerald" label={`مجموع الوزن (${r.count} قطعة)`} value={fmtWeight(r.totalUnits)} sub={`${unitsToGrams(r.totalUnits).toFixed(2)} جرام`} />
                <ResultBox big tone="cyan" label="معادل عيار 21" value={fmtWeight(r.k21Units)} sub={`${unitsToGrams(r.k21Units).toFixed(2)} جرام`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ResultBox tone="amber" label="القيمة بسعر 21" value={money(r.value)} />
                <ResultBox label="متوسط النقاوة" value={r.avgFineness ? fine(r.avgFineness) : '—'} />
                <ResultBox label="الذهب الخالص" value={`${unitsToGrams(r.pureUnits).toFixed(3)} ج`} />
              </div>
            </>
          ),
        };
      }
      case 'profit': {
        const v = profit.values;
        const units = parseWeight(v.w) ?? 0;
        const buy = toNum(v.buy) || approved?.buy || price21;
        const r = calcProfit({
          units,
          purity: toNum(v.p),
          buyPrice21: buy,
          ...(v.mode === 'target' ? { targetMarkupPercent: toNum(v.target) } : { sellPrice21: toNum(v.sell) || approved?.sell || price21 }),
        });
        const tone = r.profit >= 0 ? 'emerald' : 'rose';
        return {
          ok: units > 0 && buy > 0,
          result: `ربح ${money(r.profit)} ج.س (${pct(r.markupPercent)})`,
          value: r.profit,
          lines: [
            `الوزن: ${fmtWeight(units)} عيار ${karatDisplay(toNum(v.p))}`,
            `شراء جرام 21: ${money(buy)} — بيع جرام 21: ${money(r.sellPrice21)}`,
            `التكلفة: ${money(r.cost)} — البيع: ${money(r.revenue)}`,
          ],
          view: (
            <>
              <ResultBox big tone={tone} label={r.profit >= 0 ? 'الربح' : 'الخسارة'} value={`${money(r.profit)} ج.س`} sub={`نسبة على التكلفة ${pct(r.markupPercent)} • هامش من البيع ${pct(r.marginPercent)}`} />
              <div className="grid grid-cols-2 gap-2">
                <ResultBox label="التكلفة" value={money(r.cost)} />
                <ResultBox label="سعر البيع الكلي" value={money(r.revenue)} tone="amber" />
                <ResultBox label="سعر بيع جرام 21" value={money(r.sellPrice21)} tone="cyan" />
                <ResultBox label="الربح لكل جرام" value={money(r.profitPerGram)} />
              </div>
            </>
          ),
        };
      }
      case 'karat': {
        const v = karat.values;
        const units = parseWeight(v.w) ?? 0;
        const from = toNum(v.from);
        const to = toNum(v.to);
        const converted = convertKarat(units, from, to);
        const p21 = priceOr(v.price);
        const val = unitsToGrams(convertKarat(units, from, 21)) * p21;
        return {
          ok: units > 0 && converted > 0,
          result: `${fmtWeight(converted)} عيار ${karatDisplay(to)}`,
          value: undefined,
          lines: [`${fmtWeight(units)} عيار ${karatDisplay(from)} = ${fmtWeight(converted)} عيار ${karatDisplay(to)}`, `القيمة: ${money(val)} ج.س`],
          view: (
            <>
              <ResultBox big tone="emerald" label={`الوزن بعيار ${karatDisplay(to)}`} value={fmtWeight(converted)} sub={`${unitsToGrams(converted).toFixed(3)} جرام — نفس كمية الذهب الخالص`} />
              <div className="grid grid-cols-2 gap-2">
                {[24, 22, 21, 18].map((k) => (
                  <ResultBox key={k} label={`بعيار ${k}`} value={fmtWeight(convertKarat(units, from, k))} />
                ))}
                <ResultBox tone="amber" label="القيمة بسعر 21" value={money(val)} />
                <ResultBox label="سعر جرام العيار الأصلي" value={money(pricePerGramFor(p21, from))} />
              </div>
            </>
          ),
        };
      }
      case 'melt': {
        const v = melt.values;
        if (v.mode === 'mix') {
          const rows = parseRows(v.rows);
          const parsed = rows.map((r) => ({ units: parseWeight(r.w) ?? 0, fineness: purityToFineness(toNum(r.p)) }));
          const r = calcMix(parsed);
          return {
            ok: r.totalUnits > 0,
            result: `${fmtWeight(r.totalUnits)} عيار ${fine(r.fineness)}`,
            value: undefined,
            lines: parsed.filter((x) => x.units > 0).map((x, i) => `${i + 1}) ${fmtWeight(x.units)} نقاوة ${Math.round(x.fineness)}`),
            view: (
              <div className="grid grid-cols-2 gap-2">
                <ResultBox big tone="emerald" label="الوزن بعد الخلط" value={fmtWeight(r.totalUnits)} sub={`${unitsToGrams(r.totalUnits).toFixed(2)} جرام`} />
                <ResultBox big tone="amber" label="العيار الناتج" value={r.totalUnits ? Math.round(r.fineness) : '—'} sub={r.totalUnits ? `≈ ${r.karat.toFixed(2)} قيراط` : undefined} />
              </div>
            ),
          };
        }
        const units = parseWeight(v.w) ?? 0;
        const r = calcMeltToTarget({ units, purity: toNum(v.p), targetPurity: toNum(v.t) });
        const what = r.action === 'pure' ? 'ذهب خالص (24)' : r.action === 'alloy' ? 'نحاس / سبيكة' : '';
        return {
          ok: units > 0 && r.action !== 'none' && r.action !== 'impossible',
          result: what ? `أضف ${fmtWeight(r.addUnits)} ${what}` : '—',
          value: undefined,
          lines: [
            `${fmtWeight(units)} عيار ${karatDisplay(toNum(v.p))} ← المستهدف ${karatDisplay(toNum(v.t))}`,
            `الوزن النهائي: ${fmtWeight(r.finalUnits)}`,
          ],
          view:
            r.action === 'impossible' ? (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3">لا يمكن الوصول لعيار 24 بالإضافة — يحتاج تكرير.</div>
            ) : r.action === 'none' ? (
              <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center">
                {units > 0 ? 'نفس العيار — لا حاجة لإضافة' : 'أدخل الوزن'}
              </div>
            ) : (
              <>
                <ResultBox big tone={r.action === 'pure' ? 'amber' : 'cyan'} label={`أضف ${what}`} value={fmtWeight(r.addUnits)} sub={`${unitsToGrams(r.addUnits).toFixed(3)} جرام`} />
                <div className="grid grid-cols-2 gap-2">
                  <ResultBox label="الوزن النهائي" value={fmtWeight(r.finalUnits)} tone="emerald" />
                  <ResultBox label="من ← إلى" value={`${Math.round(r.fromFineness)} ← ${Math.round(r.toFineness)}`} />
                </div>
              </>
            ),
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, value.values, weight.values, sum.values, profit.values, karat.values, melt.values, price21, approved?.buy, approved?.sell]);

  const currentInputs = (): Record<string, string> =>
    ({ value: value.values, weight: weight.values, sum: sum.values, profit: profit.values, karat: karat.values, melt: melt.values })[tool];

  const toolLabel = GOLD_TOOLS.find((t) => t.id === tool)!.label;

  const save = () => {
    if (!out?.ok) return onToast('أكمل المدخلات أولاً');
    onSave(makeEntry({ mode: 'gold', title: toolLabel, lines: out.lines, result: out.result, value: out.value, restore: { tool, inputs: { ...currentInputs() } } }));
    onToast('حُفظ في السجل ✓');
  };

  const copy = async () => {
    if (!out?.ok) return;
    const text = [toolLabel, ...out.lines, `= ${out.result}`].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      onToast('نُسخ ✓');
    } catch {
      onToast('تعذّر النسخ');
    }
  };

  const seg = (opts: { id: string; label: string }[], val: string, set: (v: string) => void) => (
    <div className="grid grid-flow-col auto-cols-fr gap-1 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
      {opts.map((o) => (
        <button key={o.id} type="button" onClick={() => set(o.id)} className={`py-2 rounded-xl text-xs font-black ${val === o.id ? 'bg-slate-800 text-amber-300' : 'text-slate-500'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* الأدوات */}
      <div className="grid grid-cols-3 gap-1.5">
        {GOLD_TOOLS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tool;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`py-2.5 px-1 rounded-2xl text-[11px] font-black flex flex-col items-center gap-1 border transition-colors ${
                on ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-4 shadow-xl">
        {/* المدخلات */}
        {tool === 'value' && (
          <>
            <WeightField value={value.values.w} onChange={(v) => value.set('w', v)} />
            <PurityPicker value={value.values.p} onChange={(v) => value.set('p', v)} />
            <MoneyField label={`سعر جرام 21${priceHint(value.values.price)}`} value={value.values.price} onChange={(v) => value.set('price', v)} placeholder={money(price21)} chips={priceChips} />
            <MoneyField label="المصنعية لكل جرام (اختياري)" value={value.values.work} onChange={(v) => value.set('work', v)} placeholder="0" />
          </>
        )}
        {tool === 'weight' && (
          <>
            <MoneyField label="المبلغ المتاح" value={weight.values.money} onChange={(v) => weight.set('money', v)} placeholder="10,000,000" />
            <PurityPicker value={weight.values.p} onChange={(v) => weight.set('p', v)} />
            <MoneyField label={`سعر جرام 21${priceHint(weight.values.price)}`} value={weight.values.price} onChange={(v) => weight.set('price', v)} placeholder={money(price21)} chips={priceChips} />
            <MoneyField label="المصنعية لكل جرام (اختياري)" value={weight.values.work} onChange={(v) => weight.set('work', v)} placeholder="0" />
          </>
        )}
        {tool === 'sum' && (
          <>
            <Label hint="كل قطعة بعيارها — النتيجة بمعادل 21">القطع</Label>
            <RowsEditor rowsJson={sum.values.rows} onChange={(s) => sum.set('rows', s)} />
            <MoneyField label={`سعر جرام 21${priceHint(sum.values.price)}`} value={sum.values.price} onChange={(v) => sum.set('price', v)} placeholder={money(price21)} chips={priceChips} />
          </>
        )}
        {tool === 'profit' && (
          <>
            <WeightField value={profit.values.w} onChange={(v) => profit.set('w', v)} />
            <PurityPicker value={profit.values.p} onChange={(v) => profit.set('p', v)} />
            <MoneyField
              label={`سعر شراء جرام 21${toNum(profit.values.buy) ? '' : ' (فارغ = الشراء المعتمد)'}`}
              value={profit.values.buy}
              onChange={(v) => profit.set('buy', v)}
              placeholder={money(approved?.buy || price21)}
              chips={priceChips}
            />
            {seg(
              [
                { id: 'price', label: 'أعرف سعر البيع' },
                { id: 'target', label: 'نسبة ربح مستهدفة' },
              ],
              profit.values.mode,
              (m) => profit.set('mode', m)
            )}
            {profit.values.mode === 'target' ? (
              <div>
                <Label hint="على التكلفة">نسبة الربح %</Label>
                <div className="flex gap-1.5">
                  {['2', '3', '5', '10'].map((x) => (
                    <button key={x} type="button" onClick={() => profit.set('target', x)} className={`flex-1 py-2.5 rounded-xl text-xs font-black border ${profit.values.target === x ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>
                      {x}%
                    </button>
                  ))}
                  <input inputMode="decimal" dir="ltr" value={profit.values.target} onChange={(e) => profit.set('target', e.target.value.replace(/[^\d.−-]/g, ''))} className="w-20 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-400" />
                </div>
              </div>
            ) : (
              <MoneyField
                label={`سعر بيع جرام 21${toNum(profit.values.sell) ? '' : ' (فارغ = البيع المعتمد)'}`}
                value={profit.values.sell}
                onChange={(v) => profit.set('sell', v)}
                placeholder={money(approved?.sell || price21)}
                chips={priceChips}
              />
            )}
          </>
        )}
        {tool === 'karat' && (
          <>
            <WeightField value={karat.values.w} onChange={(v) => karat.set('w', v)} />
            <PurityPicker label="من عيار" value={karat.values.from} onChange={(v) => karat.set('from', v)} />
            <PurityPicker label="إلى عيار" value={karat.values.to} onChange={(v) => karat.set('to', v)} />
            <MoneyField label={`سعر جرام 21${priceHint(karat.values.price)}`} value={karat.values.price} onChange={(v) => karat.set('price', v)} placeholder={money(price21)} chips={priceChips} />
          </>
        )}
        {tool === 'melt' && (
          <>
            {seg(
              [
                { id: 'target', label: 'الوصول لعيار' },
                { id: 'mix', label: 'خلط قطع' },
              ],
              melt.values.mode,
              (m) => melt.set('mode', m)
            )}
            {melt.values.mode === 'mix' ? (
              <>
                <Label hint="24 = خالص • نحاس = 0">القطع المخلوطة</Label>
                <RowsEditor rowsJson={melt.values.rows} onChange={(s) => melt.set('rows', s)} withCopper />
              </>
            ) : (
              <>
                <WeightField value={melt.values.w} onChange={(v) => melt.set('w', v)} />
                <PurityPicker label="العيار الحالي" value={melt.values.p} onChange={(v) => melt.set('p', v)} />
                <PurityPicker label="العيار المطلوب" value={melt.values.t} onChange={(v) => melt.set('t', v)} />
              </>
            )}
          </>
        )}

        {/* النتيجة */}
        <div className="border-t border-slate-800 pt-4 space-y-2">{out?.view}</div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={save} disabled={!out?.ok} className="py-3 rounded-2xl bg-amber-500 text-slate-950 text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Save className="w-4 h-4" /> حفظ في السجل
          </button>
          <button type="button" onClick={copy} disabled={!out?.ok} className="py-3 rounded-2xl bg-slate-800 text-slate-200 text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Copy className="w-4 h-4" /> نسخ
          </button>
        </div>
        <p className="text-[10px] text-slate-500 text-center">1 جرام = 10 حبات = 100 جزء • التسعير على عيار 21 (875)</p>
      </div>
    </div>
  );
};
