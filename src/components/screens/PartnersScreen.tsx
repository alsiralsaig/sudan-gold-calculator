import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';
import { useGoldStore } from '../../context/GoldStoreContext';
import { SmartSearchBar } from '../common/SmartSearchBar';
import { smartMatch } from '../../core/globalSearch';
import { StickyActionBar } from '../layout/StickyActionBar';
import { fmtMoney, fmtNum, kCurrency } from '../../core/format';
import { Partner } from '../../types';
import { useBackClose } from '../../lib/backStack';

export const PartnersScreen: React.FC = () => {
  const {
    partners,
    totalCapital,
    netProfit,
    generalExpenses,
    privateExpenses,
    totalProfitPercent,
    addPartner,
    updatePartner,
    archivePartner,
    deletePartner,
    expenses,
  } = useGoldStore();

  const [partnerQuery, setPartnerQuery] = useState('');
  const visiblePartners = partners
    .filter((p) => !p.archived)
    .filter((p) =>
      smartMatch(partnerQuery, {
        texts: [p.name, p.notes],
        phones: [p.phone],
        amounts: [p.capital, p.profitPercent],
      })
    );

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const [name, setName] = useState('');
  const [capital, setCapital] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // زر الرجوع في التلفون يقفل النوافذ بدل الخروج من التطبيق
  useBackClose(showAddModal, () => setShowAddModal(false));

  const handleOpenAdd = () => {
    setName('');
    setCapital('');
    setProfitPercent('0');
    setPhone('');
    setNotes('');
    setEditingPartner(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Partner) => {
    setName(p.name);
    setCapital(p.capital.toString());
    setProfitPercent(p.profitPercent.toString());
    setPhone(p.phone);
    setNotes(p.notes);
    setEditingPartner(p);
    setShowAddModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingPartner) {
      updatePartner({
        ...editingPartner,
        name: name.trim(),
        capital: parseFloat(capital) || 0,
        profitPercent: parseFloat(profitPercent) || 0,
        phone: phone.trim(),
        notes: notes.trim(),
      });
    } else {
      addPartner({
        name: name.trim(),
        capital: parseFloat(capital) || 0,
        profitPercent: parseFloat(profitPercent) || 0,
        phone: phone.trim(),
        notes: notes.trim(),
      });
    }
    setShowAddModal(false);
  };

  const handleBulkPartnerEdit = () => {
    const value = prompt('نسبة الربح الجديدة للشركاء الظاهرين');
    if (value !== null) visiblePartners.forEach(p => updatePartner({ ...p, profitPercent: parseFloat(value) || p.profitPercent }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
          <div className="mb-4 bg-slate-900 border border-amber-500/20 rounded-2xl p-3 space-y-2">
            <div className="text-[11px] text-slate-400">إجراءات الصفحة على الشركاء الظاهرين فقط</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => { if (confirm('أرشفة كل الشركاء الظاهرين؟')) visiblePartners.forEach(p => archivePartner(p.id)); }} className="py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black">أرشفة الكل</button>
              <button onClick={handleBulkPartnerEdit} className="py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-black">تعديل الكل</button>
              <button onClick={() => { if (confirm('حذف نهائي لكل الشركاء الظاهرين؟')) visiblePartners.forEach(p => deletePartner(p.id)); }} className="py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black">حذف الكل</button>
            </div>
          </div>


      {/* TOP SUMMARY CARD WITH STACKED TITLES AND NUMBER UNDERNEATH */}
      <div className="bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 p-5 sm:p-6 rounded-3xl border-2 border-amber-500/50 shadow-2xl space-y-5">

        {/* Header Total Capital */}
        <div className="text-center space-y-1">
          <span className="text-xs text-slate-400 font-bold block">إجمالي رأس المال للشركاء</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
            {fmtMoney(totalCapital)}
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* 4 COLUMNS ROW: STACKED TITLES ("صافي\nالربح", "منصرفات\nعامة", "منصرفات\nخاصة", "نسب\nالربح") */}
        <div className="grid grid-cols-4 items-center justify-between text-center divide-x divide-x-reverse divide-slate-800">

          {/* Col 1: صافي الربح */}
          <div className="px-1 sm:px-2 space-y-1">
            <div className="text-[11px] sm:text-xs font-black text-slate-300 leading-tight">
              <div>صافي</div>
              <div>الربح</div>
            </div>
            <div className={`text-xs sm:text-sm font-black font-mono truncate ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtNum(netProfit)}
            </div>
          </div>

          {/* Col 2: منصرفات عامة */}
          <div className="px-1 sm:px-2 space-y-1">
            <div className="text-[11px] sm:text-xs font-black text-slate-300 leading-tight">
              <div>منصرفات</div>
              <div>عامة</div>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-amber-400 truncate">
              {fmtNum(generalExpenses)}
            </div>
          </div>

          {/* Col 3: منصرفات خاصة */}
          <div className="px-1 sm:px-2 space-y-1">
            <div className="text-[11px] sm:text-xs font-black text-slate-300 leading-tight">
              <div>منصرفات</div>
              <div>خاصة</div>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-cyan-400 truncate">
              {fmtNum(privateExpenses)}
            </div>
          </div>

          {/* Col 4: نسب الربح */}
          <div className="px-1 sm:px-2 space-y-1">
            <div className="text-[11px] sm:text-xs font-black text-slate-300 leading-tight">
              <div>نسب</div>
              <div>الربح</div>
            </div>
            <div className={`text-xs sm:text-sm font-black font-mono truncate ${totalProfitPercent === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalProfitPercent.toFixed(1)}%
            </div>
          </div>

        </div>

      </div>

      {/* عدسة البحث بين الشركاء */}
      <SmartSearchBar
        value={partnerQuery}
        onChange={setPartnerQuery}
        placeholder="ابحث بين الشركاء: اسم، هاتف، رأس المال، نسبة الربح..."
      />

      {/* Header and Add Partner Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">قائمة الشركاء والمستحقات</h3>
            <p className="text-[11px] text-slate-400">حساب نصيب كل شريك من الأرباح والمنصرفات الخاصة</p>
          </div>
        </div>

      </div>

      {/* Partners Cards List */}
      <div className="space-y-4">
        {visiblePartners.length === 0 && (
          <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl py-12 text-center text-slate-500 text-sm">
            لا يوجد شريك مطابق للبحث
          </div>
        )}
        {visiblePartners.map((p) => {
          // Partner share of profit
          const profitShare = (netProfit * p.profitPercent) / 100;
          // Partner private expenses
          const partnerExpenses = expenses
            .filter((e) => e.target === p.name || e.name === p.name)
            .reduce((sum, e) => sum + e.amount, 0);
          // Net entitlement
          const netEntitlement = p.capital + profitShare - partnerExpenses;

          return (
            <div
              key={p.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 shadow-lg space-y-4 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-white">{p.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded-lg border border-amber-500/30">
                      رأس المال: {fmtNum(p.capital)} {kCurrency}
                    </span>
                    <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 font-bold rounded-lg border border-slate-700">
                      نسبة الربح: {p.profitPercent}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من أرشفة الشريك (${p.name})؟`)) {
                        archivePartner(p.id);
                      }
                    }}
                    className="p-2 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm('حذف نهائي لهذا الشريك؟')) deletePartner(p.id); }} className="p-2 bg-slate-800 text-slate-300 rounded-xl"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Financial Breakdown Table for Partner */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">نصيب الأرباح</span>
                  <span className={`font-mono font-black ${profitShare >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtNum(profitShare)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">منصرفات خاصة</span>
                  <span className="font-mono font-black text-rose-400">
                    {fmtNum(partnerExpenses)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">صافي المستحق</span>
                  <span className={`font-mono font-black ${netEntitlement >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtNum(netEntitlement)}
                  </span>
                </div>
              </div>

              {p.notes && (
                <p className="text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                  {p.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSave}
            className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-white animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-amber-400">
                {editingPartner ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم الشريك</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: السر الصائغ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">رأس المال ({kCurrency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نسبة الربح (%)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={profitPercent}
                    onChange={(e) => setProfitPercent(e.target.value)}
                    placeholder="50"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+249..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                حفظ الشريك
              </button>
            </div>
          </form>
        </div>
      )}

      {/* شريط ثابت: ملخص الشركاء + زر إضافة شريك */}
      <StickyActionBar
        stats={[
          { label: 'رأس المال', value: fmtNum(totalCapital), tone: 'amber' },
          { label: 'صافي الأرباح', value: fmtNum(netProfit), tone: netProfit >= 0 ? 'emerald' : 'rose' },
          { label: 'مجموع النسب', value: `${totalProfitPercent}%`, tone: totalProfitPercent === 100 ? 'emerald' : 'amber' },
          { label: 'الشركاء', value: String(visiblePartners.length), tone: 'slate' },
        ]}
        columns={4}
        hint={
          totalProfitPercent !== 100 && visiblePartners.length > 0
            ? `تنبيه: مجموع نسب الشركاء ${totalProfitPercent}% وليس 100%`
            : undefined
        }
        actions={[{ label: 'إضافة شريك', onClick: handleOpenAdd, icon: Plus, tone: 'amber' }]}
      />
    </div>
  );
};
