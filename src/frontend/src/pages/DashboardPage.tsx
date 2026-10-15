import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  FileText,
  PieChart as PieIcon,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { systemApi } from '../api/system';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { AllocationPieChart } from '../components/charts/AllocationPieChart';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

export const DashboardPage: React.FC = () => {
  const { formatCurrency, formatPercent, formatNumber } = useSettings();

  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
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

  const hasPortfolios = (summary?.portfolios_count || 0) > 0;
  const hasHoldings = (summary?.holdings_count || 0) > 0;

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
      {summary?.data_warnings && summary.data_warnings.length > 0 && (
        <div className="space-y-2">
          {summary.data_warnings.map((w, idx) => (
            <Alert
              key={idx}
              variant={w.severity === 'error' ? 'error' : 'warning'}
              title={w.stock_name ? `Datenhinweis: ${w.stock_name}` : 'Systemhinweis'}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>{w.message}</span>
                {w.recommendation && (
                  <span className="text-xs font-medium underline opacity-90">
                    {w.recommendation}
                  </span>
                )}
              </div>
            </Alert>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <Card className="hover:border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gesamtwert Depot
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {summary?.total_portfolio_value !== null && summary?.total_portfolio_value !== undefined
                ? formatCurrency(summary.total_portfolio_value, summary.currency)
                : 'Keine Daten verfügbar'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.total_invested_cost !== null && summary?.total_invested_cost !== undefined ? (
                <>Einstand: {formatCurrency(summary.total_invested_cost, summary.currency)}</>
              ) : (
                'Aktuelle Kurse fehlen'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Unrealized Gain/Loss */}
        <Card className="hover:border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gewinn / Verlust
            </CardTitle>
            {summary?.total_unrealized_gain_loss !== null && (summary?.total_unrealized_gain_loss ?? 0) >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-extrabold tracking-tight ${
                summary?.total_unrealized_gain_loss === null || summary?.total_unrealized_gain_loss === undefined
                  ? 'text-foreground'
                  : summary.total_unrealized_gain_loss >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary?.total_unrealized_gain_loss !== null && summary?.total_unrealized_gain_loss !== undefined
                ? `${summary.total_unrealized_gain_loss >= 0 ? '+' : ''}${formatCurrency(
                    summary.total_unrealized_gain_loss,
                    summary.currency
                  )}`
                : 'Nicht berechenbar'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.total_unrealized_return_pct !== null && summary?.total_unrealized_return_pct !== undefined ? (
                <span
                  className={
                    summary.total_unrealized_return_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }
                >
                  {formatPercent(summary.total_unrealized_return_pct)} Rendite gesamt
                </span>
              ) : (
                'Fehlende historische Kurse'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Positions & Depots */}
        <Card className="hover:border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Depots & Positionen
            </CardTitle>
            <PieIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {summary?.holdings_count || 0}{' '}
              <span className="text-sm font-normal text-muted-foreground">Positionen</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              in {summary?.portfolios_count || 0} Depots ({summary?.stocks_count || 0} Wertpapiere)
            </p>
          </CardContent>
        </Card>

        {/* Analyses & Jobs */}
        <Card className="hover:border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Research & Jobs
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {summary?.recent_analyses?.length || 0}{' '}
              <span className="text-sm font-normal text-muted-foreground">Analysen</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.recent_jobs?.filter((j) => j.status === 'RUNNING' || j.status === 'PENDING')
                .length || 0}{' '}
              aktive Hintergrundjobs
            </p>
          </CardContent>
        </Card>
      </div>

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Größte Depotpositionen</CardTitle>
            <CardDescription>Übersicht über die gewichtigsten Positionen</CardDescription>
          </div>
          <Link to="/portfolios">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <span>Alle Positionen</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {summary?.top_positions && summary.top_positions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wertpapier</TableHead>
                  <TableHead>Depot</TableHead>
                  <TableHead className="text-right">Stück</TableHead>
                  <TableHead className="text-right">Einstand</TableHead>
                  <TableHead className="text-right">Aktueller Kurs</TableHead>
                  <TableHead className="text-right">Marktwert</TableHead>
                  <TableHead className="text-right">G/V</TableHead>
                  <TableHead className="text-right">Gewichtung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.top_positions.map((pos, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/analysis?stockId=${pos.stock_id}`}
                        className="hover:underline flex flex-col"
                      >
                        <span className="font-semibold text-foreground">{pos.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {pos.ticker || pos.isin || '—'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pos.portfolio_name || `Depot ${pos.portfolio_id}`}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatNumber(pos.shares, 2)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {pos.average_buy_price !== null
                        ? formatCurrency(pos.average_buy_price, pos.currency)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs">
                      {pos.current_price !== null
                        ? formatCurrency(pos.current_price, pos.currency)
                        : <span className="text-muted-foreground font-normal">Keine Daten</span>}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs">
                      {pos.market_value !== null
                        ? formatCurrency(pos.market_value, pos.currency)
                        : formatCurrency(pos.total_cost, pos.currency)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {pos.gain_loss !== null ? (
                        <span className={pos.gain_loss >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {pos.gain_loss >= 0 ? '+' : ''}
                          {formatCurrency(pos.gain_loss, pos.currency)}
                          {pos.return_pct !== null && ` (${formatPercent(pos.return_pct)})`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <Badge variant="secondary">{pos.weight_pct?.toFixed(1) || '0.0'} %</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={PieIcon}
              title="Noch keine Depotpositionen"
              description="Importieren Sie einen Depotauszug via CSV oder legen Sie Wertpapiere manuell an."
              actionLabel="Depot verwalten"
              onAction={() => window.location.assign('/portfolios')}
            />
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Recent Analyses & Recent Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Analyses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Zuletzt analysierte Aktien</CardTitle>
              <CardDescription>Automatisch generierte Research-Einschätzungen</CardDescription>
            </div>
            <Link to="/analysis">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <span>Alle Analysen</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {summary?.recent_analyses && summary.recent_analyses.length > 0 ? (
              <div className="space-y-3">
                {summary.recent_analyses.map((ana) => (
                  <div
                    key={ana.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60 hover:bg-accent/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/analysis?stockId=${ana.stock_id}`}
                          className="font-semibold text-sm hover:underline"
                        >
                          {ana.stock?.name || `Wertpapier #${ana.stock_id}`}
                        </Link>
                        <Badge variant="outline" className="text-[10px]">
                          v{ana.version}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-sm">
                        {ana.headline || ana.summary || 'Fundamentalanalyse abgeschlossen.'}
                      </p>
                    </div>

                    <div className="text-right">
                      {ana.score !== null ? (
                        <div
                          className={`text-sm font-bold ${
                            ana.score >= 70
                              ? 'text-emerald-500'
                              : ana.score >= 50
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        >
                          Score: {ana.score}/100
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Kein Score</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {ana.created_at ? new Date(ana.created_at).toLocaleDateString('de-DE') : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Noch keine Analysen durchgeführt. Öffnen Sie die Aktienanalyse, um eine neue Bewertung zu starten.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Aktuelle Analysejobs</CardTitle>
              <CardDescription>Hintergrundaufgaben und Ausführungsstatus</CardDescription>
            </div>
            <Link to="/jobs">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <span>Alle Jobs</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {summary?.recent_jobs && summary.recent_jobs.length > 0 ? (
              <div className="space-y-3">
                {summary.recent_jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {job.job_type === 'STOCK_ANALYSIS'
                            ? `Aktie: ${job.stock?.name || `#${job.stock_id}`}`
                            : `Portfolio: ${job.portfolio?.name || `#${job.portfolio_id}`}`}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Gestartet: {job.created_at ? new Date(job.created_at).toLocaleTimeString('de-DE') : '—'}
                      </span>
                    </div>

                    <div>
                      {job.status === 'COMPLETED' ? (
                        <Badge variant="success">Erfolgreich</Badge>
                      ) : job.status === 'FAILED' ? (
                        <Badge variant="danger">Fehlgeschlagen</Badge>
                      ) : job.status === 'RUNNING' ? (
                        <Badge variant="warning">Läuft</Badge>
                      ) : (
                        <Badge variant="secondary">Ausstehend</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Keine aktuellen Analysejobs vorhanden.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Zuletzt importierte Unternehmensberichte</CardTitle>
            <CardDescription>Dokumente und extrahierte Finanzdaten</CardDescription>
          </div>
          <Link to="/reports">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <span>Zur Berichtsverwaltung</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {summary?.recent_reports && summary.recent_reports.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.recent_reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{rep.title || `${rep.report_type} ${rep.fiscal_year || ''}`}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {rep.fiscal_year || 'FY'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unternehmen: {rep.stock?.name || `Wertpapier #${rep.stock_id}`}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Quelle: {rep.data_source}</span>
                    <Link to="/reports" className="text-primary hover:underline font-medium">
                      Details öffnen →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Keine Unternehmensberichte hinterlegt. Sie können PDF- oder Textberichte in der Berichtsverwaltung hochladen.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
