/**
 * خدمة الصوت للأوامر — تعرّف على الكلام (مايك) + قراءة الرد بصوت عربي.
 * تعمل في المتصفح على الأندرويد/كروم بدون خدمات خارجية.
 */

/* ============================ المايك ============================ */

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognitionCtor(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export const isSpeechRecognitionSupported = (): boolean => Boolean(getRecognitionCtor());

export interface ListenHandlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

/* ============================ دمج المقاطع الذكي ============================ */

const splitWords = (s: string): string[] => s.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

/**
 * المايك بيرجّع الجملة على مقاطع — ولو كررت بدايتك (أو رجّع صدى) بتراكب المقاطع فوق بعض:
 * «سجل سجل سجل في المبيعات 15 سجل في المبيعات 20…».
 * الدمج الذكي بدل الترقيم الأحمق:
 *  1. المقطع الجديد بيكمّل القديم (القديم بدايتو) → خد الجديد الأشمل
 *  2. الجديد أصلاً جوه القديم → تجاهلو
 *  3. كررت بداية الجملة → آخر محاولة هي قصدك النهائي → بدّل بيه خالص
 *  4. آخر كلمات القديم = أول كلمات الجديد (تراكب) → ادمج من غير تكرار
 *  5. غير كده → ضمّ عادي
 */
export function mergeFinals(acc: string, incoming: string): string {
  const A = splitWords(acc);
  const B = splitWords(incoming);
  if (!B.length) return A.join(' ');
  if (!A.length) return B.join(' ');
  const aStr = A.join(' ');
  const bStr = B.join(' ');
  // (1) القديم بداية الجديد → الجديد أطول وأشمل
  if (B.length >= A.length && B.slice(0, A.length).join(' ') === aStr) return bStr;
  // (2) الجديد مكرر جوه القديم → عنديو خلاص
  if (aStr.includes(bStr)) return aStr;
  // (3) بداية مكررة: أول كلمتين من الجديد موجودين متتاليين في أول القديم → إعادة محاولة، خد الأخيرة
  const head2 = B.slice(0, 2).join(' ');
  const headZone = A.slice(0, Math.max(2, Math.ceil(A.length * 0.4))).join(' ');
  if (head2.length > 1 && headZone.includes(head2)) return bStr;
  // (3.5) كلمات الجديد كلها موجودة في آخر القديم (صدى معكوس زي «عيار 680» ← «680 جرام عيار») → ما عندو جديد
  const tailZone = new Set(A.slice(Math.max(0, A.length - B.length - 2)));
  if (B.every((w) => tailZone.has(w))) return aStr;
  // (4) تراكب: آخر k كلمات من القديم = أول k كلمات من الجديد → ادمج عندها
  for (let k = Math.min(A.length, B.length, 5); k >= 1; k--) {
    if (A.slice(A.length - k).join(' ') === B.slice(0, k).join(' ')) {
      return [...A.slice(0, A.length - k), ...B].join(' ');
    }
  }
  // (5) ضمّ عادي
  return `${aStr} ${bStr}`;
}

/* كلمة الختام: قول «تمام» (أو «خلاص»/«نفذ») في آخر الجملة → تنفيذ فوري من غير انتظار السكوت */
const END_WORDS = /(^|\s)(تمام|خلاص|نفذ|نفّذ)(?=\s|$)/;
const stripEndWords = (s: string): string =>
  s.replace(/(^|\s)(تمام|خلاص|نفذ|نفّذ)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'إذن المايك مقفول — افتحه من إعدادات المتصفح',
  'service-not-allowed': 'إذن المايك مقفول — افتحه من إعدادات المتصفح',
  'no-speech': 'ما سمعت صوت — قرّب المايك وجرّب تاني',
  'audio-capture': 'ما لقيت مايك في الجهاز',
  network: 'مشكلة شبكة — التعرف على الصوت يحتاج نت',
  aborted: '',
};

/**
 * يسمع الجملة كاملة — ما بستعجلش:
 * قول جملتك براحتك وبوقفات — وبمجرد ما تقول «تمام» بينفذ فوراً.
 * لو ما قلتها: بيسكت 4 ثواني وينفذ. الضغطة التانية على المايك كمان = «خلصت، نفّذ».
 * بيرجّع دالة للإيقاف اليدوي.
 */
export function listenOnce(handlers: ListenHandlers): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError('جهازك ما بيدعم التعرف على الصوت — اكتب الأمر بدلها');
    return () => {};
  }
  let finished = false;
  let finalText = '';
  const rec = new Ctor();
  rec.lang = 'ar-SA';
  rec.continuous = true; // بيسمع على طول — ما بيقاطعش بعد أول كلمتين
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const SILENCE_MS = 4000; // سكوت 4 ثواني = الجملة خلصت (صبور جداً مع الوقفات)
  const MAX_MS = 30000;
  let silence: ReturnType<typeof setTimeout> | null = null;
  let gotAny = false;

  const clearTimers = () => {
    if (silence) { clearTimeout(silence); silence = null; }
    if (hardStop) { clearTimeout(hardStop); hardStop = null; }
  };
  let hardStop: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimers();
    try { rec.stop(); } catch { /* تجاهل */ }
    const text = finalText.trim();
    if (text) handlers.onFinal(text);
    else handlers.onEnd();
  };

  const armSilence = () => {
    if (silence) clearTimeout(silence);
    silence = setTimeout(finish, SILENCE_MS);
  };

  hardStop = setTimeout(finish, MAX_MS);

  rec.onresult = (event: any) => {
    gotAny = true;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = String(res[0]?.transcript ?? '').trim();
      if (!text) continue;
      if (res.isFinal) {
        // الدمج الذكي: الامتداد/التراكب/إعادة المحاولة — بدل ما يتراكب المكرر فوق بعض
        finalText = mergeFinals(finalText, text);
      } else {
        interim += ` ${text}`;
      }
    }
    // «تمام» = خلصت — نفّذ حالاً من غير انتظار السكوت
    if (!finished && END_WORDS.test(`${finalText} ${interim}`)) {
      finalText = stripEndWords(mergeFinals(finalText, interim));
      finish();
      return;
    }
    // حارس الضوضاء: الكلام اتكتر عن اللزوم — نفذ اللي عندنا وخلاص
    if (finalText.length > 220) { finish(); return; }
    const shown = interim.trim() || finalText;
    if (shown) handlers.onInterim?.(shown);
    // لسه بيتكلم؟ نأجل الحكم — لين يسكت
    if (!finished) armSilence();
  };
  rec.onerror = (event: any) => {
    const code = String(event?.error);
    if (finished) return;
    if (code === 'aborted') return; // بنوقفو احنا — عادي
    finished = true;
    clearTimers();
    try { rec.stop(); } catch { /* تجاهل */ }
    const msg = ERROR_MESSAGES[code] ?? 'حصلت مشكلة في المايك — جرّب تاني';
    if (finalText) handlers.onFinal(finalText);
    else if (msg) handlers.onError(msg);
    handlers.onEnd?.();
  };
  rec.onend = () => {
    if (finished) { handlers.onEnd?.(); return; }
    // المتصفح قفل السمع لوحده — لو عندي كلام ننفذو، وإلا نقول ما سمعنا
    finished = true;
    clearTimers();
    const text = finalText.trim();
    if (text) handlers.onFinal(text);
    else handlers.onError(gotAny ? 'ما فهمت الكلام — قرّب المايك وجرّب تاني' : 'ما سمعت صوت — قرّب المايك وجرّب تاني');
    handlers.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    clearTimers();
    finished = true;
    handlers.onError('ما قدرت أشغّل المايك — جرّب تاني');
  }

  return () => {
    if (finished) return;
    // الضغطة التانية على المايك = «خلصت، نفّذ» — ما نضيّع الكلام المسموع
    finish();
  };
}

/* ============================ القراءة (TTS) ============================ */

export const isSpeechSynthesisSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

const cleanForSpeech = (text: string): string =>
  String(text ?? '')
    .replace(/[*_#`~>|]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

let currentUtterances: SpeechSynthesisUtterance[] = [];

export const stopSpeaking = (): void => {
  if (!isSpeechSynthesisSupported()) return;
  currentUtterances = [];
  try { window.speechSynthesis.cancel(); } catch { /* تجاهل */ }
};

function pickArabicVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices?.length) return null;
    const ar = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ar'));
    return ar.find((v) => /google/i.test(v.name)) || ar.find((v) => /SA|EG|XA/i.test(v.lang)) || ar[0] || null;
  } catch {
    return null;
  }
}

/** يقسم النص لأجزاء صغيرة — كروم أندرويد بيقف مع الجمل الطويلة */
function chunkText(text: string, max = 180): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) chunks.push(cur.trim());
      cur = w;
    } else {
      cur = `${cur} ${w}`;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}

/** يقرأ نصاً بالعربي — يقفل أي قراءة سابقة */
export function speak(text: string, opts?: { rate?: number }): void {
  if (!isSpeechSynthesisSupported()) return;
  stopSpeaking();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  const voice = pickArabicVoice();
  const chunks = chunkText(clean);
  currentUtterances = chunks.map((c, idx) => {
    const u = new SpeechSynthesisUtterance(c);
    u.lang = voice?.lang || 'ar-SA';
    if (voice) u.voice = voice;
    u.rate = opts?.rate ?? 1;
    u.pitch = 1;
    u.volume = 1;
    // كروم أندرويد أحياناً بيوقف — نبعت الأجزاء متتالية
    if (idx > 0) u.addEventListener('start', () => {
      try { if (!window.speechSynthesis.speaking) window.speechSynthesis.speak(u); } catch { /* تجاهل */ }
    });
    return u;
  });
  // بعض الأجهزة تحتاج وقت بعد cancel
  setTimeout(() => {
    for (const u of currentUtterances) {
      try { window.speechSynthesis.speak(u); } catch { /* تجاهل */ }
    }
  }, 60);
}

/**
 * يستنى القراءة (TTS) تخلص تماماً — عشان الاستماع المتواصل:
 * المايك ما يفتح تاني إلا بعد ما التطبيق يسكت، فما يسمعش صوتو نفسو.
 */
export function waitForSpeechEnd(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) return resolve();
    const started = Date.now();
    let idleHits = 0;
    const poll = () => {
      let busy = false;
      try { busy = window.speechSynthesis.speaking || window.speechSynthesis.pending; } catch { /* تجاهل */ }
      idleHits = busy ? 0 : idleHits + 1;
      if (idleHits >= 2) return resolve();
      if (Date.now() - started > timeoutMs) {
        try { window.speechSynthesis.cancel(); } catch { /* تجاهل */ }
        return resolve();
      }
      setTimeout(poll, 250);
    };
    setTimeout(poll, 250);
  });
}
