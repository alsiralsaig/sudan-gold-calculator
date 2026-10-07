'use client';

import React, { useEffect, useState } from 'react';
import { Store, Check, ChevronLeft } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { DEFAULT_STORE_NAME, normalizeStoreName, shouldPromptStoreName } from '../../core/branding';

/** مفتاح محلي: هل اختار صاحب الجهاز اسم محله (أو تخطّى)؟ */
const CHOSEN_KEY = 'gold_store_name_chosen_v1';

/**
 * شاشة ترحيب — تُعرض مرة واحدة في التثبيت الجديد فقط:
 * «ما اسم محلك؟» حتى يختار كل من ينزّل التطبيق اسمه بنفسه،
 * بدل أن يبقى على الاسم الافتراضي. يمكن تغييره لاحقاً من الإعدادات.
 */
export const StoreNamePrompt: React.FC = () => {
  const { storeName, setStoreName, purchases, sales, expenses, partners, loans, userEmail } =
    useGoldStore();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let chosen = false;
    try {
      chosen = localStorage.getItem(CHOSEN_KEY) === '1';
    } catch {
      chosen = false;
    }

    const hasRecords = [purchases, sales, expenses, partners, loans].some((a) => a.length > 0);
    const prompt = shouldPromptStoreName({ chosen, hasRecords, userEmail });

    if (!prompt) {
      // مستخدم قديم — لا نزعجه: نثبّت العلامة حتى لا تظهر لاحقاً لو فرّغ البيانات
      if (!chosen) {
        try {
          localStorage.setItem(CHOSEN_KEY, '1');
        } catch {
          /* تجاهل */
        }
      }
      return;
    }

    setDraft(storeName === DEFAULT_STORE_NAME ? '' : storeName);
    setVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases.length, sales.length, expenses.length, partners.length, loans.length, userEmail]);

  const close = () => {
    try {
      localStorage.setItem(CHOSEN_KEY, '1');
    } catch {
      /* تجاهل */
    }
    setVisible(false);
  };

  const confirm = () => {
    setStoreName(normalizeStoreName(draft));
    close();
  };

  if (!visible) return null;

  const preview = normalizeStoreName(draft);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl">
            <Store className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-base text-white">أهلاً بك في حاسبة الذهب 👋</h2>
            <p className="text-[11px] text-slate-400">خطوة واحدة قبل ما تبدأ</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">ما اسم محلك؟</label>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
            }}
            enterKeyHint="done"
            placeholder={DEFAULT_STORE_NAME}
            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            يظهر في ترويسة رسائل الواتساب، الفواتير، التقارير، والتذكيرات — وتقدر تغيّره في أي وقت
            من <span className="text-amber-300 font-bold">الإعدادات ← اسم المحل</span>.
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 shrink-0">هكذا ستظهر الرسالة:</span>
          <span className="font-black text-amber-300 truncate">{'*' + preview + '*'}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={confirm}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-colors"
          >
            <Check className="w-4 h-4" />
            حفظ والمتابعة
          </button>
          <button
            onClick={close}
            className="shrink-0 flex items-center gap-1 py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            title="سيبقى الاسم الافتراضي ويمكن تغييره من الإعدادات"
          >
            لاحقاً
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreNamePrompt;
