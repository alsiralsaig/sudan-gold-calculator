'use client';

/**
 * المساعد الصوتي — مايك صغير زي أيقونة البحث.
 * ضغطة وحدة = بيسمعك على طول. الرد ييجي في فقاعة صغيرة تختفي لوحدها — ما بتغطيش الشاشة.
 * لو المايك مش متاح، تظهر سطر كتابة رفيع بداله.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Keyboard, X, Square } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  parseCommand,
  stripNamePrefix,
  normalizeVoiceText,
  type VoiceCommand,
} from '../../core/voiceCommands';
import {
  calcValue,
  calcWeightFromMoney,
  convertKarat,
  sumWeights,
  fmtWeight,
  unitsToGrams,
  pricePerGramFor,
} from '../../core/goldCalc';
import { fmtNum } from '../../core/format';
import { finenessToKarat } from '../../core/purity';
import { loanPending } from '../../core/loans';
import { salePending, purchasePending } from '../../core/accounting';
import type { RestoreRequest } from '../calculator/GoldCalculator';
import {
  listenOnce,
  speak,
  stopSpeaking,
  isSpeechRecognitionSupported,
} from '../../services/speech';
import {
  aiParseCommand,
  sanitizeAiCommand,
  teachPhrase,
  lookupLearned,
} from '../../services/voiceAi';

type Props = {
  onNavigate: (tab: string) => void;
  onCalc: (req: RestoreRequest) => void;
};

type Reply = { kind: 'ok' | 'err' | 'info'; text: string; say?: string };

const HELP_TEXT =
  'حساب: «احسب 10 غرام عيار 21» • «كام غرام بمية ألف»\nتسجيل: «سجل مشتريات 2 غرام عيار 21 بسعر 104 الف» • «سجل مبيعات 30 غرام واتنين حبة بسعر 89 الف لفراس» • «صرفت 50 الف كهرباء» • «سلفة 100 الف لخالد» • «سجل دفعة 50 الف لأحمد»\nأسعار: «الذهب كام؟» • «كام الدولار؟» — وتنقل: «افتح المبيعات»';

/** يلفظ الوزن بشكل مفهوم: «22.6.0» → «22 غرام و 6 حبات» */
const weightWords = (units: number): string => {
  const grams = unitsToGrams(units);
  const whole = Math.floor(grams + 1e-9);
  const habba = Math.round((grams - whole) * 10);
  if (habba > 0 && whole > 0) return `${whole} غرام و ${habba} حبة`;
  if (habba > 0) return `${habba} حبة`;
  return `${grams.toFixed(grams % 1 ? 2 : 0)} غرام`;
};

const purityLabel = (p: number): string => {
  if (p <= 24) return `عيار ${p}`;
  return `نقاوة ${p} (عيار ${finenessToKarat(p).toFixed(1)})`;
};

export const VoiceAssistant: React.FC<Props> = ({ onNavigate, onCalc }) => {
  const store = useGoldStore();
  const { rates, approvedPrice } = store;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const [showType, setShowType] = useState(false);
  const [typed, setTyped] = useState('');
  const stopListenRef = useRef<(() => void) | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supported = isSpeechRecognitionSupported();

  const flashHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setReply(null), 6000);
  }, []);

  const stopListening = useCallback(() => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => {
    stopListenRef.current?.();
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
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
      /** العيار في الكلام: يتذكر فقط لو المستخدم قاله بنفسه */
      const karatPart = (c: { purity: number; purityExplicit: boolean }) => (c.purityExplicit ? ` ${purityLabel(c.purity)}` : '');

      switch (cmd.type) {
        case 'gold_price': {
          const parts = [`جرام عيار 21: ${fmtNum(price21)} جنيه`];
          if (approvedPrice) {
            parts.push(`بيع ${fmtNum(approvedPrice.sell)}`, `شراء ${fmtNum(approvedPrice.buy)}`);
          }
          const text = `الذهب — ${parts.join(' • ')}`;
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
          onNavigate('calculator');
          const text = `${weightWords(cmd.units)}${karatPart(cmd)} = ${fmtNum(r.total)} جنيه`;
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
          onNavigate('calculator');
          const text = `${fmtNum(cmd.money)} تجيب ${weightWords(r.units)}${karatPart(cmd)}`;
          return { kind: 'ok', text, say: text };
        }
        case 'calc_karat': {
          const res = convertKarat(cmd.units, cmd.from, cmd.to);
          onCalc({
            tool: 'karat',
            inputs: { w: fmtWeight(cmd.units), from: String(cmd.from), to: String(cmd.to), price: '' },
            nonce: Date.now(),
          });
          onNavigate('calculator');
          const text = `${weightWords(cmd.units)} ${purityLabel(cmd.from)} = ${weightWords(res)} ${purityLabel(cmd.to)}`;
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
          onNavigate('calculator');
          const text = `المجموع ${weightWords(res.totalUnits)} — معادل 21: ${weightWords(res.k21Units)}`;
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
          return { kind: 'info', text: HELP_TEXT, say: 'بفهم أوامر زي: احسب 10 غرام عيار 21، سجل مبيعات 5 غرام، الذهب كام' };
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
          const text = `سجلت في المشتريات ✓ ${weightWords(cmd.units)}${karatPart(cmd)} = ${fmtNum(total)} جنيه${cmd.person ? ` من ${cmd.person}` : ''}${cmd.deferred ? ' — آجل' : ''}`;
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
          const text = `سجلت في المبيعات ✓ ${weightWords(cmd.units)}${karatPart(cmd)} = ${fmtNum(total)} جنيه${cmd.person ? ` لـ${cmd.person}` : ''}${cmd.deferred ? ' — آجل' : ''}`;
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
            const text = `سجلت دفعة ✓ ${fmtNum(cmd.amount)} لـ${loan.person}${pending > 0 ? ` — باقي ${fmtNum(pending)}` : ' — خلصت السلفة'}`;
            return { kind: 'ok', text, say: text };
          }
          const purchase = store.purchases.find(
            (p) => !p.archived && purchasePending(p) > 0 && (norm(p.seller).includes(spoken) || spoken.includes(norm(p.seller)))
          );
          if (purchase) {
            store.addPaymentToPurchase(purchase.id, { date: new Date().toISOString(), amount: cmd.amount, note: '🎙️ دفعة بالصوت' });
            onNavigate('purchases');
            const pending = Math.max(0, purchasePending(purchase) - cmd.amount);
            const text = `سجلت دفعة ✓ ${fmtNum(cmd.amount)} للمورد ${purchase.seller}${pending > 0 ? ` — باقي ${fmtNum(pending)}` : ' — خلص الحساب'}`;
            return { kind: 'ok', text, say: text };
          }
          const sale = store.sales.find(
            (s) => !s.archived && salePending(s) > 0 && (norm(s.buyer).includes(spoken) || spoken.includes(norm(s.buyer)))
          );
          if (sale) {
            store.addPaymentToSale(sale.id, { date: new Date().toISOString(), amount: cmd.amount, note: '🎙️ دفعة بالصوت' });
            onNavigate('sales');
            const pending = Math.max(0, salePending(sale) - cmd.amount);
            const text = `سجلت دفعة ✓ ${fmtNum(cmd.amount)} من ${sale.buyer}${pending > 0 ? ` — باقي عليه ${fmtNum(pending)}` : ' — خلص حسابه'}`;
            return { kind: 'ok', text, say: text };
          }
          return { kind: 'err', text: `ما لقيت حساب باسم «${cmd.person}»`, say: `ما لقيت حساب باسم ${cmd.person}` };
        }
        default:
          return { kind: 'err', text: 'ما فهمت — دوس ⌨ واكتب الأمر أو قول «الاوامر»', say: 'ما فهمت، جرّب: احسب 10 غرام عيار 21' };
      }
    },
    [store, rates, approvedPrice, onCalc, onNavigate]
  );

  const runText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      stopSpeaking();
      let cmd = parseCommand(clean);
      /* المتعلم: جملة اتعلمناها قبل كده من الـAI بتشتغل محلياً بلا نت */
      if (cmd.type === 'unknown') {
        const learned = lookupLearned(clean);
        if (learned) {
          const safe = sanitizeAiCommand(learned);
          if (safe) cmd = safe;
        }
      }
      if (cmd.type !== 'unknown') {
        const r = execCommand(cmd);
        setReply(r);
        flashHide();
        if (r.say) speak(r.say);
        return;
      }
      /* المحلي ما فهمش — ندور على الـAI (والفقاعة تبقى «بفكر...») */
      setReply({ kind: 'info', text: 'بفكر... ثواني 🤔' });
      flashHide();
      (async () => {
        try {
          const ai = await aiParseCommand(normalizeVoiceText(clean));
          const safe = ai ? sanitizeAiCommand(ai) : null;
          if (safe) {
            teachPhrase(clean, ai as Record<string, unknown>);
            const r = execCommand(safe);
            setReply(r);
            flashHide();
            if (r.say) speak(r.say);
          } else {
            const r: Reply = { kind: 'err', text: 'ما فهمت — دوس ⌨ واكتبها أو قولها بطريقة تانية' };
            setReply(r);
            flashHide();
          }
        } catch {
          const r: Reply = { kind: 'err', text: 'الذكاء الاصطناعي مش متاح دلوقتي — جرّب تاني' };
          setReply(r);
          flashHide();
        }
      })();
    },
    [execCommand, flashHide]
  );

  const startListening = useCallback(() => {
    stopSpeaking();
    setHeard('');
    setReply(null);
    setShowType(false);
    setListening(true);
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
        if (msg) {
          setReply({ kind: 'err', text: msg });
          flashHide();
        }
      },
      onEnd: () => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        stopListenRef.current = null;
        setListening(false);
      },
    });
  }, [runText, flashHide]);

  const tapMic = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    if (supported) startListening();
    else setShowType(true);
  }, [listening, supported, startListening, stopListening]);

  const submitTyped = () => {
    const t = typed.trim();
    if (!t) return;
    setTyped('');
    setShowType(false);
    setHeard(t);
    runText(t);
  };

  return (
    <>
      {/* الفقاعة الصغيرة — الرد/الحالة */}
      {(listening || heard || reply) && !showType && (
        <div className="fixed bottom-[182px] left-2 z-50 max-w-[270px]" dir="rtl">
          <div
            className={`rounded-2xl px-3 py-2 text-[12px] font-bold leading-snug shadow-lg shadow-black/50 border ${
              listening
                ? 'bg-rose-500/90 border-rose-400 text-white'
                : reply?.kind === 'err'
                  ? 'bg-slate-900/95 border-rose-500/40 text-rose-200'
                  : reply?.kind === 'info'
                    ? 'bg-slate-900/95 border-slate-600 text-slate-200 whitespace-pre-line'
                    : 'bg-slate-900/95 border-amber-500/40 text-amber-200'
            }`}
            onClick={() => { setReply(null); setHeard(''); }}
          >
            {listening ? (
              <span>{heard || 'بسمعك... اتكلم'}</span>
            ) : reply ? (
              <>
                {heard && <span className="block text-slate-500 text-[11px] leading-snug">{heard}</span>}
                <span>{reply.text}</span>
              </>
            ) : (
              <span>{heard}</span>
            )}
          </div>
        </div>
      )}

      {/* سطر الكتابة الرفيع */}
      {showType && (
        <div className="fixed bottom-[134px] left-2 right-16 z-50" dir="rtl">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur border border-amber-500/40 rounded-full pl-2 pr-3 py-1.5 shadow-lg shadow-black/50">
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
              placeholder="اكتب الأمر..."
              autoFocus
              className="flex-1 min-w-0 bg-transparent text-sm text-white font-bold focus:outline-none"
              dir="auto"
            />
            <button type="button" onClick={() => setShowType(false)} aria-label="إغلاق الكتابة" className="p-1.5 text-slate-500">
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={submitTyped}
              aria-label="تنفيذ"
              className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* زرار المايك الصغير — زي أيقونة البحث */}
      <button
        type="button"
        onClick={tapMic}
        aria-label="الأوامر الصوتية"
        className={`fixed bottom-[86px] left-2 z-50 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 ${
          listening
            ? 'bg-rose-500 text-white shadow-rose-900/50 animate-pulse'
            : 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-900/40'
        }`}
      >
        {listening ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* زرار الكتابة الصغير (فوق المايك) */}
      {!showType && !listening && (
        <button
          type="button"
          onClick={() => { setShowType(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          aria-label="كتابة أمر"
          className="fixed bottom-[134px] left-2 z-50 w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 shadow-lg flex items-center justify-center"
        >
          <Keyboard className="w-5 h-5" />
        </button>
      )}
    </>
  );
};
