import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Database,
  Globe,
  HardDrive,
  Info,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { systemApi } from '../api/system';
import { stocksApi } from '../api/stocks';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';

export const DataSourcesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: systemApi.getStatus,
  });

  const { data: health } = useQuery({
    queryKey: ['healthCheck'],
    queryFn: systemApi.checkHealth,
  });

  const syncAllMutation = useMutation({
    mutationFn: stocksApi.syncAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      refetch();
    },
  });

  if (isLoading) {
    return <Spinner size="xl" label="Prüfe Datenquellen und Datenbankstatus..." className="py-24" />;
  }

  if (isError) {
    return (
      <Alert variant="error" title="Fehler beim Verbinden">
        {error instanceof Error ? error.message : 'Konnte Datenquellen-Status nicht ermitteln.'}
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Datenquellen & Provider
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verbindungsstatus zur PostgreSQL-Datenbank, Marktdaten-Provider und Synchronisationsstatus.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Status aktualisieren</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => syncAllMutation.mutate()}
            isLoading={syncAllMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <Zap className="h-4 w-4" />
            <span>Marktdaten jetzt abrufen</span>
          </Button>
        </div>
      </div>

      {/* Sync Message Alert */}
      {syncAllMutation.isSuccess && (
        <Alert variant="success" title="Synchronisation abgeschlossen">
          {syncAllMutation.data.message}
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backend & API Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Backend API</CardTitle>
            <Server className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-foreground text-base">Online (FastAPI)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              API-Version: <strong>v{status?.version || '1.0.0'}</strong>
            </p>
            <div className="text-[11px] text-muted-foreground pt-2 border-t">
              Healthcheck: <Badge variant="success" className="text-[10px]">HTTP 200 OK</Badge>
            </div>
          </CardContent>
        </Card>

        {/* PostgreSQL Database */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">PostgreSQL Datenbank</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="font-bold text-foreground text-base capitalize">
                {status?.database || 'Verbunden'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Persistenter Speicher für Kurse, Depots & Berichte
            </p>
            <div className="text-[11px] text-muted-foreground pt-2 border-t">
              Status: <Badge variant="success" className="text-[10px]">Aktiv</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Data Provider */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Aktiver Provider</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="text-xs uppercase tracking-wider font-mono">
                {status?.active_provider || 'Yahoo Finance'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Liefert historische Kurse und fundamentale Bilanzdaten
            </p>
            <div className="text-[11px] text-muted-foreground pt-2 border-t">
              Verfügbar: {status?.available_providers?.join(', ')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Datenbestand in der Datenbank</CardTitle>
          <CardDescription>Aktuelle Anzahl gespeicherter Datensätze</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-card border text-center space-y-1">
              <span className="text-xs text-muted-foreground">Wertpapiere (Stocks)</span>
              <span className="text-2xl font-extrabold text-foreground block">
                {status?.total_stocks || 0}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-card border text-center space-y-1">
              <span className="text-xs text-muted-foreground">Portfolios & Depots</span>
              <span className="text-2xl font-extrabold text-foreground block">
                {status?.total_portfolios || 0}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-card border text-center space-y-1">
              <span className="text-xs text-muted-foreground">Unternehmensberichte</span>
              <span className="text-2xl font-extrabold text-foreground block">
                {status?.total_reports || 0}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-card border text-center space-y-1">
              <span className="text-xs text-muted-foreground">Hintergrundjobs</span>
              <span className="text-2xl font-extrabold text-foreground block">
                {status?.total_jobs || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Details & Quota Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Yahoo Finance Provider</CardTitle>
            <CardDescription>Standard-Marktdatenanbieter (kostenfrei, ohne API-Key)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              • <strong>Funktionsumfang:</strong> Ticker-Lookup, Tagesschlusskurse, historische Charts, fundamentale Jahres- und Quartalszahlen.
            </p>
            <p>
              • <strong>Ratenbegrenzung:</strong> Standard HTTP-Rate-Limiting. Bei zu vielen gleichzeitigen Anfragen empfiehlt sich ein kurzes Intervall.
            </p>
            <p>
              • <strong>Datenverzögerung:</strong> Tagesschlusskurse des vorangegangenen Handelstags.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Mock Data Provider</CardTitle>
            <CardDescription>Lokaler Offline-Provider für Entwicklung und CI/CD</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              • <strong>Funktionsumfang:</strong> Deterministische Beispieldaten für Aktien wie AAPL, MSFT, SAP SE für reproduzierbare Tests.
            </p>
            <p>
              • <strong>Verwendung:</strong> Automatisch aktivierbar über Umgebungsvariable <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">DATA_PROVIDER=mock</code>.
            </p>
            <p>
              • <strong>Netzwerk:</strong> Benötigt keine externe Internetverbindung.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
