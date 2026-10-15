import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  FileCheck,
  FileText,
  Filter,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { reportsApi } from '../api/reports';
import { stocksApi } from '../api/stocks';
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
import { EmptyState } from '../components/ui/EmptyState';
import { CompanyReport, ReportAnalysis } from '../types';

export const ReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { formatNumber, formatCurrency } = useSettings();

  const [searchTerm, setSearchTerm] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState<CompanyReport | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadStockId, setUploadStockId] = useState<number | ''>('');
  const [uploadType, setUploadType] = useState('ANNUAL_REPORT');
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear().toString());
  const [uploadPeriod, setUploadPeriod] = useState('FY');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Verification Note State
  const [verifyNotes, setVerifyNotes] = useState('');

  // Delete State
  const [deleteReportId, setDeleteReportId] = useState<number | null>(null);

  // Queries
  const { data: stocks } = useQuery({
    queryKey: ['stocksList'],
    queryFn: () => stocksApi.list(),
  });

  const {
    data: reports,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['reports', reportTypeFilter, searchTerm],
    queryFn: () =>
      reportsApi.list({
        report_type: reportTypeFilter !== 'ALL' ? reportTypeFilter : undefined,
        query: searchTerm.trim() || undefined,
      }),
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadStockId || !uploadFile) return Promise.reject('Bitte wählen Sie Aktie und Datei');
      return reportsApi.upload({
        stock_id: Number(uploadStockId),
        file: uploadFile,
        report_type: uploadType,
        fiscal_year: uploadYear ? parseInt(uploadYear, 10) : undefined,
        fiscal_period: uploadPeriod || undefined,
        title: uploadTitle.trim() || undefined,
        auto_analyze: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle('');
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (reportId: number) => reportsApi.analyze(reportId),
    onSuccess: (updatedAnalysis) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (selectedReport) {
        setSelectedReport({
          ...selectedReport,
          analyses: [updatedAnalysis, ...(selectedReport.analyses || [])],
        });
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ analysisId, isVerified, notes }: { analysisId: number; isVerified: boolean; notes?: string }) =>
      reportsApi.verify(analysisId, { is_verified: isVerified, verification_notes: notes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (selectedReport && selectedReport.analyses) {
        setSelectedReport({
          ...selectedReport,
          analyses: selectedReport.analyses.map((a) => (a.id === updated.id ? updated : a)),
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reportId: number) => reportsApi.delete(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setDeleteReportId(null);
      if (selectedReport?.id === deleteReportId) {
        setSelectedReport(null);
      }
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Berichte & Dokumente
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zentrale Verwaltung von Geschäfts- und Quartalsberichten inklusive KI-gestützter Extraktion.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            if (stocks && stocks.length > 0 && !uploadStockId) {
              setUploadStockId(stocks[0].id);
            }
            setIsUploadOpen(true);
          }}
          className="gap-2 text-xs"
        >
          <Upload className="h-4 w-4" />
          <span>Bericht hochladen (PDF/TXT)</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Berichte nach Titel oder Typ durchsuchen..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select
                value={reportTypeFilter}
                onChange={(e) => setReportTypeFilter(e.target.value)}
                className="w-48 text-xs h-9"
              >
                <option value="ALL">Alle Berichtstypen</option>
                <option value="ANNUAL_REPORT">Geschäftsberichte (Annual)</option>
                <option value="QUARTERLY_REPORT">Quartalsberichte (Quarterly)</option>
                <option value="HALF_YEAR_REPORT">Halbjahresberichte</option>
                <option value="EARNINGS_RELEASE">Ergebnis-Mitteilungen</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table & Detail Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <Card className={selectedReport ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Verfügbare Berichte</CardTitle>
            <CardDescription>
              Übersicht über alle hinterlegten Dokumente und deren Analysezustand
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Spinner size="lg" label="Lade Berichte..." className="py-16" />
            ) : isError ? (
              <Alert variant="error" title="Fehler beim Laden">
                {error instanceof Error ? error.message : 'Konnte Berichte nicht laden.'}
              </Alert>
            ) : reports && reports.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel / Dokument</TableHead>
                    <TableHead>Unternehmen</TableHead>
                    <TableHead>Typ & Periode</TableHead>
                    <TableHead>Analysezustand</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((rep) => {
                    const hasAnalyses = rep.analyses && rep.analyses.length > 0;
                    const isVerified = hasAnalyses && rep.analyses[0].is_verified;
                    const isSelected = selectedReport?.id === rep.id;

                    return (
                      <TableRow
                        key={rep.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 border-primary/40' : ''
                        }`}
                        onClick={() => setSelectedReport(rep)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <span className="font-semibold text-foreground text-sm block">
                                {rep.title || `${rep.report_type} ${rep.fiscal_year || ''}`}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Erfasst: {rep.created_at ? new Date(rep.created_at).toLocaleDateString('de-DE') : '—'}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {rep.stock?.name || `Stock #${rep.stock_id}`}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <Badge variant="outline" className="text-[10px]">
                              {rep.report_type}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {rep.fiscal_year ? `FY ${rep.fiscal_year}` : ''}{' '}
                            {rep.fiscal_period ? `(${rep.fiscal_period})` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {hasAnalyses ? (
                            isVerified ? (
                              <Badge variant="success" className="gap-1 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Geprüft</span>
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="gap-1 text-[10px]">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Ungeprüft</span>
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Nicht analysiert
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSelectedReport(rep)}
                            >
                              Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                              title="Löschen"
                              onClick={() => setDeleteReportId(rep.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={FileText}
                title="Keine Berichte gefunden"
                description={
                  searchTerm
                    ? 'Kein Bericht entspricht dem Suchkriterium.'
                    : 'Laden Sie Berichte im PDF- oder Textformat hoch.'
                }
                actionLabel="Bericht hochladen"
                onAction={() => setIsUploadOpen(true)}
              />
            )}
          </CardContent>
        </Card>

        {/* Report Analysis Detail Panel */}
        {selectedReport && (
          <Card className="lg:col-span-1 space-y-4">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Analyse & KPIs</CardTitle>
                <CardDescription className="truncate max-w-[220px]">
                  {selectedReport.title || `Bericht #${selectedReport.id}`}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedReport(null)}
              >
                Schließen
              </Button>
            </CardHeader>
            <CardContent className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* Metadata */}
              <div className="space-y-1 p-3 bg-muted/40 rounded-lg">
                <p>
                  <strong>Unternehmen:</strong> {selectedReport.stock?.name || `Stock #${selectedReport.stock_id}`}
                </p>
                <p>
                  <strong>Typ:</strong> {selectedReport.report_type} ({selectedReport.fiscal_year || 'FY'}{' '}
                  {selectedReport.fiscal_period || ''})
                </p>
                <p>
                  <strong>Datenquelle:</strong> {selectedReport.data_source}
                </p>
              </div>

              {/* Latest Analysis Details */}
              {selectedReport.analyses && selectedReport.analyses.length > 0 ? (
                (() => {
                  const analysis = selectedReport.analyses[0];
                  return (
                    <div className="space-y-4">
                      {/* Verification Status */}
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <span className="font-semibold block">Prüfstatus:</span>
                          <span className="text-[11px] text-muted-foreground">
                            {analysis.is_verified ? 'Vom Analysten verifiziert' : 'Automatisch extrahiert (ungeprüft)'}
                          </span>
                        </div>
                        <Button
                          variant={analysis.is_verified ? 'outline' : 'success'}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            verifyMutation.mutate({
                              analysisId: analysis.id,
                              isVerified: !analysis.is_verified,
                              notes: verifyNotes || undefined,
                            })
                          }
                          isLoading={verifyMutation.isPending}
                        >
                          {analysis.is_verified ? 'Als ungeprüft markieren' : 'Verifizieren'}
                        </Button>
                      </div>

                      {/* Summary */}
                      {analysis.summary && (
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground">Extrahierte Kernaussagen</h4>
                          <p className="text-muted-foreground leading-relaxed p-3 bg-card border rounded-lg">
                            {analysis.summary}
                          </p>
                        </div>
                      )}

                      {/* Extracted KPIs */}
                      {analysis.extracted_kpis && Object.keys(analysis.extracted_kpis).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-bold text-foreground">Erkannte Finanzkennzahlen</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(analysis.extracted_kpis).map(([k, v]) => (
                              <div key={k} className="p-2.5 rounded bg-muted/40 border">
                                <span className="text-[10px] text-muted-foreground uppercase block truncate">
                                  {k.replace(/_/g, ' ')}
                                </span>
                                <span className="font-bold text-sm text-foreground">
                                  {typeof v === 'number' ? formatNumber(v) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Risks & Trends */}
                      {analysis.risks && analysis.risks.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-rose-500 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Hervorgehobene Risiken</span>
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            {analysis.risks.map((r, idx) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysis.opportunities && analysis.opportunities.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-emerald-500 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Chancen & Wachstumspotenziale</span>
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            {analysis.opportunities.map((o, idx) => (
                              <li key={idx}>{o}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-muted-foreground">
                    Für diesen Bericht liegt noch keine automatisierte Analyse vor.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => analyzeMutation.mutate(selectedReport.id)}
                    isLoading={analyzeMutation.isPending}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Jetzt analysieren</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal: Upload Report */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Unternehmensbericht hochladen & analysieren"
        description="Laden Sie eine PDF- oder Textdatei hoch. Kennzahlen und Aussagen werden automatisch extrahiert."
        maxWidth="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadMutation.mutate();
          }}
          className="space-y-4"
        >
          <Select
            label="Zugehöriges Wertpapier *"
            value={uploadStockId}
            onChange={(e) => setUploadStockId(Number(e.target.value))}
            required
          >
            <option value="">Wertpapier auswählen...</option>
            {stocks?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.ticker || `Stock #${s.id}`} ({s.ticker || s.isin})
              </option>
            ))}
          </Select>

          <Input
            label="Titel des Berichts (optional)"
            placeholder="z. B. Jahresabschluss 2024 oder Q3 Earnings Report"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Berichtstyp"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
            >
              <option value="ANNUAL_REPORT">Geschäftsbericht</option>
              <option value="QUARTERLY_REPORT">Quartalsbericht</option>
              <option value="HALF_YEAR_REPORT">Halbjahresbericht</option>
              <option value="EARNINGS_RELEASE">Mitteilung</option>
            </Select>

            <Input
              label="Geschäftsjahr"
              type="number"
              value={uploadYear}
              onChange={(e) => setUploadYear(e.target.value)}
              placeholder="z. B. 2024"
            />

            <Select
              label="Periode"
              value={uploadPeriod}
              onChange={(e) => setUploadPeriod(e.target.value)}
            >
              <option value="FY">Gesamtjahr (FY)</option>
              <option value="Q1">1. Quartal (Q1)</option>
              <option value="Q2">2. Quartal (Q2)</option>
              <option value="Q3">3. Quartal (Q3)</option>
              <option value="Q4">4. Quartal (Q4)</option>
              <option value="H1">1. Halbjahr (H1)</option>
            </Select>
          </div>

          <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
            <input
              type="file"
              accept=".pdf,.txt,.json,.md"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="hidden"
              id="report-upload-file"
            />
            <label htmlFor="report-upload-file" className="cursor-pointer block">
              <Upload className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">
                {uploadFile ? uploadFile.name : 'PDF- oder Textdokument wählen'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PDF, TXT, JSON bis max. 10 MB
              </p>
            </label>
          </div>

          {uploadMutation.isError && (
            <Alert variant="error">
              {uploadMutation.error instanceof Error
                ? uploadMutation.error.message
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
              disabled={!uploadStockId || !uploadFile}
              isLoading={uploadMutation.isPending}
            >
              Hochladen & Analysieren
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteReportId !== null}
        onClose={() => setDeleteReportId(null)}
        title="Bericht löschen?"
        description="Möchten Sie diesen Bericht und alle zugehörigen extrahierten Analysen unwiderruflich löschen?"
      >
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setDeleteReportId(null)}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            isLoading={deleteMutation.isPending}
            onClick={() => deleteReportId && deleteMutation.mutate(deleteReportId)}
          >
            Ja, löschen
          </Button>
        </div>
      </Modal>
    </div>
  );
};
