import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationHealth, HealthInput } from '../src/core/notifyHealth';

const base: HealthInput = {
  permission: 'granted',
  enabled: true,
  subscribed: true,
  pushSupported: true,
  configured: true,
};

test('كل شيء سليم → حالة ok بلا شريط تنبيه', () => {
  const s = notificationHealth(base);
  assert.equal(s.level, 'ok');
  assert.equal(s.showBanner, false);
  assert.equal(s.action, 'none');
});

test('المستخدم موقّف الإشعارات → لا نزعجه (لا شريط)', () => {
  const s = notificationHealth({ ...base, enabled: false, subscribed: false });
  assert.equal(s.level, 'off');
  assert.equal(s.showBanner, false);
});

test('الإذن مرفوض من التلفون → شريط + إرشاد لإعدادات المتصفح', () => {
  const s = notificationHealth({ ...base, permission: 'denied' });
  assert.equal(s.level, 'danger');
  assert.equal(s.action, 'browser-settings');
  assert.equal(s.showBanner, true);
});

test('الإذن لم يُطلب بعد (default) → شريط بطلب الإذن', () => {
  const s = notificationHealth({ ...base, permission: 'default' });
  assert.equal(s.action, 'request-permission');
  assert.equal(s.showBanner, true);
});

test('الإذن ممنوح لكن الاشتراك ضاع (تبديل حساب/إعادة تثبيت) → شريط بإعادة الربط', () => {
  const s = notificationHealth({ ...base, subscribed: false });
  assert.equal(s.action, 'resubscribe');
  assert.equal(s.showBanner, true);
  assert.match(s.title, /مقفول/);
});

test('آيفون غير مثبّت → إرشاد للتثبيت أولاً', () => {
  const s = notificationHealth({ ...base, subscribed: false, iosNeedsInstall: true });
  assert.equal(s.action, 'ios-install');
  assert.equal(s.showBanner, true);
});

test('عدم دعم push: إشعارات التطبيق المفتوح تعمل ولا شريط', () => {
  const s = notificationHealth({ ...base, pushSupported: false, subscribed: false });
  assert.equal(s.level, 'warn');
  assert.equal(s.showBanner, false);
});

test('السيرفر غير مهيّأ (VAPID) → تحذير معلوماتي بلا شريط', () => {
  const s = notificationHealth({ ...base, configured: false });
  assert.equal(s.level, 'warn');
  assert.equal(s.showBanner, false);
  assert.match(s.hint, /VAPID/);
});

test('الترتيب: الإذن المرفوض يسبق مشكلة الاشتراك', () => {
  const s = notificationHealth({ ...base, permission: 'denied', subscribed: false });
  assert.equal(s.action, 'browser-settings');
});
