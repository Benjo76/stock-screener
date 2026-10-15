import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Edit3,
  ExternalLink,
  FolderPlus,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { stocksApi } from '../api/stocks';
import { portfoliosApi } from '../api/portfolios';
import { Stock, StockResolveResult } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';

export const StocksPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Resolution state for Add Modal
  const [queryInput, setQueryInput] = useState('');
  const [resolvedPreview, setResolvedPreview] = useState<StockResolveResult | null>(null);
  const [manualForm, setManualForm] = useState({
    name: '',
    ticker: '',
    isin: '',
    wkn: '',
    exchange: '',
    currency: 'EUR',
    sector: '',
    industry: '',
    country: '',
  });

  // Assign to Depot state
  const [targetPortfolioId, setTargetPortfolioId] = useState<number | ''>('');
  const [assignShares, setAssignShares] = useState('10');
  const [assignPrice, setAssignPrice] = useState('');
  const [assignCurrentPrice, setAssignCurrentPrice] = useState('');

  // Queries
  const {
    data: stocks,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['stocks', searchTerm],
    queryFn: () => stocksApi.list({ query: searchTerm.trim() || undefined }),
  });

  const { data: portfolios } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfoliosApi.list,
  });

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: stocksApi.resolve,
    onSuccess: (data) => {
      setResolvedPreview(data);
      setManualForm({
        name: data.name || '',
        ticker: data.ticker || '',
        isin: data.isin || '',
        wkn: data.wkn || '',
        exchange: data.exchange || '',
        currency: data.currency || 'EUR',
        sector: data.sector || '',
        industry: data.industry || '',
        country: data.country || '',
      });
    },
  });

  const createStockMutation = useMutation({
    mutationFn: stocksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsAddModalOpen(false);
      resetAddForm();
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ stockId, data }: { stockId: number; data: any }) =>
      stocksApi.update(stockId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      setIsEditModalOpen(false);
    },
  });

  const deleteStockMutation = useMutation({
    mutationFn: stocksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setDeleteId(null);
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: stocksApi.syncAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) =>
      portfoliosApi.addHolding(Number(targetPortfolioId), {
        stock_id: selectedStock?.id,
        shares: parseFloat(assignShares),
        average_buy_price: assignPrice ? parseFloat(assignPrice) : undefined,
        purchase_price: assignPrice ? parseFloat(assignPrice) : undefined,
        current_price: assignCurrentPrice ? parseFloat(assignCurrentPrice) : undefined,
        currency: selectedStock?.currency || 'EUR',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['portfolioSummary', Number(targetPortfolioId)] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsAssignModalOpen(false);
      setTargetPortfolioId('');
      setAssignShares('10');
      setAssignPrice('');
      setAssignCurrentPrice('');
    },
  });

  const resetAddForm = () => {
    setQueryInput('');
    setResolvedPreview(null);
    setManualForm({
      name: '',
      ticker: '',
      isin: '',
      wkn: '',
      exchange: '',
      currency: 'EUR',
      sector: '',
      industry: '',
      country: '',
    });
  };

  const handleOpenEdit = (stock: Stock) => {
    setSelectedStock(stock);
    setManualForm({
      name: stock.name || '',
      ticker: stock.ticker || '',
      isin: stock.isin || '',
      wkn: stock.wkn || '',
      exchange: stock.exchange || '',
      currency: stock.currency || 'EUR',
      sector: stock.sector || '',
      industry: stock.industry || '',
      country: stock.country || '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAssign = (stock: Stock) => {
    setSelectedStock(stock);
    setTargetPortfolioId(portfolios && portfolios.length > 0 ? portfolios[0].id : '');
    setIsAssignModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Wertpapierverwaltung
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suche, Stammdatenpflege und Kennzahlen-Synchronisation für Aktien.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncAllMutation.mutate()}
            isLoading={syncAllMutation.isPending}
            className="gap-1.5 text-xs"
            title="Marktdaten für alle Aktien synchronisieren"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Alle synchronisieren</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetAddForm();
              setIsAddModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Wertpapier anlegen</span>
          </Button>
        </div>
      </div>

      {/* Search & Stats Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Aktie nach Name, Ticker, WKN oder ISIN suchen..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="text-xs text-muted-foreground self-end sm:self-center">
              Gesamtbestand:{' '}
              <span className="font-semibold text-foreground">{stocks?.length || 0}</span>{' '}
              Wertpapiere
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stocks Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Erfasste Wertpapiere</CardTitle>
          <CardDescription>
            Klicken Sie auf ein Wertpapier für die Detail- und Fundamentalanalyse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner size="lg" label="Lade Wertpapiere..." className="py-16" />
          ) : isError ? (
            <Alert variant="error" title="Fehler beim Laden">
              {error instanceof Error ? error.message : 'Konnte Wertpapiere nicht abrufen.'}
            </Alert>
          ) : stocks && stocks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wertpapier</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>ISIN / WKN</TableHead>
                  <TableHead>Börse / Währung</TableHead>
                  <TableHead>Branche / Sektor</TableHead>
                  <TableHead>Land</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell>
                      <Link
                        to={`/analysis?stockId=${stock.id}`}
                        className="hover:underline flex flex-col font-medium"
                      >
                        <span className="font-semibold text-foreground text-sm">
                          {stock.name || 'Unbenannt'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">ID #{stock.id}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-xs text-primary">
                      {stock.ticker || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div>{stock.isin || '—'}</div>
                      {stock.wkn && <div className="text-[10px]">WKN: {stock.wkn}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{stock.exchange || '—'}</div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {stock.currency || 'EUR'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{stock.sector || '—'}</div>
                      {stock.industry && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {stock.industry}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{stock.country || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/analysis?stockId=${stock.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Aktienanalyse öffnen">
                            <LineChart className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        </Link>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          title="Einem Depot zuordnen"
                          onClick={() => handleOpenAssign(stock)}
                        >
                          <FolderPlus className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          title="Stammdaten bearbeiten"
                          onClick={() => handleOpenEdit(stock)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                          title="Löschen"
                          onClick={() => setDeleteId(stock.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Keine Wertpapiere gefunden"
              description={
                searchTerm
                  ? 'Kein Wertpapier entspricht Ihrem Suchbegriff.'
                  : 'Fügen Sie Aktien über die automatische Auflösung oder manuell hinzu.'
              }
              actionLabel="Wertpapier anlegen"
              onAction={() => {
                resetAddForm();
                setIsAddModalOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal: Add Stock with Identifier Resolution */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Wertpapier hinzufügen"
        description="Geben Sie eine ISIN, WKN oder ein Ticker-Symbol ein, um Stammdaten automatisch abzurufen, oder erfassen Sie die Daten manuell."
        maxWidth="2xl"
      >
        <div className="space-y-5">
          {/* Lookup Input */}
          <div className="flex gap-2">
            <Input
              placeholder="ISIN, WKN oder Ticker (z. B. US0378331005, AAPL, 865985)..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (queryInput.trim()) resolveMutation.mutate(queryInput.trim());
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              isLoading={resolveMutation.isPending}
              disabled={!queryInput.trim()}
              onClick={() => queryInput.trim() && resolveMutation.mutate(queryInput.trim())}
              className="gap-1.5 shrink-0"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Auflösen</span>
            </Button>
          </div>

          {/* Resolution Result Alert */}
          {resolvedPreview && (
            <Alert
              variant={resolvedPreview.resolved ? 'success' : 'info'}
              title={
                resolvedPreview.resolved
                  ? `Erfolgreich aufgelöst (${resolvedPreview.provider})`
                  : 'Manuelle Erfassung'
              }
            >
              {resolvedPreview.message ||
                (resolvedPreview.resolved
                  ? 'Stammdaten wurden übernommen. Bitte prüfen und speichern.'
                  : 'Bitte ergänzen Sie die Stammdaten manuell.')}
            </Alert>
          )}

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createStockMutation.mutate({
                name: manualForm.name.trim() || undefined,
                ticker: manualForm.ticker.trim() || undefined,
                isin: manualForm.isin.trim() || undefined,
                wkn: manualForm.wkn.trim() || undefined,
                exchange: manualForm.exchange.trim() || undefined,
                currency: manualForm.currency,
              });
            }}
            className="space-y-4 pt-2 border-t"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Unternehmensname *"
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                placeholder="z. B. Apple Inc."
                required
              />
              <Input
                label="Ticker-Symbol *"
                value={manualForm.ticker}
                onChange={(e) => setManualForm({ ...manualForm, ticker: e.target.value })}
                placeholder="z. B. AAPL"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="ISIN"
                value={manualForm.isin}
                onChange={(e) => setManualForm({ ...manualForm, isin: e.target.value })}
                placeholder="z. B. US0378331005"
              />
              <Input
                label="WKN"
                value={manualForm.wkn}
                onChange={(e) => setManualForm({ ...manualForm, wkn: e.target.value })}
                placeholder="z. B. 865985"
              />
              <Input
                label="Börsenplatz"
                value={manualForm.exchange}
                onChange={(e) => setManualForm({ ...manualForm, exchange: e.target.value })}
                placeholder="z. B. NASDAQ, XETRA"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Währung"
                value={manualForm.currency}
                onChange={(e) => setManualForm({ ...manualForm, currency: e.target.value })}
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="CHF">CHF (Fr.)</option>
                <option value="GBP">GBP (£)</option>
              </Select>
              <Input
                label="Sektor / Branche"
                value={manualForm.sector}
                onChange={(e) => setManualForm({ ...manualForm, sector: e.target.value })}
                placeholder="z. B. Technology"
              />
              <Input
                label="Land"
                value={manualForm.country}
                onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })}
                placeholder="z. B. United States"
              />
            </div>

            {createStockMutation.isError && (
              <Alert variant="error">
                {createStockMutation.error instanceof Error
                  ? createStockMutation.error.message
                  : 'Fehler beim Anlegen des Wertpapiers.'}
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createStockMutation.isPending}
                disabled={!manualForm.name && !manualForm.ticker && !manualForm.isin}
              >
                Wertpapier speichern
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Edit Master Data */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Stammdaten bearbeiten"
        description={selectedStock?.name || 'Wertpapier anpassen'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedStock) return;
            updateStockMutation.mutate({
              stockId: selectedStock.id,
              data: {
                name: manualForm.name.trim() || undefined,
                ticker: manualForm.ticker.trim() || undefined,
                isin: manualForm.isin.trim() || undefined,
                wkn: manualForm.wkn.trim() || undefined,
                exchange: manualForm.exchange.trim() || undefined,
                currency: manualForm.currency,
                sector: manualForm.sector.trim() || undefined,
                industry: manualForm.industry.trim() || undefined,
                country: manualForm.country.trim() || undefined,
              },
            });
          }}
          className="space-y-4"
        >
          <Input
            label="Unternehmensname"
            value={manualForm.name}
            onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ticker"
              value={manualForm.ticker}
              onChange={(e) => setManualForm({ ...manualForm, ticker: e.target.value })}
            />
            <Input
              label="ISIN"
              value={manualForm.isin}
              onChange={(e) => setManualForm({ ...manualForm, isin: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="WKN"
              value={manualForm.wkn}
              onChange={(e) => setManualForm({ ...manualForm, wkn: e.target.value })}
            />
            <Input
              label="Börsenplatz"
              value={manualForm.exchange}
              onChange={(e) => setManualForm({ ...manualForm, exchange: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sektor"
              value={manualForm.sector}
              onChange={(e) => setManualForm({ ...manualForm, sector: e.target.value })}
            />
            <Input
              label="Land"
              value={manualForm.country}
              onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })}
            />
          </div>

          {updateStockMutation.isError && (
            <Alert variant="error">
              {updateStockMutation.error instanceof Error
                ? updateStockMutation.error.message
                : 'Fehler beim Aktualisieren der Stammdaten.'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" isLoading={updateStockMutation.isPending}>
              Änderungen speichern
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Stock to Portfolio */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Wertpapier einem Depot zuordnen"
        description={`${selectedStock?.name || 'Aktie'} zu einem bestehenden Portfolio hinzufügen.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!targetPortfolioId || !selectedStock) return;
            assignMutation.mutate({});
          }}
          className="space-y-4"
        >
          <Select
            label="Ziel-Depot *"
            value={targetPortfolioId}
            onChange={(e) => setTargetPortfolioId(Number(e.target.value))}
            required
          >
            <option value="">Depot auswählen...</option>
            {portfolios?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currency})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Stückzahl *"
              type="number"
              step="any"
              value={assignShares}
              onChange={(e) => setAssignShares(e.target.value)}
              required
            />
            <Input
              label={`Kaufpreis (Purchase Price) je Aktie (${selectedStock?.currency || 'EUR'})`}
              type="number"
              step="any"
              placeholder="z. B. 150.00"
              value={assignPrice}
              onChange={(e) => setAssignPrice(e.target.value)}
            />
            <Input
              label={`Aktueller Kurs (Current Price) je Aktie (${selectedStock?.currency || 'EUR'})`}
              type="number"
              step="any"
              placeholder="z. B. 180.00"
              value={assignCurrentPrice}
              onChange={(e) => setAssignCurrentPrice(e.target.value)}
            />
          </div>

          {assignMutation.isError && (
            <Alert variant="error">
              {assignMutation.error instanceof Error
                ? assignMutation.error.message
                : 'Fehler bei der Zuordnung zum Depot.'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={assignMutation.isPending}
              disabled={!targetPortfolioId || !assignShares}
            >
              Zum Depot hinzufügen
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Wertpapier löschen?"
        description="Möchten Sie dieses Wertpapier und alle zugehörigen Kurse, Fundamentaldaten und Berichte wirklich löschen?"
      >
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setDeleteId(null)}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            isLoading={deleteStockMutation.isPending}
            onClick={() => deleteId && deleteStockMutation.mutate(deleteId)}
          >
            Ja, löschen
          </Button>
        </div>
      </Modal>
    </div>
  );
};
