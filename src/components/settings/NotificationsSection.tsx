'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Send,
  Users,
  HandCoins,
  TrendingUp,
  WifiOff,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { fmtNum } from '../../core/format';
import { partnerDigestText } from '../../core/notifications';
import { notificationHealth } from '../../core/notifyHealth';
import { openWhatsApp } from '../../core/share';
import {
  PermissionState,
  PushSubscribeResult,
  fetchVapidReady,
  isIOS,
  isPushSubscribed,
  isStandalonePwa,
  permissionState,
  requestPermission,
  sendTestPush,
  showSystemNotification,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../core/systemNotify';

/**
 * إعدادات الإشعارات:
 * - تفعيل إشعارات النظام (تظهر حتى لو التطبيق مقفول) مع طلب الإذن واشتراك Web Push.
 * - اختيار أنواع الإشعارات: السعر، العمليات، الدفعات، المتأخرات، السلف.
 * - ملخص الشركاء على واتساب.
 */
export const NotificationsSection: React.FC = () => {
  const {
    notificationPrefs,
    setNotificationPrefs,
    notifications,
    unreadNotifications,
    storeName,
    partners,
    partnerSharesList,
    financials,
    dues,
    loanSummary,
    rates,
  } = useGoldStore();

  const [permission, setPermission] = useState<PermissionState>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  const ios = isIOS();
  const standalone = isStandalonePwa();

  const refreshState = async () => {
    setPermission(permissionState());
    setSubscribed(await isPushSubscribed());
    setServerReady(await fetchVapidReady());
  };

  useEffect(() => {
    void refreshState();
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3500);
  };

  const enableNotifications = async () => {
    setBusy(true);
    try {
      const state = await requestPermission();
      setPermission(state);
      if (state !== 'granted') {
        flash(
          state === 'unsupported'
            ? 'جهازك لا يدعم إشعارات الويب'
            : 'لم يُسمح بالإشعارات — يمكنك السماح من إعدادات المتصفح'
        );
        return;
      }
      setNotificationPrefs({ enabled: true });
      const result: PushSubscribeResult = await subscribeToPush();
      setSubscribed(result.ok);
      if (result.ok === false) {
        if ('reason' in result && result.reason === 'unconfigured') {
          flash('الإشعارات داخل التطبيق مفعّلة — وللإشعارات والتطبيق مقفول يحتاج السيرفر مفاتيح VAPID');
        } else {
          flash('الإشعارات داخل التطبيق مفعّلة');
        }
      } else {
        flash('تم تفعيل الإشعارات — ستصلك حتى لو كان التطبيق مقفولاً');
      }
      void refreshState();
    } finally {
      setBusy(false);
    }
  };

  const disableNotifications = async () => {
    setBusy(true);
    try {
      setNotificationPrefs({ enabled: false });
      await unsubscribeFromPush();
      setSubscribed(false);
      flash('تم إيقاف إشعارات النظام — تبقى الإشعارات داخل التطبيق');
    } finally {
      setBusy(false);
    }
  };

  const testPush = async () => {
    setBusy(true);
    try {
      const result = await sendTestPush();
      flash(result.ok ? 'تم إرسال إشعار تجريبي — تصفّح وابتعد عن التطبيق وشوف الإشعار' : result.message || 'تعذر الإرسال');
      void refreshState();
    } finally {
      setBusy(false);
    }
  };

  /** إصلاح شامل: إذن → ربط الاشتراك بالحساب → إشعار فوري للتأكيد */
  const repairNotifications = async () => {
    setBusy(true);
    try {
      let state = permissionState();
      if (state === 'default') {
        state = await requestPermission();
        setPermission(state);
      }
      if (state !== 'granted') {
        flash(state === 'denied' ? 'الإذن مرفوض — اسمح به من إعدادات الموقع في المتصفح' : 'تعذر منح الإذن');
        return;
      }
      setNotificationPrefs({ enabled: true });
      const res = await subscribeToPush();
      setSubscribed(res.ok);
      if (res.ok) {
        await showSystemNotification('الإشعارات تعمل ✓', 'تم إصلاح وربط الإشعارات بهذا الحساب', {
          tab: 'settings',
        });
        flash('تم الإصلاح — الإشعارات مربوطة بهذا الحساب ✓');
      } else if (res.ok === false && res.reason === 'unconfigured') {
        flash('السيرفر غير مهيّأ بمفاتيح VAPID — إشعارات التطبيق المفتوح تعمل');
      } else {
        flash('تعذر الربط — تأكد من الاتصال وحاول مرة أخرى');
      }
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const health = notificationHealth({
    permission,
    enabled: notificationPrefs.enabled,
    subscribed,
    pushSupported: true,
    configured: serverReady,
    iosNeedsInstall: ios && !standalone,
  });

  const digestText = useMemo(
    () =>
      partnerDigestText({
        storeName,
        periodLabel: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
        salesAmount: financials.totalSales,
        profit: financials.grossProfit,
        expenses: financials.generalExpenses,
        net: financials.netProfit,
        capital: financials.totalCapital,
        partners: partnerSharesList.map((p) => ({
          name: p.partner.name,
          percent: p.partner.profitPercent,
          netShare: p.netShare,
        })),
        duesTotal: financials.receivables,
        loansOutstanding: loanSummary.lentOutstanding,
        price21: rates.karat21,
      }),
    [storeName, financials, partnerSharesList, loanSummary.lentOutstanding, rates.karat21]
  );

  const partnerPhones = partners.filter((p) => !p.archived && p.phone).map((p) => ({ name: p.name, phone: p.phone }));

  const toggleRow = (
    label: string,
    description: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    icon: React.ElementType
  ) => {
    const Icon = icon;
    return (
      <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-800 last:border-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-slate-800 text-amber-400 shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">{label}</div>
            <div className="text-[10px] text-slate-400 leading-relaxed">{description}</div>
          </div>
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
            checked ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
          title={checked ? 'مفعّل' : 'متوقف'}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
              checked ? 'right-0.5' : 'right-[22px]'
            }`}
          />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
        <BellRing className="w-4 h-4" />
        <span>الإشعارات والتنبيهات</span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        {/* حالة الإذن + التفعيل */}
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-2xl shrink-0 ${
              permission === 'granted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {permission === 'granted' ? <CheckCircle2 className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-sm text-white">إشعارات النظام (مثل واتساب)</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
              {permission === 'granted'
                ? subscribed
                  ? 'مفعّلة على هذا الجهاز — تصلك الإشعارات حتى لو كان التطبيق مقفولاً.'
                  : 'الإذن ممنوح. اضغط «تفعيل» لتشغيل إشعارات التطبيق-المقفول.'
                : permission === 'denied'
                ? 'الإذن مرفوض من المتصفح — افتح إعدادات الموقع في المتصفح واسمح بالإشعارات.'
                : permission === 'unsupported'
                ? 'هذا المتصفح لا يدعم إشعارات الويب.'
                : 'اضغط تفعيل الإشعارات وامنح الإذن لتظهر التنبيهات على شاشة جهازك.'}
            </p>
          </div>
        </div>

        {ios && !standalone ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-200 leading-relaxed">
              على الآيفون: لازم تضيف التطبيق للشاشة الرئيسية أولاً (زر «تثبيت» بالأعلى ← إضافة إلى الشاشة
              الرئيسية)، وبعدها افتحه من الأيقونة وفعّل الإشعارات — عندها تعمل زي واتساب.
            </p>
          </div>
        ) : null}

        {/* تشخيص صحة الإشعارات — يشرح الحالة الحقيقية بدل الفشل الصامت */}
        <div className={`rounded-2xl border p-3 space-y-2 ${
          health.level === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : health.level === 'off'
            ? 'bg-slate-950 border-slate-800'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-white">{health.title}</span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                health.level === 'ok'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : health.level === 'off'
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {health.level === 'ok' ? 'سليمة' : health.level === 'off' ? 'موقوفة' : 'تحتاج إصلاح'}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{health.hint}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
              <span className="block text-[9px] text-slate-400 font-bold">إذن النظام</span>
              <span className={`block font-black text-[11px] ${
                permission === 'granted' ? 'text-emerald-300' : permission === 'denied' ? 'text-rose-300' : 'text-amber-300'
              }`}>
                {permission === 'granted' ? 'ممنوح ✓' : permission === 'denied' ? 'مرفوض ✗' : permission === 'unsupported' ? 'غير مدعوم' : 'يحتاج طلب'}
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
              <span className="block text-[9px] text-slate-400 font-bold">الربط بالسحابة</span>
              <span className={`block font-black text-[11px] ${subscribed ? 'text-emerald-300' : 'text-amber-300'}`}>
                {subscribed ? 'مربوط ✓' : 'غير مربوط'}
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800">
              <span className="block text-[9px] text-slate-400 font-bold">جاهزية السيرفر</span>
              <span className={`block font-black text-[11px] ${serverReady === null ? 'text-slate-400' : serverReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                {serverReady === null ? '—' : serverReady ? 'جاهز ✓' : 'ناقص إعداد'}
              </span>
            </div>
          </div>
          {health.level !== 'ok' && (
            <button
              onClick={() => (health.action === 'resubscribe' || health.action === 'request-permission' ? repairNotifications() : enableNotifications())}
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-black transition-colors"
            >
              إصلاح الإشعارات الآن
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {permission === 'granted' && notificationPrefs.enabled && subscribed ? (
            <button
              onClick={disableNotifications}
              disabled={busy}
              className="py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs disabled:opacity-50"
            >
              إيقاف الإشعارات
            </button>
          ) : (
            <button
              onClick={enableNotifications}
              disabled={busy || permission === 'unsupported'}
              className="py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <BellRing className="w-4 h-4" />
              تفعيل الإشعارات
            </button>
          )}
          <button
            onClick={testPush}
            disabled={busy || !subscribed}
            className="py-3 rounded-2xl bg-slate-800 text-slate-200 font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
            title={subscribed ? 'إرسال إشعار تجريبي من السيرفر' : 'فعّل الإشعارات أولاً'}
          >
            <Send className="w-4 h-4" />
            إشعار تجريبي
          </button>
        </div>

        {/* إحصاء الإشعارات */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
          <div className="bg-slate-950 rounded-2xl p-2.5 border border-slate-800">
            <span className="block text-[10px] text-slate-400 font-bold">كل الإشعارات</span>
            <span className="block font-mono font-black text-amber-300 text-sm">{notifications.length}</span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-2.5 border border-slate-800">
            <span className="block text-[10px] text-slate-400 font-bold">غير المقروء</span>
            <span className="block font-mono font-black text-rose-300 text-sm">{unreadNotifications}</span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-2.5 border border-slate-800">
            <span className="block text-[10px] text-slate-400 font-bold">الحالة</span>
            <span className="block font-black text-[11px] text-emerald-300">
              {permission === 'granted' && notificationPrefs.enabled ? 'مفعّلة' : 'متوقفة'}
            </span>
          </div>
        </div>
      </div>

      {/* أنواع الإشعارات */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
        <h4 className="font-extrabold text-sm text-white mb-1">أنواع الإشعارات</h4>
        <p className="text-[10px] text-slate-500 mb-2">اختر ما يهمّك — والتنبيهات داخل التطبيق تعمل دائماً.</p>

        {toggleRow(
          'تغيّر سعر الذهب (عيار 21)',
          `إشعار عند تغيّر السعر بنسبة ${notificationPrefs.priceChangePercent}% أو أكثر`,
          notificationPrefs.priceEnabled,
          (v) => setNotificationPrefs({ priceEnabled: v }),
          TrendingUp
        )}
        {toggleRow(
          'عمليات جديدة في الحسابات',
          'مبيعات، مشتريات، ومصروفات تُسجَّل هنا أو من جهاز آخر بعد المزامنة',
          notificationPrefs.operationsEnabled,
          (v) => setNotificationPrefs({ operationsEnabled: v }),
          Smartphone
        )}
        {toggleRow(
          'الدفعات والتحصيل',
          'عند استلام دفعة من زبون أو سداد مورد أو سداد سلفة',
          notificationPrefs.paymentsEnabled,
          (v) => setNotificationPrefs({ paymentsEnabled: v }),
          CheckCircle2
        )}
        {toggleRow(
          'المتأخرات والمستحقات',
          'فاتورة أو سلفة متأخرة أو تستحق اليوم (إشعار واحد لكل مستحق يومياً)',
          notificationPrefs.duesEnabled,
          (v) => setNotificationPrefs({ duesEnabled: v }),
          AlertTriangle
        )}
        {toggleRow(
          'السلف',
          'عند تسجيل سلفة جديدة أو اكتمال سدادها',
          notificationPrefs.loansEnabled,
          (v) => setNotificationPrefs({ loansEnabled: v }),
          HandCoins
        )}

        <div className="pt-3 space-y-3 border-t border-slate-800 mt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              حد تغيّر السعر لإرسال إشعار: {notificationPrefs.priceChangePercent}%
            </label>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={notificationPrefs.priceChangePercent}
              onChange={(e) => setNotificationPrefs({ priceChangePercent: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>0.5% (حساس)</span>
              <span>10% (تغيّرات كبيرة فقط)</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              لا تُشعرني بالعمليات الأقل من (0 = الكل)
            </label>
            <input
              type="number"
              min={0}
              value={notificationPrefs.minAmount}
              onChange={(e) => setNotificationPrefs({ minAmount: Number(e.target.value) || 0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ملخص الشركاء */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-2xl shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white">إشعار الشركاء</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
              أرسل ملخصاً فورياً للأرباح والذمم لكل شريك. ولو نزّل الشريك التطبيق على جواله ودخل بنفس
              الحساب وفعّل الإشعارات، تصله كل التنبيهات فوراً مثل واتساب.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-[10px] text-slate-400 leading-relaxed whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
          {digestText}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openWhatsApp(undefined, digestText)}
            className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            إرسال الملخص للشركاء
          </button>
          <button
            onClick={() => {
              const phones = partnerPhones;
              if (phones.length === 0) {
                flash('لا يوجد شركاء بأرقام هواتف — أضف أرقامهم من شاشة الشركاء');
                return;
              }
              phones.forEach((p, idx) => {
                setTimeout(() => openWhatsApp(p.phone, digestText), idx * 600);
              });
              flash(`جاري الإرسال لـ ${phones.length} شريك على واتساب`);
            }}
            className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            إرسال لكل شريك ({partnerPhones.length})
          </button>
        </div>

        {!notificationPrefs.enabled ? (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-200 leading-relaxed">
              الإشعارات داخل التطبيق تعمل الآن (الجرس بالأعلى). أما ظهورها على شاشة الجوال والتطبيق مقفول
              فيحتاج الضغط على «تفعيل الإشعارات» ومنح الإذن.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-emerald-200 leading-relaxed">
              إشعارات النظام مفعّلة. لتجربة حقيقية: اضغط «إشعار تجريبي» ثم ابتعد عن التطبيق أو اقفله —
              سيظهر الإشعار على شاشة جهازك.
            </p>
          </div>
        )}

        <div className="text-[10px] text-slate-500 leading-relaxed">
          ذمم الزبائن الآن: {fmtNum(dues.receivablesTotal)} ج.س • سلف قائمة: {fmtNum(loanSummary.lentOutstanding)} ج.س
        </div>
      </div>

      {status ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 border border-amber-500/50 text-amber-200 text-[11px] font-bold px-4 py-2.5 rounded-2xl shadow-2xl text-center max-w-[90%]">
          {status}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsSection;
