'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { checkApproval, computeGoldPrice, TRADE_KARAT } from '../core/pricing';
import type { Aggregate, ApprovedPrice, GoldComputation, SourceReading } from '../core/pricing';
import {
  AppTombstones,
  Branch,
  Expense,
  GoldRates,
  Loan,
  Partner,
  Payment,
  Purchase,
  RatesMeta,
  Sale,
} from '../types';
import { mergeRecordsWithTombstones } from '../core/merge';
import { DEFAULT_STORE_NAME, normalizeStoreName } from '../core/branding';
import { permissionState, pushSupported, subscribeToPush } from '../core/systemNotify';
import { SessionSnapshotMeta, totalRecords } from '../core/session';
import { buildCsv, buildExportTable, exportFileName } from '../core/dataExport';
import { sortRecords } from '../core/recordOrder';
import {
  Financials,
  Inventory,
  PartnerShare,
  computeFinancials,
  computeInventory,
  partnerShares,
  purchasePending,
  salePending,
} from '../core/accounting';
import { K21_FINENESS } from '../core/purity';
import { DueSummary, computeDues, mergeDueSummaries } from '../core/reminders';
import { LoanSummary, computeLoanDues, isLoanSettled, loanPending, summarizeLoans } from '../core/loans';
import {
  AppNotification,
  batchSyncNotification,
  DEFAULT_NOTIFICATION_PREFS,
  NotificationPrefs,
  dueNotifications,
  expenseNotification,
  loanNotification,
  loanSettledNotification,
  markAllRead,
  markRead,
  notificationKey,
  notificationKeys,
  paymentNotification,
  priceNotification,
  purchaseNotification,
  pushNotification,
  saleNotification,
  unreadCount,
  withDismissed,
} from '../core/notifications';
import { showSystemNotification } from '../core/systemNotify';
import {
  ALL_BRANCHES,
  UNASSIGNED_BRANCH,
  activeBranches,
  branchCode,
  branchName,
  scopeToBranch,
} from '../core/branches';
import { assignMissingInvoiceNumbersByBranch, nextInvoiceNo } from '../core/invoice';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export type ThemeMode = 'light' | 'dark' | 'system';

export type InvoiceCounters = { sale: number; purchase: number };

export interface CloudInspection {
  ok: boolean;
  updatedAt: string | null;
  sessionExpired?: boolean;
  serverNotConfigured?: boolean;
  counts?: {
    purchases: number;
    sales: number;
    expenses: number;
    loans: number;
    partners: number;
    branches: number;
  };
}

export interface EngineSnapshot {
  ok: boolean;
  fetchedAt: string;
  inputs: { ounceUsd: number | null; usdBuy: number | null; usdSell: number | null; adjust: number; karat: number };
  overridesUsed: { usdBuy: boolean; usdSell: boolean; ounce: boolean };
  parallel: { readings: SourceReading[]; errors: string[] };
  official: { readings: SourceReading[]; errors: string[] };
  spot: { readings: SourceReading[]; errors: string[] };
  aggregates: { parallel: Aggregate; official: Aggregate; spot: Aggregate };
  computation: GoldComputation | null;
  publishedLocalGold: number | null;
  sourcesUsed?: { parallel: string[]; official: string[]; spot: string[] };
  warnings: string[];
  errors: string[];
}

export interface EngineOverrides {
  usdBuy?: number;
  usdSell?: number;
  ounce?: number;
}

interface GoldStoreContextType {
  /** السجلات بعد تقييدها بالفرع النشط (كل الفروع = الكل) */
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  /** كل السجلات بغض النظر عن الفرع النشط (للتقارير المقارنة والنسخ الاحتياطي) */
  allPurchases: Purchase[];
  allSales: Sale[];
  allExpenses: Expense[];
  partners: Partner[];
  /** فروع النشاط (مزامَنة عبر Supabase) */
  branches: Branch[];
  /** الفروع غير المؤرشفة فقط — للاختيار في الواجهة */
  activeBranchList: Branch[];
  /** الفرع النشط: معرّف فرع أو ALL_BRANCHES */
  activeBranchId: string;
  activeBranch: Branch | null;
  activeBranchName: string;
  setActiveBranchId: (id: string) => void;
  addBranch: (b: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>) => Branch;
  updateBranch: (b: Branch) => void;
  archiveBranch: (id: string) => void;
  restoreBranch: (id: string) => void;
  deleteBranch: (id: string) => void;
  /** عدّادات أرقام الفواتير */
  invoiceCounters: InvoiceCounters;
  /** يرقّم كل الفواتير القديمة التي بلا رقم ويعيد عددها */
  numberLegacyInvoices: () => number;
  /** مرآة الفروع إلى جدول Supabase المستقل (best-effort) */
  syncBranchesTable: (branches: Branch[]) => Promise<boolean>;
  /** سلف نقدية (دين) — غير مؤثرة على الربح */
  loans: Loan[];
  allLoans: Loan[];
  loanSummary: LoanSummary;
  addLoan: (l: Omit<Loan, 'id' | 'payments' | 'updatedAt'>) => void;
  updateLoan: (l: Loan) => void;
  archiveLoan: (id: string) => void;
  restoreLoan: (id: string) => void;
  deleteLoan: (id: string) => void;
  /** إضافة دفعة سداد — تُؤرشف السلفة تلقائياً عند اكتمال المبلغ */
  addPaymentToLoan: (loanId: string, payment: Omit<Payment, 'id'>) => void;
  /** عدد العمليات غير المسندة لأي فرع */
  unassignedOperations: number;
  /** إسناد العمليات القديمة إلى فرع محدد (يعيد العدد) */
  assignUnbranchedTo: (branchId: string) => number;

  /* ------------------------- الإشعارات ------------------------- */
  /** كل الإشعارات (الأحدث أولاً) */
  notifications: AppNotification[];
  /** عدد غير المقروء */
  unreadNotifications: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  deleteNotification: (id: string) => void;
  /** إنشاء إشعار (ودفعه لنظام التشغيل إن كان مفعّلاً) */
  notify: (notification: AppNotification, options?: { system?: boolean }) => void;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  /** مزامنة الإشعارات على السيرفر تتم قراءتها من /api/push/subscribe */
  rates: GoldRates;
  /** كاش الـ PIN (مُجزّأ). وجوده يعني أن القفل مُفعّل */
  pinCode: string;
  isLocked: boolean;
  userEmail: string;
  storeName: string;
  themeMode: ThemeMode;
  lastSyncTime: string;
  isCloudSignedIn: boolean;
  isSyncing: boolean;

  // Metrics & Stats
  totalCapital: number;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  generalExpenses: number;
  privateExpenses: number;
  netProfit: number;
  totalProfitPercent: number;
  currentStockUnits: number;

  /** المخزون التفصيلي لكل عيار + معادل عيار 21 */
  inventory: Inventory;
  /** المؤشرات المالية الكاملة (ذمم مدينة/دائنة، هوامش، أرشيف) */
  financials: Financials;
  /** أنصبة الشركاء */
  partnerSharesList: PartnerShare[];
  /** حالة تحديث الأسعار: المصدر، وقت التحديث، التحذيرات */
  ratesMeta: RatesMeta;
  /** سجل سعر جرام عيار 21 عبر الزمن (محلي) */
  ratesHistory: { t: string; v: number }[];
  /** المتأخرات: ذمم الزبائن والديون للموردين */
  dues: DueSummary;

  /** هل الجهاز متصل بالإنترنت */
  isOnline: boolean;
  /** هناك تغييرات لم تُزامن بعد */
  pendingSync: boolean;
  /** رسالة آخر خطأ مزامنة */
  syncError: string;
  /** فحص ما هو موجود فعلاً على السيرفر (بدون تعديل أي شئ) */
  inspectCloud: () => Promise<CloudInspection>;
  /** سحب التحديثات من الأجهزة الأخرى فوراً */
  refreshFromCloud: (silent?: boolean) => Promise<{ ok: boolean; changed: boolean }>;
  /** محاولة مزامنة فورية */
  forceSync: () => Promise<boolean>;

  // Actions
  setUserEmail: (email: string) => void;
  setStoreName: (name: string) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setLastSyncTime: (timeStr: string) => void;

  // Cloud Auth & Sync
  signInCloud: (email: string, pass: string, opts?: { clearLocal?: boolean }) => Promise<{ success: boolean; message: string }>;
  signUpCloud: (email: string, pass: string, opts?: { clearLocal?: boolean }) => Promise<{ success: boolean; message: string }>;
  /** تسجيل الخروج: يحفظ لقطة ثم يفرّغ بيانات الحساب من الجهاز */
  signOutCloud: () => SessionSnapshotMeta | null;
  /** حساب السحابة المسجّل على هذا الجهاز آخر مرة */
  lastAccountEmail: string;
  /** لقطة ما قبل الخروج/تبديل الحساب (إن وُجدت) */
  snapshotMeta: SessionSnapshotMeta | null;
  /** هل توجد سجلات محلية على الجهاز؟ */
  hasLocalRecords: boolean;
  /** ترجيع لقطة ما قبل الخروج إلى الجهاز */
  restoreSnapshot: () => { ok: boolean; total: number };
  /** حذف لقطة ما قبل الخروج نهائياً */
  discardSnapshot: () => void;
  /** عمل لقطة يدوية من بيانات الجهاز */
  createSnapshot: () => SessionSnapshotMeta;
  syncWithCloud: (silent?: boolean) => Promise<boolean>;

  addPurchase: (p: Omit<Purchase, 'id' | 'payments' | 'updatedAt'>) => void;
  updatePurchase: (p: Purchase) => void;
  deletePurchase: (id: string) => void;
  archivePurchase: (id: string) => void;
  restorePurchase: (id: string) => void;
  addPaymentToPurchase: (purchaseId: string, payment: Omit<Payment, 'id'>) => void;

  addSale: (s: Omit<Sale, 'id' | 'updatedAt'>) => void;
  updateSale: (s: Sale) => void;
  deleteSale: (id: string) => void;
  archiveSale: (id: string) => void;
  restoreSale: (id: string) => void;
  addPaymentToSale: (saleId: string, payment: Omit<Payment, 'id'>) => void;

  addExpense: (e: Omit<Expense, 'id' | 'updatedAt'>) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  archiveExpense: (id: string) => void;
  restoreExpense: (id: string) => void;

  addPartner: (p: Omit<Partner, 'id' | 'updatedAt'>) => void;
  updatePartner: (p: Partner) => void;
  deletePartner: (id: string) => void;
  archivePartner: (id: string) => void;
  restorePartner: (id: string) => void;

  updateRates: (r: Partial<GoldRates>) => void;
  refreshRates: () => Promise<boolean>;
  setLocalPremium: (percent: number) => void;
  setManualRateOverride: (enabled: boolean) => void;

  /* ----------------------- محرك الأسعار (v6.6) ----------------------- */
  /** آخر لقطة من محرك الأسعار: القراءات + التحقق + الحساب */
  engine: EngineSnapshot | null;
  /** جلب كل المصادر عبر محرك التحقق — false يعني فشل الجلب */
  refreshEngine: (overrides?: EngineOverrides) => Promise<boolean>;
  engineBusy: boolean;
  engineError: string;
  /** السعر المعتمد لجرام عيار 21 (شراء وبيع) — يقود كل العمليات الجديدة */
  approvedPrice: ApprovedPrice | null;
  /** اعتماد سعر (يدوي أو تلقائي) */
  approvePrice: (price: { buy: number; sell: number }, source?: 'manual' | 'auto', note?: string) => void;
  clearApprovedPrice: () => void;
  /** تعديل السوق المحلي % (موجب/سالب) */
  localAdjustPercent: number;
  setLocalAdjust: (percent: number) => void;
  /** هل السعر المقترح يحتاج تأكيداً بسبب تغيّر كبير */
  approvalNeedsConfirmation: boolean;

  setPinCode: (pin: string) => Promise<void>;
  unlockApp: (enteredPin: string) => Promise<boolean>;
  /** التحقق من الرمز بدون فتح القفل (لتغيير الرمز في الإعدادات) */
  verifyPin: (enteredPin: string) => Promise<boolean>;
  lockApp: () => void;
  /** محاولات فتح القفل الخاطئة ووقت الحظر */
  lockout: { attempts: number; until: number };

  exportData: () => void;
  exportCsv: () => void;
  importData: (jsonStr: string) => boolean;
  resetAllData: () => void;
  deletedCount: number;
}

const GoldStoreContext = createContext<GoldStoreContextType | undefined>(undefined);

const STORAGE_KEY = 'golden_calculator_db_v6';
const LEGACY_KEYS = ['golden_calculator_db_v5', 'golden_calculator_db_v4'];
/** حساب السحابة الذي سُجّل على هذا الجهاز آخر مرة */
const LAST_ACCOUNT_KEY = 'gold_last_account_email_v1';
/** لقطة كاملة تُحفظ قبل الخروج أو تبديل الحساب — قابلة للاسترجاع */
const SNAPSHOT_KEY = 'gold_preswitch_snapshot_v1';

/** حِمل فارغ (نظيف) للبدء بحساب جديد أو لدمج حساب بلا بيانات محلية */
const emptyDbPayload = (userEmail = '', storeName = '') => ({
  version: 6,
  storeName,
  userEmail,
  purchases: [],
  sales: [],
  expenses: [],
  partners: [],
  branches: [],
  loans: [],
  invoiceCounters: { sale: 0, purchase: 0 },
  rates: INITIAL_RATES,
  tombstones: {},
});
const LOCKOUT_KEY = 'gold_pin_lockout';
const NOTIFICATIONS_KEY = 'gold_notifications_v1';
const DISMISSED_NOTIFICATIONS_KEY = 'gold_dismissed_notifications_v1';
/** سجل السجلات التي أُنشئ لها إشعار سابقاً — يمنع تكرار الإشعارات بعد إعادة التحميل */
const SEEN_RECORDS_KEY = 'gold_seen_records_v1';
const NOTIFICATION_PREFS_KEY = 'gold_notification_prefs_v1';
const PENDING_SYNC_KEY = 'gold_pending_sync';
const APPROVED_PRICE_KEY = 'gold_approved_price_v1';
const LOCAL_ADJUST_KEY = 'gold_local_adjust_v1';

const GRAMS_PER_OUNCE = 31.1034768;
const DEFAULT_OUNCE_USD = 4150;
const DEFAULT_USD_RATE = 8400;
const DEFAULT_GRAM_USD = DEFAULT_OUNCE_USD / GRAMS_PER_OUNCE;
const DEFAULT_K21 = Math.round(DEFAULT_GRAM_USD * (21 / 24) * DEFAULT_USD_RATE);

const INITIAL_RATES: GoldRates = {
  karat21: DEFAULT_K21,
  karat24: Math.round(DEFAULT_K21 * (24 / 21)),
  karat22: Math.round(DEFAULT_K21 * (22 / 21)),
  karat18: Math.round(DEFAULT_K21 * (18 / 21)),
  usdRate: DEFAULT_USD_RATE,
  usdBuyRate: DEFAULT_USD_RATE - 100,
  bankUsdRate: undefined,
  sarRate: 2240,
  aedRate: 2288,
  egpRate: 170,
  globalOunceUsd: DEFAULT_OUNCE_USD,
  lastUpdated: new Date().toISOString(),
  goldSource: 'قيمة ابتدائية',
  usdSource: 'قيمة ابتدائية',
  isStale: true,
  localPremiumPercent: 0,
  manualOverride: false,
};

/* ------------------------- أدوات مساعدة ------------------------- */

function makeId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch (_) {}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** تجزئة الـ PIN (SHA-256 مع ملح) بدل تخزينه كنص صريح */
export async function hashPin(pin: string, salt?: string): Promise<string> {
  const usedSalt = salt || makeId('s').slice(2, 10);
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // بيئة بدون WebCrypto: نستخدم تجزئة بسيطة (الوضع نادر)
    let h = 0;
    const input = `${usedSalt}:${pin}`;
    for (let i = 0; i < input.length; i += 1) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return `${usedSalt}:${Math.abs(h).toString(16)}`;
  }
  const data = new TextEncoder().encode(`${usedSalt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return `${usedSalt}:${toHex(digest)}`;
}

/** صيغة التخزين للـ PIN الجديد: "salt:hash" — أما القديم فكان 4 أرقام صريحة */
function isLegacyPin(value: string): boolean {
  return /^\d{4}$/.test(value) && value.includes(':') === false;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const GoldStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tombstones, setTombstones] = useState<AppTombstones>({});
  const [rates, setRates] = useState<GoldRates>(INITIAL_RATES);
  const [pinCode, setPinCodeState] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [userEmail, setUserEmailState] = useState<string>('');
  const [storeName, setStoreNameState] = useState<string>(DEFAULT_STORE_NAME);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isCloudSignedIn, setIsCloudSignedIn] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastAccountEmail, setLastAccountEmail] = useState<string>('');
  const [snapshotMeta, setSnapshotMeta] = useState<SessionSnapshotMeta | null>(null);
  const [ratesMeta, setRatesMeta] = useState<RatesMeta>({
    ok: false,
    stale: true,
    warnings: [],
    fetchedAt: '',
  });
  const [lockout, setLockout] = useState<{ attempts: number; until: number }>({ attempts: 0, until: 0 });
  const [ratesHistory, setRatesHistory] = useState<{ t: string; v: number }[]>([]);
  const [engineSnapshot, setEngineSnapshot] = useState<EngineSnapshot | null>(null);
  const [engineBusy, setEngineBusy] = useState<boolean>(false);
  const [engineError, setEngineError] = useState<string>('');
  const [approvedPrice, setApprovedPrice] = useState<ApprovedPrice | null>(null);
  const approvedRef = useRef<ApprovedPrice | null>(null);
  const [localAdjustPercent, setLocalAdjustState] = useState<number>(0);
  const [pendingSync, setPendingSync] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  /** مفاتيح إشعارات حذفها المستخدم نهائياً — لا تعود أبداً */
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const dismissedRef = useRef<string[]>([]);
  const [notificationPrefs, setNotificationPrefsState] =
    useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(ALL_BRANCHES);
  const [invoiceCounters, setInvoiceCounters] = useState<InvoiceCounters>({ sale: 0, purchase: 0 });
  const [syncError, setSyncError] = useState('');
  const { isOnline } = useOnlineStatus();

  /* ------------------------- تقييد البيانات بالفرع النشط ------------------------- */
  const purchases = useMemo(() => scopeToBranch(allPurchases, activeBranchId), [allPurchases, activeBranchId]);
  const loans = useMemo(() => scopeToBranch(allLoans, activeBranchId), [allLoans, activeBranchId]);
  const sales = useMemo(() => scopeToBranch(allSales, activeBranchId), [allSales, activeBranchId]);
  const expenses = useMemo(() => scopeToBranch(allExpenses, activeBranchId), [allExpenses, activeBranchId]);

  const activeBranchList = useMemo(() => activeBranches(branches), [branches]);
  const activeBranch = useMemo(
    () =>
      activeBranchId === ALL_BRANCHES || activeBranchId === UNASSIGNED_BRANCH
        ? null
        : branches.find((b) => b.id === activeBranchId) || null,
    [branches, activeBranchId]
  );
  const activeBranchName = useMemo(() => branchName(branches, activeBranchId), [branches, activeBranchId]);

  const setActiveBranchId = useCallback((id: string) => setActiveBranchIdState(id || ALL_BRANCHES), []);

  const hydrated = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedSignature = useRef<string>('');
  const retryAttempts = useRef(0);
  const dataSignatureRef = useRef<string>('');
  /* المزامنة ثنائية الاتجاه: آخر بصمة سحابية رأيناها + منع رفع مرتد بعد السحب */
  const lastRemoteStamp = useRef<string>('');
  const suppressNextPush = useRef(false);
  const pullInFlight = useRef(false);

  /* ------------------------- التحميل من التخزين المحلي ------------------------- */

  useEffect(() => {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const legacy = LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) || null;
      const saved = current || legacy;
      if (saved) {
        const data = JSON.parse(saved);

        const legacySampleNames = new Set([
          'السر الصائغ (الشريك الأول)',
          'محمد أحمد (الشريك الثاني)',
        ]);
        const hadSampleAccount =
          data.userEmail === 'tajalsir2026@gmail.com' ||
          data.storeName === 'مجوهرات السر الصائغ' ||
          (Array.isArray(data.partners) &&
            data.partners.some((p: Partner) => legacySampleNames.has(p?.name)));

        setAllPurchases(safeArray<Purchase>(data.purchases));
        setAllSales(safeArray<Sale>(data.sales));
        setAllExpenses(safeArray<Expense>(data.expenses));
        setPartners(
          safeArray<Partner>(data.partners).filter((p) => p && !legacySampleNames.has(p.name))
        );
        if (data.tombstones && typeof data.tombstones === 'object') {
          setTombstones(data.tombstones as AppTombstones);
        }
        if (data.rates && typeof data.rates === 'object') {
          setRates((prev) => ({ ...prev, ...data.rates }));
        }
        if (data.pinCode) {
          setPinCodeState(data.pinCode);
          setIsLocked(true);
        }
        if (data.userEmail && !hadSampleAccount) setUserEmailState(data.userEmail);
        if (data.storeName && !hadSampleAccount) setStoreNameState(normalizeStoreName(data.storeName));
        if (hadSampleAccount) {
          setUserEmailState('');
          setStoreNameState(normalizeStoreName(''));
          setIsCloudSignedIn(false);
        }
        if (Array.isArray(data.ratesHistory)) setRatesHistory(data.ratesHistory.slice(-200));
        if (Array.isArray(data.branches)) setBranches(data.branches.filter((b: Branch) => b && b.id && b.name));
        if (Array.isArray(data.loans)) setAllLoans(safeArray<Loan>(data.loans));
        if (typeof data.activeBranchId === 'string' && data.activeBranchId) {
          setActiveBranchIdState(data.activeBranchId);
        }
        if (data.invoiceCounters && typeof data.invoiceCounters === 'object') {
          setInvoiceCounters({
            sale: Math.max(0, Number(data.invoiceCounters.sale) || 0),
            purchase: Math.max(0, Number(data.invoiceCounters.purchase) || 0),
          });
        }
        if (data.themeMode) setThemeModeState(data.themeMode);
        if (data.lastSyncTime) setLastSyncTime(data.lastSyncTime);
        if (!hadSampleAccount && data.isCloudSignedIn !== undefined) {
          setIsCloudSignedIn(Boolean(data.isCloudSignedIn));
        }
      }

      const savedLockout = localStorage.getItem(LOCKOUT_KEY);
      if (savedLockout) setLockout(JSON.parse(savedLockout));

      if (localStorage.getItem(PENDING_SYNC_KEY) === '1') setPendingSync(true);

      try {
        const rawDismissed = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
        if (rawDismissed) {
          const parsed = JSON.parse(rawDismissed);
          if (Array.isArray(parsed)) {
            dismissedRef.current = parsed.filter((x) => typeof x === 'string');
            setDismissedNotifications(dismissedRef.current);
          }
        }
      } catch {
        /* تجاهل */
      }

      try {
        const rawSeen = localStorage.getItem(SEEN_RECORDS_KEY);
        if (rawSeen) {
          const parsedSeen = JSON.parse(rawSeen);
          if (parsedSeen && typeof parsedSeen === 'object') {
            seenIdsRef.current = {
              sales: new Set<string>(parsedSeen.sales || []),
              purchases: new Set<string>(parsedSeen.purchases || []),
              expenses: new Set<string>(parsedSeen.expenses || []),
              loans: new Set<string>(parsedSeen.loans || []),
            };
          }
        }
      } catch {
        /* تجاهل */
      }

      const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
      if (savedNotifications) {
        const parsed = JSON.parse(savedNotifications);
        if (Array.isArray(parsed)) setNotifications(parsed.slice(0, 120));
      }
      const savedPrefs = localStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        if (parsed && typeof parsed === 'object') {
          setNotificationPrefsState({ ...DEFAULT_NOTIFICATION_PREFS, ...parsed });
        }
      }
    } catch (e) {
      console.warn('Failed to load storage:', e);
    } finally {
      hydrated.current = true;
    }
  }, []);

  /* ------------------------- ترقيم الفواتير القديمة مرة واحدة ------------------------- */

  useEffect(() => {
    if (!hydrated.current) return;
    const missing =
      allSales.some((x) => !x.invoiceNo) || allPurchases.some((x) => !x.invoiceNo);
    if (!missing) return;
    numberLegacyInvoices();
    // numberLegacyInvoices آمنة للتكرار: تُرقّم الناقص فقط ثم تتوقف
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSales, allPurchases]);

  /* ------------------------- حماية الفرع النشط من الحذف ------------------------- */

  useEffect(() => {
    if (activeBranchId === ALL_BRANCHES || activeBranchId === UNASSIGNED_BRANCH) return;
    if (branches.some((b) => b.id === activeBranchId)) return;
    // الفرع لم يعد موجوداً (حُذف من جهاز آخر) → نعود لعرض كل الفروع
    if (hydrated.current) setActiveBranchIdState(ALL_BRANCHES);
  }, [branches, activeBranchId]);

  /* ------------------------- الترقية: تجزئة الـ PIN القديم ------------------------- */

  useEffect(() => {
    if (!pinCode || !isLegacyPin(pinCode)) return;
    const plain = pinCode;
    hashPin(plain).then((hashed) => {
      setPinCodeState(hashed);
    });
  }, [pinCode]);

  /* ------------------------- الحفظ في التخزين المحلي ------------------------- */

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 6,
          purchases: allPurchases,
          sales: allSales,
          expenses: allExpenses,
          branches,
          loans: allLoans,
          activeBranchId,
          invoiceCounters,
          partners,
          tombstones,
          rates,
          pinCode,
          userEmail,
          storeName,
          themeMode,
          lastSyncTime,
          isCloudSignedIn,
          ratesHistory,
        })
      );
      if (pendingSync) localStorage.setItem(PENDING_SYNC_KEY, '1');
      else localStorage.removeItem(PENDING_SYNC_KEY);

      try {
        if (dismissedNotifications.length > 0) {
          localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(dismissedNotifications));
        } else {
          localStorage.removeItem(DISMISSED_NOTIFICATIONS_KEY);
        }
      } catch {
        /* تجاهل */
      }

      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 120)));
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(notificationPrefs));
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Failed to save storage:', e);
    }
  }, [
    allPurchases,
    allSales,
    allExpenses,
    branches,
    allLoans,
    activeBranchId,
    invoiceCounters,
    partners,
    tombstones,
    rates,
    pinCode,
    userEmail,
    storeName,
    themeMode,
    lastSyncTime,
    isCloudSignedIn,
    ratesHistory,
    pendingSync,
    notifications,
    notificationPrefs,
    dismissedNotifications,
  ]);

  /* ------------------------- تطبيق القفل التلقائي ------------------------- */

  useEffect(() => {
    const savedLockTime = Number(localStorage.getItem('gold_auto_lock_time') || 60);
    if (!pinCode) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (savedLockTime === 0) return;
      timer = setTimeout(() => setIsLocked(true), savedLockTime * 1000);
    };
    const events = ['pointerdown', 'keydown', 'visibilitychange'];
    const handler = () => {
      if (document.visibilityState === 'hidden') return;
      schedule();
    };
    events.forEach((e) => window.addEventListener(e, handler));
    schedule();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [pinCode, isLocked]);

  /* ---------------- تحميل السعر المعتمد وتعديل السوق المحلي ---------------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APPROVED_PRICE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ApprovedPrice;
        if (parsed && Number(parsed.buy) > 0 && Number(parsed.sell) > 0) {
          setApprovedPrice(parsed);
          approvedRef.current = parsed;
        }
      }
      const adj = Number(localStorage.getItem(LOCAL_ADJUST_KEY));
      if (Number.isFinite(adj) && adj !== 0) setLocalAdjustState(adj);
    } catch (_) {}
  }, []);

  /* ------------------------- جلب الأسعار تلقائياً ------------------------- */

  const applyRatesPayload = useCallback((data: any) => {
    const apiKarat21 = Number(data?.karat21) || 0;
    if (!apiKarat21 || apiKarat21 < 1000) return false;

    setRates((prev) => {
      const premium = Number(prev.localPremiumPercent) || 0;
      const base = apiKarat21;
      const effective = prev.manualOverride
        ? prev.karat21
        : Math.round(base * (1 + premium / 100));
      const ratio = effective / base;

      return {
        ...prev,
        karat21: effective,
        karat24: Math.round((Number(data.karat24) || base * (24 / 21)) * ratio),
        karat22: Math.round((Number(data.karat22) || base * (22 / 21)) * ratio),
        karat18: Math.round((Number(data.karat18) || base * (18 / 21)) * ratio),
        usdRate: Number(data.usdRate) || prev.usdRate,
        usdBuyRate: Number(data.usdBuyRate) || prev.usdBuyRate,
        bankUsdRate: Number(data.bankUsdRate) || prev.bankUsdRate,
        sarRate: Number(data.sarRate) || prev.sarRate,
        aedRate: Number(data.aedRate) || prev.aedRate,
        egpRate: Number(data.egpRate) || prev.egpRate,
        globalOunceUsd: Number(data.ounceUsd) || prev.globalOunceUsd,
        karat21Base: base,
        goldSource: data?.global?.source || prev.goldSource,
        usdSource: data?.usd?.source || prev.usdSource,
        isStale: Boolean(data?.stale),
        fetchedAt: data?.fetchedAt || new Date().toISOString(),
        lastUpdated: data?.fetchedAt || new Date().toISOString(),
      } as GoldRates;
    });

    setRatesMeta({
      ok: Boolean(data?.ok),
      stale: Boolean(data?.stale),
      warnings: safeArray<string>(data?.warnings),
      fetchedAt: data?.fetchedAt || new Date().toISOString(),
      goldSource: data?.global?.source,
      usdSource: data?.usd?.source,
      crossSource: data?.cross?.source,
      bankRate: Number(data?.banks?.sell) || null,
      usdBuy: Number(data?.usd?.buy) || null,
    });
    return true;
  }, []);

  const refreshRates = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/rates', { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      return applyRatesPayload(data);
    } catch (err) {
      console.warn('Rates fetch failed:', err);
      return false;
    }
  }, [applyRatesPayload]);

  useEffect(() => {
    refreshRates();
    // كل 3 دقائق في الوضع الطبيعي، وكل دقيقة إذا كانت الأسعار غير محدّثة
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refreshRates();
    }, 60 * 1000);
    const onFocus = () => refreshRates();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshRates]);

  /* ------------------- سجل سعر عيار 21 (محلي) ------------------- */

  useEffect(() => {
    if (!hydrated.current) return;
    const value = Number(rates.karat21) || 0;
    if (value <= 0) return;
    setRatesHistory((prev) => {
      const last = prev[prev.length - 1];
      const changed = !last || Math.abs(last.v - value) / (last.v || 1) > 0.001;
      const oldEnough = !last || Date.now() - new Date(last.t).getTime() > 6 * 60 * 60 * 1000;
      if (last && !changed && !oldEnough) return prev;
      return [...prev, { t: new Date().toISOString(), v: value }].slice(-200);
    });
  }, [rates.karat21]);

  /* ------------------------- المظهر ------------------------- */

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      let isDark = true;
      if (mode === 'light') isDark = false;
      else if (mode === 'dark') isDark = true;
      else isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (isDark) {
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
      }
    };

    applyTheme(themeMode);

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [themeMode]);

  /* ------------------------- الحسابات المشتقة ------------------------- */

  const inventory = useMemo(() => computeInventory(purchases, sales, rates), [purchases, sales, rates]);

  const financials = useMemo(
    () => computeFinancials(purchases, sales, expenses, partners),
    [purchases, sales, expenses, partners]
  );

  const partnerSharesList = useMemo(
    () => partnerShares(partners, expenses, financials.netProfit, financials.totalCapital),
    [partners, expenses, financials.netProfit, financials.totalCapital]
  );

  const dues = useMemo(
    () => mergeDueSummaries(computeDues(sales, purchases), computeLoanDues(loans)),
    [sales, purchases, loans]
  );

  /** ملخص السلف: لنا، علينا، والصافي */
  const loanSummary = useMemo<LoanSummary>(() => summarizeLoans(loans), [loans]);

  const totalProfitPercent = useMemo(
    () => partners.filter((p) => !p.archived).reduce((sum, p) => sum + (p.profitPercent || 0), 0),
    [partners]
  );

  /* ------------------------- الإجراءات ------------------------- */

  const setUserEmail = (email: string) => setUserEmailState(email.trim());
  const setStoreName = (name: string) => setStoreNameState(name.trim());
  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);

  const markDeleted = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setTombstones((prev) => {
      const next = { ...prev };
      const now = new Date().toISOString();
      ids.forEach((id) => {
        next[id] = now;
      });
      return next;
    });
  }, []);

  const addPurchase = (p: Omit<Purchase, 'id' | 'payments' | 'updatedAt'>) => {
    const branchId =
      p.branchId ||
      (activeBranchId === ALL_BRANCHES || activeBranchId === UNASSIGNED_BRANCH ? undefined : activeBranchId);
    const code = branchCode(branches, branchId);
    const invoiceNo =
      p.invoiceNo ||
      nextInvoiceNo(allPurchases, 'purchase', { branchCode: code, counter: invoiceCounters.purchase });
    const newP: Purchase = {
      ...p,
      branchId,
      invoiceNo,
      id: makeId('pch'),
      payments: [],
      updatedAt: new Date().toISOString(),
    };
    if (!p.invoiceNo) {
      setInvoiceCounters((prev) => ({ ...prev, purchase: prev.purchase + 1 }));
    }
    setAllPurchases((prev) => [newP, ...prev]);
  };

  const updatePurchase = (p: Purchase) => {
    setAllPurchases((prev) =>
      prev.map((item) => (item.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : item))
    );
  };

  const deletePurchase = (id: string) => {
    setAllPurchases((prev) => prev.filter((item) => item.id !== id));
    markDeleted([id]);
  };
  const archivePurchase = (id: string) =>
    setAllPurchases((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item
      )
    );
  const restorePurchase = (id: string) =>
    setAllPurchases((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: false, updatedAt: new Date().toISOString() } : item
      )
    );

  const addPaymentToPurchase = (purchaseId: string, payment: Omit<Payment, 'id'>) => {
    const targetPurchase = allPurchases.find((x) => x.id === purchaseId);
    if (targetPurchase && notificationPrefs.paymentsEnabled) {
      const appliedNow = Math.min(purchasePending(targetPurchase), Math.max(0, payment.amount || 0));
      if (appliedNow > 0) {
        notify(
          paymentNotification('purchase', targetPurchase.seller || 'مورد عام', appliedNow, payment.date)
        );
      }
    }
    setAllPurchases((prev) =>
      prev.map((pch) => {
        if (pch.id !== purchaseId) return pch;
        const newPay: Payment = { ...payment, id: makeId('pay') };
        const newPending = Math.max(0, (pch.pendingAmount || 0) - payment.amount);
        return {
          ...pch,
          pendingAmount: newPending,
          payments: [...(pch.payments || []), newPay],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const addSale = (s: Omit<Sale, 'id' | 'updatedAt'>) => {
    const branchId =
      s.branchId ||
      (activeBranchId === ALL_BRANCHES || activeBranchId === UNASSIGNED_BRANCH ? undefined : activeBranchId);
    const code = branchCode(branches, branchId);
    const invoiceNo =
      s.invoiceNo || nextInvoiceNo(allSales, 'sale', { branchCode: code, counter: invoiceCounters.sale });
    const newS: Sale = {
      ...s,
      branchId,
      invoiceNo,
      id: makeId('sal'),
      updatedAt: new Date().toISOString(),
    };
    if (!s.invoiceNo) {
      setInvoiceCounters((prev) => ({ ...prev, sale: prev.sale + 1 }));
    }
    setAllSales((prev) => [newS, ...prev]);
  };

  const updateSale = (s: Sale) => {
    setAllSales((prev) =>
      prev.map((item) => (item.id === s.id ? { ...s, updatedAt: new Date().toISOString() } : item))
    );
  };

  const deleteSale = (id: string) => {
    setAllSales((prev) => prev.filter((item) => item.id !== id));
    markDeleted([id]);
  };
  const archiveSale = (id: string) =>
    setAllSales((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item
      )
    );
  const restoreSale = (id: string) =>
    setAllSales((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: false, updatedAt: new Date().toISOString() } : item
      )
    );

  const addPaymentToSale = (saleId: string, payment: Omit<Payment, 'id'>) => {
    const targetSale = allSales.find((x) => x.id === saleId);
    if (targetSale && notificationPrefs.paymentsEnabled) {
      const appliedNow = Math.min(salePending(targetSale), Math.max(0, payment.amount || 0));
      if (appliedNow > 0) {
        notify(
          paymentNotification('sale', targetSale.buyer || 'زبون عام', appliedNow, payment.date)
        );
      }
    }
    setAllSales((prev) =>
      prev.map((sale) => {
        if (sale.id !== saleId) return sale;
        const remaining = salePending(sale);
        const applied = Math.min(remaining, Math.max(0, payment.amount));
        const newPay: Payment = { ...payment, amount: applied, id: makeId('rct') };
        return {
          ...sale,
          paidAmount: (sale.sellAmount || 0) - (remaining - applied),
          pendingAmount: Math.max(0, remaining - applied),
          payments: [...(sale.payments || []), newPay],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const addExpense = (e: Omit<Expense, 'id' | 'updatedAt'>) => {
    const newE: Expense = {
      ...e,
      id: makeId('exp'),
      branchId:
        e.branchId ||
        (activeBranchId === ALL_BRANCHES || activeBranchId === UNASSIGNED_BRANCH ? undefined : activeBranchId),
      updatedAt: new Date().toISOString(),
    };
    setAllExpenses((prev) => [newE, ...prev]);
  };

  const updateExpense = (e: Expense) => {
    setAllExpenses((prev) =>
      prev.map((item) => (item.id === e.id ? { ...e, updatedAt: new Date().toISOString() } : item))
    );
  };

  const deleteExpense = (id: string) => {
    setAllExpenses((prev) => prev.filter((item) => item.id !== id));
    markDeleted([id]);
  };
  const archiveExpense = (id: string) =>
    setAllExpenses((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item
      )
    );
  const restoreExpense = (id: string) =>
    setAllExpenses((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: false, updatedAt: new Date().toISOString() } : item
      )
    );

  const addPartner = (p: Omit<Partner, 'id' | 'updatedAt'>) => {
    const newPt: Partner = {
      ...p,
      id: makeId('pt'),
      updatedAt: new Date().toISOString(),
    };
    setPartners((prev) => [...prev, newPt]);
  };

  const updatePartner = (p: Partner) => {
    setPartners((prev) =>
      prev.map((item) => (item.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : item))
    );
  };

  const deletePartner = (id: string) => {
    setPartners((prev) => prev.filter((item) => item.id !== id));
    markDeleted([id]);
  };
  const archivePartner = (id: string) =>
    setPartners((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item
      )
    );
  const restorePartner = (id: string) =>
    setPartners((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: false, updatedAt: new Date().toISOString() } : item
      )
    );

  const updateRates = (newRates: Partial<GoldRates>) => {
    setRates((prev) => ({
      ...prev,
      ...newRates,
      lastUpdated: new Date().toISOString(),
    }));
  };

  /**
   * تعديل السوق المحلي — مصدر حقيقة واحد مع محرك الأسعار.
   * يُعاد الحساب فوراً من آخر مدخلات المحرك (بلا شبكة) ثم يُحدَّث من المصادر.
   */
  const setLocalPremium = (percent: number) => {
    setLocalAdjust(percent);
    const inputs = engineSnapshot?.inputs;
    if (inputs?.ounceUsd && inputs?.usdBuy && inputs?.usdSell) {
      const recomputed = computeGoldPrice({
        ounceUsd: inputs.ounceUsd,
        usdBuy: inputs.usdBuy,
        usdSell: inputs.usdSell,
        localAdjustPercent: percent,
        karat: TRADE_KARAT,
      });
      if (recomputed.ok) {
        approvePrice(
          { buy: recomputed.buy, sell: recomputed.sell },
          'manual',
          `تعديل السوق المحلي ${percent > 0 ? '+' : ''}${percent}%`
        );
      }
    }
    setRates((prev) => ({ ...prev, localPremiumPercent: percent }));
    refreshEngine();
  };

  const setManualRateOverride = (enabled: boolean) => {
    setRates((prev) => ({ ...prev, manualOverride: enabled }));
  };

  /* --------------------------- محرك الأسعار --------------------------- */

  const applyApproved = useCallback((price: ApprovedPrice | null) => {
    approvedRef.current = price;
    setApprovedPrice(price);
    try {
      if (price) localStorage.setItem(APPROVED_PRICE_KEY, JSON.stringify(price));
      else localStorage.removeItem(APPROVED_PRICE_KEY);
    } catch (_) {}
  }, []);

  const approvePrice = useCallback(
    (price: { buy: number; sell: number }, source: 'manual' | 'auto' = 'manual', note?: string) => {
      const buy = Math.round(Number(price.buy) || 0);
      const sell = Math.round(Number(price.sell) || 0);
      if (buy <= 0 || sell <= 0) return;
      const next: ApprovedPrice = { buy, sell, at: new Date().toISOString(), source, note };
      applyApproved(next);
      // دعم الشاشات القديمة (الفواتير/العروض) — البيع هو سعر المتجر لجرام 21
      setRates((prev) => ({
        ...prev,
        karat21: sell,
        karat24: Math.round(sell * (24 / 21)),
        karat22: Math.round(sell * (22 / 21)),
        karat18: Math.round(sell * (18 / 21)),
        manualOverride: true,
        lastUpdated: next.at,
      }));
    },
    [applyApproved]
  );

  const clearApprovedPrice = useCallback(() => applyApproved(null), [applyApproved]);

  const setLocalAdjust = useCallback((percent: number) => {
    const clamped = Math.max(-20, Math.min(50, Number(percent) || 0));
    setLocalAdjustState(clamped);
    try {
      localStorage.setItem(LOCAL_ADJUST_KEY, String(clamped));
    } catch (_) {}
  }, []);

  const refreshEngine = useCallback(
    async (overrides?: EngineOverrides): Promise<boolean> => {
      setEngineBusy(true);
      setEngineError('');
      try {
        const params = new URLSearchParams();
        params.set('adjust', String(localAdjustPercent || 0));
        if (overrides?.usdBuy) params.set('usdBuy', String(overrides.usdBuy));
        if (overrides?.usdSell) params.set('usdSell', String(overrides.usdSell));
        if (overrides?.ounce) params.set('ounce', String(overrides.ounce));
        const res = await fetch(`/api/rates/engine?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) {
          setEngineError('تعذر تشغيل محرك الأسعار الآن');
          return false;
        }
        const data = (await res.json()) as EngineSnapshot;
        setEngineSnapshot(data);

        // الاعتماد التلقائي: فقط إذا مرّت الأسعار من كل طبقات التحقق
        const comp = data?.computation;
        const parallelOk = (data?.aggregates?.parallel?.used?.length ?? 0) > 0;
        if (comp?.ok && parallelOk) {
          const check = checkApproval(approvedRef.current, { buy: comp.buy, sell: comp.sell });
          if (!check.needsConfirmation) {
            const auto: ApprovedPrice = {
              buy: comp.buy,
              sell: comp.sell,
              at: new Date().toISOString(),
              source: 'auto',
              note: `محرك الأسعار — ${data.sourcesUsed?.parallel?.join(' + ') || 'مصادر متعددة'}`,
            };
            applyApproved(auto);
            setRates((prev) => ({
              ...prev,
              karat21: auto.sell,
              karat24: Math.round(auto.sell * (24 / 21)),
              karat22: Math.round(auto.sell * (22 / 21)),
              karat18: Math.round(auto.sell * (18 / 21)),
              usdRate: data.inputs.usdSell || prev.usdRate,
              usdBuyRate: data.inputs.usdBuy || prev.usdBuyRate,
              globalOunceUsd: data.inputs.ounceUsd || prev.globalOunceUsd,
              manualOverride: true,
              lastUpdated: auto.at,
            }));
          }
        }
        return Boolean(data?.ok);
      } catch (err) {
        setEngineError('تعذر الاتصال بمحرك الأسعار');
        console.warn('Engine fetch failed:', err);
        return false;
      } finally {
        setEngineBusy(false);
      }
    },
    [localAdjustPercent, applyApproved]
  );

  /* ------------ الجلب التلقائي للمحرك (دوري + عند العودة للتطبيق) ------------ */

  const lastEngineFetchRef = useRef<number>(0);

  useEffect(() => {
    const runIfDue = (minGapMs: number) => {
      if (Date.now() - lastEngineFetchRef.current < minGapMs) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      lastEngineFetchRef.current = Date.now();
      refreshEngine();
    };

    // أول جلب بعد فتح التطبيق بقليل (لا يعطّل الإقلاع)
    const boot = setTimeout(() => runIfDue(0), 4000);
    const interval = setInterval(() => runIfDue(14 * 60 * 1000), 5 * 60 * 1000);
    const onFocus = () => runIfDue(5 * 60 * 1000);
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(boot);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approvalNeedsConfirmation = useMemo(() => {
    const comp = engineSnapshot?.computation;
    if (!comp?.ok) return false;
    return checkApproval(approvedRef.current, { buy: comp.buy, sell: comp.sell }).needsConfirmation;
  }, [engineSnapshot]);

  /* ------------------------- القفل والـ PIN ------------------------- */

  const recordFailedAttempt = () => {
    setLockout((prev) => {
      const attempts = prev.attempts + 1;
      // تأخير متزايد بعد 5 محاولات فاشلة
      const delay = attempts >= 5 ? Math.min(15 * 60 * 1000, 30 * 1000 * 2 ** (attempts - 5)) : 0;
      const next = { attempts, until: delay > 0 ? Date.now() + delay : 0 };
      try {
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const setPinCode = async (pin: string) => {
    if (!pin) {
      setPinCodeState('');
      setIsLocked(false);
      return;
    }
    setPinCodeState(await hashPin(pin));
  };

  const unlockApp = async (enteredPin: string): Promise<boolean> => {
    if (!pinCode) {
      setIsLocked(false);
      return true;
    }
    if (lockout.until && Date.now() < lockout.until) return false;

    const [salt] = pinCode.split(':');
    const candidate = await hashPin(enteredPin, salt);
    if (candidate === pinCode) {
      setLockout({ attempts: 0, until: 0 });
      try {
        localStorage.removeItem(LOCKOUT_KEY);
      } catch (_) {}
      setIsLocked(false);
      return true;
    }
    recordFailedAttempt();
    return false;
  };

  const verifyPin = async (enteredPin: string): Promise<boolean> => {
    if (!pinCode) return true;
    if (isLegacyPin(pinCode)) return enteredPin === pinCode;
    const [salt] = pinCode.split(':');
    return (await hashPin(enteredPin, salt)) === pinCode;
  };

  const lockApp = () => {
    if (pinCode) setIsLocked(true);
  };

  /* -------- جلسة الحساب: من سجّل هنا آخر مرة + لقطة ما قبل الخروج -------- */

  useEffect(() => {
    try {
      const savedAccount = localStorage.getItem(LAST_ACCOUNT_KEY);
      if (savedAccount) setLastAccountEmail(savedAccount);
      const rawSnap = localStorage.getItem(SNAPSHOT_KEY);
      if (rawSnap) {
        const parsed = JSON.parse(rawSnap);
        if (parsed?.meta) setSnapshotMeta(parsed.meta as SessionSnapshotMeta);
      }
    } catch {
      /* تجاهل: تخزين غير متاح */
    }
  }, []);

  const hasLocalRecords = useMemo(
    () =>
      totalRecords({
        purchases: allPurchases,
        sales: allSales,
        expenses: allExpenses,
        partners,
        loans: allLoans,
      }) > 0,
    [allPurchases, allSales, allExpenses, partners, allLoans]
  );

  const rememberAccount = useCallback((email: string) => {
    const clean = String(email || '').trim().toLowerCase();
    setLastAccountEmail((prev) => (clean || prev));
    try {
      if (clean) localStorage.setItem(LAST_ACCOUNT_KEY, clean);
    } catch {
      /* تجاهل */
    }
  }, []);

  /** لقطة كاملة من حالة الجهاز الحالية — تُحفظ محلياً قبل أي مسح */
  const createSnapshot = useCallback((): SessionSnapshotMeta => {
    const meta: SessionSnapshotMeta = {
      email: userEmail || lastAccountEmail || '',
      storeName,
      at: new Date().toISOString(),
      counts: {
        purchases: allPurchases.length,
        sales: allSales.length,
        expenses: allExpenses.length,
        partners: partners.length,
        loans: allLoans.length,
        branches: branches.length,
      },
    };
    const payload = {
      version: 6,
      storeName,
      userEmail,
      purchases: allPurchases,
      sales: allSales,
      expenses: allExpenses,
      partners,
      branches,
      loans: allLoans,
      invoiceCounters,
      rates,
      tombstones,
    };
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ meta, payload }));
    } catch {
      /* تجاهل: مساحة ممتلئة */
    }
    setSnapshotMeta(meta);
    return meta;
  }, [
    userEmail,
    lastAccountEmail,
    storeName,
    allPurchases,
    allSales,
    allExpenses,
    partners,
    allLoans,
    branches,
    invoiceCounters,
    rates,
    tombstones,
  ]);

  /** تفريغ سجلات الحساب من حالة التطبيق (بلا لمس الإعدادات) */
  const resetLocalRecords = useCallback(() => {
    setAllPurchases([]);
    setAllSales([]);
    setAllExpenses([]);
    setPartners([]);
    setBranches([]);
    setAllLoans([]);
    setActiveBranchIdState(ALL_BRANCHES);
    setInvoiceCounters({ sale: 0, purchase: 0 });
    setTombstones({});
    setStoreNameState(DEFAULT_STORE_NAME);
  }, []);

  /** ترجيع لقطة ما قبل الخروج إلى الجهاز */
  const restoreSnapshot = useCallback((): { ok: boolean; total: number } => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return { ok: false, total: 0 };
      const parsed = JSON.parse(raw);
      const p = parsed?.payload || {};
      setAllPurchases(safeArray<Purchase>(p.purchases));
      setAllSales(safeArray<Sale>(p.sales));
      setAllExpenses(safeArray<Expense>(p.expenses));
      setPartners(safeArray<Partner>(p.partners));
      setBranches(safeArray<Branch>(p.branches));
      setAllLoans(safeArray<Loan>(p.loans));
      if (p.invoiceCounters && typeof p.invoiceCounters === 'object') {
        setInvoiceCounters({
          sale: Math.max(0, Number(p.invoiceCounters.sale) || 0),
          purchase: Math.max(0, Number(p.invoiceCounters.purchase) || 0),
        });
      }
      if (p.tombstones && typeof p.tombstones === 'object') setTombstones(p.tombstones as AppTombstones);
      if (p.storeName) setStoreNameState(normalizeStoreName(String(p.storeName)));
      localStorage.removeItem(SNAPSHOT_KEY);
      setSnapshotMeta(null);
      return { ok: true, total: totalRecords(p) };
    } catch {
      return { ok: false, total: 0 };
    }
  }, []);

  /** حذف لقطة ما قبل الخروج نهائياً */
  const discardSnapshot = useCallback(() => {
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      /* تجاهل */
    }
    setSnapshotMeta(null);
  }, []);

  /* ------------------------- المزامنة السحابية ------------------------- */

  const syncPayload = useCallback(
    () => ({
      version: 6,
      storeName,
      userEmail,
      purchases: allPurchases,
      sales: allSales,
      expenses: allExpenses,
      partners,
      branches,
      loans: allLoans,
      invoiceCounters,
      rates,
      tombstones,
    }),
    [
      storeName,
      userEmail,
      allPurchases,
      allSales,
      allExpenses,
      partners,
      branches,
      allLoans,
      invoiceCounters,
      rates,
      tombstones,
    ]
  );

  const mergePayloads = useCallback(
    (local: any, cloud: any) => {
      const purchasesMerge = mergeRecordsWithTombstones<Purchase>(
        local?.purchases,
        cloud?.purchases,
        local?.tombstones,
        cloud?.tombstones
      );
      const salesMerge = mergeRecordsWithTombstones<Sale>(
        local?.sales,
        cloud?.sales,
        local?.tombstones,
        cloud?.tombstones
      );
      const expensesMerge = mergeRecordsWithTombstones<Expense>(
        local?.expenses,
        cloud?.expenses,
        local?.tombstones,
        cloud?.tombstones
      );
      const partnersMerge = mergeRecordsWithTombstones<Partner>(
        local?.partners,
        cloud?.partners,
        local?.tombstones,
        cloud?.tombstones
      );
      const loansMerge = mergeRecordsWithTombstones<Loan>(
        local?.loans,
        cloud?.loans,
        local?.tombstones,
        cloud?.tombstones
      );
      const branchesMerge = mergeRecordsWithTombstones<Branch>(
        local?.branches,
        cloud?.branches,
        local?.tombstones,
        cloud?.tombstones
      );

      const mergedTombstones: AppTombstones = {
        ...(cloud?.tombstones || {}),
        ...(local?.tombstones || {}),
        ...purchasesMerge.tombstones,
        ...salesMerge.tombstones,
        ...expensesMerge.tombstones,
        ...partnersMerge.tombstones,
        ...branchesMerge.tombstones,
        ...loansMerge.tombstones,
      };

      return {
        version: 6,
        storeName: normalizeStoreName(local?.storeName || cloud?.storeName || ''),
        userEmail: local?.userEmail || cloud?.userEmail || '',
        purchases: sortRecords(purchasesMerge.items),
        sales: sortRecords(salesMerge.items),
        expenses: sortRecords(expensesMerge.items),
        partners: partnersMerge.items,
        branches: branchesMerge.items,
        loans: sortRecords(loansMerge.items),
        invoiceCounters: {
          sale: Math.max(
            Number(local?.invoiceCounters?.sale) || 0,
            Number(cloud?.invoiceCounters?.sale) || 0
          ),
          purchase: Math.max(
            Number(local?.invoiceCounters?.purchase) || 0,
            Number(cloud?.invoiceCounters?.purchase) || 0
          ),
        },
        rates: cloud?.rates && !local?.rates?.manualOverride ? { ...local?.rates, ...cloud?.rates, karat21: local?.rates?.karat21 } : local?.rates || cloud?.rates,
        tombstones: mergedTombstones,
      };
    },
    []
  );

  /**
   * لا نستبدل المصفوفة إذا كانت نفس السجلات وفقط (نفس المعرّف ووقت التعديل).
   * بدون هذا الفحص، كل مزامنة تُنشئ مرجعاً جديداً فتطلق مزامنة تالية بلا نهاية.
   */
  const sameRecords = (a: any[] = [], b: any[] = []) =>
    a.length === b.length &&
    a.every((item, i) => item?.id === b[i]?.id && item?.updatedAt === b[i]?.updatedAt);

  /**
   * تطبيق نتيجة المزامنة بدمجها مع الحالة *الحالية* (تحديث وظيفي) لا استبدالها.
   * السبب: الحِمل المدموج بُني من لقطة محلية أُخذت قبل انتظار الشبكة؛ لو عدّل المستخدم
   * شيئاً أثناء الطلب (استعادة من الأرشيف، أرشفة، تعديل، حذف) كان الاستبدال يمحو تعديله.
   * الآن: الأحدث `updatedAt` يفوز، وسجلات الحذف المحلية الأحدث تُحترم.
   */
  const tombstonesRef = useRef<AppTombstones>({});
  tombstonesRef.current = tombstones;
  const mergeInto = <T extends { id: string; updatedAt?: string }>(
    prev: T[],
    incoming: T[],
    cloudTombstones: AppTombstones,
    sort: boolean
  ): T[] => {
    const items = mergeRecordsWithTombstones<T>(prev, incoming, tombstonesRef.current, cloudTombstones).items;
    const next = sort ? sortRecords(items) : items;
    return sameRecords(prev, next) ? prev : next;
  };

  const applyCloudPayload = (payload: any) => {
    if (!payload) return;
    const nextPurchases = safeArray<Purchase>(payload.purchases);
    const nextSales = safeArray<Sale>(payload.sales);
    const nextExpenses = safeArray<Expense>(payload.expenses);
    const nextPartners = safeArray<Partner>(payload.partners);
    const nextBranches = safeArray<Branch>(payload.branches);
    const nextLoans = safeArray<Loan>(payload.loans);
    const ct: AppTombstones = payload.tombstones && typeof payload.tombstones === 'object' ? payload.tombstones : {};

    setAllPurchases((prev) => mergeInto(prev, nextPurchases, ct, true));
    setAllSales((prev) => mergeInto(prev, nextSales, ct, true));
    setAllExpenses((prev) => mergeInto(prev, nextExpenses, ct, true));
    setPartners((prev) => mergeInto(prev, nextPartners, ct, false));
    setBranches((prev) => mergeInto(prev, nextBranches, ct, false));
    setAllLoans((prev) => mergeInto(prev, nextLoans, ct, true));
    if (payload.invoiceCounters && typeof payload.invoiceCounters === 'object') {
      setInvoiceCounters((prev) => ({
        sale: Math.max(prev.sale, Number(payload.invoiceCounters.sale) || 0),
        purchase: Math.max(prev.purchase, Number(payload.invoiceCounters.purchase) || 0),
      }));
    }
    if (payload.tombstones && typeof payload.tombstones === 'object') {
      setTombstones((prev) => {
        const out: AppTombstones = { ...prev };
        Object.entries(payload.tombstones as AppTombstones).forEach(([id, at]) => {
          if (!out[id] || new Date(at) > new Date(out[id])) out[id] = at;
        });
        return out;
      });
    }
    if (typeof payload.storeName === 'string' && payload.storeName) {
      setStoreNameState(payload.storeName);
    }
  };

  const syncTimeLabel = () => {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now
      .getHours()
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  /**
   * مزامنة الفروع مع جدول Supabase المستقل (`branches`).
   * الحِمل الكامل يُزامَن عبر /api/sync، وهذه مرآة إضافية:
   * ترفع الفروع للجدول وتدمج ما وُجد هناك (الأحدث يفوز) حتى يرى كل جهاز فروع بقية الأجهزة.
   * تفشل بهدوء إن لم يكن الجدول منشأً بعد (راجع supabase/branches.sql).
   */
  const syncBranchesTable = useCallback(async (localBranches: Branch[]): Promise<boolean> => {
    try {
      if (localBranches.length > 0) {
        await fetch('/api/branches', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branches: localBranches }),
        });
      }
      const res = await fetch('/api/branches', { cache: 'no-store' });
      if (!res.ok) return false;
      const data = await res.json();
      const remote: Branch[] = Array.isArray(data?.branches) ? data.branches : [];
      if (remote.length === 0) return Boolean(data?.ok);

      setBranches((prev) => {
        const byId = new Map<string, Branch>();
        prev.forEach((b) => byId.set(b.id, b));
        for (const rb of remote) {
          const existing = byId.get(rb.id);
          if (!existing) {
            byId.set(rb.id, rb);
            continue;
          }
          const tLocal = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const tRemote = rb.updatedAt ? new Date(rb.updatedAt).getTime() : 0;
          if (tRemote > tLocal) byId.set(rb.id, rb);
        }
        const next = Array.from(byId.values());
        const unchanged =
          next.length === prev.length &&
          next.every((b, i) => b.id === prev[i]?.id && b.updatedAt === prev[i]?.updatedAt);
        return unchanged ? prev : next;
      });
      return Boolean(data?.ok);
    } catch {
      return false;
    }
  }, []);

  /** الخادم غير مهيّأ (نقص AUTH_SECRET) — رسالة واضحة للمستخدم */
  const handleServerNotConfigured = useCallback(() => {
    setSyncError('المزامنة متوقفة: الخادم يحتاج إعداد مفتاح AUTH_SECRET في Vercel ثم إعادة النشر');
  }, []);

  /** انتهت جلسة الدخول على السيرفر (كوكي منتهي أو مُسح) */
  const handleSessionExpired = useCallback(() => {
    setIsCloudSignedIn(false);
    setSyncError('انتهت جلسة الدخول — سجّل الدخول من جديد من قسم المزامنة لاستعادة المزامنة');
  }, []);

  const syncWithCloud = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!isCloudSignedIn) return false;
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync', { cache: 'no-store' });
        if (response.status === 503) {
          handleServerNotConfigured();
          return false;
        }
        if (response.status === 401) {
          handleSessionExpired();
          return false;
        }
        if (!response.ok) {
          setSyncError(`تعذر الوصول للسحابة (خطأ ${response.status}) — سيُعاد المحاولة`);
          return false;
        }
        const result = await response.json();
        const merged = mergePayloads(syncPayload(), result.payload || {});
        applyCloudPayload(merged);
        const put = await fetch('/api/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
        if (put.status === 503) {
          handleServerNotConfigured();
          return false;
        }
        if (put.status === 401) {
          handleSessionExpired();
          return false;
        }
        if (!put.ok) {
          setSyncError(`تعذر رفع البيانات للسحابة (خطأ ${put.status}) — سيُعاد المحاولة`);
          return false;
        }
        try {
          const putResult = await put.clone().json();
          if (putResult?.updatedAt) lastRemoteStamp.current = String(putResult.updatedAt);
        } catch {
          /* لا يعطّل المزامنة */
        }
        setLastSyncTime(syncTimeLabel());
        // مرآة الفروع إلى جدول Supabase المستقل (أفضل جهد — لا يعطّل المزامنة)
        void syncBranchesTable(merged.branches || []);
        return true;
      } catch {
        if (!silent) console.warn('sync failed');
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [isCloudSignedIn, mergePayloads, syncPayload, syncBranchesTable, handleSessionExpired, handleServerNotConfigured]
  );

  /**
   * سحب التحديثات من السحابة (لأجهزة أخرى).
   * - طلب قراءة واحد فقط، ولا يفعل شيئاً إن لم يتغيّر شئ على السحابة.
   * - بعد الدمج: إن لم يكن لدينا تغييرات غير مرفوعة، لا نرفع مرة أخرى (تفادي الحلقة).
   */
  const pullFromCloud = useCallback(
    async (silent = true): Promise<{ ok: boolean; changed: boolean }> => {
      if (!isCloudSignedIn || !isOnline) return { ok: false, changed: false };
      if (pullInFlight.current) return { ok: true, changed: false };
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return { ok: true, changed: false };
      }
      pullInFlight.current = true;
      try {
        const response = await fetch('/api/sync', { cache: 'no-store' });
        if (response.status === 503) {
          handleServerNotConfigured();
          return { ok: false, changed: false };
        }
        if (response.status === 401) {
          handleSessionExpired();
          return { ok: false, changed: false };
        }
        if (!response.ok) return { ok: false, changed: false };
        const result = await response.json();
        const stamp = result?.updatedAt ? String(result.updatedAt) : '';
        if (!stamp || stamp === lastRemoteStamp.current) return { ok: true, changed: false };

        const hadUnsyncedLocal = dataSignatureRef.current !== lastPushedSignature.current;
        const merged = mergePayloads(syncPayload(), result.payload || {});
        applyCloudPayload(merged);
        lastRemoteStamp.current = stamp;

        // لا نرفع ردّاً على سحب لم يصاحبه أي تعديل محلي
        if (!hadUnsyncedLocal) suppressNextPush.current = true;
        if (!silent) setLastSyncTime(syncTimeLabel());
        return { ok: true, changed: true };
      } catch {
        return { ok: false, changed: false };
      } finally {
        pullInFlight.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCloudSignedIn, isOnline, mergePayloads, syncPayload, handleSessionExpired, handleServerNotConfigured]
  );

  /**
   * محرّك المزامنة:
   * - ينتظر 4 ثوانٍ بعد آخر تعديل (لتجميع التعديلات).
   * - لا يحاول أثناء انقطاع الشبكة، وينتظر حدث العودة للمحاولة فوراً.
   * - عند الفشل يعيد المحاولة بتأخير متزايد، ويحفظ التغييرات محلياً حتى تنجح.
   */
  const attemptSync = useCallback(async (): Promise<boolean> => {
    if (!isCloudSignedIn) return false;

    if (!isOnline) {
      setPendingSync(true);
      setSyncError('لا يوجد اتصال بالإنترنت — سيتم الرفع تلقائياً عند عودة الشبكة');
      return false;
    }

    const signature = dataSignatureRef.current;
    setSyncError('');
    const ok = await syncWithCloud(true);

    if (ok) {
      lastPushedSignature.current = signature;
      retryAttempts.current = 0;
      setPendingSync(false);
      setSyncError('');
      return true;
    }

    retryAttempts.current += 1;
    setPendingSync(true);
    setSyncError('تعذر إكمال المزامنة — سيُعاد المحاولة تلقائياً');

    const delay = Math.min(60_000, 5_000 * 2 ** Math.min(retryAttempts.current - 1, 4));
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      void attemptSync();
    }, delay);
    return false;
  }, [isCloudSignedIn, isOnline, syncWithCloud]);

  /** فحص السحابة: كم سجل موجود على السيرفر فعلاً؟ (قراءة فقط) */
  const inspectCloud = useCallback(async (): Promise<CloudInspection> => {
    try {
      const res = await fetch('/api/sync', { cache: 'no-store' });
      if (res.status === 503) {
        handleServerNotConfigured();
        return { ok: false, updatedAt: null, serverNotConfigured: true };
      }
      if (res.status === 401) {
        handleSessionExpired();
        return { ok: false, updatedAt: null, sessionExpired: true };
      }
      if (!res.ok) return { ok: false, updatedAt: null };
      const data = await res.json();
      const payload = data?.payload || null;
      const counts = {
        purchases: (payload?.purchases || []).length,
        sales: (payload?.sales || []).length,
        expenses: (payload?.expenses || []).length,
        loans: (payload?.loans || []).length,
        partners: (payload?.partners || []).length,
        branches: (payload?.branches || []).length,
      };
      return { ok: true, updatedAt: data?.updatedAt || null, counts };
    } catch {
      return { ok: false, updatedAt: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSessionExpired, handleServerNotConfigured]);

  const forceSync = useCallback(async () => {
    retryAttempts.current = 0;
    return attemptSync();
  }, [attemptSync]);

  // توقيع البيانات: يتغير فقط عند إضافة/تعديل/حذف سجل فعلاً
  const dataSignature = useMemo(
    () =>
      JSON.stringify([
        allPurchases.map((p) => `${p.id}:${p.updatedAt || ''}:${p.archived ? 1 : 0}:${p.branchId || ''}`),
        allSales.map((s) => `${s.id}:${s.updatedAt || ''}:${s.archived ? 1 : 0}:${s.branchId || ''}`),
        allExpenses.map((e) => `${e.id}:${e.updatedAt || ''}:${e.archived ? 1 : 0}:${e.branchId || ''}`),
        allLoans.map((l) => `${l.id}:${l.updatedAt || ''}:${l.archived ? 1 : 0}:${(l.payments || []).length}`),
        partners.map((p) => `${p.id}:${p.updatedAt || ''}:${p.archived ? 1 : 0}`),
        Object.keys(tombstones).length,
      ]),
    [allPurchases, allSales, allExpenses, partners, branches, allLoans, tombstones]
  );

  useEffect(() => {
    dataSignatureRef.current = dataSignature;
  }, [dataSignature]);

  useEffect(() => {
    if (!isCloudSignedIn || !hydrated.current) return;

    if (suppressNextPush.current) {
      suppressNextPush.current = false;
      lastPushedSignature.current = dataSignature;
      setPendingSync(false);
      return;
    }

    if (dataSignature === lastPushedSignature.current) {
      setPendingSync(false);
      return;
    }

    setPendingSync(true);
    if (!isOnline) return; // سننتظر حدث العودة للشبكة

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void attemptSync();
    }, 4000);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature, isCloudSignedIn, isOnline]);

  /**
   * مزامنة ثنائية الاتجاه بين الأجهزة:
   * - كل 15 ثانية (والتطبيق في المقدمة) نسحب أي جديد من السحابة.
   * - عند رجوع التطبيق للمقدمة أو إعادة التركيز → سحب فوري.
   * النتيجة: أي تعديل على جهاز يظهر على الأجهزة الأخرى خلال ثوانٍ دون أي تدخل.
   */
  useEffect(() => {
    if (!isCloudSignedIn || !isOnline) return;

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void pullFromCloud(true);
    };

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick();
    };

    const interval = setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    document.addEventListener('resume', onVisible);

    // سحب أولي عند التفعيل
    tick();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('resume', onVisible);
    };
  }, [isCloudSignedIn, isOnline, pullFromCloud]);

  /**
   * التحقق من صلاحية جلسة الدخول عند بدء التشغيل.
   * بدون هذا: قد يظل التطبيق يظن أنه مسجّل بينما الجلسة منتهية،
   * فتفشل كل محاولات المزامنة بصمت (وهو ما كان يحدث).
   */
  useEffect(() => {
    if (!hydrated.current || !isCloudSignedIn) return;
    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.configured === false) {
          handleServerNotConfigured();
          return;
        }
        if (data && data.authenticated === false) handleSessionExpired();
      } catch {
        /* تجاهل — سنكتشفها عند أول مزامنة */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudSignedIn]);

  // عودة الشبكة → مزامنة فورية
  useEffect(() => {
    if (isOnline && isCloudSignedIn && pendingSync) {
      retryAttempts.current = 0;
      void attemptSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // عند فتح التطبيق بحساب مسجّل: مزامنة أولية (تُنجز أي تغييرات معلّقة من قبل)
  useEffect(() => {
    if (hydrated.current && isCloudSignedIn && isOnline) {
      void attemptSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudSignedIn]);

  // تنظيف المؤقتات عند الإغلاق
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  /**
   * إعادة ربط إشعارات الجهاز بالحساب الحالي بعد الدخول.
   * اشتراك Web Push مسجَّل على السيرفر باسم الحساب القديم — إعادة الإرسال
   * تُحدّث صاحب الاشتراك (upsert على endpoint) فتستمر الإشعارات بعد تبديل الحساب.
   */
  const relinkPushToAccount = useCallback(() => {
    try {
      if (!pushSupported()) return;
      if (permissionState() !== 'granted') return;
      if (!notificationPrefs.enabled) return;
      void subscribeToPush().catch(() => undefined);
    } catch {
      /* تجاهل: الإشعارات ليست حرجة */
    }
  }, [notificationPrefs.enabled]);

  const signInCloud = async (email: string, pass: string, opts?: { clearLocal?: boolean }) => {
    if (!email.trim() || pass.length < 6) {
      return { success: false, message: 'يرجى كتابة بريد صحيح وكلمة مرور من 6 خانات على الأقل' };
    }
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.message || 'تعذر تسجيل الدخول' };

      const trimmedEmail = email.trim().toLowerCase();
      setUserEmailState(trimmedEmail);
      setIsCloudSignedIn(true);
      rememberAccount(trimmedEmail);

      // تبديل حساب: نبدأ من حِمل فارغ حتى لا ترث بيانات جهاز صاحبه القديم،
      // وبيانات الحساب الجديد تُنزَّل من السحابة.
      if (opts?.clearLocal) resetLocalRecords();

      const cloud = await fetch('/api/sync', { cache: 'no-store' });
      const cloudResult = await cloud.json();
      const basePayload = opts?.clearLocal ? emptyDbPayload('') : syncPayload();
      const merged = mergePayloads({ ...basePayload, userEmail: trimmedEmail }, cloudResult.payload || {});
      applyCloudPayload(merged);
      const put = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!put.ok) return { success: false, message: 'تم الدخول لكن فشل رفع البيانات' };
      setLastSyncTime(syncTimeLabel());
      relinkPushToAccount();
      return { success: true, message: 'تم تسجيل الدخول ومزامنة بيانات السحابة 🔒' };
    } catch {
      return { success: false, message: 'تعذر الاتصال بقاعدة البيانات' };
    }
  };

  const signUpCloud = async (email: string, pass: string, opts?: { clearLocal?: boolean }) => {
    if (!email.trim() || pass.length < 6) {
      return { success: false, message: 'يرجى كتابة بريد صحيح وكلمة مرور من 6 خانات على الأقل' };
    }
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const result = await response.json();
      if (!response.ok) return { success: false, message: result.message || 'تعذر إنشاء الحساب' };
      const trimmedEmail = email.trim().toLowerCase();
      setUserEmailState(trimmedEmail);
      setIsCloudSignedIn(true);
      rememberAccount(trimmedEmail);

      // حساب جديد بعد حساب آخر: الجهاز يبدأ نظيفاً — بيانات الحساب القديم لا تُرفع لهذا الحساب
      const signUpPayload = opts?.clearLocal
        ? { ...emptyDbPayload(trimmedEmail), storeName: DEFAULT_STORE_NAME }
        : { ...syncPayload(), userEmail: trimmedEmail };
      if (opts?.clearLocal) resetLocalRecords();

      const put = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signUpPayload),
      });
      if (!put.ok) return { success: false, message: 'تم إنشاء الحساب لكن فشل رفع البيانات' };
      setLastSyncTime(syncTimeLabel());
      relinkPushToAccount();
      return { success: true, message: 'تم إنشاء الحساب ورفع بيانات جهازك ☁️' };
    } catch {
      return { success: false, message: 'تعذر الاتصال بقاعدة البيانات' };
    }
  };

  /**
   * تسجيل الخروج:
   * 1) تُحفظ لقطة كاملة من بيانات الجهاز (قابلة للاسترجاع بضغطة).
   * 2) يُفرَّغ الجهاز — بيانات الحساب لا تبقى لمن يستعمله بعده.
   * 3) تُنهى جلسة السيرفر. البريد يُحفظ للمقارنة عند الدخول بحساب مختلف.
   */
  const signOutCloud = useCallback(() => {
    const account = userEmail || lastAccountEmail;
    const meta = createSnapshot();
    resetLocalRecords();
    setUserEmailState('');
    setLastSyncTime('');
    setIsCloudSignedIn(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* تجاهل */
    }
    rememberAccount(account);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    return meta;
  }, [userEmail, lastAccountEmail, createSnapshot, resetLocalRecords, rememberAccount]);

  /* ------------------------- النسخ الاحتياطي ------------------------- */

  const exportData = () => {
    const byNewest = <T extends { date?: string }>(items: T[]) =>
      [...items].sort(
        (a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
      );
    const db = {
      version: 6,
      storeName,
      userEmail,
      purchases: byNewest(allPurchases),
      sales: byNewest(allSales),
      expenses: byNewest(allExpenses),
      partners,
      branches,
      loans: byNewest(allLoans),
      invoiceCounters,
      rates,
      tombstones,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gold_Calculator_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = buildExportTable({
      storeName,
      exportedAt: new Date(),
      branches,
      purchases: allPurchases,
      sales: allSales,
      expenses: allExpenses,
      loans: allLoans,
    });
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(new Date());
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (typeof data !== 'object' || data === null) return false;
      const hasAny =
        Array.isArray(data.purchases) ||
        Array.isArray(data.sales) ||
        Array.isArray(data.expenses) ||
        Array.isArray(data.partners);
      if (!hasAny) return false;

      setAllPurchases(safeArray<Purchase>(data.purchases));
      setAllSales(safeArray<Sale>(data.sales));
      setAllExpenses(safeArray<Expense>(data.expenses));
      setPartners(safeArray<Partner>(data.partners));
      if (Array.isArray(data.branches)) {
        setBranches(data.branches.filter((b: Branch) => b && b.id && b.name));
      }
      if (Array.isArray(data.loans)) {
        setAllLoans(
          safeArray<Loan>(data.loans).filter((l) => l && l.id && l.person && typeof l.amount === 'number')
        );
      }
      if (data.invoiceCounters && typeof data.invoiceCounters === 'object') {
        setInvoiceCounters({
          sale: Math.max(0, Number(data.invoiceCounters.sale) || 0),
          purchase: Math.max(0, Number(data.invoiceCounters.purchase) || 0),
        });
      }
      if (data.tombstones && typeof data.tombstones === 'object') setTombstones(data.tombstones);
      if (data.rates && typeof data.rates === 'object') setRates((prev) => ({ ...prev, ...data.rates }));
      if (data.userEmail) setUserEmailState(String(data.userEmail));
      if (data.storeName) setStoreNameState(normalizeStoreName(String(data.storeName)));
      return true;
    } catch {
      return false;
    }
  };

  const resetAllData = () => {
    setAllPurchases([]);
    setAllSales([]);
    setAllExpenses([]);
    setPartners([]);
    setBranches([]);
    setAllLoans([]);
    setActiveBranchIdState(ALL_BRANCHES);
    setInvoiceCounters({ sale: 0, purchase: 0 });
    setTombstones({});
    setRates(INITIAL_RATES);
    localStorage.removeItem(STORAGE_KEY);
  };

  /* ------------------------- إدارة الفروع ------------------------- */

  const addBranch = (b: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Branch => {
    const now = new Date().toISOString();
    const branch: Branch = { ...b, id: makeId('brn'), createdAt: now, updatedAt: now };
    setBranches((prev) => [...prev, branch]);
    // أول فرع يُضاف يصبح الفرع النشط تلقائياً
    setActiveBranchIdState((prev) => (prev === ALL_BRANCHES ? branch.id : prev));
    return branch;
  };

  const updateBranch = (b: Branch) => {
    setBranches((prev) =>
      prev.map((item) => (item.id === b.id ? { ...b, updatedAt: new Date().toISOString() } : item))
    );
  };

  const archiveBranch = (id: string) => {
    setBranches((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item
      )
    );
    setActiveBranchIdState((prev) => (prev === id ? ALL_BRANCHES : prev));
  };

  const restoreBranch = (id: string) => {
    setBranches((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: false, updatedAt: new Date().toISOString() } : item
      )
    );
  };

  const deleteBranch = (id: string) => {
    setBranches((prev) => prev.filter((item) => item.id !== id));
    setActiveBranchIdState((prev) => (prev === id ? ALL_BRANCHES : prev));
    markDeleted([id]);
  };

  /** عدد العمليات غير المسندة لأي فرع (بيانات قديمة) */
  const unassignedOperations = useMemo(
    () =>
      allPurchases.filter((x) => !x.branchId).length +
      allSales.filter((x) => !x.branchId).length +
      allExpenses.filter((x) => !x.branchId).length,
    [allPurchases, allSales, allExpenses]
  );

  /** إسناد كل العمليات القديمة (بلا فرع) إلى فرع محدد */
  const assignUnbranchedTo = (branchId: string): number => {
    if (!branchId || branchId === ALL_BRANCHES || branchId === UNASSIGNED_BRANCH) return 0;
    const now = new Date().toISOString();
    const touch = <T extends { branchId?: string; updatedAt?: string }>(items: T[]) =>
      items.map((item) => (item.branchId ? item : { ...item, branchId, updatedAt: now }));
    const count = unassignedOperations;
    setAllPurchases(touch);
    setAllSales(touch);
    setAllExpenses(touch);
    return count;
  };

  /* ------------------------- السلف النقدية ------------------------- */

  const addLoan = (l: Omit<Loan, 'id' | 'payments' | 'updatedAt'>) => {
    const newLoan: Loan = {
      ...l,
      branchId:
        l.branchId ||
        (activeBranchId === ALL_BRANCHES || activeBranchId === UNASSIGNED_BRANCH ? undefined : activeBranchId),
      id: makeId('lon'),
      payments: [],
      updatedAt: new Date().toISOString(),
    };
    setAllLoans((prev) => [newLoan, ...prev]);
  };

  const updateLoan = (l: Loan) => {
    setAllLoans((prev) =>
      prev.map((item) => (item.id === l.id ? { ...l, updatedAt: new Date().toISOString() } : item))
    );
  };

  const archiveLoan = (id: string) =>
    setAllLoans((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item
      )
    );

  const restoreLoan = (id: string) =>
    setAllLoans((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, archived: false, updatedAt: new Date().toISOString() } : item
      )
    );

  const deleteLoan = (id: string) => {
    setAllLoans((prev) => prev.filter((item) => item.id !== id));
    markDeleted([id]);
  };

  /**
   * تسجيل دفعة سداد.
   * عند اكتمال المبلغ: تُؤرشف السلفة تلقائياً (تبقى في الأرشيف قابلة للاستعادة)
   * ولا يتأثر الربح إطلاقاً لأن السلفة ليست مصروفاً ولا إيراداً.
   */
  const addPaymentToLoan = (loanId: string, payment: Omit<Payment, 'id'>) => {
    const targetLoan = allLoans.find((x) => x.id === loanId);
    if (targetLoan && notificationPrefs.paymentsEnabled) {
      const remainingBefore = loanPending(targetLoan);
      const appliedNow = Math.min(remainingBefore, Math.max(0, payment.amount || 0));
      if (appliedNow > 0) {
        notify(paymentNotification('loan', targetLoan.person, appliedNow, payment.date));
        if (appliedNow >= remainingBefore - 0.5) {
          notify(loanSettledNotification(targetLoan, payment.date));
        }
      }
    }
    setAllLoans((prev) =>
      prev.map((loanItem) => {
        if (loanItem.id !== loanId) return loanItem;
        const remaining = loanPending(loanItem);
        const applied = Math.min(remaining, Math.max(0, payment.amount || 0));
        const newPay: Payment = { ...payment, amount: applied, id: makeId('rcv') };
        const updated: Loan = {
          ...loanItem,
          payments: [...(loanItem.payments || []), newPay],
          updatedAt: new Date().toISOString(),
        };
        return isLoanSettled(updated) ? { ...updated, archived: true } : updated;
      })
    );
  };

  const numberLegacyInvoices = (): number => {
    const saleRes = assignMissingInvoiceNumbersByBranch(allSales, 'sale', {
      branches,
      counter: invoiceCounters.sale,
    });
    const purchaseRes = assignMissingInvoiceNumbersByBranch(allPurchases, 'purchase', {
      branches,
      counter: invoiceCounters.purchase,
    });
    if (saleRes.assigned > 0) setAllSales(saleRes.items);
    if (purchaseRes.assigned > 0) setAllPurchases(purchaseRes.items);
    setInvoiceCounters({
      sale: Math.max(invoiceCounters.sale, saleRes.nextCounter),
      purchase: Math.max(invoiceCounters.purchase, purchaseRes.nextCounter),
    });
    return saleRes.assigned + purchaseRes.assigned;
  };

  /* ------------------------- الإشعارات ------------------------- */

  const unreadNotifications = useMemo(() => unreadCount(notifications), [notifications]);

  const notify = useCallback(
    (notification: AppNotification, options: { system?: boolean } = {}) => {
      if (!notification) return;
      // إشعار حُذف نهائياً لا يعود أبداً
      const key = notificationKey(notification);
      if (
        (key && dismissedRef.current.includes(key)) ||
        dismissedRef.current.includes(notification.id)
      ) {
        return;
      }
      setNotifications((prev) =>
        pushNotification(prev, notification, notificationPrefs.keepMax, dismissedRef.current)
      );
      const wantSystem = options.system !== false && notificationPrefs.enabled;
      if (wantSystem) {
        void showSystemNotification(notification.title, notification.body, {
          tab: notification.tab,
          tag: notification.kind,
        });
      }
    },
    [notificationPrefs.enabled, notificationPrefs.keepMax]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => markRead(prev, id));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => markAllRead(prev));
  }, []);

  /** تثبيت مفاتيح في سجل الحذف الدائم */
  const rememberDismissed = useCallback((keys: string[]) => {
    const next = withDismissed(dismissedRef.current, keys);
    dismissedRef.current = next;
    setDismissedNotifications(next);
    // حفظ فوري — لا ينتظر تأثيرات React حتى لا يرجع الإشعار لو أُغلق التطبيق سريعاً
    try {
      localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
      /* تجاهل */
    }
  }, []);

  /** حذف كل الإشعارات — ولا تعود مرة أخرى */
  const clearNotifications = useCallback(() => {
    setNotifications((prev) => {
      rememberDismissed(prev.flatMap((n) => notificationKeys(n)));
      return [];
    });
  }, [rememberDismissed]);

  /** حذف إشعار واحد نهائياً */
  const deleteNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target) rememberDismissed(notificationKeys(target));
        return prev.filter((n) => n.id !== id);
      });
    },
    [rememberDismissed]
  );

  const setNotificationPrefs = useCallback((prefs: Partial<NotificationPrefs>) => {
    setNotificationPrefsState((prev) => ({ ...DEFAULT_NOTIFICATION_PREFS, ...prev, ...prefs }));
  }, []);

  /* ---------------- الكشف التلقائي عن الأحداث الجديدة ---------------- */

  const seenIdsRef = useRef<{ sales: Set<string>; purchases: Set<string>; expenses: Set<string>; loans: Set<string> }>(
    { sales: new Set(), purchases: new Set(), expenses: new Set(), loans: new Set() }
  );
  const lastPriceRef = useRef<number>(0);
  const notificationsBootRef = useRef(false);
  /** لحظة التشغيل — خلال فترة السماح لا تُنتج إشعارات (البيانات ما زالت تُحمَّل) */
  const bootTimeRef = useRef<number>(Date.now());

  /** كشف العمليات الجديدة (محلياً أو من جهاز آخر بعد المزامنة) */
  useEffect(() => {
    if (!hydrated.current) return;

    const seen = seenIdsRef.current;
    // فترة سماح 6 ثوانٍ من التشغيل: البيانات تُحمَّل خلالها من الذاكرة المحلية،
    // وبدونها تُعتبر السجلات الموجودة «جديدة» فتغرق المستخدم بإشعارات وهمية.
    const withinGrace = Date.now() - bootTimeRef.current < 6000;
    const first = !notificationsBootRef.current || withinGrace;
    const fresh: AppNotification[] = [];
    const minAmount = notificationPrefs.minAmount || 0;
    const passes = (amount: number) => !minAmount || (amount || 0) >= minAmount;

    if (notificationPrefs.operationsEnabled) {
      allSales.forEach((sale) => {
        if (seen.sales.has(sale.id)) return;
        if (!first && passes(sale.sellAmount || 0)) {
          const n = saleNotification(sale, sale.updatedAt || sale.date);
          if (n) fresh.push(n);
        }
      });
      allPurchases.forEach((p) => {
        if (seen.purchases.has(p.id)) return;
        if (!first && passes(p.amount || 0)) {
          const n = purchaseNotification(p, p.updatedAt || p.date);
          if (n) fresh.push(n);
        }
      });
      allExpenses.forEach((e) => {
        if (seen.expenses.has(e.id)) return;
        if (!first && passes(e.amount || 0)) fresh.push(expenseNotification(e, e.updatedAt || e.date));
      });
    }

    if (notificationPrefs.loansEnabled) {
      allLoans.forEach((loan) => {
        if (seen.loans.has(loan.id)) return;
        if (!first) fresh.push(loanNotification(loan, loan.updatedAt || loan.date));
      });
    }

    seen.sales = new Set(allSales.map((x) => x.id));
    seen.purchases = new Set(allPurchases.map((x) => x.id));
    seen.expenses = new Set(allExpenses.map((x) => x.id));
    seen.loans = new Set(allLoans.map((x) => x.id));

    // حفظ سجل المُشاهَد — يمنع تكرار الإشعارات بعد إعادة تحميل التطبيق
    try {
      const cap = (set: Set<string>, max = 600) => Array.from(set).slice(-max);
      localStorage.setItem(
        SEEN_RECORDS_KEY,
        JSON.stringify({
          sales: cap(seen.sales),
          purchases: cap(seen.purchases),
          expenses: cap(seen.expenses),
          loans: cap(seen.loans),
        })
      );
    } catch {
      /* تجاهل */
    }

    if (first) {
      notificationsBootRef.current = true;
      return;
    }

    // لو وصلت عمليات كثيرة معاً (مزامنة من جهاز آخر) → إشعار واحد مختصر
    const BATCH_LIMIT = 4;
    if (fresh.length > BATCH_LIMIT) {
      const counts = { sales: 0, purchases: 0, expenses: 0, loans: 0 };
      fresh.forEach((n) => {
        if (n.kind === 'sale') counts.sales += 1;
        else if (n.kind === 'purchase') counts.purchases += 1;
        else if (n.kind === 'expense') counts.expenses += 1;
        else if (n.kind === 'loan') counts.loans += 1;
      });
      notify(batchSyncNotification(counts));
      return;
    }

    fresh.forEach((n) => notify(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSales, allPurchases, allExpenses, allLoans]);

  /** تغيّر سعر عيار 21 — أهم إشعار */
  useEffect(() => {
    if (!hydrated.current) return;
    const current = rates.karat21 || 0;
    if (!current) return;

    const previous = lastPriceRef.current;
    lastPriceRef.current = current;
    if (!previous) return;
    if (!notificationPrefs.priceEnabled) return;

    const n = priceNotification(previous, current, notificationPrefs.priceChangePercent);
    if (n) notify(n, { system: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates.karat21]);

  /** المتأخرات والمستحقات — إشعار مرة واحدة لكل مستحق في اليوم */
  useEffect(() => {
    if (!hydrated.current) return;
    if (!notificationPrefs.duesEnabled) return;
    const list = dueNotifications(dues, new Date());
    if (list.length === 0) return;
    setNotifications((prev) => {
      let next = prev;
      list.forEach((n) => {
        next = pushNotification(next, n, notificationPrefs.keepMax, dismissedRef.current);
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dues.overdue.length, dues.dueToday.length, notificationPrefs.duesEnabled]);

  const value: GoldStoreContextType = {
    engine: engineSnapshot,
    refreshEngine,
    engineBusy,
    engineError,
    approvedPrice,
    approvePrice,
    clearApprovedPrice,
    localAdjustPercent,
    setLocalAdjust,
    approvalNeedsConfirmation,
    purchases,
    sales,
    expenses,
    allPurchases,
    allSales,
    allExpenses,
    loans,
    allLoans,
    loanSummary,
    addLoan,
    updateLoan,
    archiveLoan,
    restoreLoan,
    deleteLoan,
    addPaymentToLoan,
    partners,
    branches,
    activeBranchList,
    activeBranchId,
    activeBranch,
    activeBranchName,
    setActiveBranchId,
    addBranch,
    updateBranch,
    archiveBranch,
    restoreBranch,
    deleteBranch,
    invoiceCounters,
    numberLegacyInvoices,
    syncBranchesTable,
    unassignedOperations,
    assignUnbranchedTo,
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    deleteNotification,
    notify,
    notificationPrefs,
    setNotificationPrefs,
    rates,
    pinCode,
    isLocked,
    userEmail,
    storeName,
    themeMode,
    lastSyncTime,
    isCloudSignedIn,
    isSyncing,

    totalCapital: financials.totalCapital,
    totalSales: financials.totalSales,
    totalCost: financials.totalCost,
    grossProfit: financials.grossProfit,
    generalExpenses: financials.generalExpenses,
    privateExpenses: financials.privateExpenses,
    netProfit: financials.netProfit,
    totalProfitPercent,
    currentStockUnits: inventory.unitsK21,

    inventory,
    financials,
    partnerSharesList,
    ratesMeta,
    ratesHistory,
    dues,
    isOnline,
    pendingSync,
    syncError,
    forceSync,
    refreshFromCloud: pullFromCloud,
    inspectCloud,

    setUserEmail,
    setStoreName,
    setThemeMode,
    setLastSyncTime,

    signInCloud,
    signUpCloud,
    signOutCloud,
    lastAccountEmail,
    snapshotMeta,
    hasLocalRecords,
    restoreSnapshot,
    discardSnapshot,
    createSnapshot,
    syncWithCloud,

    addPurchase,
    updatePurchase,
    deletePurchase,
    archivePurchase,
    restorePurchase,
    addPaymentToPurchase,

    addSale,
    updateSale,
    deleteSale,
    archiveSale,
    restoreSale,
    addPaymentToSale,

    addExpense,
    updateExpense,
    deleteExpense,
    archiveExpense,
    restoreExpense,

    addPartner,
    updatePartner,
    deletePartner,
    archivePartner,
    restorePartner,

    updateRates,
    refreshRates,
    setLocalPremium,
    setManualRateOverride,

    setPinCode,
    unlockApp,
    verifyPin,
    lockApp,
    lockout,

    exportData,
    exportCsv,
    importData,
    resetAllData,
    deletedCount: Object.keys(tombstones).length,
  };

  return <GoldStoreContext.Provider value={value}>{children}</GoldStoreContext.Provider>;
};

export const useGoldStore = () => {
  const context = useContext(GoldStoreContext);
  if (!context) throw new Error('useGoldStore must be used within GoldStoreProvider');
  return context;
};

export { K21_FINENESS };
