import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  highlight?: boolean;
  alert?: boolean;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  highlight,
  alert,
  onClick,
  className = ''
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={e => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`
        bg-white rounded-lg p-5 border transition-all duration-200
        ${alert ? 'border-amber-300 bg-amber-50/40' : highlight ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200'}
        ${isClickable ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10' : ''}
        ${className}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {value}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-1 text-xs">
              <span className={`font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-slate-600'}`}>
                {trend.value}
              </span>
              {trend.label && <span className="text-slate-400">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-lg shrink-0 ${alert ? 'bg-amber-100 text-amber-700' : highlight ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
