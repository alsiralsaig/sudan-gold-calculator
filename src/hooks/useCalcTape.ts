'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { addToTape, parseTape, removeFromTape, TapeEntry, TAPE_STORAGE_KEY } from '../core/calcTape';

/** سجل الحسابات — محفوظ على هذا الجهاز */
export function useCalcTape() {
  const [tape, setTape] = useState<TapeEntry[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      setTape(parseTape(localStorage.getItem(TAPE_STORAGE_KEY)));
    } catch {
      /* تجاهل */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(TAPE_STORAGE_KEY, JSON.stringify(tape));
    } catch {
      /* الذاكرة ممتلئة — نتجاهل */
    }
  }, [tape]);

  const add = useCallback((e: TapeEntry) => setTape((prev) => addToTape(prev, e)), []);
  const remove = useCallback((id: string) => setTape((prev) => removeFromTape(prev, id)), []);
  const clear = useCallback(() => setTape([]), []);

  return { tape, add, remove, clear };
}

/** قيم محفوظة على الجهاز لكل أداة (آخر مدخلات) */
export function usePersistentInputs<T extends Record<string, string>>(key: string, defaults: T) {
  const [values, setValues] = useState<T>(defaults);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setValues((d) => ({ ...d, ...parsed }));
      }
    } catch {
      /* تجاهل */
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch {
      /* تجاهل */
    }
  }, [key, values]);

  const set = useCallback((name: keyof T, v: string) => setValues((prev) => ({ ...prev, [name]: v })), []);
  const replace = useCallback((next: Partial<T>) => setValues((prev) => ({ ...prev, ...next })), []);
  return { values, set, replace };
}
