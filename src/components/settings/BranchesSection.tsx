'use client';
import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  Check,
  Hash,
  Cloud,
  Phone,
  MapPin,
  X,
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { ALL_BRANCHES, branchStats, suggestBranchCode } from '../../core/branches';
import { fmtNum } from '../../core/format';
import { Branch } from '../../types';
import { useBackClose } from '../../lib/backStack';

/**
 * قسم الفروع في الإعدادات.
 * الفروع تُخزَّن داخل بيانات الحساب وتُزامَن مع Supabase عبر /api/sync
 * (نفس حِمل المزامنة)، فيظهر فرع أُنشئ على جهاز على بقية الأجهزة.
 */
export const BranchesSection: React.FC = () => {
  const {
    branches,
    allPurchases,
    allSales,
    allExpenses,
    activeBranchId,
    setActiveBranchId,
    addBranch,
    updateBranch,
    archiveBranch,
    restoreBranch,
    deleteBranch,
    numberLegacyInvoices,
    invoiceCounters,
    unassignedOperations,
    assignUnbranchedTo,
  } = useGoldStore();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState('');
  const [assignTarget, setAssignTarget] = useState('');

  // زر الرجوع في التلفون يقفل النوافذ بدل الخروج من التطبيق
  useBackClose(showForm, () => setShowForm(false));

  const stats = useMemo(
    () => branchStats(branches.filter((b) => !b.archived), allPurchases, allSales, allExpenses),
    [branches, allPurchases, allSales, allExpenses]
  );

  const opsFor = (id: string) => stats.find((s) => s.branchId === id)?.operations ?? 0;
  const salesFor = (id: string) => stats.find((s) => s.branchId === id)?.salesAmount ?? 0;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const openAdd = () => {
    setEditing(null);
    setName('');
    setCode('');
    setPhone('');
    setAddress('');
    setReceiptName('');
    setNotes('');
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setName(b.name);
    setCode(b.code || '');
    setPhone(b.phone || '');
    setAddress(b.address || '');
    setReceiptName(b.receiptName || '');
    setNotes(b.notes || '');
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      code: (code.trim() || suggestBranchCode(trimmed, branches)).toUpperCase(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      receiptName: receiptName.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (editing) {
      updateBranch({ ...editing, ...payload });
      flash('تم تحديث بيانات الفرع');
    } else {
      addBranch(payload);
      flash('تمت إضافة الفرع — سيُزامَن مع Supabase');
    }
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-amber-400 font-black text-sm border-r-4 border-amber-500 pr-2">
          <Building2 className="w-4 h-4" />
          <span>الفروع (تعدد الفروع)</span>
        </div>
        <button
          onClick={openAdd}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-xl flex items-center gap-1.5 shadow-md"
        >
          <Plus className="w-3.5 h-3.5" />
          فرع جديد
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            الفروع تُحفظ مع بيانات حسابك وتُزامَن مع Supabase، وكل عملية (شراء/بيع/مصروف) تُسجَّل باسم
            الفرع النشط مع رقم فاتورة خاص بالفرع مثل{' '}
            <span className="font-mono text-amber-300">SAL-KH1-0007</span>.
          </p>
        </div>

        {branches.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-700 rounded-2xl">
            لا توجد فروع بعد — أضف فرعاً ليصبح كل شيء مرتبطاً به
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map((b) => {
              const isActive = activeBranchId === b.id;
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-3 space-y-2 ${
                    b.archived
                      ? 'bg-slate-950/60 border-slate-800 opacity-70'
                      : isActive
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white truncate">{b.name}</span>
                        {b.code ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {b.code}
                          </span>
                        ) : null}
                        {b.archived ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400">
                            مؤرشف
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" /> النشط
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        {b.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {b.phone}
                          </span>
                        ) : null}
                        {b.address ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {b.address}
                          </span>
                        ) : null}
                        <span className="font-mono text-slate-500">
                          {opsFor(b.id)} عملية • مبيعات {fmtNum(salesFor(b.id))}
                        </span>
                      </div>
                      {b.receiptName ? (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          الاسم على الفاتورة: {b.receiptName}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!b.archived && !isActive ? (
                        <button
                          onClick={() => {
                            setActiveBranchId(b.id);
                            flash(`الفرع النشط: ${b.name}`);
                          }}
                          className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          title="تعيين كفرع نشط"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => openEdit(b)}
                        className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                        title="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {b.archived ? (
                        <button
                          onClick={() => restoreBranch(b.id)}
                          className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400"
                          title="استعادة الفرع"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`أرشفة الفرع «${b.name}»؟ لن تظهر عملياته في العرض المجمّع.`)) {
                              archiveBranch(b.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-amber-500/15 text-amber-400"
                          title="أرشفة"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              'حذف الفرع نهائياً؟ العمليات المسجّلة باسمه تبقى محفوظة لكن بدون فرع.'
                            )
                          ) {
                            deleteBranch(b.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-rose-500/15 text-rose-400"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {unassignedOperations > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-2">
            <p className="text-[11px] text-amber-200 leading-relaxed">
              يوجد <span className="font-black">{unassignedOperations}</span> عملية قديمة بدون فرع
              (مسجّلة قبل إنشاء الفروع). اسندها إلى فرع لتظهر داخل تقاريره.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={assignTarget}
                onChange={(e) => setAssignTarget(e.target.value)}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 text-slate-200 text-[11px] rounded-xl px-2 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="">اختر الفرع…</option>
                {branches
                  .filter((b) => !b.archived)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => {
                  const n = assignUnbranchedTo(assignTarget);
                  flash(n > 0 ? `تم إسناد ${n} عملية` : 'اختر فرعاً أولاً');
                }}
                disabled={!assignTarget}
                className="px-3 py-2 rounded-xl bg-amber-500 disabled:opacity-50 text-slate-950 text-[11px] font-black shrink-0"
              >
                إسناد
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={() => setActiveBranchId(ALL_BRANCHES)}
            disabled={activeBranchId === ALL_BRANCHES}
            className="px-3 py-2 rounded-xl bg-slate-800 disabled:opacity-50 text-slate-300 text-[11px] font-bold"
          >
            عرض كل الفروع
          </button>
          <button
            onClick={() => {
              const n = numberLegacyInvoices();
              flash(n > 0 ? `تم ترقيم ${n} فاتورة قديمة` : 'كل الفواتير مرقّمة بالفعل');
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1.5"
          >
            <Hash className="w-3.5 h-3.5" />
            ترقيم الفواتير القديمة
          </button>
          <span className="text-[10px] text-slate-500 font-mono">
            عدّاد الفواتير: بيع {invoiceCounters.sale} • شراء {invoiceCounters.purchase}
          </span>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <form
            onSubmit={submit}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-amber-400">
                {editing ? 'تعديل الفرع' : 'إضافة فرع جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">اسم الفرع *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: فرع الخرطوم الرئيسي"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">
                  رمز الفواتير
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="KH1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">هاتف الفرع</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">العنوان</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="السوق العربي — الخرطوم"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">
                الاسم على الفاتورة (اختياري)
              </label>
              <input
                value={receiptName}
                onChange={(e) => setReceiptName(e.target.value)}
                placeholder="محلات أبو أحمد — فرع الخرطوم"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">ملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                {editing ? 'حفظ التعديلات' : 'إضافة الفرع'}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 border border-amber-500/50 text-amber-200 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
};
