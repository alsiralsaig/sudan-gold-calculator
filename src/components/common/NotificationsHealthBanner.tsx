'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, X } from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import {
  PermissionState,
  fetchVapidReady,
  isIOS,
  isPushSubscribed,
  isStandalonePwa,
  permissionState,
  pushSupported,
  requestPermission,
  showSystemNotification,
  subscribeToPush,
} from '../../core/systemNotify';
import { notificationHealth } from '../../core/notifyHealth';

/** مفتاح إغلاق الشريط مؤقتاً (لكل جلسة) */
const MUTE_KEY = 'gold_notify_banner_muted_v1';

/**
 * شريط صحة الإشعارات — يظهر فقط عندما تكون إشعارات النظام مفعّلة
 * لكن شيء ما يعطّلها (إذن مسحوب، ربط ضاع بعد تبديل حساب أو إعادة تثبيت…).
 * بضغطة واحدة: يمنح الإذن، يعيد ربط الاشتراك بحسابك، ويجرب إشعاراً فورياً.
 */
export const NotificationsHealthBanner: React.FC = () => {
  const { notificationPrefs } = useGoldStore();
  const [permission, setPermission] = useState<PermissionState>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    setPermission(permissionState());
    const [sub, conf] = await Promise.all([isPushSubscribed(), fetchVapidReady()]);
    setSubscribed(sub);
    setConfigured(conf);
  }, []);

  useEffect(() => {
    try {
      setMuted(sessionStorage.getItem(MUTE_KEY) === '1');
    } catch {
      setMuted(false);
    }
    void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(''), 4000);
  };

  const health = notificationHealth({
    permission,
    enabled: Boolean(notificationPrefs.enabled),
    subscribed,
    pushSupported: pushSupported(),
    configured,
    iosNeedsInstall: isIOS() && !isStandalonePwa(),
  });

  const fix = async () => {
    setBusy(true);
    try {
      if (health.action === 'browser-settings') {
        flash('افتح أيقونة القفل بجانب العنوان ← الإشعارات ← «سماح» ثم أعد فتح التطبيق');
        return;
      }
      if (health.action === 'ios-install') {
        flash('زر «تثبيت» في الأعلى ← إضافة إلى الشاشة الرئيسية، ثم افتح التطبيق من الأيقونة');
        return;
      }

      if (health.action === 'request-permission') {
        const p = await requestPermission();
        setPermission(p);
        if (p !== 'granted') {
          flash(p === 'denied' ? 'الإذن مرفوض — اسمح به من إعدادات المتصفح' : 'لم يُمنح الإذن');
          return;
        }
      }

      const res = await subscribeToPush();
      setSubscribed(res.ok);
      if (res.ok) {
        await showSystemNotification('الإشعارات مربوطة ✓', 'من الآن تصلك التنبيهات على شاشة التلفون', {
          tab: 'dashboard',
        });
        flash('تم ربط الإشعارات بهذا الحساب ✓');
      } else if (res.ok === false && res.reason === 'unconfigured') {
        flash('إشعارات التطبيق المفتوح شغالة — وللتطبيق المقفول يحتاج السيرفر مفاتيح VAPID');
      } else {
        flash('تعذر الربط — جرّب مرة أخرى');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const mute = () => {
    try {
      sessionStorage.setItem(MUTE_KEY, '1');
    } catch {
      /* تجاهل */
    }
    setMuted(true);
  };

  if (!health.showBanner || muted) {
    return note ? (
      <div className="mb-3 bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2.5 text-[11px] text-slate-200 animate-in fade-in duration-200">
        {note}
      </div>
    ) : null;
  }

  const tone =
    health.level === 'danger'
      ? 'bg-rose-500/10 border-rose-500/30'
      : 'bg-amber-500/10 border-amber-500/30';
  const iconTone = health.level === 'danger' ? 'text-rose-400' : 'text-amber-400';

  const actionLabel =
    health.action === 'request-permission'
      ? 'منح الإذن'
      : health.action === 'resubscribe'
      ? 'اربط الآن'
      : health.action === 'ios-install'
      ? 'كيف أثبّت؟'
      : health.action === 'browser-settings'
      ? 'فهمت'
      : null;

  return (
    <div className={`mb-3 border rounded-2xl px-3 py-2.5 flex items-center gap-2.5 animate-in fade-in duration-200 ${tone}`}>
      {health.level === 'danger' ? (
        <AlertTriangle className={`w-4 h-4 shrink-0 ${iconTone}`} />
      ) : (
        <BellRing className={`w-4 h-4 shrink-0 ${iconTone}`} />
      )}
      <div className="flex-1 min-w-0 text-[11px] leading-snug">
        <span className="font-black block text-white">{health.title}</span>
        <span className="text-slate-300">{note || health.hint}</span>
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={fix}
          disabled={busy}
          className="shrink-0 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-[11px] font-black transition-colors"
        >
          {busy ? '...' : actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={mute}
        aria-label="تجاهل الآن"
        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
        title="تجاهل حتى إغلاق التطبيق"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default NotificationsHealthBanner;
