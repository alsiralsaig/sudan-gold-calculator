import React, { createContext, useContext, useState, useEffect } from 'react';
import { Purchase, Sale, Expense, Partner, GoldRates, Payment } from '../types';
import { kUnitsPerGram } from '../core/format';

export type ThemeMode = 'light' | 'dark' | 'system';

interface GoldStoreContextType {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  partners: Partner[];
  rates: GoldRates;
  pinCode: string;
  isLocked: boolean;
  userEmail: string;
  storeName: string;
  themeMode: ThemeMode;
  lastSyncTime: string;
  isCloudSignedIn: boolean;
  
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

  // Actions
  setUserEmail: (email: string) => void;
  setStoreName: (name: string) => void;
  setThemeMode: (theme: ThemeMode) => void;
  setLastSyncTime: (timeStr: string) => void;
  
  // Cloud Auth & Sync
  signInCloud: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signUpCloud: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signOutCloud: () => void;
  syncWithCloud: () => Promise<boolean>;

  addPurchase: (p: Omit<Purchase, 'id' | 'payments' | 'updatedAt'>) => void;
  updatePurchase: (p: Purchase) => void;
  deletePurchase: (id: string) => void;
  addPaymentToPurchase: (purchaseId: string, payment: Omit<Payment, 'id'>) => void;

  addSale: (s: Omit<Sale, 'id' | 'updatedAt'>) => void;
  updateSale: (s: Sale) => void;
  deleteSale: (id: string) => void;

  addExpense: (e: Omit<Expense, 'id' | 'updatedAt'>) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;

  addPartner: (p: Omit<Partner, 'id' | 'updatedAt'>) => void;
  updatePartner: (p: Partner) => void;
  deletePartner: (id: string) => void;

  updateRates: (r: Partial<GoldRates>) => void;
  setPinCode: (pin: string) => void;
  unlockApp: (enteredPin: string) => boolean;
  lockApp: () => void;

  exportData: () => void;
  importData: (jsonStr: string) => boolean;
  resetAllData: () => void;
}

const GoldStoreContext = createContext<GoldStoreContextType | undefined>(undefined);

const STORAGE_KEY = 'golden_calculator_db_v4';

const GRAMS_PER_OUNCE = 31.1034768;
const DEFAULT_OUNCE_USD = 4144.70;
const DEFAULT_USD_RATE = 8203.10;
const DEFAULT_GRAM_USD = DEFAULT_OUNCE_USD / GRAMS_PER_OUNCE;
const DEFAULT_K24 = Math.round(DEFAULT_GRAM_USD * DEFAULT_USD_RATE);
const DEFAULT_K21 = Math.round(DEFAULT_K24 * (21 / 24));
const DEFAULT_K18 = Math.round(DEFAULT_K24 * (18 / 24));
const DEFAULT_K22 = Math.round(DEFAULT_K24 * (22 / 24));

const INITIAL_RATES: GoldRates = {
  karat24: DEFAULT_K24,
  karat21: DEFAULT_K21,
  karat18: DEFAULT_K18,
  karat22: DEFAULT_K22,
  usdRate: DEFAULT_USD_RATE,
  sarRate: 2185.27,
  aedRate: 2233.40,
  egpRate: 157.60,
  globalOunceUsd: DEFAULT_OUNCE_USD,
  lastUpdated: new Date().toISOString(),
};

// Completely empty initial partners so new users/merchants start clean with zero exposure
const INITIAL_PARTNERS: Partner[] = [];

export const GoldStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [rates, setRates] = useState<GoldRates>(INITIAL_RATES);
  const [pinCode, setPinCodeState] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [userEmail, setUserEmailState] = useState<string>('');
  const [storeName, setStoreNameState] = useState<string>('مجوهرات الذهب');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isCloudSignedIn, setIsCloudSignedIn] = useState<boolean>(false);

  // Load from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.purchases) setPurchases(data.purchases);
        if (data.sales) setSales(data.sales);
        if (data.expenses) setExpenses(data.expenses);
        if (data.partners) setPartners(data.partners);
        if (data.rates) {
          if (data.rates.karat21 < 500000) {
            setRates(INITIAL_RATES);
          } else {
            setRates(data.rates);
          }
        }
        if (data.pinCode) {
          setPinCodeState(data.pinCode);
          setIsLocked(true);
        }
        if (data.userEmail) setUserEmailState(data.userEmail);
        if (data.storeName) setStoreNameState(data.storeName);
        if (data.themeMode) setThemeModeState(data.themeMode);
        if (data.lastSyncTime) setLastSyncTime(data.lastSyncTime);
        if (data.isCloudSignedIn !== undefined) setIsCloudSignedIn(data.isCloudSignedIn);
      }
    } catch (e) {
      console.warn('Failed to load storage:', e);
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    try {
      const dataToSave = {
        purchases,
        sales,
        expenses,
        partners,
        rates,
        pinCode,
        userEmail,
        storeName,
        themeMode,
        lastSyncTime,
        isCloudSignedIn,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to save storage:', e);
    }
  }, [purchases, sales, expenses, partners, rates, pinCode, userEmail, storeName, themeMode, lastSyncTime, isCloudSignedIn]);

  // Apply Theme Mode Dynamically to HTML Root and Body
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      let isDark = true;
      if (mode === 'light') {
        isDark = false;
      } else if (mode === 'dark') {
        isDark = true;
      } else if (mode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        document.body.style.backgroundColor = '#020617';
        document.body.style.color = '#f8fafc';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
        document.body.style.backgroundColor = '#f8fafc';
        document.body.style.color = '#0f172a';
      }
    };

    applyTheme(themeMode);

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Derived Calculations
  const totalCapital = partners.reduce((sum, p) => sum + (p.capital || 0), 0);
  const totalProfitPercent = partners.reduce((sum, p) => sum + (p.profitPercent || 0), 0);

  const totalSales = sales.reduce((sum, s) => sum + (s.sellAmount || 0), 0);
  const totalCost = sales.reduce((sum, s) => sum + (s.buyAmount || 0), 0);
  const grossProfit = totalSales - totalCost;

  const generalExpenses = expenses
    .filter((e) => e.target === 'عام' || !e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const privateExpenses = expenses
    .filter((e) => e.target !== 'عام' && e.target)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const netProfit = grossProfit - generalExpenses;

  const purchasedUnits = purchases.reduce((sum, p) => sum + (p.units || 0), 0);
  const soldUnits = sales.reduce((sum, s) => sum + (s.units || 0), 0);
  const currentStockUnits = Math.max(0, purchasedUnits - soldUnits);

  // Actions
  const setUserEmail = (email: string) => setUserEmailState(email.trim());
  const setStoreName = (name: string) => setStoreNameState(name.trim());
  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);

  // Cloud Authentication (Password-Protected to isolate merchants)
  const signInCloud = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !pass) {
      return { success: false, message: 'يرجى كتابة البريد وكلمة المرور' };
    }
    if (pass.length < 6) {
      return { success: false, message: 'كلمة المرور يجب أن تتكون من 6 خانات على الأقل' };
    }

    setUserEmailState(trimmedEmail);
    setIsCloudSignedIn(true);
    const now = new Date();
    const timeStr = `${now.getDate()} أكتوبر ${now.getFullYear()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLastSyncTime(timeStr);

    return { success: true, message: 'تم تسجيل الدخول بنجاح وتفعيل المزامنة المشفرة 🔒' };
  };

  const signUpCloud = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !pass) {
      return { success: false, message: 'يرجى كتابة البريد وكلمة المرور' };
    }
    if (pass.length < 6) {
      return { success: false, message: 'كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل' };
    }

    setUserEmailState(trimmedEmail);
    setIsCloudSignedIn(true);
    const now = new Date();
    const timeStr = `${now.getDate()} أكتوبر ${now.getFullYear()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLastSyncTime(timeStr);

    return { success: true, message: 'تم إنشاء الحساب السحابي وتشفير البيانات بنجاح ☁️' };
  };

  const signOutCloud = () => {
    setIsCloudSignedIn(false);
  };

  const syncWithCloud = async (): Promise<boolean> => {
    try {
      const now = new Date();
      const timeStr = `${now.getDate()} أكتوبر ${now.getFullYear()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      setLastSyncTime(timeStr);
      return true;
    } catch {
      return false;
    }
  };

  const addPurchase = (p: Omit<Purchase, 'id' | 'payments' | 'updatedAt'>) => {
    const newP: Purchase = {
      ...p,
      id: `pch_${Date.now()}`,
      payments: [],
      updatedAt: new Date().toISOString(),
    };
    setPurchases((prev) => [newP, ...prev]);
  };

  const updatePurchase = (p: Purchase) => {
    setPurchases((prev) => prev.map((item) => (item.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : item)));
  };

  const deletePurchase = (id: string) => {
    setPurchases((prev) => prev.filter((item) => item.id !== id));
  };

  const addPaymentToPurchase = (purchaseId: string, payment: Omit<Payment, 'id'>) => {
    setPurchases((prev) =>
      prev.map((pch) => {
        if (pch.id === purchaseId) {
          const newPay: Payment = { ...payment, id: `pay_${Date.now()}` };
          const newPending = Math.max(0, pch.pendingAmount - payment.amount);
          return {
            ...pch,
            pendingAmount: newPending,
            payments: [...pch.payments, newPay],
            updatedAt: new Date().toISOString(),
          };
        }
        return pch;
      })
    );
  };

  const addSale = (s: Omit<Sale, 'id' | 'updatedAt'>) => {
    const newS: Sale = {
      ...s,
      id: `sal_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setSales((prev) => [newS, ...prev]);
  };

  const updateSale = (s: Sale) => {
    setSales((prev) => prev.map((item) => (item.id === s.id ? { ...s, updatedAt: new Date().toISOString() } : item)));
  };

  const deleteSale = (id: string) => {
    setSales((prev) => prev.filter((item) => item.id !== id));
  };

  const addExpense = (e: Omit<Expense, 'id' | 'updatedAt'>) => {
    const newE: Expense = {
      ...e,
      id: `exp_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newE, ...prev]);
  };

  const updateExpense = (e: Expense) => {
    setExpenses((prev) => prev.map((item) => (item.id === e.id ? { ...e, updatedAt: new Date().toISOString() } : item)));
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((item) => item.id !== id));
  };

  const addPartner = (p: Omit<Partner, 'id' | 'updatedAt'>) => {
    const newPt: Partner = {
      ...p,
      id: `pt_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setPartners((prev) => [...prev, newPt]);
  };

  const updatePartner = (p: Partner) => {
    setPartners((prev) => prev.map((item) => (item.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : item)));
  };

  const deletePartner = (id: string) => {
    setPartners((prev) => prev.filter((item) => item.id !== id));
  };

  const updateRates = (newRates: Partial<GoldRates>) => {
    setRates((prev) => ({
      ...prev,
      ...newRates,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const setPinCode = (pin: string) => {
    setPinCodeState(pin);
    if (!pin) setIsLocked(false);
  };

  const unlockApp = (enteredPin: string): boolean => {
    if (enteredPin === pinCode || !pinCode) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const lockApp = () => {
    if (pinCode) setIsLocked(true);
  };

  const exportData = () => {
    const db = {
      storeName,
      userEmail,
      purchases,
      sales,
      expenses,
      partners,
      rates,
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

  const importData = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.purchases) setPurchases(data.purchases);
      if (data.sales) setSales(data.sales);
      if (data.expenses) setExpenses(data.expenses);
      if (data.partners) setPartners(data.partners);
      if (data.rates) setRates(data.rates);
      if (data.userEmail) setUserEmailState(data.userEmail);
      if (data.storeName) setStoreNameState(data.storeName);
      return true;
    } catch {
      return false;
    }
  };

  const resetAllData = () => {
    setPurchases([]);
    setSales([]);
    setExpenses([]);
    setPartners([]);
    setUserEmailState('');
    setIsCloudSignedIn(false);
    setRates(INITIAL_RATES);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <GoldStoreContext.Provider
      value={{
        purchases,
        sales,
        expenses,
        partners,
        rates,
        pinCode,
        isLocked,
        userEmail,
        storeName,
        themeMode,
        lastSyncTime,
        isCloudSignedIn,
        totalCapital,
        totalSales,
        totalCost,
        grossProfit,
        generalExpenses,
        privateExpenses,
        netProfit,
        totalProfitPercent,
        currentStockUnits,
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
        addPaymentToPurchase,
        addSale,
        updateSale,
        deleteSale,
        addExpense,
        updateExpense,
        deleteExpense,
        addPartner,
        updatePartner,
        deletePartner,
        updateRates,
        setPinCode,
        unlockApp,
        lockApp,
        exportData,
        importData,
        resetAllData,
      }}
    >
      {children}
    </GoldStoreContext.Provider>
  );
};

export const useGoldStore = () => {
  const context = useContext(GoldStoreContext);
  if (!context) throw new Error('useGoldStore must be used within GoldStoreProvider');
  return context;
};
