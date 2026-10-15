import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LineChart,
  PieChart as PieIcon,
  Play,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { portfoliosApi } from '../api/portfolios';
import { analysesApi } from '../api/analyses';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { EmptyState } from '../components/ui/EmptyState';
import { AllocationPieChart } from '../components/charts/AllocationPieChart';
import { AnalysisResult } from '../types';

export const PortfolioAnalysisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const portfolioIdParam = searchParams.get('portfolioId');
  const queryClient = useQueryClient();
  const { formatCurrency, formatPercent } = useSettings();

  const { data: portfolios } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfoliosApi.list,
  });

  const selectedPortfolioId = portfolioIdParam
    ? Number(portfolioIdParam)
    : portfolios && portfolios.length > 0
    ? portfolios[0].id
    : null;

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['portfolioSummary', selectedPortfolioId],
    queryFn: () =>
      selectedPortfolioId ? portfoliosApi.getSummary(selectedPortfolioId) : Promise.reject(),
    enabled: !!selectedPortfolioId,
  });

  const {
    data: analyses = [],
    isLoading: isAnalysesLoading,
    refetch: refetchAnalyses,
  } = useQuery({
    queryKey: ['portfolioAnalyses', selectedPortfolioId],
    queryFn: () =>
      selectedPortfolioId ? portfoliosApi.getAnalyses(selectedPortfolioId) : Promise.resolve([]),
    enabled: !!selectedPortfolioId,
  });

  const analyzeMutation = useMutation({
    mutationFn: () =>
      selectedPortfolioId
        ? analysesApi.analyzePortfolio(selectedPortfolioId, true)
        : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolioAnalyses', selectedPortfolioId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['analysesJobs'] });
      refetchAnalyses();
    },
  });

  const latestAnalysis: AnalysisResult | undefined = analyses.length > 0 ? analyses[0] : undefined;

  // Identify concentration risk: positions > 15%
  const concentrationRisks = (summary?.top_holdings || []).filter(
    (h) => (h.weight_pct || 0) > 15
  );

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Gesamtdepot-Analyse & Risikoprofil
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ganzheitliche Untersuchung von Klumpenrisiken, Diversifikation, Branchenallokation und Kennzahlen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {portfolios && portfolios.length > 0 && (
            <Select
              value={selectedPortfolioId || ''}
              onChange={(e) => setSearchParams({ portfolioId: e.target.value })}
              className="w-48 text-xs font-semibold h-9"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </Select>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            isLoading={analyzeMutation.isPending}
            disabled={!selectedPortfolioId}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            <span>Depotanalyse jetzt ausführen</span>
          </Button>
        </div>
      </div>

      {!selectedPortfolioId ? (
        <EmptyState
          icon={PieIcon}
          title="Kein Depot ausgewählt"
          description="Legen Sie zuerst ein Depot an, um eine Portfolio-Gesamtanalyse durchzuführen."
          actionLabel="Depots anzeigen"
          onAction={() => (window.location.href = '/portfolios')}
        />
      ) : (
        <div className="space-y-6">
          {/* Latest Analysis Report Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">
                  {latestAnalysis?.headline || 'Portfolio-Zusammenfassung'}
                </CardTitle>
                <CardDescription>
                  {latestAnalysis?.created_at
                    ? `Analysiert am: ${new Date(latestAnalysis.created_at).toLocaleString('de-DE')} • Version ${latestAnalysis.version}`
                    : 'Klicken Sie auf "Depotanalyse jetzt ausführen", um das gesamte Depot zu bewerten.'}
                </CardDescription>
              </div>
              {latestAnalysis?.score !== null && latestAnalysis?.score !== undefined && (
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Diversifikations-Score</span>
                  <span className="text-2xl font-black text-primary">
                    {latestAnalysis.score}/100
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {latestAnalysis ? (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed p-4 bg-muted/40 rounded-xl border">
                    {latestAnalysis.summary || 'Keine Zusammenfassung hinterlegt.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Verwendete Datenquellen:</span>
                    {latestAnalysis.data_sources?.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Für dieses Depot wurde noch keine ganzheitliche Analyse gestartet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Concentration & Allocation Risks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Concentration Risks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <span>Konzentrations- & Klumpenrisiken</span>
                </CardTitle>
                <CardDescription>
                  Positionen mit über 15% Portfoliogewichtung
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {concentrationRisks.length > 0 ? (
                  <div className="space-y-2">
                    {concentrationRisks.map((pos) => (
                      <Alert key={pos.stock_id} variant="warning" title={`${pos.name} (${pos.weight_pct?.toFixed(1)}%)`}>
                        Diese Position macht einen signifikanten Anteil des Gesamtdepots aus. Starke Kursschwankungen haben hohen Einfluss auf das Gesamtergebnis.
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-500 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Keine übermäßigen Klumpenrisiken (&gt; 15% pro Einzeltitel) festgestellt. Gute Grunddiversifikation.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sektor & Währungsrisiken */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  <span>Branchen- & Währungsallokation</span>
                </CardTitle>
                <CardDescription>Risikoverteilung nach Märkten</CardDescription>
              </CardHeader>
              <CardContent>
                {summary?.sector_allocation && Object.keys(summary.sector_allocation).length > 0 ? (
                  <AllocationPieChart data={summary.sector_allocation} height={220} />
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Keine Sektordaten vorhanden.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Holdings Development in Portfolio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Entwicklung der Einzelpositionen</CardTitle>
              <CardDescription>Beitrag zur Gesamtperformance</CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.top_holdings && summary.top_holdings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wertpapier</TableHead>
                      <TableHead className="text-right">Stück</TableHead>
                      <TableHead className="text-right">Einstandswert</TableHead>
                      <TableHead className="text-right">Aktueller Wert</TableHead>
                      <TableHead className="text-right">Gewinn / Verlust</TableHead>
                      <TableHead className="text-right">Gewichtung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.top_holdings.map((rawH) => {
                      const buyPrice = rawH.purchase_price ?? rawH.average_buy_price ?? null;
                      const currentPrice = rawH.current_price ?? null;
                      const shares = rawH.shares || 0;
                      const totalCost = rawH.total_cost ?? (buyPrice !== null ? buyPrice * shares : null);
                      const marketValue = rawH.market_value ?? (currentPrice !== null ? currentPrice * shares : null);
                      let gainLoss = rawH.gain_loss ?? null;
                      let returnPct = rawH.return_pct ?? null;

                      if (gainLoss === null && marketValue !== null && totalCost !== null) {
                        gainLoss = marketValue - totalCost;
                      } else if (gainLoss === null && currentPrice !== null && buyPrice !== null && shares > 0) {
                        gainLoss = (currentPrice - buyPrice) * shares;
                      }

                      if (returnPct === null && totalCost !== null && totalCost > 0 && gainLoss !== null) {
                        returnPct = (gainLoss / totalCost) * 100;
                      } else if (returnPct === null && buyPrice !== null && buyPrice > 0 && currentPrice !== null) {
                        returnPct = ((currentPrice - buyPrice) / buyPrice) * 100;
                      }

                      return (
                        <TableRow key={rawH.stock_id}>
                          <TableCell>
                            <Link to={`/analysis?stockId=${rawH.stock_id}`} className="font-semibold text-xs hover:underline">
                              {rawH.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{rawH.shares}</TableCell>
                          <TableCell className="text-right text-xs">
                            {totalCost !== null ? formatCurrency(totalCost, rawH.currency) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">
                            {marketValue !== null ? formatCurrency(marketValue, rawH.currency) : (totalCost !== null ? formatCurrency(totalCost, rawH.currency) : 'Keine Kurse')}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold">
                            {gainLoss !== null ? (
                              <div className={`flex flex-col items-end ${gainLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <span>
                                  {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, rawH.currency)}
                                </span>
                                <span className="text-[11px] font-medium opacity-90">
                                  {returnPct !== null ? formatPercent(returnPct) : '—'}
                                </span>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <Badge variant="secondary">{rawH.weight_pct?.toFixed(1) || '0.0'} %</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Keine Positionen im gewählten Depot.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
