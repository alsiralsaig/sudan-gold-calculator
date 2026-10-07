import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STORE_NAME,
  LEGACY_STORE_NAMES,
  normalizeStoreName,
  shouldPromptStoreName,
  storeHeader,
} from '../src/core/branding';

test('الاسم الافتراضي هو «محلات أبو أحمد»', () => {
  assert.equal(DEFAULT_STORE_NAME, 'محلات أبو أحمد');
});

test('الفراغ أو غير المعرّف يعطي الاسم الافتراضي', () => {
  assert.equal(normalizeStoreName(''), DEFAULT_STORE_NAME);
  assert.equal(normalizeStoreName('   '), DEFAULT_STORE_NAME);
  assert.equal(normalizeStoreName(undefined), DEFAULT_STORE_NAME);
  assert.equal(normalizeStoreName(null), DEFAULT_STORE_NAME);
});

test('الأسماء الافتراضية القديمة تُستبدل بالجديد (ترحيل تلقائي)', () => {
  LEGACY_STORE_NAMES.forEach((legacy) => {
    assert.equal(normalizeStoreName(legacy), DEFAULT_STORE_NAME, legacy);
  });
  assert.equal(normalizeStoreName('مجوهرات الذهب'), 'محلات أبو أحمد');
});

test('الاسم الذي كتبه المستخدم بنفسه يبقى كما هو (مع تنظيف الفراغات)', () => {
  assert.equal(normalizeStoreName('مجوهرات النيل'), 'مجوهرات النيل');
  assert.equal(normalizeStoreName('  محلات أبو أحمد  '), 'محلات أبو أحمد');
});

test('ترويسة الرسالة تُغلَّف بنجيمتين كما في الواتساب', () => {
  assert.equal(storeHeader('محلات أبو أحمد'), '*محلات أبو أحمد*');
  assert.equal(storeHeader('مجوهرات الذهب'), '*محلات أبو أحمد*');
  assert.equal(storeHeader(''), '*محلات أبو أحمد*');
});

test('شاشة الترحيب تظهر فقط في التثبيت الجديد', () => {
  // تثبيت جديد تماماً: بلا علامة، بلا سجلات، بلا حساب → تظهر
  assert.equal(shouldPromptStoreName({ chosen: false, hasRecords: false }), true);
  // اختار الاسم من قبل (أو تخطّى) → لا تظهر
  assert.equal(shouldPromptStoreName({ chosen: true, hasRecords: false }), false);
  // لديه سجلات (مستخدم قديم) → لا تظهر، الاسم من الإعدادات
  assert.equal(shouldPromptStoreName({ chosen: false, hasRecords: true }), false);
  // مسجّل دخول سحابي → لا تظهر
  assert.equal(
    shouldPromptStoreName({ chosen: false, hasRecords: false, userEmail: 'owner@shop.com' }),
    false
  );
  assert.equal(shouldPromptStoreName({ chosen: false, hasRecords: false, userEmail: '   ' }), true);
});
