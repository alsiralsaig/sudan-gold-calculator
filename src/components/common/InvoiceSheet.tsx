'use client';
import React from 'react';
import { PrintableInvoice } from '../../core/invoice';
import { fmtNum, formatInvoiceDate, unitsToGhJ } from '../../core/format';

/**
 * ورقة الفاتورة — نسخة واحدة تُستخدم للمعاينة والطباعة معاً،
 * بأنماط مستقلّة عن الوضع الليلي حتى تُطبع بالأبيض والأسود دائماً.
 */
export const InvoiceSheet: React.FC<{ invoice: PrintableInvoice; currency: string }> = ({ invoice, currency }) => {
  const inv = invoice;
  return (
    <div className="inv-sheet">
      <div className="inv-head">
        <div>
          <div className="inv-store">{inv.storeName || 'متجر الذهب'}</div>
          <div className="inv-store-sub">
            {inv.branchName ? `فرع: ${inv.branchName}` : 'الفرع الرئيسي'}
            {inv.branchPhone ? ` — هاتف: ${inv.branchPhone}` : ''}
          </div>
        </div>
        <div className="inv-kind">
          <div className="inv-kind-title">{inv.title}</div>
          <div className="inv-no">{inv.invoiceNo}</div>
          <div className="inv-no-sub">{formatInvoiceDate(inv.date)}</div>
        </div>
      </div>

      <div className="inv-meta">
        <div className="inv-meta-cell">
          <div className="inv-meta-label">{inv.partyLabel}</div>
          <div className="inv-meta-value">{inv.partyName}</div>
          {inv.partyPhone ? <div className="inv-meta-label">هاتف: {inv.partyPhone}</div> : null}
        </div>
        <div className="inv-meta-cell">
          <div className="inv-meta-label">الفرع / المستخدم</div>
          <div className="inv-meta-value">{inv.branchName || 'الفرع الرئيسي'}</div>
          <div className="inv-meta-label">تاريخ الإصدار: {formatInvoiceDate(inv.date)}</div>
        </div>
        {inv.dueDate ? (
          <div className="inv-meta-cell">
            <div className="inv-meta-label">تاريخ استحقاق السداد</div>
            <div className="inv-meta-value">{formatInvoiceDate(inv.dueDate)}</div>
          </div>
        ) : null}
        {inv.bankAccount ? (
          <div className="inv-meta-cell">
            <div className="inv-meta-label">الحساب البنكي (بنكك)</div>
            <div className="inv-meta-value">{inv.bankAccount}</div>
          </div>
        ) : null}
      </div>

      <table className="inv-lines">
        <thead>
          <tr>
            <th style={{ width: '30%' }}>الوصف</th>
            <th style={{ width: '22%' }}>الوزن</th>
            <th style={{ width: '16%' }}>العيار</th>
            <th style={{ width: '32%' }}>سعر الجرام ({currency})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ذهب مصاغ / سبائك</td>
            <td className="num">{inv.weightLabel}</td>
            <td className="num">{inv.purityLabel}</td>
            <td className="num">{fmtNum(Math.round(inv.pricePerGram))}</td>
          </tr>
        </tbody>
      </table>

      <div className="inv-totals">
        <div className="inv-total-cell grand">
          <div className="inv-total-label">الإجمالي ({currency})</div>
          <div className="inv-total-value">{fmtNum(inv.amount)}</div>
        </div>
        <div className="inv-total-cell">
          <div className="inv-total-label">المدفوع ({currency})</div>
          <div className="inv-total-value">{fmtNum(inv.paid)}</div>
        </div>
        <div className={`inv-total-cell ${inv.pending > 0 ? 'due' : ''}`}>
          <div className="inv-total-label">المتبقي ({currency})</div>
          <div className="inv-total-value">{fmtNum(inv.pending)}</div>
        </div>
      </div>

      {inv.extra && inv.extra.length > 0 ? (
        <div className="inv-notes">
          {inv.extra.map((row) => (
            <div key={row.label}>
              {row.label}: <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {inv.notes ? <div className="inv-notes">ملاحظات: {inv.notes}</div> : null}

      <div className="inv-sign">
        <span>توقيع البائع</span>
        <span>توقيع {inv.partyLabel}</span>
      </div>

      <div className="inv-foot">
        <span>شكراً لتعاملكم معنا</span>
        <span>حاسبة الذهب السودانية — {unitsToGhJ(100)} = 1 جرام</span>
      </div>
    </div>
  );
};
