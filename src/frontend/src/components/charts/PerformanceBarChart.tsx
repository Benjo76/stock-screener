import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FundamentalData } from '../../types';
import { useSettings } from '../../context/SettingsContext';

interface PerformanceBarChartProps {
  fundamentals: FundamentalData[];
  currency?: string;
  height?: number;
}

export const PerformanceBarChart: React.FC<PerformanceBarChartProps> = ({
  fundamentals,
  currency = 'EUR',
  height = 300,
}) => {
  const { formatNumber } = useSettings();

  const chartData = React.useMemo(() => {
    if (!fundamentals || fundamentals.length === 0) return [];

    return [...fundamentals]
      .sort((a, b) => (a.fiscal_year || 0) - (b.fiscal_year || 0))
      .map((f) => {
        const label = f.fiscal_period
          ? `${f.fiscal_year || ''} ${f.fiscal_period}`
          : `${f.fiscal_year || ''}`;
        return {
          period: label.trim() || `ID ${f.id}`,
          revenue: f.revenue ? f.revenue / 1_000_000 : null,
          operatingIncome: f.operating_income ? f.operating_income / 1_000_000 : null,
          netIncome: f.net_income ? f.net_income / 1_000_000 : null,
          fcf: f.free_cash_flow ? f.free_cash_flow / 1_000_000 : null,
        };
      });
  }, [fundamentals]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-muted-foreground text-xs">
        Keine historischen Finanzkennzahlen vorhanden
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="text-right text-[11px] text-muted-foreground">
        Werte in Mio. {currency}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="period" stroke="#888888" fontSize={11} tickLine={false} />
            <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-xs space-y-1.5">
                      <p className="font-semibold text-foreground">{label}</p>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}:
                          </span>
                          <span className="font-medium text-foreground">
                            {formatNumber(entry.value as number)} Mio. {currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="revenue" name="Umsatz" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="operatingIncome" name="Operatives Ergebnis" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="netIncome" name="Nettogewinn" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fcf" name="Free Cashflow" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
