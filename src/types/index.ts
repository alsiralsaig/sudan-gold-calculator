export interface Payment {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Purchase {
  id: string;
  date: string;
  units: number; // total units (1g = 100 sub-units = 4 habba = 40 juz)
  purity: number; // karat (18, 21, 22, 24) or fineness (e.g. 650, 875)
  amount: number; // total buy amount in SDG
  pendingAmount: number; // remaining debt to seller
  seller: string;
  /** هاتف المورد/البائع */
  sellerPhone?: string;
  bankAccount: string;
  /** تاريخ الاستحقاق المتفق عليه للسداد */
  dueDate?: string;
  notes: string;
  payments: Payment[];
  archived?: boolean;
  updatedAt?: string;
}

export interface Sale {
  id: string;
  date: string;
  units: number;
  purity: number;
  buyAmount: number; // cost
  sellAmount: number; // revenue
  buyer: string;
  /** هاتف الزبون — للإرسال على واتساب */
  buyerPhone?: string;
  notes: string;
  purchaseId?: string;
  /** المبلغ المحصّل من الزبون. غير موجود = مدفوع بالكامل (بيانات قديمة) */
  paidAmount?: number;
  /** المتبقي على الزبون */
  pendingAmount?: number;
  payments?: Payment[];
  dueDate?: string;
  archived?: boolean;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  target: string; // 'عام' or partner name
  name: string;
  notes: string;
  archived?: boolean;
  updatedAt?: string;
}

export interface Partner {
  id: string;
  name: string;
  capital: number;
  profitPercent: number;
  phone: string;
  notes: string;
  archived?: boolean;
  updatedAt?: string;
}

/**
 * أسعار السوق.
 * قاعدة العمل: العيار 21 هو العيار الرسمي للبيع والشراء، وكل التسعير
 * يُحسب من سعر جرام 21 ثم يُشتق باقي العيارات بنسبة النقاوة.
 */
export interface GoldRates {
  karat24: number;
  karat22: number;
  karat21: number;
  karat18: number;
  usdRate: number; // سعر التداول (بيع) في السوق الموازي
  usdBuyRate?: number; // سعر الشراء في السوق الموازي
  bankUsdRate?: number; // متوسط سعر البنوك
  sarRate: number;
  aedRate: number;
  egpRate: number;
  globalOunceUsd: number;
  lastUpdated: string;
  /** اسم مصدر سعر الذهب العالمي */
  goldSource?: string;
  /** اسم مصدر سعر الدولار في السودان */
  usdSource?: string;
  /** هل الأسعار من ذاكرة مؤقتة (فشل التحديث) */
  isStale?: boolean;
  /** وقت جلبه من المصدر */
  fetchedAt?: string;
  /** تعديل السوق المحلي بالنسبة المئوية، يُطبّق على سعر جرام 21 */
  localPremiumPercent?: number;
  /** عندما يقوم المستخدم بتثبيت السعر يدوياً */
  manualOverride?: boolean;
  /** سعر جرام 21 الأساسي قبل تعديل السوق المحلي */
  karat21Base?: number;
}

export interface RatesMeta {
  ok: boolean;
  stale: boolean;
  warnings: string[];
  fetchedAt: string;
  goldSource?: string;
  usdSource?: string;
  crossSource?: string;
  bankRate?: number | null;
  usdBuy?: number | null;
}

export interface AppTombstones {
  [id: string]: string; // id -> ISO date of deletion
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  storeName: string;
  userEmail: string;
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  partners: Partner[];
  rates: GoldRates;
  tombstones?: AppTombstones;
}
