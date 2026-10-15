import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, TrendingUp } from 'lucide-react';

import { systemApi } from '../api/system';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { AllocationPieChart } from '../components/charts/AllocationPieChart';

import { SummaryCards } from './dashboard/components/SummaryCards';
import { WarningsAlert } from './dashboard/components/WarningsAlert';
import { TopHoldingsTable } from './dashboard/components/TopHoldingsTable';
import { RecentAnalysesAndJobs } from './dashboard/components/RecentAnalysesAndJobs';
import { RecentReportsGrid } from './dashboard/components/RecentReportsGrid';

export const DashboardPage: React.FC = () => {
  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: systemApi.getDashboardSummary,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <Spinner size="xl" label="Lade Dashboard-Daten..." className="py-24" />;
  }

  if (isError) {
    return (
      <div className="space-y-4 py-8">
        <Alert variant="error" title="Fehler beim Laden des Dashboards">
          {error instanceof Error ? error.message : 'Konnte die Dashboard-Daten nicht abrufen.'}
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Portfolio & Research Überblick
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Echtzeit-Kennzahlen und automatisierte Analysen Ihres Aktienbestands.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/portfolios">
            <Button variant="primary" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Depot / Import</span>
            </Button>
          </Link>
          <Link to="/stocks">
            <Button variant="outline" size="sm" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span>Aktie hinzufügen</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Warnings & Data Gaps */}
      <WarningsAlert warnings={summary?.data_warnings} />

      {/* KPI Cards Grid */}
      <SummaryCards summary={summary} />

      {/* Charts & Allocations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sector Allocation */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Branchenverteilung</CardTitle>
            <CardDescription>
              Depotzusammensetzung nach Industriesektoren
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary?.sector_allocation && Object.keys(summary.sector_allocation).length > 0 ? (
              <AllocationPieChart data={summary.sector_allocation} height={260} />
            ) : (
              <div className="flex h-52 items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
                Keine Positionsdaten für Branchenanalyse vorhanden.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Currency Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Währungsverteilung</CardTitle>
            <CardDescription>Währungsrisiken und Diversifikation</CardDescription>
          </CardHeader>
          <CardContent>
            {summary?.currency_allocation && Object.keys(summary.currency_allocation).length > 0 ? (
              <AllocationPieChart data={summary.currency_allocation} height={260} />
            ) : (
              <div className="flex h-52 items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
                Keine Währungsdaten vorhanden.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Holdings Table */}
      <TopHoldingsTable
        positions={summary?.top_positions}
        fallbackCurrency={summary?.currency || 'EUR'}
      />

      {/* Research & Jobs Grid */}
      <RecentAnalysesAndJobs
        recentAnalyses={summary?.recent_analyses}
        recentJobs={summary?.recent_jobs}
      />

      {/* Reports Section */}
      <RecentReportsGrid recentReports={summary?.recent_reports} />
    </div>
  );
};
