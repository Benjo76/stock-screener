import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, label }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-3 text-muted-foreground">
      <Loader2 className={twMerge(clsx('animate-spin text-primary', sizes[size], className))} />
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
    </div>
  );
};
