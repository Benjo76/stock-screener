import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = 'info',
  title,
  icon,
  children,
  ...props
}) => {
  const base = 'relative w-full rounded-lg border p-4 text-sm flex gap-3 items-start';

  const defaultIcons = {
    info: <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />,
  };

  const variants = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200',
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200',
  };

  return (
    <div className={twMerge(clsx(base, variants[variant], className))} role="alert" {...props}>
      {icon || defaultIcons[variant]}
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold leading-none tracking-tight">{title}</h5>}
        <div className="text-sm opacity-90 leading-relaxed">{children}</div>
      </div>
    </div>
  );
};
