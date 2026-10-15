import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpDown,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  LineChart,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { portfoliosApi } from '../api/portfolios';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { AllocationPieChart } from '../components/charts/AllocationPieChart';
import { CsvImportPreview, CsvImportResult } from '../types';

type SortField =
  | 'name'
  | 'shares'
  | 'purchase_price'
  | 'total_cost'
  | 'current_price'
  | 'market_value'
  | 'gain_loss'
  | 'return_pct'
  | 'sector'
  | 'currency';

export const PortfolioDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const portfolioId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { formatCurrency, formatPercent, formatNumber } = useSettings();

  const [activeTab, setActiveTab] = useState<'positions' | 'transactions' | 'analytics'>('positions');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('market_value');
  const [sortAsc, setSortAsc] = useState(false);

  // Modals state
  const [isAddHoldingOpen, setIsAddHoldingOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // New Holding Form State
  const [holdingTicker, setHoldingTicker] = useState('');
  const [holdingName, setHoldingName] = useState('');
  const [holdingShares, setHoldingShares] = useState('');
  const [holdingBuyPrice, setHoldingBuyPrice] = useState('');
  const [holdingCurrentPrice, setHoldingCurrentPrice] = useState('');

  // New Transaction Form State
  const [txStockId, setTxStockId] = useState<number | ''>('');
  const [txType, setTxType] = useState('BUY');
  const [txShares, setTxShares] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txTotal, setTxTotal] = useState('');
  const [txFees, setTxFees] = useState('0');
  const [txNotes, setTxNotes] = useState('');

  // Multi-step CSV Import State
  // Step 1: Select file/paste text
  // Step 2 & 3: Preview columns, detected data, validation & errors
  // Step 4: Confirm import
  // Step 5: Import summary report
  const [csvStep, setCsvStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvForcedType, setCsvForcedType] = useState<'holdings' | 'transactions' | undefined>(undefined);
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  // Queries
  const {
    data: portfolio,
    isLoading: isPortfolioLoading,
    isError: isPortfolioError,
  } = useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => portfoliosApi.get(portfolioId),
    enabled: !isNaN(portfolioId),
  });

  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['portfolioSummary', portfolioId],
    queryFn: () => portfoliosApi.getSummary(portfolioId),
    enabled: !isNaN(portfolioId),
  });

  // Mutations
  const addHoldingMutation = useMutation({
    mutationFn: (data: any) => portfoliosApi.addHolding(portfolioId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsAddHoldingOpen(false);
      setHoldingTicker('');
      setHoldingName('');
      setHoldingShares('');
      setHoldingBuyPrice('');
      setHoldingCurrentPrice('');
    },
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: (holdingId: number) => portfoliosApi.deleteHolding(portfolioId, holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  const addTxMutation = useMutation({
    mutationFn: (data: any) => portfoliosApi.addTransaction(portfolioId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsAddTxOpen(false);
      setTxStockId('');
      setTxShares('');
      setTxPrice('');
      setTxTotal('');
      setTxFees('0');
      setTxNotes('');
    },
  });

  const previewCsvMutation = useMutation({
    mutationFn: (content: string) => portfoliosApi.previewCsv(portfolioId, content, csvForcedType),
    onSuccess: (data) => {
      setCsvPreview(data);
      setCsvStep(2); // Go to Preview & Validation step
    },
  });

  const executeCsvMutation = useMutation({
    mutationFn: (content: string) => portfoliosApi.executeCsv(portfolioId, content, csvForcedType),
    onSuccess: (data) => {
      setCsvResult(data);
      setCsvStep(5); // Show final import report
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  // Unique sectors for filter dropdown
  const availableSectors = useMemo(() => {
    if (!summary?.top_holdings) return [];
    const set = new Set<string>();
    summary.top_holdings.forEach((h) => {
      if (h.sector) set.add(h.sector);
    });
    return Array.from(set);
  }, [summary]);

  // Filtered & Sorted Holdings
  const displayedHoldings = useMemo(() => {
    if (!summary?.top_holdings) return [];
    let list = summary.top_holdings.map((h) => {
      const buyPrice =
        h.purchase_price !== undefined && h.purchase_price !== null
          ? h.purchase_price
          : h.average_buy_price ?? null;
      const currentPrice = h.current_price ?? null;
      const shares = h.shares || 0;

      const totalCost = h.total_cost ?? (buyPrice !== null ? buyPrice * shares : null);
      const marketValue = h.market_value ?? (currentPrice !== null ? currentPrice * shares : null);

      let gainLoss: number | null = h.gain_loss ?? null;
      let returnPct: number | null = h.return_pct ?? null;

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

      return {
        ...h,
        purchase_price: buyPrice,
        total_cost: totalCost !== null ? Math.round(totalCost * 100) / 100 : null,
        market_value: marketValue !== null ? Math.round(marketValue * 100) / 100 : null,
        gain_loss: gainLoss !== null ? Math.round(gainLoss * 100) / 100 : null,
        return_pct: returnPct !== null ? Math.round(returnPct * 100) / 100 : null,
      };
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.ticker?.toLowerCase().includes(q) ||
          h.isin?.toLowerCase().includes(q)
      );
    }

    if (sectorFilter !== 'ALL') {
      list = list.filter((h) => h.sector === sectorFilter);
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === null || valA === undefined) valA = sortAsc ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortAsc ? Infinity : -Infinity;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [summary, searchTerm, sectorFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvRawText(content);
    };
    reader.readAsText(file);
  };

  const handleStartCsvPreview = () => {
    if (!csvRawText.trim()) return;
    previewCsvMutation.mutate(csvRawText);
  };

  if (isPortfolioLoading || isSummaryLoading) {
    return <Spinner size="xl" label="Lade Depot-Details..." className="py-24" />;
  }

  if (isPortfolioError || !portfolio) {
    return (
      <div className="space-y-4 py-8">
        <Alert variant="error" title="Depot nicht gefunden">
          Das angeforderte Depot existiert nicht oder konnte nicht geladen werden.
        </Alert>
        <Link to="/portfolios">
          <Button variant="outline">Zurück zur Depotübersicht</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/portfolios"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Zurück zur Übersicht</span>
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {portfolio.name}
            </h2>
            <Badge variant="outline">{portfolio.currency}</Badge>
          </div>
          {portfolio.description && (
            <p className="text-xs text-muted-foreground">{portfolio.description}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCsvStep(1);
              setCsvRawText('');
              setCsvFileName('');
              setCsvPreview(null);
              setCsvResult(null);
              setIsCsvModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-4 w-4" />
            <span>CSV-Import</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddHoldingOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Position hinzufügen</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddTxOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Transaktion erfassen</span>
          </Button>

          <Link to={`/analysis?portfolioId=${portfolio.id}`}>
            <Button variant="primary" size="sm" className="gap-1.5 text-xs">
              <LineChart className="h-4 w-4" />
              <span>Depotanalyse starten</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Market Value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Aktueller Marktwert
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {summary?.total_value !== null && summary?.total_value !== undefined
                ? formatCurrency(summary.total_value, portfolio.currency)
                : 'Keine Daten verfügbar'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Einstand:{' '}
              {summary?.total_cost !== null && summary?.total_cost !== undefined
                ? formatCurrency(summary.total_cost, portfolio.currency)
                : '—'}
            </p>
          </CardContent>
        </Card>

        {/* Total Gain / Loss */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gewinn / Verlust
            </CardTitle>
            {summary?.total_gain_loss !== null && (summary?.total_gain_loss ?? 0) >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-extrabold tracking-tight ${
                summary?.total_gain_loss === null || summary?.total_gain_loss === undefined
                  ? 'text-foreground'
                  : summary.total_gain_loss >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary?.total_gain_loss !== null && summary?.total_gain_loss !== undefined
                ? `${summary.total_gain_loss >= 0 ? '+' : ''}${formatCurrency(
                    summary.total_gain_loss,
                    portfolio.currency
                  )}`
                : 'Nicht berechenbar'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.total_return_pct !== null && summary?.total_return_pct !== undefined ? (
                <span
                  className={
                    summary.total_return_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }
                >
                  {formatPercent(summary.total_return_pct)} Rendite
                </span>
              ) : (
                'Aktuelle Kurse erforderlich'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Positions Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Positionen
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {portfolio.holdings?.length || 0}
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {portfolio.holdings?.length || 0}{' '}
              <span className="text-sm font-normal text-muted-foreground">Aktien</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {availableSectors.length} verschiedene Branchen
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Historie
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">
              {portfolio.transactions?.length || 0}{' '}
              <span className="text-sm font-normal text-muted-foreground">Buchungen</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Letzte Aktualisierung:{' '}
              {portfolio.updated_at
                ? new Date(portfolio.updated_at).toLocaleDateString('de-DE')
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'positions', label: 'Depotpositionen', badge: portfolio.holdings?.length || 0 },
          { id: 'transactions', label: 'Transaktionshistorie', badge: portfolio.transactions?.length || 0 },
          { id: 'analytics', label: 'Verteilungen & Risiko' },
        ]}
        activeTab={activeTab}
        onChange={(tab: any) => setActiveTab(tab)}
      />

      {/* Tab 1: Positions */}
      {activeTab === 'positions' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Positionen im Depot</CardTitle>
              <CardDescription>
                Sortierbare und filterbare Übersicht aller gehaltenen Wertpapiere
              </CardDescription>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Input
                placeholder="Name, WKN, ISIN suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 sm:w-60 h-8 text-xs"
              />

              {availableSectors.length > 0 && (
                <Select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="w-36 h-8 text-xs"
                >
                  <option value="ALL">Alle Branchen</option>
                  {availableSectors.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {displayedHoldings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Wertpapier</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort('shares')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Stück</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort('purchase_price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Kaufpreis (Purchase Price)</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort('total_cost')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Einstandswert</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort('current_price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Aktueller Kurs (Current Price)</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort('market_value')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Marktwert</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort('gain_loss')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Gewinn / Verlust (G/V)</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('sector')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Branche</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedHoldings.map((h) => (
                    <TableRow key={h.holding_id || h.stock_id}>
                      <TableCell>
                        <Link
                          to={`/analysis?stockId=${h.stock_id}`}
                          className="hover:underline flex flex-col font-medium"
                        >
                          <span className="font-semibold text-foreground">{h.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {h.ticker || h.isin || '—'}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(h.shares, 2)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {(h.purchase_price ?? h.average_buy_price) !== null && (h.purchase_price ?? h.average_buy_price) !== undefined
                          ? formatCurrency(h.purchase_price ?? h.average_buy_price, h.currency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {h.total_cost !== null
                          ? formatCurrency(h.total_cost, h.currency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs">
                        {h.current_price !== null
                          ? formatCurrency(h.current_price, h.currency)
                          : <span className="text-muted-foreground font-normal">Keine Daten</span>}
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs">
                        {h.market_value !== null
                          ? formatCurrency(h.market_value, h.currency)
                          : formatCurrency(h.total_cost, h.currency)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        {h.gain_loss !== null && h.gain_loss !== undefined ? (
                          <div className={`flex flex-col items-end ${h.gain_loss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <span>
                              {h.gain_loss >= 0 ? '+' : ''}
                              {formatCurrency(h.gain_loss, h.currency)}
                            </span>
                            <span className="text-[11px] font-medium opacity-90">
                              {h.return_pct !== null && h.return_pct !== undefined
                                ? formatPercent(h.return_pct)
                                : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="font-normal text-[11px]">
                          {h.sector || 'Unklassifiziert'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/analysis?stockId=${h.stock_id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Aktienanalyse öffnen">
                              <LineChart className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </Link>
                          {h.holding_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                              title="Position entfernen"
                              onClick={() => deleteHoldingMutation.mutate(h.holding_id!)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={FileSpreadsheet}
                title="Keine Positionen gefunden"
                description={
                  searchTerm
                    ? 'Keine Positionen stimmen mit Ihrem Suchbegriff überein.'
                    : 'Dieses Depot enthält derzeit noch keine Wertpapiere.'
                }
                actionLabel="Position manuell hinzufügen"
                onAction={() => setIsAddHoldingOpen(true)}
                secondaryActionLabel="CSV importieren"
                onSecondaryAction={() => {
                  setCsvStep(1);
                  setIsCsvModalOpen(true);
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Transactions */}
      {activeTab === 'transactions' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Transaktionshistorie</CardTitle>
              <CardDescription>
                Chronologische Erfassung aller Käufe, Verkäufe und Buchungen
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddTxOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Transaktion buchen</span>
            </Button>
          </CardHeader>
          <CardContent>
            {portfolio.transactions && portfolio.transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Wertpapier</TableHead>
                    <TableHead className="text-right">Stück</TableHead>
                    <TableHead className="text-right">Kurs</TableHead>
                    <TableHead className="text-right">Gesamtbetrag</TableHead>
                    <TableHead className="text-right">Gebühren</TableHead>
                    <TableHead>Notizen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {tx.transaction_date
                          ? new Date(tx.transaction_date).toLocaleDateString('de-DE')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.transaction_type === 'BUY'
                              ? 'success'
                              : tx.transaction_type === 'SELL'
                              ? 'danger'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {tx.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {tx.stock?.name || `Wertpapier #${tx.stock_id}`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {tx.shares !== null ? formatNumber(tx.shares, 2) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {tx.price_per_share !== null
                          ? formatCurrency(tx.price_per_share, tx.currency || portfolio.currency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs">
                        {formatCurrency(tx.total_amount, tx.currency || portfolio.currency)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {tx.fees > 0
                          ? formatCurrency(tx.fees, tx.currency || portfolio.currency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {tx.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={FileText}
                title="Keine Transaktionen erfasst"
                description="Buchen Sie Transaktionen manuell oder importieren Sie diese über den CSV-Import."
                actionLabel="Transaktion erfassen"
                onAction={() => setIsAddTxOpen(true)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Analytics & Risks */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Branchenaufteilung</CardTitle>
              <CardDescription>Depotstruktur nach Sektoren</CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.sector_allocation && Object.keys(summary.sector_allocation).length > 0 ? (
                <AllocationPieChart data={summary.sector_allocation} height={260} />
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Keine Branchen vorhanden.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Währungsaufteilung</CardTitle>
              <CardDescription>Struktur nach Währungsräumen</CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.currency_allocation && Object.keys(summary.currency_allocation).length > 0 ? (
                <AllocationPieChart data={summary.currency_allocation} height={260} />
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Keine Währungen vorhanden.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Add Holding Manually */}
      <Modal
        isOpen={isAddHoldingOpen}
        onClose={() => setIsAddHoldingOpen(false)}
        title="Position manuell hinzufügen"
        description="Fügen Sie eine Aktie und den aktuellen Bestand zum Depot hinzu."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addHoldingMutation.mutate({
              ticker: holdingTicker.trim() || undefined,
              name: holdingName.trim() || undefined,
              shares: parseFloat(holdingShares),
              average_buy_price: holdingBuyPrice ? parseFloat(holdingBuyPrice) : undefined,
              purchase_price: holdingBuyPrice ? parseFloat(holdingBuyPrice) : undefined,
              current_price: holdingCurrentPrice ? parseFloat(holdingCurrentPrice) : undefined,
              currency: portfolio.currency,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ticker / WKN / ISIN *"
              placeholder="z. B. AAPL, US0378331005"
              value={holdingTicker}
              onChange={(e) => setHoldingTicker(e.target.value)}
              required
            />
            <Input
              label="Name (optional)"
              placeholder="z. B. Apple Inc."
              value={holdingName}
              onChange={(e) => setHoldingName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Stückzahl *"
              type="number"
              step="any"
              placeholder="z. B. 10.5"
              value={holdingShares}
              onChange={(e) => setHoldingShares(e.target.value)}
              required
            />
            <Input
              label={`Kaufpreis (Purchase Price) je Aktie (${portfolio.currency})`}
              type="number"
              step="any"
              placeholder="z. B. 150.00"
              value={holdingBuyPrice}
              onChange={(e) => setHoldingBuyPrice(e.target.value)}
            />
            <Input
              label={`Aktueller Kurs (Current Price) je Aktie (${portfolio.currency})`}
              type="number"
              step="any"
              placeholder="z. B. 180.00"
              value={holdingCurrentPrice}
              onChange={(e) => setHoldingCurrentPrice(e.target.value)}
            />
          </div>

          {addHoldingMutation.isError && (
            <Alert variant="error">
              {addHoldingMutation.error instanceof Error
                ? addHoldingMutation.error.message
                : 'Fehler beim Hinzufügen der Position.'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsAddHoldingOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={addHoldingMutation.isPending}
              disabled={!holdingShares}
            >
              Position speichern
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Transaction Manually */}
      <Modal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        title="Transaktion buchen"
        description="Erfassen Sie einen Kauf, Verkauf oder eine Dividende."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!txStockId) return;
            addTxMutation.mutate({
              stock_id: Number(txStockId),
              transaction_type: txType,
              shares: txShares ? parseFloat(txShares) : undefined,
              price_per_share: txPrice ? parseFloat(txPrice) : undefined,
              total_amount: parseFloat(txTotal),
              fees: txFees ? parseFloat(txFees) : 0,
              currency: portfolio.currency,
              notes: txNotes.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Wertpapier *"
              value={txStockId}
              onChange={(e) => setTxStockId(Number(e.target.value))}
              required
            >
              <option value="">Wertpapier auswählen...</option>
              {portfolio.holdings?.map((h) => (
                <option key={h.stock_id} value={h.stock_id}>
                  {h.stock?.name || h.stock?.ticker || `ID ${h.stock_id}`}
                </option>
              ))}
            </Select>

            <Select label="Typ *" value={txType} onChange={(e) => setTxType(e.target.value)}>
              <option value="BUY">Kauf (BUY)</option>
              <option value="SELL">Verkauf (SELL)</option>
              <option value="DIVIDEND">Dividende</option>
              <option value="FEE">Gebühr / Kosten</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Stückzahl"
              type="number"
              step="any"
              placeholder="z. B. 5"
              value={txShares}
              onChange={(e) => {
                setTxShares(e.target.value);
                if (e.target.value && txPrice) {
                  setTxTotal((parseFloat(e.target.value) * parseFloat(txPrice)).toFixed(2));
                }
              }}
            />
            <Input
              label={`Ausführungskurs (${portfolio.currency})`}
              type="number"
              step="any"
              placeholder="z. B. 120.50"
              value={txPrice}
              onChange={(e) => {
                setTxPrice(e.target.value);
                if (txShares && e.target.value) {
                  setTxTotal((parseFloat(txShares) * parseFloat(e.target.value)).toFixed(2));
                }
              }}
            />
            <Input
              label={`Gesamtbetrag (${portfolio.currency}) *`}
              type="number"
              step="any"
              placeholder="z. B. 602.50"
              value={txTotal}
              onChange={(e) => setTxTotal(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Ordergebühren (${portfolio.currency})`}
              type="number"
              step="any"
              placeholder="0.00"
              value={txFees}
              onChange={(e) => setTxFees(e.target.value)}
            />
            <Input
              label="Notiz / Verwendungszweck"
              placeholder="z. B. Sparplan August"
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
            />
          </div>

          {addTxMutation.isError && (
            <Alert variant="error">
              {addTxMutation.error instanceof Error
                ? addTxMutation.error.message
                : 'Fehler beim Buchen der Transaktion.'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsAddTxOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={addTxMutation.isPending}
              disabled={!txStockId || !txTotal}
            >
              Transaktion buchen
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: 5-Stage CSV Import */}
      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Depotauszug importieren (CSV)"
        description={`Schritt ${csvStep} von 5: ${
          csvStep === 1
            ? 'CSV-Datei oder Text auswählen'
            : csvStep === 2
            ? 'Spaltenzuordnung und Datenprüfung'
            : csvStep === 3
            ? 'Validierung & Duplikate'
            : csvStep === 4
            ? 'Import bestätigen'
            : 'Importbericht'
        }`}
        maxWidth="3xl"
      >
        <div className="space-y-4">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground border-b pb-3">
            <span className={csvStep >= 1 ? 'text-primary font-bold' : ''}>1. Datei</span>
            <span>→</span>
            <span className={csvStep >= 2 ? 'text-primary font-bold' : ''}>2. Erkennung</span>
            <span>→</span>
            <span className={csvStep >= 3 ? 'text-primary font-bold' : ''}>3. Validierung</span>
            <span>→</span>
            <span className={csvStep >= 4 ? 'text-primary font-bold' : ''}>4. Bestätigung</span>
            <span>→</span>
            <span className={csvStep >= 5 ? 'text-emerald-500 font-bold' : ''}>5. Bericht</span>
          </div>

          {/* Stage 1: File selection or pasting */}
          {csvStep === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 transition-colors">
                <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">
                  CSV-Datei auswählen oder hierher ziehen
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Unterstützt Standardformate (ISIN, WKN, Ticker, Shares, Purchase Price, Current Price) mit Komma oder Semikolon.
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="mt-4 inline-block">
                  <Button variant="outline" size="sm" type="button" onClick={() => document.getElementById('csv-file-input')?.click()}>
                    Datei auswählen
                  </Button>
                </label>
                {csvFileName && (
                  <p className="text-xs font-medium text-emerald-500 mt-2">
                    Ausgewählt: {csvFileName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Oder CSV-Inhalt direkt einfügen:
                </label>
                <textarea
                  className="w-full h-32 p-3 font-mono text-xs rounded-md border border-input bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="ISIN,Name,Shares,Purchase Price,Current Price,Currency&#10;US0378331005,Apple Inc.,10,150.00,180.50,EUR"
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsCsvModalOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  variant="primary"
                  onClick={handleStartCsvPreview}
                  disabled={!csvRawText.trim()}
                  isLoading={previewCsvMutation.isPending}
                >
                  Weiter: Daten prüfen
                </Button>
              </div>
            </div>
          )}

          {/* Stage 2 & 3: Column Mapping & Validation Errors */}
          {(csvStep === 2 || csvStep === 3) && csvPreview && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block">Erkannter Typ:</span>
                  <span className="font-bold uppercase text-foreground">{csvPreview.import_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Gültige Zeilen:</span>
                  <span className="font-bold text-emerald-500">{csvPreview.valid_rows_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Fehlerhafte Zeilen:</span>
                  <span className="font-bold text-rose-500">{csvPreview.invalid_rows_count}</span>
                </div>
              </div>

              {csvPreview.errors.length > 0 && (
                <Alert variant="error" title="Gefundene Formatfehler">
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    {csvPreview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {/* Preview Rows Table */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground border-b">
                    {csvPreview.import_type === 'holdings' ? (
                      <tr>
                        <th className="p-2 text-left">Zeile</th>
                        <th className="p-2 text-left">ISIN / Ticker</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-right">Stück</th>
                        <th className="p-2 text-right">Kaufpreis (Purchase Price)</th>
                        <th className="p-2 text-right">Aktueller Kurs (Current Price)</th>
                        <th className="p-2 text-right">Gewinn / Verlust (G/V)</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="p-2 text-left">Zeile</th>
                        <th className="p-2 text-left">ISIN / Ticker</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Typ</th>
                        <th className="p-2 text-right">Stück</th>
                        <th className="p-2 text-right">Kurs / Betrag</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-border">
                    {csvPreview.preview_items.slice(0, 15).map((row) => (
                      <tr key={row.row_number} className={row.is_valid ? '' : 'bg-rose-500/10'}>
                        <td className="p-2 font-mono">{row.row_number}</td>
                        <td className="p-2 font-mono font-medium">{row.isin || row.ticker || row.wkn || '—'}</td>
                        <td className="p-2 truncate max-w-xs">{row.name || '—'}</td>
                        {csvPreview.import_type === 'holdings' ? (
                          <>
                            <td className="p-2 text-right font-mono">{row.shares ?? '—'}</td>
                            <td className="p-2 text-right font-mono">
                              {row.purchase_price ?? row.average_buy_price ?? row.price ?? '—'}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {row.current_price ?? '—'}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {(() => {
                                const buyPrice = row.purchase_price ?? row.average_buy_price ?? row.price;
                                const curPrice = row.current_price;
                                const shares = row.shares || 1;
                                if (buyPrice !== null && buyPrice !== undefined && curPrice !== null && curPrice !== undefined) {
                                  const glAbs = (curPrice - buyPrice) * shares;
                                  const glPct = buyPrice > 0 ? ((curPrice - buyPrice) / buyPrice) * 100 : null;
                                  return (
                                    <span className={glAbs >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                                      {glAbs >= 0 ? '+' : ''}{formatCurrency(glAbs, row.currency || portfolio.currency)}
                                      {glPct !== null && ` (${formatPercent(glPct)})`}
                                    </span>
                                  );
                                }
                                return <span className="text-muted-foreground">—</span>;
                              })()}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2 font-medium">{row.transaction_type || 'BUY'}</td>
                            <td className="p-2 text-right font-mono">{row.shares ?? '—'}</td>
                            <td className="p-2 text-right font-mono">
                              {row.price_per_share ?? row.average_buy_price ?? row.total_amount ?? '—'}
                            </td>
                          </>
                        )}
                        <td className="p-2 text-center">
                          {row.is_valid ? (
                            <Badge variant="success" className="text-[10px]">Gültig</Badge>
                          ) : (
                            <span className="text-rose-500 font-semibold text-[10px]">
                              {row.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" onClick={() => setCsvStep(1)}>
                  Zurück
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCsvStep(4)}
                  disabled={csvPreview.valid_rows_count === 0}
                >
                  Weiter zur Bestätigung ({csvPreview.valid_rows_count} Zeilen)
                </Button>
              </div>
            </div>
          )}

          {/* Stage 4: Explicit Confirmation */}
          {csvStep === 4 && csvPreview && (
            <div className="space-y-4 py-2">
              <Alert variant="warning" title="Import wirklich ausführen?">
                Es werden jetzt <strong>{csvPreview.valid_rows_count}</strong> Datensätze verbindlich in das Depot{' '}
                <strong>{portfolio.name}</strong> übernommen. Ungültige Zeilen werden übersprungen.
              </Alert>

              <div className="p-4 rounded-lg bg-card border space-y-2 text-xs">
                <p>
                  <strong>Depot:</strong> {portfolio.name} ({portfolio.currency})
                </p>
                <p>
                  <strong>Import-Modus:</strong> {csvPreview.import_type === 'holdings' ? 'Bestandspositionen' : 'Transaktionen'}
                </p>
                <p>
                  <strong>Zeilen:</strong> {csvPreview.valid_rows_count} von {csvPreview.total_rows} gültig
                </p>
              </div>

              <div className="flex justify-between items-center pt-3">
                <Button variant="outline" onClick={() => setCsvStep(2)}>
                  Zurück zur Prüfung
                </Button>
                <Button
                  variant="primary"
                  isLoading={executeCsvMutation.isPending}
                  onClick={() => executeCsvMutation.mutate(csvRawText)}
                >
                  Bestätigen & Jetzt importieren
                </Button>
              </div>
            </div>
          )}

          {/* Stage 5: Final Import Report */}
          {csvStep === 5 && csvResult && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center text-center p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <h3 className="text-base font-bold text-foreground">Import erfolgreich abgeschlossen</h3>
                <p className="text-xs text-muted-foreground">
                  {csvResult.imported_count} Zeilen wurden erfolgreich in das Depot übertragen.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block">Importiert:</span>
                  <span className="font-bold text-emerald-500 text-sm">{csvResult.imported_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Übersprungen:</span>
                  <span className="font-bold text-amber-500 text-sm">{csvResult.skipped_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Gesamtzeilen:</span>
                  <span className="font-bold text-foreground text-sm">{csvResult.total_rows}</span>
                </div>
              </div>

              {csvResult.row_errors && csvResult.row_errors.length > 0 && (
                <Alert variant="warning" title="Übersprungene Zeilen mit Fehlern">
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    {csvResult.row_errors.map((err, i) => (
                      <li key={i}>
                        Zeile {err.row}: {err.errors.join(', ')}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="flex justify-end pt-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsCsvModalOpen(false);
                    refetchSummary();
                  }}
                >
                  Fertig
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
