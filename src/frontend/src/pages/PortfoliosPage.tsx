import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Briefcase,
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

export const PortfoliosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { formatCurrency } = useSettings();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCurrency, setNewCurrency] = useState('EUR');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const {
    data: portfolios,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['portfolios'],
    queryFn: portfoliosApi.list,
  });

  const createMutation = useMutation({
    mutationFn: portfoliosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsCreateModalOpen(false);
      setNewName('');
      setNewDesc('');
      setNewCurrency('EUR');
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      currency: newCurrency,
    });
  };

  if (isLoading) {
    return <Spinner size="xl" label="Lade Depots..." className="py-24" />;
  }

  if (isError) {
    return (
      <Alert variant="error" title="Fehler beim Laden der Portfolios">
        {error instanceof Error ? error.message : 'Konnte Portfolios nicht laden.'}
      </Alert>
    );
  }

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
        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Neues Depot erstellen</span>
        </Button>
      </div>

      {/* Portfolio Grid */}
      {portfolios && portfolios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => {
            const holdingCount = portfolio.holdings?.length || 0;
            const txCount = portfolio.transactions?.length || 0;

            const totalInvested = (portfolio.holdings || []).reduce((acc, h) => {
              const cost =
                h.total_cost !== null && h.total_cost !== undefined
                  ? h.total_cost
                  : (h.shares || 0) * (h.average_buy_price || 0);
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

                  <Link to={`/portfolios/${portfolio.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <span>Depot öffnen</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
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
        />
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
    </div>
  );
};
