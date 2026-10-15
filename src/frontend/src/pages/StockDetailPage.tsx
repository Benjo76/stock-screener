import React, { useMemo, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  History,
  Layers,
  LineChart,
  Percent,
  Play,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { stocksApi } from '../api/stocks';
import { analysesApi } from '../api/analyses';
import { reportsApi } from '../api/reports';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { PriceHistoryChart } from '../components/charts/PriceHistoryChart';
import { PerformanceBarChart } from '../components/charts/PerformanceBarChart';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { AnalysisResult, CompanyReport, FundamentalData, Stock, StockPrice } from '../types';

export const StockDetailPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const stockIdParam = searchParams.get('stockId');
  const queryClient = useQueryClient();
  const { formatCurrency, formatPercent, formatNumber } = useSettings();

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Comparison State
  const [compareResultId, setCompareResultId] = useState<number | null>(null);

  // Upload Report Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [reportType, setReportType] = useState('ANNUAL_REPORT');
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportPeriod, setReportPeriod] = useState('FY');
  const [reportFile, setReportFile] = useState<File | null>(null);

  // Stock selector list
  const { data: allStocks } = useQuery({
    queryKey: ['stocksList'],
    queryFn: () => stocksApi.list(),
  });

  const stockId = stockIdParam ? Number(stockIdParam) : allStocks && allStocks.length > 0 ? allStocks[0].id : null;

  // Selected Stock Details
  const {
    data: stock,
    isLoading: isStockLoading,
    isError: isStockError,
  } = useQuery({
    queryKey: ['stock', stockId],
    queryFn: () => (stockId ? stocksApi.get(stockId) : Promise.reject('No stock selected')),
    enabled: !!stockId,
  });

  // Prices
  const { data: prices = [] } = useQuery({
    queryKey: ['stockPrices', stockId],
    queryFn: () => (stockId ? stocksApi.getPrices(stockId) : Promise.resolve([])),
    enabled: !!stockId,
  });

  // Fundamentals
  const { data: fundamentals = [] } = useQuery({
    queryKey: ['stockFundamentals', stockId],
    queryFn: () => (stockId ? stocksApi.getFundamentals(stockId) : Promise.resolve([])),
    enabled: !!stockId,
  });

  // Analyses History
  const { data: analyses = [], refetch: refetchAnalyses } = useQuery({
    queryKey: ['stockAnalyses', stockId],
    queryFn: () => (stockId ? stocksApi.getAnalyses(stockId) : Promise.resolve([])),
    enabled: !!stockId,
  });

  // Reports
  const { data: reports = [], refetch: refetchReports } = useQuery({
    queryKey: ['stockReports', stockId],
    queryFn: () => (stockId ? stocksApi.getReports(stockId) : Promise.resolve([])),
    enabled: !!stockId,
  });

  // Mutations
  const syncMutation = useMutation({
    mutationFn: () => (stockId ? stocksApi.sync(stockId) : Promise.reject()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', stockId] });
      queryClient.invalidateQueries({ queryKey: ['stockPrices', stockId] });
      queryClient.invalidateQueries({ queryKey: ['stockFundamentals', stockId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => (stockId ? analysesApi.analyzeStock(stockId, true) : Promise.reject()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockAnalyses', stockId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['analysesJobs'] });
      refetchAnalyses();
    },
  });

  const uploadReportMutation = useMutation({
    mutationFn: () => {
      if (!stockId || !reportFile) return Promise.reject();
      return reportsApi.upload({
        stock_id: stockId,
        file: reportFile,
        report_type: reportType,
        fiscal_year: reportYear ? parseInt(reportYear, 10) : undefined,
        fiscal_period: reportPeriod || undefined,
        auto_analyze: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockReports', stockId] });
      queryClient.invalidateQueries({ queryKey: ['stockFundamentals', stockId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsUploadOpen(false);
      setReportFile(null);
      refetchReports();
    },
  });

  // Latest Analysis
  const latestAnalysis: AnalysisResult | undefined = analyses.length > 0 ? analyses[0] : undefined;
  const compareAnalysis: AnalysisResult | undefined = analyses.find((a) => a.id === compareResultId);

  // Latest Fundamental
  const latestFundamental: FundamentalData | undefined = fundamentals.length > 0 ? fundamentals[0] : undefined;

  // Latest Price
  const latestPrice: StockPrice | undefined = prices.length > 0 ? prices[prices.length - 1] : undefined;

  if (!stockId && (!allStocks || allStocks.length === 0)) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Keine Wertpapiere vorhanden"
        description="Legen Sie zuerst eine Aktie in der Wertpapierverwaltung an, um eine detaillierte Aktienanalyse durchzuführen."
        actionLabel="Wertpapier anlegen"
        onAction={() => (window.location.href = '/stocks')}
      />
    );
  }

  if (isStockLoading) {
    return <Spinner size="xl" label="Lade Aktiendaten und Analysen..." className="py-24" />;
  }

  if (isStockError || !stock) {
    return (
      <div className="space-y-4 py-8">
        <Alert variant="error" title="Wertpapier nicht gefunden">
          Das ausgewählte Wertpapier existiert nicht oder konnte nicht geladen werden.
        </Alert>
        <Link to="/stocks">
          <Button variant="outline">Zurück zur Wertpapierliste</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stock Selection & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/stocks"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mr-2"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Wertpapiere</span>
            </Link>

            {/* Quick stock switcher */}
            {allStocks && allStocks.length > 1 && (
              <Select
                value={stock.id}
                onChange={(e) => setSearchParams({ stockId: e.target.value })}
                className="h-7 w-48 text-xs font-semibold py-0"
              >
                {allStocks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.ticker || `Stock #${s.id}`} ({s.ticker || s.isin})
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {stock.name || 'Unbekanntes Wertpapier'}
            </h2>
            <Badge variant="primary" className="text-xs font-mono">
              {stock.ticker || 'KEIN TICKER'}
            </Badge>
            {stock.isin && <Badge variant="outline" className="text-xs font-mono">ISIN: {stock.isin}</Badge>}
            {stock.wkn && <Badge variant="outline" className="text-xs font-mono">WKN: {stock.wkn}</Badge>}
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Börse: <strong>{stock.exchange || '—'}</strong></span>
            <span>•</span>
            <span>Währung: <strong>{stock.currency || 'EUR'}</strong></span>
            <span>•</span>
            <span>Branche: <strong>{stock.sector || '—'}</strong></span>
            <span>•</span>
            <span>Land: <strong>{stock.country || '—'}</strong></span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            isLoading={syncMutation.isPending}
            className="gap-1.5 text-xs"
            title="Kurse und Fundamentaldaten vom Provider abrufen"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Marktdaten sync</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-4 w-4" />
            <span>Bericht hochladen</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            isLoading={analyzeMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            <span>Neue Analyse starten</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs (9 Areas) */}
      <Tabs
        tabs={[
          { id: 'overview', label: '1. Übersicht', icon: <Layers className="h-4 w-4" /> },
          { id: 'prices', label: '2. Kursverlauf', icon: <LineChart className="h-4 w-4" /> },
          { id: 'fundamentals', label: '3. Fundamentaldaten', icon: <DollarSign className="h-4 w-4" /> },
          { id: 'valuation', label: '4. Bewertung', icon: <Scale className="h-4 w-4" /> },
          { id: 'growth', label: '5. Wachstum & Margen', icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'cashflow', label: '6. Cashflow & Schulden', icon: <Percent className="h-4 w-4" /> },
          { id: 'risks', label: '7. Risiken & Unsicherheiten', icon: <ShieldAlert className="h-4 w-4" /> },
          { id: 'reports', label: '8. Quartalsberichte', icon: <FileText className="h-4 w-4" />, badge: reports.length },
          { id: 'history', label: '9. Analysehistorie', icon: <History className="h-4 w-4" />, badge: analyses.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Score & Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Research-Zusammenfassung</CardTitle>
                    <CardDescription>
                      {latestAnalysis?.data_timestamp
                        ? `Stand: ${new Date(latestAnalysis.data_timestamp).toLocaleDateString('de-DE')}`
                        : 'Einschätzung basierend auf aktuellen Finanzdaten'}
                    </CardDescription>
                  </div>
                  {latestAnalysis && (
                    <Badge variant="outline" className="text-xs">
                      Version {latestAnalysis.version}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestAnalysis ? (
                  <>
                    {latestAnalysis.headline && (
                      <h4 className="text-base font-semibold text-foreground">
                        {latestAnalysis.headline}
                      </h4>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {latestAnalysis.summary || 'Keine detaillierte Zusammenfassung vorhanden.'}
                    </p>

                    {/* Data Source Transparency Tag */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Datenquellen:</span>
                      {latestAnalysis.data_sources && latestAnalysis.data_sources.length > 0 ? (
                        latestAnalysis.data_sources.map((src, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px]">
                            {src}
                          </Badge>
                        ))
                      ) : (
                        <span className="italic">Marktdaten-Provider & lokale Finanzdaten</span>
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="Noch keine Analyse vorhanden"
                    description="Klicken Sie oben auf 'Neue Analyse starten', um eine automatisierte Fundamentalanalyse zu generieren."
                    actionLabel="Jetzt analysieren"
                    onAction={() => analyzeMutation.mutate()}
                  />
                )}
              </CardContent>
            </Card>

            {/* Score Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Gesamteinschätzung
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                {latestAnalysis?.score !== null && latestAnalysis?.score !== undefined ? (
                  <>
                    <div
                      className={`text-5xl font-black tracking-tight ${
                        latestAnalysis.score >= 70
                          ? 'text-emerald-500'
                          : latestAnalysis.score >= 50
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {latestAnalysis.score}
                      <span className="text-2xl text-muted-foreground font-normal">/100</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground mt-2">
                      {latestAnalysis.score >= 75
                        ? 'Starkes Fundament / Attraktiv'
                        : latestAnalysis.score >= 50
                        ? 'Solide / Ausgewogenes Profil'
                        : 'Erhöhtes Risiko / Unterdurchschnittlich'}
                    </p>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Kein numerischer Gesamtscore berechnet.
                  </div>
                )}
              </CardContent>
              <div className="p-4 border-t border-border/50 text-center text-[11px] text-muted-foreground">
                Basiert auf Bewertung, Wachstum, Profitabilität und Bilanzqualität.
              </div>
            </Card>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Aktueller Kurs</span>
                <span className="text-xl font-bold text-foreground">
                  {latestPrice?.close !== undefined
                    ? formatCurrency(latestPrice.close, stock.currency)
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {latestPrice?.date ? `Datum: ${latestPrice.date}` : 'Keine Kursdaten'}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">KGV / P/E</span>
                <span className="text-xl font-bold text-foreground">
                  {latestFundamental?.pe_ratio !== null && latestFundamental?.pe_ratio !== undefined
                    ? formatNumber(latestFundamental.pe_ratio, 1)
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {latestFundamental?.fiscal_year ? `FY ${latestFundamental.fiscal_year}` : 'Historisch'}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Umsatz</span>
                <span className="text-xl font-bold text-foreground">
                  {latestFundamental?.revenue
                    ? `${formatNumber(latestFundamental.revenue / 1_000_000, 1)} Mio.`
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {stock.currency || 'EUR'}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground block">Free Cashflow</span>
                <span className="text-xl font-bold text-foreground">
                  {latestFundamental?.free_cash_flow
                    ? `${formatNumber(latestFundamental.free_cash_flow / 1_000_000, 1)} Mio.`
                    : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {stock.currency || 'EUR'}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Mini Price Chart in Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Kursentwicklung</CardTitle>
                <CardDescription>Historischer Preisverlauf</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('prices')} className="text-xs">
                Vollständiger Chart →
              </Button>
            </CardHeader>
            <CardContent>
              <PriceHistoryChart prices={prices} currency={stock.currency || 'EUR'} height={240} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Price Chart */}
      {activeTab === 'prices' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Detaillierter Kursverlauf</CardTitle>
            <CardDescription>
              Historische Tagesschlusskurse und Handelsvolumina aus synchronisierten Daten
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PriceHistoryChart prices={prices} currency={stock.currency || 'EUR'} height={380} />

            {/* Price Table */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Letzte Kursdaten</h4>
              {prices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Eröffnung</TableHead>
                      <TableHead className="text-right">Tageshoch</TableHead>
                      <TableHead className="text-right">Tagestief</TableHead>
                      <TableHead className="text-right">Schlusskurs</TableHead>
                      <TableHead className="text-right">Volumen</TableHead>
                      <TableHead>Quelle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...prices]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 10)
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.date}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{p.open ? formatNumber(p.open, 2) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{p.high ? formatNumber(p.high, 2) : '—'}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{p.low ? formatNumber(p.low, 2) : '—'}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs">
                            {formatCurrency(p.close, p.currency || stock.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {p.volume ? formatNumber(p.volume, 0) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.data_source}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={LineChart}
                  title="Keine Kursdaten gespeichert"
                  description="Synchronisieren Sie die Marktdaten für dieses Wertpapier."
                  actionLabel="Jetzt synchronisieren"
                  onAction={() => syncMutation.mutate()}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Fundamental Data Table */}
      {activeTab === 'fundamentals' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Fundamentaldaten im Periodenvergleich</CardTitle>
            <CardDescription>
              Gewinn- und Verlustrechnung, Bilanz und Cashflow-Kennzahlen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PerformanceBarChart fundamentals={fundamentals} currency={stock.currency || 'EUR'} height={300} />

            {fundamentals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Umsatz</TableHead>
                    <TableHead className="text-right">Operatives Ergebnis</TableHead>
                    <TableHead className="text-right">Nettogewinn</TableHead>
                    <TableHead className="text-right">EPS</TableHead>
                    <TableHead className="text-right">Free Cashflow</TableHead>
                    <TableHead className="text-right">Gesamtschulden</TableHead>
                    <TableHead>Quelle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundamentals.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-semibold text-xs">
                        {f.fiscal_year ? `FY ${f.fiscal_year}` : 'Periode'}{' '}
                        {f.fiscal_period ? `(${f.fiscal_period})` : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {f.revenue ? formatCurrency(f.revenue, f.currency || stock.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {f.operating_income ? formatCurrency(f.operating_income, f.currency || stock.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {f.net_income ? formatCurrency(f.net_income, f.currency || stock.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {f.eps !== null ? formatNumber(f.eps, 2) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-xs">
                        {f.free_cash_flow ? formatCurrency(f.free_cash_flow, f.currency || stock.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {f.total_debt ? formatCurrency(f.total_debt, f.currency || stock.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.data_source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={DollarSign}
                title="Keine Fundamentaldaten verfügbar"
                description="Synchronisieren Sie Marktdaten oder laden Sie einen Geschäftsbericht hoch."
                actionLabel="Marktdaten abrufen"
                onAction={() => syncMutation.mutate()}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Valuation */}
      {activeTab === 'valuation' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Bewertungskennzahlen & Multiples</CardTitle>
            <CardDescription>Vergleich der Bewertungsmetriken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Kurs-Gewinn-Verhältnis (KGV)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.pe_ratio !== null && latestFundamental?.pe_ratio !== undefined
                    ? formatNumber(latestFundamental.pe_ratio, 1)
                    : '—'}
                </span>
                <span className="text-[11px] text-muted-foreground">P/E Ratio</span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Kurs-Umsatz-Verhältnis (KUV)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.ps_ratio !== null && latestFundamental?.ps_ratio !== undefined
                    ? formatNumber(latestFundamental.ps_ratio, 1)
                    : '—'}
                </span>
                <span className="text-[11px] text-muted-foreground">P/S Ratio</span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Kurs-Buchwert-Verhältnis (KBV)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.pb_ratio !== null && latestFundamental?.pb_ratio !== undefined
                    ? formatNumber(latestFundamental.pb_ratio, 1)
                    : '—'}
                </span>
                <span className="text-[11px] text-muted-foreground">P/B Ratio</span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Dividendenrendite</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.dividend_yield !== null && latestFundamental?.dividend_yield !== undefined
                    ? formatPercent(latestFundamental.dividend_yield * 100)
                    : '—'}
                </span>
                <span className="text-[11px] text-muted-foreground">Dividend Yield</span>
              </div>
            </div>

            {/* Assessment from latest analysis */}
            {latestAnalysis?.details?.valuation && (
              <div className="p-4 rounded-lg bg-muted/40 border space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Automatisierte Bewertungsanalyse
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {JSON.stringify(latestAnalysis.details.valuation)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Growth & Profitability */}
      {activeTab === 'growth' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Wachstum und Margen</CardTitle>
            <CardDescription>Profitabilitäts- und Rentabilitätskennzahlen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Bruttomarge (Gross Margin)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.gross_margin !== null && latestFundamental?.gross_margin !== undefined
                    ? formatPercent(latestFundamental.gross_margin)
                    : '—'}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Operative Marge (EBIT Margin)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.operating_margin !== null && latestFundamental?.operating_margin !== undefined
                    ? formatPercent(latestFundamental.operating_margin)
                    : '—'}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Nettomarge (Net Margin)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.net_margin !== null && latestFundamental?.net_margin !== undefined
                    ? formatPercent(latestFundamental.net_margin)
                    : '—'}
                </span>
              </div>
            </div>

            <PerformanceBarChart fundamentals={fundamentals} currency={stock.currency || 'EUR'} height={280} />
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Cashflow & Debt */}
      {activeTab === 'cashflow' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Cashflow und Bilanzstruktur</CardTitle>
            <CardDescription>Liquidität, Verschuldungsgrad und Solvenz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Operativer Cashflow</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.operating_cash_flow
                    ? formatCurrency(latestFundamental.operating_cash_flow, stock.currency)
                    : '—'}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Free Cashflow</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.free_cash_flow
                    ? formatCurrency(latestFundamental.free_cash_flow, stock.currency)
                    : '—'}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-card border space-y-1">
                <span className="text-xs text-muted-foreground block">Verschuldungsgrad (Debt/Equity)</span>
                <span className="text-2xl font-bold text-foreground">
                  {latestFundamental?.debt_to_equity !== null && latestFundamental?.debt_to_equity !== undefined
                    ? formatNumber(latestFundamental.debt_to_equity, 2)
                    : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 7: Risks */}
      {activeTab === 'risks' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Risikofaktoren und Datenunsicherheiten</CardTitle>
            <CardDescription>
              Transparente Auflistung von identifizierten Unternehmensrisiken und Datenlücken
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Risks from Analysis */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Identifizierte Risiken</span>
              </h4>
              {latestAnalysis?.uncertainties && latestAnalysis.uncertainties.length > 0 ? (
                <div className="space-y-2">
                  {latestAnalysis.uncertainties.map((u, i) => (
                    <Alert key={i} variant="warning" title={`Risikofaktor ${i + 1}`}>
                      {u}
                    </Alert>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Keine spezifischen Risikofaktoren in der letzten Analyse vermerkt.
                </p>
              )}
            </div>

            {/* Data Gaps */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <span>Datenlücken und Informationsbedarf</span>
              </h4>
              {latestAnalysis?.data_gaps && latestAnalysis.data_gaps.length > 0 ? (
                <div className="space-y-2">
                  {latestAnalysis.data_gaps.map((gap, i) => (
                    <Alert key={i} variant="info" title="Fehlende Datenbasis">
                      {gap}
                    </Alert>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Keine Datenlücken in der Analyse festgestellt.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 8: Quarterly Reports */}
      {activeTab === 'reports' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Unternehmensberichte & Dokumente</CardTitle>
              <CardDescription>
                Geschäftsberichte, Quartalszahlen und automatisch extrahierte Aussagen
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)} className="gap-1.5 text-xs">
              <Upload className="h-4 w-4" />
              <span>Bericht hochladen</span>
            </Button>
          </CardHeader>
          <CardContent>
            {reports.length > 0 ? (
              <div className="space-y-4">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-lg border border-border bg-card/60 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold text-sm">
                            {rep.title || `${rep.report_type} ${rep.fiscal_year || ''}`}
                          </h4>
                          <Badge variant="outline" className="text-[10px]">
                            {rep.report_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Jahr: {rep.fiscal_year || '—'} {rep.fiscal_period ? `• Periode: ${rep.fiscal_period}` : ''} • Quelle: {rep.data_source}
                        </p>
                      </div>

                      <Link to="/reports">
                        <Button variant="outline" size="sm" className="text-xs">
                          In Berichtsverwaltung öffnen
                        </Button>
                      </Link>
                    </div>

                    {/* Extracted Analyses Preview */}
                    {rep.analyses && rep.analyses.length > 0 && (
                      <div className="p-3 bg-muted/40 rounded-md text-xs space-y-2">
                        <span className="font-semibold text-foreground block">
                          Extrahierte Zusammenfassung:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {rep.analyses[0].summary || 'Keine Zusammenfassung extrahiert.'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="Keine Berichte hinterlegt"
                description="Laden Sie Jahres- oder Quartalsberichte im PDF- oder Textformat hoch, um Kennzahlen automatisch zu extrahieren."
                actionLabel="Bericht hochladen"
                onAction={() => setIsUploadOpen(true)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 9: Analysis History & Comparison */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Analysehistorie & Versionsvergleich</CardTitle>
            <CardDescription>
              Historische Einschätzungen vergleichen und Veränderungen nachverfolgen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {analyses.length > 0 ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Kernaussage / Headline</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyses.map((ana) => (
                      <TableRow key={ana.id}>
                        <TableCell className="font-bold text-xs">v{ana.version}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ana.created_at ? new Date(ana.created_at).toLocaleDateString('de-DE') : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-bold">
                          {ana.score !== null ? (
                            <span
                              className={
                                ana.score >= 70
                                  ? 'text-emerald-500'
                                  : ana.score >= 50
                                  ? 'text-amber-500'
                                  : 'text-rose-500'
                              }
                            >
                              {ana.score}/100
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-md truncate">
                          {ana.headline || ana.summary || 'Analyseergebnis'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setCompareResultId(ana.id)}
                          >
                            Vergleichen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Comparison Modal / Box */}
                {compareAnalysis && (
                  <div className="p-4 rounded-xl border border-primary/40 bg-card space-y-3 mt-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-primary">
                        Detailansicht Analyse Version {compareAnalysis.version} (ID #{compareAnalysis.id})
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => setCompareResultId(null)}>
                        Schließen
                      </Button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-foreground">{compareAnalysis.headline}</p>
                      <p className="text-muted-foreground leading-relaxed">{compareAnalysis.summary}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={History}
                title="Keine bisherigen Analysen"
                description="Starten Sie eine neue Analyse, um den Verlauf zu protokollieren."
                actionLabel="Analyse ausführen"
                onAction={() => analyzeMutation.mutate()}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Upload Report */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Unternehmensbericht hochladen & analysieren"
        description="Laden Sie eine PDF- oder Textdatei hoch. Kennzahlen und Aussagen werden automatisch extrahiert."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadReportMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Berichtstyp"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="ANNUAL_REPORT">Geschäftsbericht (Annual Report)</option>
              <option value="QUARTERLY_REPORT">Quartalsbericht (Quarterly)</option>
              <option value="HALF_YEAR_REPORT">Halbjahresbericht</option>
              <option value="EARNINGS_RELEASE">Ergebnis-Mitteilung</option>
            </Select>

            <Input
              label="Geschäftsjahr (FY)"
              type="number"
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              placeholder="z. B. 2024"
            />
          </div>

          <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
            <input
              type="file"
              accept=".pdf,.txt,.json,.md"
              onChange={(e) => setReportFile(e.target.files?.[0] || null)}
              className="hidden"
              id="report-file-picker"
            />
            <label htmlFor="report-file-picker" className="cursor-pointer block">
              <Upload className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">
                {reportFile ? reportFile.name : 'PDF- oder Textdokument wählen'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PDF, TXT, Markdown bis max. 10 MB
              </p>
            </label>
          </div>

          {uploadReportMutation.isError && (
            <Alert variant="error">
              {uploadReportMutation.error instanceof Error
                ? uploadReportMutation.error.message
                : 'Fehler beim Hochladen des Berichts.'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!reportFile}
              isLoading={uploadReportMutation.isPending}
            >
              Hochladen & Analysieren
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
