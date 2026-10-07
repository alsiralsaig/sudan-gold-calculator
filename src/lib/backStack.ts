'use client';

import { useEffect, useRef } from 'react';

/**
 * سجل النوافذ المفتوحة — حتى يقفل زر الرجوع آخر نافذة فُتحت
 * بدل أن يخرج من التطبيق.
 *
 * كل نافذة تستدعي useBackClose(open, close). عند الرجوع، page.tsx
 * يستدعي closeTopOverlay() فتُقفل الأعلى فقط.
 */
type Entry = { id: number; close: () => void };

const stack: Entry[] = [];
let seq = 0;

export const overlayCount = (): number => stack.length;

export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  // نزيلها أولاً — الإقفال سيُطلق تنظيف الـ effect أيضاً بلا ضرر
  stack.pop();
  try {
    top.close();
  } catch {
    /* تجاهل */
  }
  return true;
}

export function useBackClose(open: boolean | unknown, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;

  const isOpen = Boolean(open);
  useEffect(() => {
    if (!isOpen) return;
    const entry: Entry = { id: ++seq, close: () => closeRef.current() };
    stack.push(entry);
    return () => {
      const i = stack.findIndex((e) => e.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [isOpen]);
}
