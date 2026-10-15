import React from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, PieChart as PieIcon, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { DashboardSummary } from '../../../types';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

interface SummaryCardsProps {
  summary?: DashboardSummary | null;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const currency = summary?.currency || 'EUR';

  return (
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
              ? formatCurrency(summary.total_portfolio_value, currency)
              : 'Keine Daten verfügbar'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary?.total_invested_cost !== null && summary?.total_invested_cost !== undefined ? (
              <>Einstand: {formatCurrency(summary.total_invested_cost, currency)}</>
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
                  currency
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
  );
};
