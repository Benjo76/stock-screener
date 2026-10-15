import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'flex overflow-x-auto no-scrollbar space-x-1 p-1 bg-muted/60 rounded-lg border border-border/50 text-muted-foreground',
          className
        )
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={twMerge(
              clsx(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition-all select-none',
                isActive
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'hover:text-foreground hover:bg-muted/80'
              )
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={clsx(
                  'ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted-foreground/20 text-muted-foreground'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
