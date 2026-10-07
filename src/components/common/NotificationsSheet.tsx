'use client';
import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CheckCheck,
  Clock,
  Cloud,
  DollarSign,
  HandCoins,
  Info,
  Settings,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { APP_VERSION_LABEL } from '../../core/version';
import { useGoldStore } from '../../context/GoldStoreContext';
import { AppNotification, NotificationKind, relativeArabic } from '../../core/notifications';
import { useBackClose } from '../../lib/backStack';

/**
 * مركز الإشعارات — لوحة تُفتح من الجرس في الأعلى.
 * تعرض كل الأحداث: تغيّر السعر، العمليات الجديدة (حتى من جهاز آخر بعد المزامنة)،
 * الدفعات، المتأخرات، والسلف — مع توجيه للشاشة المعنية عند الضغط.
 */

const KIND_STYLE: Record<NotificationKind, { icon: React.ElementType; color: string; label: string }> = {
  price: { icon: TrendingUp, color: 'text-amber-400 bg-amber-500/15 border-amber-500/40', label: 'السعر' },
  sale: { icon: DollarSign, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40', label: 'بيع' },
  purchase: { icon: ShoppingBag, color: 'text-blue-400 bg-blue-500/15 border-blue-500/40', label: 'شراء' },
  expense: { icon: Wallet, color: 'text-rose-400 bg-rose-500/15 border-rose-500/40', label: 'مصروف' },
  loan: { icon: HandCoins, color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40', label: 'سلفة' },
  payment: { icon: CheckCheck, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40', label: 'دفعة' },
  dues: { icon: Clock, color: 'text-rose-400 bg-rose-500/15 border-rose-500/40', label: 'استحقاق' },
  partner: { icon: Users, color: 'text-amber-400 bg-amber-500/15 border-amber-500/40', label: 'الشركاء' },
  sync: { icon: Cloud, color: 'text-slate-300 bg-slate-500/15 border-slate-500/40', label: 'مزامنة' },
  system: { icon: Info, color: 'text-slate-300 bg-slate-500/15 border-slate-500/40', label: 'النظام' },
};

const LEVEL_DOT: Record<string, string> = {
  info: 'bg-blue-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const NotificationsSheet: React.FC<Props> = ({ open, onClose, onNavigate }) => {
  useBackClose(open, onClose);
  const {
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    deleteNotification,
    notificationPrefs,
    loans,
  } = useGoldStore();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const list = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications),
    [notifications, filter]
  );

  if (!open) return null;

  const openItem = (n: AppNotification) => {
    markNotificationRead(n.id);
    if (n.tab) {
      onNavigate(n.tab);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-x-0 top-0 h-full sm:top-3 sm:h-[92%] max-w-md sm:mx-auto sm:rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-top-4 duration-200">
        {/* الرأس */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 relative">
              <BellRing className="w-5 h-5" />
              {unreadNotifications > 0 ? (
                <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              ) : null}
            </div>
            <div>
              <h3 className="font-black text-sm text-white">الإشعارات</h3>
              <p className="text-[10px] text-slate-400">
                {unreadNotifications > 0 ? `${unreadNotifications} إشعار غير مقروء` : 'كل الإشعارات مقروءة'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-300" title="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط الأدوات */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
              filter === 'all' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            الكل ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
              filter === 'unread' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}
          >
            غير المقروء ({unreadNotifications})
          </button>
          <div className="flex-1" />
          <button
            onClick={markAllNotificationsRead}
            disabled={unreadNotifications === 0}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40"
            title="تحديد الكل كمقروء"
          >
            <CheckCheck className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('مسح كل الإشعارات من هذا الجهاز؟')) clearNotifications();
            }}
            disabled={notifications.length === 0}
            className="p-2 rounded-xl bg-slate-800 text-rose-300 disabled:opacity-40"
            title="مسح الكل"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* القائمة */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {list.length === 0 ? (
            <div className="py-20 text-center px-6">
              <BellRing className="w-10 h-10 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400 font-bold">لا توجد إشعارات</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                ستظهر هنا تغيّرات سعر عيار 21، والعمليات الجديدة (حتى التي تُسجَّل من جهاز آخر)،
                الدفعات، المتأخرات، والسلف.
              </p>
              {!notificationPrefs.enabled ? (
                <button
                  onClick={() => {
                    onNavigate('settings');
                    onClose();
                  }}
                  className="mt-4 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs"
                >
                  تفعيل إشعارات النظام
                </button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {list.map((n) => {
                const style = KIND_STYLE[n.kind] || KIND_STYLE.system;
                const Icon = style.icon;
                const unread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      unread ? 'bg-slate-900/70 hover:bg-slate-900' : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <div className={`p-2 rounded-2xl border shrink-0 ${style.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold ${unread ? 'text-white' : 'text-slate-300'}`}>
                          {n.title}
                        </span>
                        {unread ? <span className={`w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[n.level]}`} /> : null}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-500">{relativeArabic(n.at)}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                          {style.label}
                        </span>
                        {n.pushed ? (
                          <span className="text-[9px] text-emerald-400">أُرسل للجوال</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 shrink-0"
                      title="حذف"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* التذييل */}
        <div className="border-t border-slate-800 bg-slate-900 px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={() => {
              onNavigate('reminders');
              onClose();
            }}
            className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5"
          >
            <Clock className="w-4 h-4 text-rose-400" />
            المتأخرات والتحصيل
          </button>
          <button
            onClick={() => {
              onNavigate('loans');
              onClose();
            }}
            className="py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5"
          >
            <HandCoins className="w-4 h-4 text-emerald-400" />
            السلف {loans.filter((l) => !l.archived).length > 0 ? `(${loans.filter((l) => !l.archived).length})` : ''}
          </button>
          <button
            onClick={() => {
              onNavigate('settings');
              onClose();
            }}
            className="py-2.5 px-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1.5"
          >
            <Settings className="w-4 h-4" />
            الإعدادات
          </button>
        </div>

        <div className="text-center text-[10px] text-slate-500 font-mono pt-1">
          إشعارات التطبيق • {APP_VERSION_LABEL}
        </div>
      </div>
    </div>
  );
};

export default NotificationsSheet;
