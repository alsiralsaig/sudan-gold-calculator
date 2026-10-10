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
 * يسمع جملة واحدة ويرجّع دالة للإيقاف.
 * onFinal بتتنادى بالجملة النهائية، onInterim أثناء الكلام.
 */
export function listenOnce(handlers: ListenHandlers): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError('جهازك ما بيدعم التعرف على الصوت — اكتب الأمر بدلها');
    return () => {};
  }
  let finished = false;
  const rec = new Ctor();
  rec.lang = 'ar-SA';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const stopTimer = setTimeout(() => {
    try { rec.stop(); } catch { /* تجاهل */ }
  }, 15000);

  const cleanup = () => {
    finished = true;
    clearTimeout(stopTimer);
  };

  rec.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = String(res[0]?.transcript ?? '').trim();
      if (!text) continue;
      if (res.isFinal) {
        cleanup();
        handlers.onFinal(text);
        return;
      }
      interim += ` ${text}`;
    }
    if (interim.trim()) handlers.onInterim?.(interim.trim());
  };
  rec.onerror = (event: any) => {
    cleanup();
    const msg = ERROR_MESSAGES[String(event?.error)] ?? 'حصلت مشكلة في المايك — جرّب تاني';
    if (msg) handlers.onError(msg);
  };
  rec.onend = () => {
    const wasFinished = finished;
    cleanup();
    handlers.onEnd?.();
    if (!wasFinished) handlers.onError('ما سمعت صوت — قرّب المايك وجرّب تاني');
  };

  try {
    rec.start();
  } catch {
    cleanup();
    handlers.onError('ما قدرت أشغّل المايك — جرّب تاني');
  }

  return () => {
    cleanup();
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
