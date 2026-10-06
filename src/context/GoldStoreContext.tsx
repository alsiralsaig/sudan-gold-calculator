'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppTombstones, Branch, Expense, GoldRates, Partner, Payment, Purchase, RatesMeta, Sale } from '../types';
import { mergeRecordsWithTombstones } from '../core/merge';
import {
  Financials,
  Inventory,
  PartnerShare,
  computeFinancials,
  computeInventory,
  partnerShares,
  salePending,
} from '../core/accounting';
import { K21_FINENESS } from '../core/purity';
import { DueSummary, computeDues } from '../core/reminders';
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
  /** عدد العمليات غير المسندة لأي فرع */
  unassignedOperations: number;
  /** إسناد العمليات القديمة إلى فرع محدد (يعيد العدد) */
  assignUnbranchedTo: (branchId: string) => number;
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
  /** محاولة مزامنة فورية */
  forceSync: () => Promise<boolean>;

  // Actions
  setUserEmail: (email: string) => void;
  setStoreName: (name: string) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setLastSyncTime: (timeStr: string) => void;

  // Cloud Auth & Sync
  signInCloud: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signUpCloud: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signOutCloud: () => void;
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
const LOCKOUT_KEY = 'gold_pin_lockout';
const PENDING_SYNC_KEY = 'gold_pending_sync';

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
  const [storeName, setStoreNameState] = useState<string>('مجوهرات الذهب');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isCloudSignedIn, setIsCloudSignedIn] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [ratesMeta, setRatesMeta] = useState<RatesMeta>({
    ok: false,
    stale: true,
    warnings: [],
    fetchedAt: '',
  });
  const [lockout, setLockout] = useState<{ attempts: number; until: number }>({ attempts: 0, until: 0 });
  const [ratesHistory, setRatesHistory] = useState<{ t: string; v: number }[]>([]);
  const [pendingSync, setPendingSync] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(ALL_BRANCHES);
  const [invoiceCounters, setInvoiceCounters] = useState<InvoiceCounters>({ sale: 0, purchase: 0 });
  const [syncError, setSyncError] = useState('');
  const { isOnline } = useOnlineStatus();

  /* ------------------------- تقييد البيانات بالفرع النشط ------------------------- */
  const purchases = useMemo(() => scopeToBranch(allPurchases, activeBranchId), [allPurchases, activeBranchId]);
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
        if (data.storeName && !hadSampleAccount) setStoreNameState(data.storeName);
        if (hadSampleAccount) {
          setUserEmailState('');
          setStoreNameState('مجوهرات الذهب');
          setIsCloudSignedIn(false);
        }
        if (Array.isArray(data.ratesHistory)) setRatesHistory(data.ratesHistory.slice(-200));
        if (Array.isArray(data.branches)) setBranches(data.branches.filter((b: Branch) => b && b.id && b.name));
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
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Failed to save storage:', e);
    }
  }, [
    allPurchases,
    allSales,
    allExpenses,
    branches,
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

  const dues = useMemo(() => computeDues(sales, purchases), [sales, purchases]);

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

  const setLocalPremium = (percent: number) => {
    setRates((prev) => {
      const base = prev.karat21Base || prev.karat21;
      return {
        ...prev,
        localPremiumPercent: percent,
        karat21: Math.round(base * (1 + percent / 100)),
        karat24: Math.round(base * (24 / 21) * (1 + percent / 100)),
        karat22: Math.round(base * (22 / 21) * (1 + percent / 100)),
        karat18: Math.round(base * (18 / 21) * (1 + percent / 100)),
      };
    });
  };

  const setManualRateOverride = (enabled: boolean) => {
    setRates((prev) => ({ ...prev, manualOverride: enabled }));
  };

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
      invoiceCounters,
      rates,
      tombstones,
    }),
    [storeName, userEmail, allPurchases, allSales, allExpenses, partners, branches, invoiceCounters, rates, tombstones]
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
      };

      return {
        version: 6,
        storeName: local?.storeName || cloud?.storeName || 'مجوهرات الذهب',
        userEmail: local?.userEmail || cloud?.userEmail || '',
        purchases: purchasesMerge.items,
        sales: salesMerge.items,
        expenses: expensesMerge.items,
        partners: partnersMerge.items,
        branches: branchesMerge.items,
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

  const applyCloudPayload = (payload: any) => {
    if (!payload) return;
    const nextPurchases = safeArray<Purchase>(payload.purchases);
    const nextSales = safeArray<Sale>(payload.sales);
    const nextExpenses = safeArray<Expense>(payload.expenses);
    const nextPartners = safeArray<Partner>(payload.partners);
    const nextBranches = safeArray<Branch>(payload.branches);

    setAllPurchases((prev) => (sameRecords(prev, nextPurchases) ? prev : nextPurchases));
    setAllSales((prev) => (sameRecords(prev, nextSales) ? prev : nextSales));
    setAllExpenses((prev) => (sameRecords(prev, nextExpenses) ? prev : nextExpenses));
    setPartners((prev) => (sameRecords(prev, nextPartners) ? prev : nextPartners));
    setBranches((prev) => (sameRecords(prev, nextBranches) ? prev : nextBranches));
    if (payload.invoiceCounters && typeof payload.invoiceCounters === 'object') {
      setInvoiceCounters((prev) => ({
        sale: Math.max(prev.sale, Number(payload.invoiceCounters.sale) || 0),
        purchase: Math.max(prev.purchase, Number(payload.invoiceCounters.purchase) || 0),
      }));
    }
    if (payload.tombstones && typeof payload.tombstones === 'object') {
      setTombstones((prev) => ({ ...prev, ...payload.tombstones }));
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

  const syncWithCloud = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!isCloudSignedIn) return false;
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync', { cache: 'no-store' });
        if (!response.ok) return false;
        const result = await response.json();
        const merged = mergePayloads(syncPayload(), result.payload || {});
        applyCloudPayload(merged);
        const put = await fetch('/api/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
        if (!put.ok) return false;
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
    [isCloudSignedIn, mergePayloads, syncPayload, syncBranchesTable]
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
        partners.map((p) => `${p.id}:${p.updatedAt || ''}:${p.archived ? 1 : 0}`),
        Object.keys(tombstones).length,
      ]),
    [allPurchases, allSales, allExpenses, partners, branches, tombstones]
  );

  useEffect(() => {
    dataSignatureRef.current = dataSignature;
  }, [dataSignature]);

  useEffect(() => {
    if (!isCloudSignedIn || !hydrated.current) return;

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

  const signInCloud = async (email: string, pass: string) => {
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

      const cloud = await fetch('/api/sync', { cache: 'no-store' });
      const cloudResult = await cloud.json();
      const merged = mergePayloads({ ...syncPayload(), userEmail: trimmedEmail }, cloudResult.payload || {});
      applyCloudPayload(merged);
      const put = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!put.ok) return { success: false, message: 'تم الدخول لكن فشل رفع البيانات' };
      setLastSyncTime(syncTimeLabel());
      return { success: true, message: 'تم تسجيل الدخول ومزامنة بيانات السحابة 🔒' };
    } catch {
      return { success: false, message: 'تعذر الاتصال بقاعدة البيانات' };
    }
  };

  const signUpCloud = async (email: string, pass: string) => {
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
      setUserEmailState(email.trim().toLowerCase());
      setIsCloudSignedIn(true);
      const put = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncPayload()),
      });
      if (!put.ok) return { success: false, message: 'تم إنشاء الحساب لكن فشل رفع البيانات' };
      setLastSyncTime(syncTimeLabel());
      return { success: true, message: 'تم إنشاء الحساب ورفع بيانات جهازك ☁️' };
    } catch {
      return { success: false, message: 'تعذر الاتصال بقاعدة البيانات' };
    }
  };

  const signOutCloud = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setIsCloudSignedIn(false);
    setLastSyncTime('');
  };

  /* ------------------------- النسخ الاحتياطي ------------------------- */

  const exportData = () => {
    const db = {
      version: 6,
      storeName,
      userEmail,
      purchases: allPurchases,
      sales: allSales,
      expenses: allExpenses,
      partners,
      branches,
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
    const rows: string[][] = [
      ['النوع', 'التاريخ', 'الفرع', 'رقم الفاتورة', 'الوزن (جرام.حبة.جزء)', 'النقاوة', 'المبلغ', 'المتبقي', 'الطرف', 'ملاحظات'],
    ];
    const fmtUnits = (units: number) => {
      const g = Math.floor(units / 100);
      const rest = units % 100;
      return `${g}.${Math.floor(rest / 10)}.${Math.round(rest % 10)}`;
    };
    allPurchases.forEach((p) =>
      rows.push([
        'شراء',
        new Date(p.date).toLocaleDateString('en-GB'),
        branchName(branches, p.branchId),
        p.invoiceNo || '',
        fmtUnits(p.units || 0),
        String(p.purity ?? ''),
        String(p.amount || 0),
        String(p.pendingAmount || 0),
        p.seller || '',
        (p.notes || '').replace(/[\n,]/g, ' '),
      ])
    );
    allSales.forEach((s) =>
      rows.push([
        'بيع',
        new Date(s.date).toLocaleDateString('en-GB'),
        branchName(branches, s.branchId),
        s.invoiceNo || '',
        fmtUnits(s.units || 0),
        String(s.purity ?? ''),
        String(s.sellAmount || 0),
        String(salePending(s)),
        s.buyer || '',
        (s.notes || '').replace(/[\n,]/g, ' '),
      ])
    );
    allExpenses.forEach((e) =>
      rows.push([
        'مصروف',
        new Date(e.date).toLocaleDateString('en-GB'),
        branchName(branches, e.branchId),
        '',
        '',
        String(e.amount || 0),
        '',
        e.target || '',
        (e.name || '').replace(/[\n,]/g, ' '),
      ])
    );
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gold_Calculator_Export_${new Date().toISOString().split('T')[0]}.csv`;
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
      if (data.invoiceCounters && typeof data.invoiceCounters === 'object') {
        setInvoiceCounters({
          sale: Math.max(0, Number(data.invoiceCounters.sale) || 0),
          purchase: Math.max(0, Number(data.invoiceCounters.purchase) || 0),
        });
      }
      if (data.tombstones && typeof data.tombstones === 'object') setTombstones(data.tombstones);
      if (data.rates && typeof data.rates === 'object') setRates((prev) => ({ ...prev, ...data.rates }));
      if (data.userEmail) setUserEmailState(String(data.userEmail));
      if (data.storeName) setStoreNameState(String(data.storeName));
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

  /** ترقيم الفواتير القديمة (التي أُنشئت قبل إضافة نظام الأرقام) */
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

  const value: GoldStoreContextType = {
    purchases,
    sales,
    expenses,
    allPurchases,
    allSales,
    allExpenses,
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

    setUserEmail,
    setStoreName,
    setThemeMode,
    setLastSyncTime,

    signInCloud,
    signUpCloud,
    signOutCloud,
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
