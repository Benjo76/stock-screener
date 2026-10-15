import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { analysesApi } from '../api/analyses';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Select } from '../components/ui/Select';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { AnalysisJob } from '../types';

export const JobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedJob, setSelectedJob] = useState<AnalysisJob | null>(null);

  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['analysesJobs', statusFilter, typeFilter],
    queryFn: () =>
      analysesApi.listJobs({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        job_type: typeFilter !== 'ALL' ? typeFilter : undefined,
      }),
    refetchInterval: 5000, // Poll every 5s for running tasks
  });

  const runPendingMutation = useMutation({
    mutationFn: analysesApi.runPending,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysesJobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });

  const runJobMutation = useMutation({
    mutationFn: (jobId: number) => analysesApi.runJob(jobId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['analysesJobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      if (selectedJob?.id === updated.id) {
        setSelectedJob(updated);
      }
    },
  });

  const pendingCount = jobs?.filter((j) => j.status === 'PENDING').length || 0;
  const runningCount = jobs?.filter((j) => j.status === 'RUNNING').length || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Analysejobs & Hintergrundaufgaben
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Überwachen Sie automatisierte Screening-Läufe, Report-Extraktionen und Depotbewertungen.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {pendingCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => runPendingMutation.mutate()}
              isLoading={runPendingMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <Play className="h-4 w-4" />
              <span>{pendingCount} ausstehende Jobs ausführen</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Aktualisieren</span>
          </Button>
        </div>
      </div>

      {/* Filter and Quick Stats Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40 text-xs h-9"
            >
              <option value="ALL">Alle Status</option>
              <option value="PENDING">Ausstehend</option>
              <option value="RUNNING">Läuft</option>
              <option value="COMPLETED">Erfolgreich</option>
              <option value="FAILED">Fehlgeschlagen</option>
            </Select>

            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-48 text-xs h-9"
            >
              <option value="ALL">Alle Aufgabentypen</option>
              <option value="STOCK_ANALYSIS">Aktienanalyse</option>
              <option value="PORTFOLIO_ANALYSIS">Depotanalyse</option>
            </Select>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {runningCount > 0 && (
              <span className="flex items-center gap-1.5 font-semibold text-amber-500">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                {runningCount} aktiv in Bearbeitung
              </span>
            )}
            <span>Gesamt: <strong className="text-foreground">{jobs?.length || 0}</strong> Aufgaben</span>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Jobhistorie</CardTitle>
          <CardDescription>
            Chronologische Liste aller gestarteten und beendeten Analysejobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner size="lg" label="Lade Analysejobs..." className="py-16" />
          ) : isError ? (
            <Alert variant="error" title="Fehler beim Laden">
              {error instanceof Error ? error.message : 'Konnte Jobs nicht abrufen.'}
            </Alert>
          ) : jobs && jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job-ID & Typ</TableHead>
                  <TableHead>Zielobjekt</TableHead>
                  <TableHead>Erstellt / Gestartet</TableHead>
                  <TableHead>Abgeschlossen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const isStock = job.job_type === 'STOCK_ANALYSIS';
                  const targetName = isStock
                    ? job.stock?.name || `Aktie #${job.stock_id}`
                    : job.portfolio?.name || `Depot #${job.portfolio_id}`;

                  return (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedJob(job)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <span className="font-semibold text-xs text-foreground block">
                              Job #{job.id}
                            </span>
                            <Badge variant="outline" className="text-[10px] mt-0.5">
                              {job.job_type}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {isStock ? (
                          <Link
                            to={`/analysis?stockId=${job.stock_id}`}
                            className="hover:underline text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {targetName}
                          </Link>
                        ) : (
                          <Link
                            to={`/portfolios/${job.portfolio_id}`}
                            className="hover:underline text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {targetName}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {job.started_at
                          ? new Date(job.started_at).toLocaleString('de-DE')
                          : job.created_at
                          ? new Date(job.created_at).toLocaleString('de-DE')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {job.completed_at
                          ? new Date(job.completed_at).toLocaleString('de-DE')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {job.status === 'COMPLETED' ? (
                          <Badge variant="success" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Erfolgreich</span>
                          </Badge>
                        ) : job.status === 'RUNNING' ? (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Läuft</span>
                          </Badge>
                        ) : job.status === 'FAILED' ? (
                          <Badge variant="danger" className="gap-1 text-[10px]">
                            <AlertCircle className="h-3 w-3" />
                            <span>Fehlgeschlagen</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Clock className="h-3 w-3" />
                            <span>Ausstehend</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {(job.status === 'PENDING' || job.status === 'FAILED') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => runJobMutation.mutate(job.id)}
                              isLoading={runJobMutation.isPending && selectedJob?.id === job.id}
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Ausführen</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedJob(job)}
                          >
                            Details
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
              icon={Activity}
              title="Keine Analysejobs gefunden"
              description="Starten Sie eine Aktien- oder Depotanalyse, um Hintergrundaufgaben auszuführen."
              actionLabel="Zur Aktienanalyse"
              onAction={() => (window.location.href = '/analysis')}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal: Job Details */}
      <Modal
        isOpen={selectedJob !== null}
        onClose={() => setSelectedJob(null)}
        title={`Analysejob Details (#${selectedJob?.id})`}
        description={selectedJob?.job_type}
        maxWidth="xl"
      >
        {selectedJob && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
              <div>
                <span className="text-muted-foreground block">Status:</span>
                <span className="font-bold text-foreground">{selectedJob.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Ziel:</span>
                <span className="font-bold text-foreground">
                  {selectedJob.stock_id
                    ? `Aktie #${selectedJob.stock_id} (${selectedJob.stock?.name || ''})`
                    : `Portfolio #${selectedJob.portfolio_id}`}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Erstellt am:</span>
                <span>{selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString('de-DE') : '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Abgeschlossen:</span>
                <span>{selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString('de-DE') : '—'}</span>
              </div>
            </div>

            {selectedJob.error_message && (
              <Alert variant="error" title="Fehlermeldung">
                {selectedJob.error_message}
              </Alert>
            )}

            {selectedJob.params && Object.keys(selectedJob.params).length > 0 && (
              <div>
                <span className="font-semibold block mb-1">Parameter:</span>
                <pre className="p-3 bg-muted rounded font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedJob.params, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t">
              {(selectedJob.status === 'PENDING' || selectedJob.status === 'FAILED') ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => runJobMutation.mutate(selectedJob.id)}
                  isLoading={runJobMutation.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Jetzt erneut ausführen</span>
                </Button>
              ) : (
                <div />
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedJob(null)}>
                Schließen
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
