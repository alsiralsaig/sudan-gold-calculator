'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_RECORD_ORDER,
  RECORD_ORDER_STORAGE_KEY,
  RecordOrder,
  parseRecordOrder,
  toggleRecordOrder,
} from '../core/recordOrder';

const EVENT = 'gold-record-order-change';

/**
 * اختيار ترتيب السجلات (الأحدث/الأقدم أولاً) — محفوظ على الجهاز
 * وموحّد بين كل الشاشات: تغييره في المبيعات يغيّره في المشتريات والمصروفات.
 */
export function useRecordOrder(): [RecordOrder, () => void] {
  const [order, setOrder] = useState<RecordOrder>(DEFAULT_RECORD_ORDER);

  useEffect(() => {
    try {
      setOrder(parseRecordOrder(localStorage.getItem(RECORD_ORDER_STORAGE_KEY)));
    } catch {
      /* وضع التصفح الخاص — نبقى على الافتراضي */
    }
    const onChange = (e: Event) => setOrder(parseRecordOrder((e as CustomEvent).detail));
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const toggle = useCallback(() => {
    setOrder((prev) => {
      const next = toggleRecordOrder(prev);
      try {
        localStorage.setItem(RECORD_ORDER_STORAGE_KEY, next);
      } catch {
        /* تجاهل */
      }
      // إبلاغ بقية الشاشات المفتوحة
      setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT, { detail: next })), 0);
      return next;
    });
  }, []);

  return [order, toggle];
}
