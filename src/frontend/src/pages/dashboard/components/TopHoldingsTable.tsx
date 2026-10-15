import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { TopPositionItem } from '../../../types';
import { formatCurrency, formatNumber, formatPercent } from '../../../utils/formatters';

interface TopHoldingsTableProps {
  positions?: TopPositionItem[] | null;
  fallbackCurrency?: string;
}

export const TopHoldingsTable: React.FC<TopHoldingsTableProps> = ({
  positions,
  fallbackCurrency = 'EUR',
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Größte Depotpositionen</CardTitle>
          <CardDescription>Übersicht über die gewichtigsten Positionen</CardDescription>
        </div>
        <Link to="/portfolios">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <span>Alle Positionen</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {positions && positions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wertpapier</TableHead>
                <TableHead>Depot</TableHead>
                <TableHead className="text-right">Stück</TableHead>
                <TableHead className="text-right">Einstand</TableHead>
                <TableHead className="text-right">Aktueller Kurs</TableHead>
                <TableHead className="text-right">Marktwert</TableHead>
                <TableHead className="text-right">G/V</TableHead>
                <TableHead className="text-right">Gewichtung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((rawPos, idx) => {
                const buyPrice = rawPos.purchase_price ?? rawPos.average_buy_price ?? null;
                const currentPrice = rawPos.current_price ?? null;
                const shares = rawPos.shares || 0;
                const totalCost = rawPos.total_cost ?? (buyPrice !== null ? buyPrice * shares : null);
                const marketValue = rawPos.market_value ?? (currentPrice !== null ? currentPrice * shares : null);
                let gainLoss = rawPos.gain_loss ?? null;
                let returnPct = rawPos.return_pct ?? null;

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

                const posCurrency = rawPos.currency || fallbackCurrency;

                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/analysis?stockId=${rawPos.stock_id}`}
                        className="hover:underline text-foreground block font-semibold"
                      >
                        {rawPos.name || `Aktie #${rawPos.stock_id}`}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {rawPos.ticker || rawPos.isin || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {rawPos.portfolio_name || '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(shares, 2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {buyPrice !== null ? formatCurrency(buyPrice, posCurrency) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currentPrice !== null ? formatCurrency(currentPrice, posCurrency) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {marketValue !== null ? formatCurrency(marketValue, posCurrency) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {gainLoss !== null ? (
                        <div
                          className={`font-semibold ${
                            gainLoss >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {gainLoss >= 0 ? '+' : ''}
                          {formatCurrency(gainLoss, posCurrency)}
                          {returnPct !== null && (
                            <span className="block text-[11px] opacity-80">
                              ({formatPercent(returnPct)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {rawPos.weight_pct !== undefined && rawPos.weight_pct !== null
                        ? `${formatNumber(rawPos.weight_pct, 1)}%`
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Noch keine Positionen in Depots vorhanden.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
