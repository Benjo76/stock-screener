import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  Database,
  FileText,
  LayoutDashboard,
  LineChart,
  Moon,
  PieChart,
  Settings,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/portfolios', label: 'Portfolio', icon: PieChart },
  { path: '/stocks', label: 'Wertpapiere', icon: TrendingUp },
  { path: '/analysis', label: 'Aktienanalyse', icon: LineChart },
  { path: '/reports', label: 'Berichte', icon: FileText },
  { path: '/jobs', label: 'Analysejobs', icon: Activity },
  { path: '/data-sources', label: 'Datenquellen', icon: Database },
  { path: '/settings', label: 'Einstellungen', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <NavLink to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-foreground" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-extrabold text-foreground">Stock Screener</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
                Research Agent
              </span>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Navigation schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Hauptmenü
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / Theme switch */}
        <div className="border-t border-border p-4 space-y-3">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4 text-primary" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
              <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-semibold">
              {theme}
            </span>
          </button>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground border border-border/50">
            <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Agent Status: Online</span>
            </div>
            <p className="text-[11px] leading-tight">API & PostgreSQL verbunden</p>
          </div>
        </div>
      </aside>
    </>
  );
};
