'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  lang?: string;
  /** صمت بعد آخر كلمة قبل ما ينفذ (ملي ثانية) */
  silenceMs?: number;
  /** أقصى مدة للجملة الواحدة */
  maxMs?: number;
  /** بيتنادى مرة واحدة بس، بالنص النهائي الكامل */
  onFinal: (text: string) => void;
};

// كلمة ختام اختيارية: قول «خلاص» أو «نفذ» في آخر الجملة عشان ينفذ فوراً
const END_WORD = /(?:^|\s)(?:خلاص|نفذ|نفّذ)\s*$/;
const IDLE_MS = 8000; // لو ما اتكلمت خالص بعد الضغط

export function useVoiceCommand({ lang = 'ar-SA', silenceMs = 2500, maxMs = 30000, onFinal }: Options) {
  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState('');

  const recRef = useRef<any>(null);
  const activeRef = useRef(false); // المستخدم لسه عايز يتكلم
  const stopRequested = useRef(false); // ضغط على الميكروفون عشان ينهي
  const committedRef = useRef(''); // نص الجلسات اللي انتهت
  const currentRef = useRef(''); // نص الجلسة الحالية (بيتبدّل، ما بيتزاد)
  const silenceTimer = useRef<any>(null);
  const maxTimer = useRef<any>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const clearTimers = () => {
    clearTimeout(silenceTimer.current);
    clearTimeout(maxTimer.current);
  };

  /** إنهاء + تنفيذ مرة واحدة */
  const complete = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    stopRequested.current = false;
    clearTimers();
    try {
      recRef.current?.abort();
    } catch {}
    const text = `${committedRef.current} ${currentRef.current}`.replace(/\s+/g, ' ').trim();
    committedRef.current = '';
    currentRef.current = '';
    setListening(false);
    setLiveText('');
    if (text) onFinalRef.current(text);
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('المتصفح ده ما بيدعم الأوامر الصوتية. استخدم Chrome.');
      return;
    }

    setError('');
    committedRef.current = '';
    currentRef.current = '';
    stopRequested.current = false;

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false; // مهم للأندرويد: بيمنع تراكم النتائج
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const armSilence = () => {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(complete, silenceMs);
    };

    rec.onresult = (e: any) => {
      // في أندرويد كل نتيجة بتحتوي النص التراكمي، فناخد الأطول ونبدّل بيهو (مش نزيد)
      let best = '';
      for (let i = 0; i < e.results.length; i++) {
        const t: string = e.results[i]?.[0]?.transcript?.trim() ?? '';
        if (t.length > best.length) best = t;
      }
      currentRef.current = best;
      setLiveText(`${committedRef.current} ${best}`.trim());

      const last = e.results[e.results.length - 1];
      if (last?.isFinal && END_WORD.test(best)) {
        currentRef.current = best.replace(END_WORD, '').trim();
        complete();
        return;
      }
      armSilence(); // كل ما يتكلم تاني، العد بيبدأ من جديد
    };

    rec.onspeechstart = () => clearTimeout(silenceTimer.current);
    rec.onspeechend = () => {
      if (activeRef.current) armSilence();
    };

    rec.onerror = (e: any) => {
      const code = e?.error;
      if (code === 'no-speech' || code === 'aborted') return; // onend بيعيد الاستماع
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('اسمح للميكروفون من إعدادات المتصفح.');
        complete();
      } else if (code === 'network') {
        setError('الإنترنت ضعيف، التعرف على الصوت محتاج اتصال.');
        complete();
      } else {
        setError(String(code || 'خطأ في الميكروفون'));
      }
    };

    rec.onend = () => {
      if (!activeRef.current) return;
      if (stopRequested.current) {
        complete(); // ضغط إنهاء: نفّذ بعد ما وصلت آخر نتيجة
        return;
      }
      // الجلسة قفلت لوحدها (صمت قصير): ثبّت نصها وكمّل الاستماع بدل التنفيذ
      committedRef.current = `${committedRef.current} ${currentRef.current}`.replace(/\s+/g, ' ').trim();
      currentRef.current = '';
      setTimeout(() => {
        if (!activeRef.current) return;
        try {
          rec.start();
        } catch {}
      }, 150);
    };

    recRef.current = rec;
    activeRef.current = true;
    setListening(true);
    maxTimer.current = setTimeout(complete, maxMs);
    silenceTimer.current = setTimeout(complete, IDLE_MS);
    try {
      rec.start();
    } catch {
      complete();
    }
  }, [lang, silenceMs, maxMs, complete]);

  /** ضغطة ثانية على الميكروفون = «خلصت، نفّذ» */
  const stop = useCallback(() => {
    if (!activeRef.current) return;
    stopRequested.current = true;
    try {
      recRef.current?.stop();
    } catch {
      complete();
      return;
    }
    setTimeout(complete, 1500); // احتياط لو onend ما جا
  }, [complete]);

  const toggle = useCallback(() => (activeRef.current ? stop() : start()), [start, stop]);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearTimers();
      try {
        recRef.current?.abort();
      } catch {}
    },
    []
  );

  return { listening, liveText, error, toggle, start, stop };
}
