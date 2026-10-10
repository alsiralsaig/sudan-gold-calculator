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
 * بيستنى سكوت ثانية ونص قبل ما ينفذ، فبتقدر تقول الجملة براحتك وبوقفات.
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

  const SILENCE_MS = 1500; // سكوت ثانية ونص = الجملة خلصت
  const MAX_MS = 30000;
  const startedAt = Date.now();
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
      if (res.isFinal) finalText = `${finalText} ${text}`.trim();
      else interim += ` ${text}`;
    }
    const shown = `${finalText} ${interim}`.trim();
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
    finished = true;
    clearTimers();
    try { rec.stop(); } catch { /* تجاهل */ }
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
