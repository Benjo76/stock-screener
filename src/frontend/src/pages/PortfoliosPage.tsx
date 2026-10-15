import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FolderPlus,
  PieChart,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { portfoliosApi } from '../api/portfolios';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { CsvImportPreview, CsvImportResult } from '../types';

export const PortfoliosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { formatCurrency, formatPercent } = useSettings();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCurrency, setNewCurrency] = useState('EUR');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // CSV Import State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvTargetPortfolioId, setCsvTargetPortfolioId] = useState<number | 'NEW'>('NEW');
  const [csvNewName, setCsvNewName] = useState('Mein Depot');
  const [csvNewCurrency, setCsvNewCurrency] = useState('EUR');
  const [csvStep, setCsvStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvForcedType, setCsvForcedType] = useState<'holdings' | 'transactions' | undefined>(undefined);
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);
  const [csvActivePortfolioId, setCsvActivePortfolioId] = useState<number | null>(null);

  const {
    data: portfolios,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfoliosApi.list,
  });

  const createMutation = useMutation({
    mutationFn: portfoliosApi.create,
    onSuccess: (newPortfolio) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsCreateModalOpen(false);
      setNewName('');
      setNewDesc('');
      setNewCurrency('EUR');
      return newPortfolio;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: portfoliosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setDeleteId(null);
    },
  });

  const previewCsvMutation = useMutation({
    mutationFn: async ({ portfolioId, content }: { portfolioId: number; content: string }) => {
      return portfoliosApi.previewCsv(portfolioId, content, csvForcedType);
    },
    onSuccess: (data) => {
      setCsvPreview(data);
      setCsvStep(2);
    },
  });

  const executeCsvMutation = useMutation({
    mutationFn: async ({ portfolioId, content }: { portfolioId: number; content: string }) => {
      return portfoliosApi.executeCsv(portfolioId, content, csvForcedType);
    },
    onSuccess: (data) => {
      setCsvResult(data);
      setCsvStep(5);
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      currency: newCurrency,
    });
  };

  const handleOpenCsvModal = (targetId?: number | 'NEW') => {
    if (targetId) {
      setCsvTargetPortfolioId(targetId);
      if (typeof targetId === 'number') {
        setCsvActivePortfolioId(targetId);
      } else {
        setCsvActivePortfolioId(null);
      }
    } else if (portfolios && portfolios.length > 0) {
      setCsvTargetPortfolioId(portfolios[0].id);
      setCsvActivePortfolioId(portfolios[0].id);
    } else {
      setCsvTargetPortfolioId('NEW');
      setCsvActivePortfolioId(null);
    }
    setCsvStep(1);
    setCsvRawText('');
    setCsvFileName('');
    setCsvPreview(null);
    setCsvResult(null);
    setIsCsvModalOpen(true);
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

  const handleStartCsvPreview = async () => {
    if (!csvRawText.trim()) return;
    let targetPid = csvActivePortfolioId;

    if (!targetPid || csvTargetPortfolioId === 'NEW') {
      try {
        const created = await portfoliosApi.create({
          name: csvNewName.trim() || 'Mein Depot',
          currency: csvNewCurrency,
        });
        targetPid = created.id;
        setCsvActivePortfolioId(created.id);
        setCsvTargetPortfolioId(created.id);
        queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      } catch (err) {
        return;
      }
    }

    if (targetPid) {
      previewCsvMutation.mutate({ portfolioId: targetPid, content: csvRawText });
    }
  };

  const handleExecuteCsv = () => {
    if (!csvActivePortfolioId || !csvRawText.trim()) return;
    executeCsvMutation.mutate({ portfolioId: csvActivePortfolioId, content: csvRawText });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Portfolioverwaltung
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verwalten Sie mehrere Depots, importieren Sie Auszüge und behalten Sie Positionen im Blick.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => handleOpenCsvModal()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            <span>CSV-Import</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Neues Depot erstellen</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <Spinner size="xl" label="Lade Depots..." className="py-24" />
      )}

      {/* Error state */}
      {isError && (
        <div className="space-y-4">
          <Alert variant="error" title="Fehler beim Laden der Portfolios">
            {error instanceof Error ? error.message : 'Konnte Portfolios nicht laden.'}
          </Alert>
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </div>
        </div>
      )}

      {/* Portfolio Grid or Empty State */}
      {!isLoading && !isError && (
        <>
          {portfolios && portfolios.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => {
            const holdingCount = portfolio.holdings?.length || 0;
            const txCount = portfolio.transactions?.length || 0;

            const totalInvested = (portfolio.holdings || []).reduce((acc, h) => {
              const cost =
                h.total_cost !== null && h.total_cost !== undefined
                  ? h.total_cost
                  : (h.shares || 0) * (h.purchase_price ?? h.average_buy_price ?? 0);
              return acc + cost;
            }, 0);

            return (
              <Card
                key={portfolio.id}
                className="flex flex-col justify-between hover:border-primary/50 transition-all group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                        {portfolio.name}
                      </CardTitle>
                      {portfolio.description && (
                        <CardDescription className="line-clamp-2">
                          {portfolio.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {portfolio.currency}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/50 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Positionen</span>
                      <span className="text-base font-semibold text-foreground">
                        {holdingCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Einstandswert</span>
                      <span className="text-base font-semibold text-foreground">
                        {totalInvested > 0
                          ? formatCurrency(totalInvested, portfolio.currency)
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Transaktionen: <span className="font-medium text-foreground">{txCount}</span>
                  </div>
                </CardContent>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-border/40 gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-rose-500"
                    onClick={() => setDeleteId(portfolio.id)}
                    title="Depot löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => handleOpenCsvModal(portfolio.id)}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>CSV importieren</span>
                    </Button>
                    <Link to={`/portfolios/${portfolio.id}`}>
                      <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                        <span>Depot öffnen</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="Keine Depots vorhanden"
          description="Erstellen Sie Ihr erstes Depot oder importieren Sie direkt Wertpapiere per CSV-Datei."
          actionLabel="Erstes Depot anlegen"
          onAction={() => setIsCreateModalOpen(true)}
          secondaryActionLabel="CSV importieren"
          onSecondaryAction={() => handleOpenCsvModal('NEW')}
        />
      )}
        </>
      )}

      {/* Modal: Create Portfolio */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Neues Portfolio / Depot anlegen"
        description="Geben Sie einen aussagekräftigen Namen und die Basiswährung für das Depot an."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Depotname *"
            placeholder="z. B. Hauptdepot, Dividendenstrategie, Tech Growth"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Beschreibung (optional)"
            placeholder="z. B. Langfristiger Vermögensaufbau, monatlicher Sparplan"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />

          <Select
            label="Basiswährung"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value)}
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="CHF">CHF (Fr.)</option>
            <option value="GBP">GBP (£)</option>
          </Select>

          {createMutation.isError && (
            <Alert variant="error">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Fehler beim Erstellen des Depots.'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
              disabled={!newName.trim()}
            >
              Depot anlegen
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Depot unwiderruflich löschen?"
        description="Möchten Sie dieses Depot und alle zugehörigen Positionen und Transaktionen wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
      >
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setDeleteId(null)}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            isLoading={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
          >
            Ja, Depot löschen
          </Button>
        </div>
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

          {/* Stage 1: File selection, target portfolio or pasting */}
          {csvStep === 1 && (
            <div className="space-y-4">
              {/* Portfolio Selection */}
              <div className="p-3 bg-muted/40 rounded-lg space-y-3">
                <label className="block text-xs font-semibold text-foreground">
                  Ziel-Depot für den Import:
                </label>
                <Select
                  value={csvTargetPortfolioId.toString()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'NEW') {
                      setCsvTargetPortfolioId('NEW');
                      setCsvActivePortfolioId(null);
                    } else {
                      const num = Number(val);
                      setCsvTargetPortfolioId(num);
                      setCsvActivePortfolioId(num);
                    }
                  }}
                >
                  {portfolios && portfolios.length > 0 ? (
                    <>
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.currency})
                        </option>
                      ))}
                      <option value="NEW">+ Neues Depot anlegen...</option>
                    </>
                  ) : (
                    <option value="NEW">Neues Depot anlegen</option>
                  )}
                </Select>

                {csvTargetPortfolioId === 'NEW' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Input
                      label="Neuer Depotname"
                      placeholder="z. B. Mein Depot"
                      value={csvNewName}
                      onChange={(e) => setCsvNewName(e.target.value)}
                      required
                    />
                    <Select
                      label="Basiswährung"
                      value={csvNewCurrency}
                      onChange={(e) => setCsvNewCurrency(e.target.value)}
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="CHF">CHF (Fr.)</option>
                      <option value="GBP">GBP (£)</option>
                    </Select>
                  </div>
                )}
              </div>

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
                  id="csv-file-input-portfolios"
                />
                <label htmlFor="csv-file-input-portfolios" className="mt-4 inline-block">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => document.getElementById('csv-file-input-portfolios')?.click()}
                  >
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
                  disabled={!csvRawText.trim() || (csvTargetPortfolioId === 'NEW' && !csvNewName.trim())}
                  isLoading={previewCsvMutation.isPending || createMutation.isPending}
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
                                      {glAbs >= 0 ? '+' : ''}{formatCurrency(glAbs, row.currency || 'EUR')}
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
                Es werden jetzt <strong>{csvPreview.valid_rows_count}</strong> Datensätze verbindlich in das gewählte Depot übernommen. Ungültige Zeilen werden übersprungen.
              </Alert>

              <div className="p-4 rounded-lg bg-card border space-y-2 text-xs">
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
                  onClick={handleExecuteCsv}
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
                    queryClient.invalidateQueries({ queryKey: ['portfolios'] });
                  }}
                >
                  Fertigstellen
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
