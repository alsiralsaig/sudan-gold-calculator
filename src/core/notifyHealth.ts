/**
 * تشخيص صحة إشعارات النظام — منطق نقي قابل للاختبار.
 *
 * يجمع: إذن المتصفح + تفضيل المستخدم + اشتراك Web Push + جاهزية السيرفر،
 * ويخرج بحالة واحدة مفهومة مع الإجراء المطلوب — بدل فشل صامت.
 */

export type Permission = 'granted' | 'denied' | 'default' | 'unsupported';
export type HealthLevel = 'ok' | 'warn' | 'danger' | 'off';
export type HealthAction = 'none' | 'enable' | 'request-permission' | 'resubscribe' | 'browser-settings' | 'ios-install';

export interface HealthInput {
  /** إذن الإشعارات من المتصفح */
  permission: Permission;
  /** تفضيل المستخدم: إشعارات النظام مفعّلة */
  enabled: boolean;
  /** هل الجهاز مربوط باشتراك Web Push على السيرفر؟ */
  subscribed: boolean;
  /** الجهاز/المتصفح يدعم Web Push */
  pushSupported: boolean;
  /** السيرفر مهيّأ (مفاتيح VAPID) — null إذا لم يُفحص بعد */
  configured?: boolean | null;
  /** آيفون غير مثبّت على الشاشة الرئيسية */
  iosNeedsInstall?: boolean;
}

export interface HealthStatus {
  level: HealthLevel;
  title: string;
  hint: string;
  action: HealthAction;
  /** هل تستحق عرض شريط تنبيه أعلى الشاشة؟ */
  showBanner: boolean;
}

export function notificationHealth(input: HealthInput): HealthStatus {
  const {
    permission,
    enabled,
    subscribed,
    pushSupported,
    configured = null,
    iosNeedsInstall = false,
  } = input;

  if (!enabled) {
    return {
      level: 'off',
      title: 'إشعارات النظام موقوفة',
      hint: 'شغّلها من الإعدادات لتظهر التنبيهات على شاشة تلفونك.',
      action: 'none',
      showBanner: false, // اختيار المستخدم — لا نزعجه
    };
  }

  if (permission === 'unsupported') {
    return {
      level: 'danger',
      title: 'جهازك لا يدعم إشعارات الويب',
      hint: 'استخدم كروم على أندرويد، أو أضف التطبيق للشاشة الرئيسية على الآيفون (iOS 16.4+).',
      action: 'none',
      showBanner: true,
    };
  }

  if (permission === 'denied') {
    return {
      level: 'danger',
      title: 'التلفون رافض الإشعارات',
      hint: 'افتح إعدادات الموقع في المتصفح (أيقونة القفل) ← الإشعارات ← «سماح»، ثم أعد التشغيل.',
      action: 'browser-settings',
      showBanner: true,
    };
  }

  if (permission === 'default') {
    return {
      level: 'warn',
      title: 'الإشعارات محتاجة إذن',
      hint: 'اضغط لتمنح الإذن مرة واحدة وتشتغل التنبيهات.',
      action: 'request-permission',
      showBanner: true,
    };
  }

  if (iosNeedsInstall) {
    return {
      level: 'warn',
      title: 'أضف التطبيق للشاشة الرئيسية',
      hint: 'على الآيفون لا تعمل الإشعارات إلا بعد التثبيت من زر «تثبيت» ثم الفتح من الأيقونة.',
      action: 'ios-install',
      showBanner: true,
    };
  }

  if (!pushSupported) {
    return {
      level: 'warn',
      title: 'إشعارات التطبيق المقفول غير مدعومة هنا',
      hint: 'إشعارات التطبيق المفتوح تعمل — واستخدم كروم أو ثبّت التطبيق لدعم الإشعارات والتطبيق مقفول.',
      action: 'none',
      showBanner: false, // المفتوح يعمل — لا داعي للإزعاج في كل مرة
    };
  }

  if (!subscribed) {
    return {
      level: 'warn',
      title: 'إشعارات التطبيق المقفول غير مربوطة',
      hint: 'اربط الجهاز بحسابك — يصلك التنبيه حتى لو كان التطبيق مقفولاً.',
      action: 'resubscribe',
      showBanner: true,
    };
  }

  if (configured === false) {
    return {
      level: 'warn',
      title: 'السيرفر غير مهيّأ للإشعارات عن بُعد',
      hint: 'إشعارات التطبيق المفتوح تعمل. للتشغيل الكامل أضف مفاتيح VAPID في إعدادات Vercel.',
      action: 'none',
      showBanner: false,
    };
  }

  return {
    level: 'ok',
    title: 'الإشعارات تعمل على هذا الجهاز',
    hint: 'تصلك التنبيهات على شاشة التلفون — حتى لو كان التطبيق مقفولاً.',
    action: 'none',
    showBanner: false,
  };
}
