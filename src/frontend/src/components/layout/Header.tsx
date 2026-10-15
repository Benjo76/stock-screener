import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { systemApi } from '../../api/system';
import { Button } from '../ui/Button';

interface HeaderProps {
  onMenuClick: () => void;
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Gesamtübersicht über Portfolios, Kennzahlen und Analysen' },
  '/portfolios': { title: 'Portfolioverwaltung', subtitle: 'Depots, Positionen, Transaktionen und CSV-Import' },
  '/stocks': { title: 'Wertpapiere', subtitle: 'Aktien-Stammdaten, Suche und Kennzahlen' },
  '/analysis': { title: 'Aktienanalyse & Research', subtitle: 'Fundamentalanalyse, Bewertung und Risikoprofile' },
  '/reports': { title: 'Berichte & Dokumente', subtitle: 'Quartals- und Geschäftsberichte verwalten und analysieren' },
  '/jobs': { title: 'Analysejobs', subtitle: 'Status laufender und abgeschlossener Hintergrundaufgaben' },
  '/data-sources': { title: 'Datenquellen', subtitle: 'Status der Provider, API-Limits und Synchronisation' },
  '/settings': { title: 'Einstellungen', subtitle: 'Systemkonfiguration, API-Schlüssel und Darstellung' },
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const currentInfo = PAGE_TITLES[location.pathname] || {
    title: 'Aktien-Research',
    subtitle: 'Professionelle Finanzanalyse & Portfoliomanagement',
  };

  const { data: systemStatus, isFetching, refetch } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: systemApi.getStatus,
    refetchInterval: 60000,
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Menü öffnen"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">
            {currentInfo.title}
          </h1>
          <p className="hidden md:block text-xs text-muted-foreground leading-tight">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: System status badge & quick refresh */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-muted-foreground">Provider:</span>
          <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
            {systemStatus?.active_provider || 'Mock/Yahoo'}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isLoading={isFetching}
          className="h-8 gap-1.5 text-xs"
          title="Status aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </div>
    </header>
  );
};
