import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  ...props
}) => (
  <div className="relative w-full overflow-auto rounded-lg border border-border">
    <table className={twMerge(clsx('w-full caption-bottom text-sm', className))} {...props} />
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <thead
    className={twMerge(clsx('border-b border-border bg-muted/40 text-muted-foreground', className))}
    {...props}
  />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <tbody
    className={twMerge(clsx('[&_tr:last-child]:border-0 divide-y divide-border', className))}
    {...props}
  />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  ...props
}) => (
  <tr
    className={twMerge(
      clsx(
        'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )
    )}
    {...props}
  />
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => (
  <th
    className={twMerge(
      clsx(
        'h-10 px-4 text-left align-middle font-medium text-xs text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className
      )
    )}
    {...props}
  />
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => (
  <td
    className={twMerge(
      clsx('p-4 align-middle text-sm [&:has([role=checkbox])]:pr-0', className)
    )}
    {...props}
  />
);
