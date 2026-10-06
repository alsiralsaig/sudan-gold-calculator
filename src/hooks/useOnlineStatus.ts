'use client';

import { useEffect, useState } from 'react';

/**
 * حالة الاتصال بالشبكة + استرجاع تلقائي عند عودة الاتصال.
 */
export function useOnlineStatus(): { isOnline: boolean; lastOnlineAt: number } {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState(() => Date.now());

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const goOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(Date.now());
    };
    const goOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline, lastOnlineAt };
}
