'use client';

import React, { useMemo } from 'react';

/**
 * رسوم بيانية خفيفة مبنية بـ SVG بدون أي مكتبة خارجية.
 * مصممة للعربية (اتجاه من اليمين لليسار) وتعمل في الوضعين الفاتح والداكن والطباعة.
 */

export interface BarPoint {
  label: string;
  value: number;
  value2?: number;
  hint?: string;
}

interface BarChartProps {
  data: BarPoint[];
  height?: number;
  formatValue?: (n: number) => string;
  /** لون العمود الأول والثاني */
  colors?: [string, string];
  labels2?: string;
  emptyMessage?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 150,
  formatValue = (n) => Math.round(n).toLocaleString('en-US'),
  colors = ['#10b981', '#f59e0b'],
  labels2,
  emptyMessage = 'لا توجد بيانات كافية',
}) => {
  const max = useMemo(() => {
    const values = data.flatMap((d) => [d.value, d.value2 ?? 0]).map((v) => Math.abs(v));
    return Math.max(1, ...values);
  }, [data]);

  const hasAny = data.some((d) => d.value !== 0 || (d.value2 ?? 0) !== 0);

  if (!data.length || !hasAny) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 text-xs text-slate-500"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* منطقة الأعمدة — تُرسم من اليمين لليسار */}
      <div className="flex items-end gap-1.5" style={{ height }} dir="rtl">
        {data.map((point, i) => {
          const v1 = Math.abs(point.value);
          const v2 = Math.abs(point.value2 ?? 0);
          const h1 = Math.max(v1 > 0 ? 3 : 0, (v1 / max) * (height - 24));
          const h2 = Math.max(v2 > 0 ? 3 : 0, (v2 / max) * (height - 24));

          return (
            <div key={`${point.label}-${i}`} className="flex-1 flex flex-col items-center justify-end gap-0.5 group">
              <div
                className="w-full flex items-end justify-center gap-[2px]"
                style={{ height: height - 20 }}
                title={
                  point.hint ||
                  `${point.label}: ${formatValue(point.value)}${point.value2 !== undefined ? ` / ${formatValue(point.value2)}` : ''}`
                }
              >
                <div
                  className="rounded-t-[3px] transition-all group-hover:opacity-80"
                  style={{ width: point.value2 !== undefined ? '42%' : '72%', height: `${h1}px`, backgroundColor: colors[0] }}
                />
                {point.value2 !== undefined && (
                  <div
                    className="rounded-t-[3px] transition-all group-hover:opacity-80"
                    style={{ width: '42%', height: `${h2}px`, backgroundColor: colors[1] }}
                  />
                )}
              </div>
              <span className="text-[9px] text-slate-500 whitespace-nowrap">{point.label}</span>
            </div>
          );
        })}
      </div>

      {/* مفتاح الألوان */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[0] }} />
          {colors[0] === '#10b981' ? 'المبيعات' : 'الأول'}
        </span>
        {labels2 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[1] }} />
            {labels2}
          </span>
        )}
        <span className="mr-auto text-slate-500">القمة: {formatValue(max)}</span>
      </div>
    </div>
  );
};

interface LineChartProps {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
  emptyMessage?: string;
}

/** مخطط خطي مع تعبئة، يعرض آخر قيمة ومقارنتها بأول قيمة */
export const LineChart: React.FC<LineChartProps> = ({
  points,
  height = 120,
  color = '#f59e0b',
  formatValue = (n) => Math.round(n).toLocaleString('en-US'),
  emptyMessage = 'لا يوجد سجل أسعار بعد',
}) => {
  const clean = useMemo(() => points.filter((p) => isFinite(p.value) && p.value > 0), [points]);

  if (clean.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 text-xs text-slate-500"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const values = clean.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 300;
  const padTop = 10;
  const padBottom = 10;
  const usable = height - padTop - padBottom;

  // الاتجاه من اليمين لليسار: أول نقطة على اليمين
  const coords = clean.map((p, i) => {
    const x = width - (i / (clean.length - 1)) * width;
    const y = padTop + usable - ((p.value - min) / span) * usable;
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(2)},${(height - padBottom).toFixed(2)} L${coords[0].x.toFixed(2)},${(height - padBottom).toFixed(2)} Z`;

  const first = clean[0].value;
  const last = clean[clean.length - 1].value;
  const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;
  const rising = changePercent >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-base font-black font-mono" style={{ color }}>
            {formatValue(last)}
          </span>
          <span className="text-[10px] text-slate-500 mr-2">آخر سعر مسجّل</span>
        </div>
        <span
          className={`text-[11px] font-bold font-mono ${rising ? 'text-emerald-400' : 'text-rose-400'}`}
          title="التغير منذ أول نقطة في السجل"
        >
          {rising ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height }}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineFill)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2.2" fill={color} opacity={i === coords.length - 1 ? 1 : 0.5} />
        ))}
      </svg>

      <div className="flex items-center justify-between text-[9px] text-slate-500">
        <span>{clean[0].label}</span>
        <span>الأدنى: {formatValue(min)} · الأعلى: {formatValue(max)}</span>
        <span>{clean[clean.length - 1].label}</span>
      </div>
    </div>
  );
};

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}

/** خط مصغّر للوحات الفرعية */
export const Sparkline: React.FC<SparklineProps> = ({ points, width = 80, height = 22, color = '#f59e0b' }) => {
  const clean = points.filter((p) => isFinite(p));
  if (clean.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const path = clean
    .map((v, i) => {
      const x = width - (i / (clean.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};
