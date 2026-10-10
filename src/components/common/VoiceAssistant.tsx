'use client';

/**
 * المساعد الصوتي — زرار مايك عائم في كل الشاشات.
 *
 * تقول: «احسب 10 غرام عيار 21» فيحسب ويقرا الرد بصوت،
 * أو «شحال غرام بمية ألف»، «سعر الذهب»، «افتح المبيعات»...
 * ولو المايك مش متاح فيكتب الأمر بالكيبورد وينفذ برضه.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, X, Send, Square } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  parseCommand,
  stripNamePrefix,
  VOICE_EXAMPLES,
  type VoiceCommand,
} from '../../core/voiceCommands';
import {
  calcValue,
  calcWeightFromMoney,
  convertKarat,
  sumWeights,
  fmtWeight,
  unitsToGrams,
} from '../../core/goldCalc';
import { fmtNum } from '../../core/format';
import { finenessToKarat } from '../../core/purity';
import { pricePerGramFor } from '../../core/goldCalc';
import { loanPending } from '../../core/loans';
import { salePending, purchasePending } from '../../core/accounting';
import { normalizeVoiceText } from '../../core/voiceCommands';
import type { RestoreRequest } from '../calculator/GoldCalculator';
import {
  listenOnce,
  speak,
  stopSpeaking,
  isSpeechRecognitionSupported,
} from '../../services/speech';

type Props = {
  onNavigate: (tab: string) => void;
  onCalc: (req: RestoreRequest) => void;
};

type Reply = { kind: 'ok' | 'err' | 'info'; text: string; say?: string };

const HELP_TEXT =
  'حساب: «احسب 10 غرام عيار 21» • «شحال غرام بمية ألف» • «حول 10 غرام من 18 إلى 21» • «اجمع 5 و 8 غرام»\nتسجيل: «سجل مشتريات 2 غرام عيار 21 بسعر 104 الف» • «سجل مبيعات 30 غرام واتنين حبة بسعر 89 الف لفراس» • «صرفت 50 الف كهرباء» • «سلفة 100 الف لخالد يستحق بعد شهر» • «سجل دفعة 50 الف لأحمد»\nأسعار: «سعر الذهب» • «شحال الدولار» — وتنقل: «افتح المبيعات»';

/** يلفظ الوزن بشكل مفهوم: «22.6.0» → «22 غرام و 6 حبات» */
const weightWords = (units: number): string => {
  const grams = unitsToGrams(units);
  const whole = Math.floor(grams + 1e-9);
  const habba = Math.round((grams - whole) * 10);
  if (habba > 0) return `${whole} غرام و ${habba} حبة`;
  return `${grams.toFixed(grams % 1 ? 2 : 0)} غرام`;
};

const purityLabel = (p: number): string => {
  if (p <= 24) return `عيار ${p}`;
  return `نقاوة ${p} (عيار ${finenessToKarat(p).toFixed(1)})`;
};

export const VoiceAssistant: React.FC<Props> = ({ onNavigate, onCalc }) => {
  const store = useGoldStore();
  const { rates, approvedPrice } = store;
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const [typed, setTyped] = useState('');
  const stopListenRef = useRef<(() => void) | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supported = isSpeechRecognitionSupported();

  const stopListening = useCallback(() => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    setListening(false);
  }, []);

  const close = useCallback(() => {
    stopListening();
    stopSpeaking();
    setOpen(false);
    setListening(false);
  }, [stopListening]);

  useEffect(() => () => {
    stopListenRef.current?.();
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    stopSpeaking();
  }, []);

  const execCommand = useCallback(
    (cmd: VoiceCommand): Reply => {
      const price21 = Number(rates.karat21) || 0;
      /* يفهم السعر المذكور: للجرام ولا إجمالي؟ (يقارن بقيمة السوق) */
      const resolvePrice = (c: { price?: number; priceMode: 'per_gram' | 'total' | 'auto'; purity: number }, grams: number) => {
        const market = pricePerGramFor(price21, c.purity || 21);
        if (c.priceMode === 'total' && c.price) {
          return { perGram: grams > 0 ? c.price / grams : c.price, total: c.price, how: 'إجمالي' };
        }
        if (c.priceMode === 'per_gram' && c.price) {
          return { perGram: c.price, total: c.price * grams, how: 'للجرام' };
        }
        if (c.price && grams > 0) {
          const expected = market * grams;
          const errAsTotal = Math.abs(c.price - expected);
          const errAsPerGram = Math.abs(c.price * grams - expected);
          if (errAsTotal < errAsPerGram) {
            return { perGram: c.price / grams, total: c.price, how: 'إجمالي' };
          }
          return { perGram: c.price, total: c.price * grams, how: 'للجرام' };
        }
        return { perGram: market, total: market * grams, how: 'بسعر السوق' };
      };
      const dueDateFrom = (days?: number) => (days ? new Date(Date.now() + days * 86400000).toISOString() : undefined);

      switch (cmd.type) {
        case 'gold_price': {
          const parts = [`جرام عيار 21: ${fmtNum(price21)} جنيه`];
          if (approvedPrice) {
            parts.push(`بيع ${fmtNum(approvedPrice.sell)}`, `شراء ${fmtNum(approvedPrice.buy)}`);
          }
          const text = `سعر الذهب — ${parts.join(' • ')}`;
          return { kind: 'ok', text, say: text };
        }
        case 'usd_price': {
          const text = `الدولار — بيع ${fmtNum(Number(rates.usdRate) || 0)} • شراء ${fmtNum(Number(rates.usdBuyRate) || 0)} جنيه`;
          return { kind: 'ok', text, say: text };
        }
        case 'calc_value': {
          const r = calcValue({
            units: cmd.units,
            purity: cmd.purity,
            price21,
            workmanshipPerGram: 0,
          });
          onCalc({
            tool: 'value',
            inputs: { w: fmtWeight(cmd.units), p: String(cmd.purity), price: '', work: '' },
            nonce: Date.now(),
          });
          const text = `${weightWords(cmd.units)} ${purityLabel(cmd.purity)} — قيمتهم ${fmtNum(r.total)} جنيه`;
          return { kind: 'ok', text, say: text };
        }
        case 'calc_weight': {
          const r = calcWeightFromMoney({
            money: cmd.money,
            purity: cmd.purity,
            price21,
            workmanshipPerGram: 0,
          });
          onCalc({
            tool: 'weight',
            inputs: { money: String(cmd.money), p: String(cmd.purity), price: '', work: '' },
            nonce: Date.now(),
          });
          const text = `بمبلغ ${fmtNum(cmd.money)} تجيب ${weightWords(r.units)} (${unitsToGrams(r.units).toFixed(2)} جرام) ${purityLabel(cmd.purity)}`;
          return { kind: 'ok', text, say: text };
        }
        case 'calc_karat': {
          const res = convertKarat(cmd.units, cmd.from, cmd.to);
          onCalc({
            tool: 'karat',
            inputs: { w: fmtWeight(cmd.units), from: String(cmd.from), to: String(cmd.to), price: '' },
            nonce: Date.now(),
          });
          const text = `${weightWords(cmd.units)} ${purityLabel(cmd.from)} تعادل ${weightWords(res)} ${purityLabel(cmd.to)}`;
          return { kind: 'ok', text, say: text };
        }
        case 'calc_sum': {
          const res = sumWeights(
            cmd.items.map((it) => ({ units: it.units, purity: it.purity })),
            price21
          );
          onCalc({
            tool: 'sum',
            inputs: {
              rows: JSON.stringify(cmd.items.map((it) => ({ w: fmtWeight(it.units), p: String(it.purity) }))),
              price: '',
            },
            nonce: Date.now(),
          });
          const text = `المجموع ${weightWords(res.totalUnits)} — معادل عيار 21: ${weightWords(res.k21Units)}`;
          return { kind: 'ok', text, say: text };
        }
        case 'navigate': {
          onNavigate(cmd.tab);
          const names: Record<string, string> = {
            dashboard: 'الرئيسية', calculator: 'الحاسبة', partners: 'الشركاء', purchases: 'المشتريات',
            sales: 'المبيعات', expenses: 'المصاريف', gold_price: 'محرك الأسعار', reports: 'التقارير',
            analytics: 'التحليلات', reminders: 'التذكيرات', loans: 'القروض والأمانات', archive: 'الأرشيف',
            settings: 'الإعدادات', search: 'البحث',
          };
          const text = `فتحت ${names[cmd.tab] ?? cmd.tab}`;
          return { kind: 'ok', text, say: text };
        }
        case 'help':
          return { kind: 'info', text: HELP_TEXT, say: 'بفهم أوامر زي: احسب 10 غرام عيار 21، سجل مبيعات 5 غرام، سعر الذهب، وافتح المبيعات' };
        /* ---------- تسجيل العمليات ---------- */
        case 'add_purchase': {
          const grams = unitsToGrams(cmd.units);
          const pr = resolvePrice(cmd, grams);
          const total = Math.round(pr.total);
          store.addPurchase({
            date: new Date().toISOString(),
            units: cmd.units,
            purity: cmd.purity,
            amount: total,
            pendingAmount: cmd.deferred ? total : 0,
            seller: cmd.person || 'بائع عام',
            sellerPhone: '',
            bankAccount: '',
            notes: '🎙️ مسجل بالصوت',
            dueDate: undefined,
          });
          onNavigate('purchases');
          const text = `سجلت في المشتريات ✓ ${weightWords(cmd.units)} ${purityLabel(cmd.purity)} بإجمالي ${fmtNum(total)} جنيه (${fmtNum(pr.perGram)} للجرام${pr.how === 'بسعر السوق' ? ' — سعر السوق' : ''})${cmd.person ? ` من ${cmd.person}` : ''}${cmd.deferred ? ' — آجل' : ' — كاش'}`;
          return { kind: 'ok', text, say: text };
        }
        case 'add_sale': {
          const grams = unitsToGrams(cmd.units);
          const pr = resolvePrice(cmd, grams);
          const total = Math.round(pr.total);
          store.addSale({
            date: new Date().toISOString(),
            units: cmd.units,
            purity: cmd.purity,
            sellAmount: total,
            buyAmount: 0,
            buyer: cmd.person || 'زبون عام',
            buyerPhone: '',
            notes: '🎙️ مسجل بالصوت',
            paidAmount: cmd.deferred ? 0 : total,
            pendingAmount: cmd.deferred ? total : 0,
          });
          onNavigate('sales');
          const text = `سجلت في المبيعات ✓ ${weightWords(cmd.units)} ${purityLabel(cmd.purity)} بإجمالي ${fmtNum(total)} جنيه (${fmtNum(pr.perGram)} للجرام${pr.how === 'بسعر السوق' ? ' — سعر السوق' : ''})${cmd.person ? ` لـ${cmd.person}` : ''}${cmd.deferred ? ' — آجل على الزبون' : ' — كاش'}`;
          return { kind: 'ok', text, say: text };
        }
        case 'add_expense': {
          store.addExpense({
            date: new Date().toISOString(),
            amount: cmd.amount,
            category: 'منصرفات عامة',
            target: 'عام',
            name: cmd.name || 'مصروف',
            notes: '🎙️ مسجل بالصوت',
          });
          onNavigate('expenses');
          const text = `سجلت المصروف ✓ ${cmd.name || 'مصروف'} — ${fmtNum(cmd.amount)} جنيه`;
          return { kind: 'ok', text, say: text };
        }
        case 'add_loan': {
          const dueDate = dueDateFrom(cmd.dueDays);
          store.addLoan({
            date: new Date().toISOString(),
            person: cmd.person || 'بدون اسم',
            amount: cmd.amount,
            direction: cmd.direction,
            dueDate,
            notes: '🎙️ مسجل بالصوت',
          });
          onNavigate('loans');
          const text = cmd.direction === 'lent'
            ? `سجلت سلفة ✓ ${cmd.person || ''} — ${fmtNum(cmd.amount)} جنيه${dueDate ? ` تستحق ${new Date(dueDate).toLocaleDateString('ar-SD')}` : ''}`
            : `سجلت استلاف ✓ من ${cmd.person} — ${fmtNum(cmd.amount)} جنيه`;
          return { kind: 'ok', text, say: text };
        }
        case 'add_payment': {
          const norm = (s: string) => stripNamePrefix(normalizeVoiceText(s));
          const spoken = norm(cmd.person);
          const loan = store.loans.find(
            (l) => !l.archived && loanPending(l) > 0 && (norm(l.person).includes(spoken) || spoken.includes(norm(l.person)))
          );
          if (loan) {
            store.addPaymentToLoan(loan.id, { date: new Date().toISOString(), amount: cmd.amount, note: '🎙️ دفعة بالصوت' });
            onNavigate('loans');
            const pending = Math.max(0, loanPending(loan) - cmd.amount);
            const text = `سجلت دفعة ✓ ${fmtNum(cmd.amount)} جنيه لـ${loan.person} على السلفة${pending > 0 ? ` — باقي عليه ${fmtNum(pending)}` : ' — خلصت السلفة كاملة'}`;
            return { kind: 'ok', text, say: text };
          }
          const purchase = store.purchases.find(
            (p) => !p.archived && purchasePending(p) > 0 && (norm(p.seller).includes(spoken) || spoken.includes(norm(p.seller)))
          );
          if (purchase) {
            store.addPaymentToPurchase(purchase.id, { date: new Date().toISOString(), amount: cmd.amount, note: '🎙️ دفعة بالصوت' });
            onNavigate('purchases');
            const pending = Math.max(0, purchasePending(purchase) - cmd.amount);
            const text = `سجلت دفعة ✓ ${fmtNum(cmd.amount)} جنيه للمورد ${purchase.seller}${pending > 0 ? ` — باقي ${fmtNum(pending)}` : ' — خلص الحساب'}`;
            return { kind: 'ok', text, say: text };
          }
          const sale = store.sales.find(
            (s) => !s.archived && salePending(s) > 0 && (norm(s.buyer).includes(spoken) || spoken.includes(norm(s.buyer)))
          );
          if (sale) {
            store.addPaymentToSale(sale.id, { date: new Date().toISOString(), amount: cmd.amount, note: '🎙️ دفعة بالصوت' });
            onNavigate('sales');
            const pending = Math.max(0, salePending(sale) - cmd.amount);
            const text = `سجلت دفعة ✓ ${fmtNum(cmd.amount)} جنيه من ${sale.buyer}${pending > 0 ? ` — باقي عليه ${fmtNum(pending)}` : ' — خلص حسابه'}`;
            return { kind: 'ok', text, say: text };
          }
          return { kind: 'err', text: `ما لقيت سلفة أو دين باسم «${cmd.person}» — اتأكد من الاسم أو سجلها يدوي`, say: `ما لقيت حساب باسم ${cmd.person}` };
        }
        default:
          return { kind: 'err', text: `ما فهمتش الأمر — جرّب واحد من الأمثلة`, say: 'ما فهمتش، جرّب: احسب 10 غرام عيار 21' };
      }
    },
    [store, rates, approvedPrice, onCalc, onNavigate]
  );

  const runText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      stopSpeaking();
      const cmd = parseCommand(clean);
      const r = execCommand(cmd);
      setReply(r);
      if (r.say) speak(r.say);
    },
    [execCommand]
  );

  const startListening = useCallback(() => {
    stopSpeaking();
    setHeard('');
    setReply(null);
    setListening(true);
    // حارس أمان: لو المايك ما ردّ أي حدث (بعض الأجهزة/المتصفحات) نوقف السماع تلقائياً
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
    }, 16000);
    stopListenRef.current = listenOnce({
      onInterim: (t) => setHeard(t),
      onFinal: (t) => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        setHeard(t);
        setListening(false);
        stopListenRef.current = null;
        runText(t);
      },
      onError: (msg) => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        setListening(false);
        stopListenRef.current = null;
        if (msg) setReply({ kind: 'err', text: msg });
      },
      onEnd: () => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        stopListenRef.current = null;
        setListening(false);
      },
    });
  }, [runText]);

  const toggleOpen = useCallback(() => {
    if (open) return close();
    setOpen(true);
    if (supported) setTimeout(startListening, 150);
    else setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, close, supported, startListening]);

  const submitTyped = () => {
    const t = typed.trim();
    if (!t) return;
    setTyped('');
    setHeard(t);
    runText(t);
  };

  return (
    <>
      {/* الزرار العائم */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="الأوامر الصوتية"
        className={`fixed bottom-[84px] left-3 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 ${
          listening
            ? 'bg-rose-500 text-white shadow-rose-900/50 animate-pulse'
            : 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-900/40'
        }`}
      >
        {listening ? <Square className="w-6 h-6" /> : <Mic className="w-7 h-7" />}
      </button>

      {/* اللوحة */}
      {open && (
        <div className="fixed inset-x-2 bottom-[152px] z-50 mx-auto max-w-md" dir="rtl">
          <div className="bg-slate-900/95 backdrop-blur border border-amber-500/30 rounded-3xl shadow-2xl shadow-black/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-black text-amber-300">الأوامر الصوتية</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {listening ? 'بسمعك... اتكلم' : supported ? 'اضغط المايك واتكلم — أو اكتب' : 'اكتب الأمر واله ينفذه'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={close} aria-label="إغلاق" className="p-2 rounded-xl text-slate-400 bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* اللي سمعه */}
            {(heard || listening) && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-sm text-slate-300 min-h-[38px]" dir="auto">
                {heard || <span className="text-slate-500">...بسمعك</span>}
              </div>
            )}

            {/* الرد */}
            {reply && (
              <div
                className={`rounded-2xl px-3 py-2.5 text-sm font-bold leading-relaxed ${
                  reply.kind === 'ok'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                    : reply.kind === 'err'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
                      : 'bg-slate-800/60 border border-slate-700 text-slate-200'
                }`}
                dir="auto"
              >
                {reply.text}
              </div>
            )}

            {/* كتابة الأمر */}
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
                placeholder="أو اكتب الأمر هنا..."
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none"
                dir="auto"
              />
              {supported && (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? 'إيقاف السماع' : 'سماع'}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${listening ? 'bg-rose-500 text-white' : 'bg-slate-800 text-amber-300'}`}
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={submitTyped}
                aria-label="تنفيذ"
                className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* أمثلة */}
            {!reply && !listening && !heard && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {VOICE_EXAMPLES.slice(0, 4).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => { setHeard(ex); runText(ex); }}
                    className="text-[11px] font-bold text-slate-300 bg-slate-800/80 border border-slate-700 rounded-full px-2.5 py-1.5"
                    dir="auto"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
