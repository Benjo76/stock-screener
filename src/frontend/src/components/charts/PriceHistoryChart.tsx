import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StockPrice } from '../../types';
import { useSettings } from '../../context/SettingsContext';

interface PriceHistoryChartProps {
  prices: StockPrice[];
  currency?: string;
  height?: number;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  prices,
  currency = 'EUR',
  height = 320,
}) => {
  const { formatCurrency } = useSettings();
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');

  const filteredPrices = useMemo(() => {
    if (!prices || prices.length === 0) return [];

    const sorted = [...prices].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (timeRange === 'ALL') return sorted;

    const lastDate = new Date(sorted[sorted.length - 1].date);
    const cutoff = new Date(lastDate);

    if (timeRange === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (timeRange === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
    else if (timeRange === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (timeRange === '1Y') cutoff.setFullYear(cutoff.getFullYear() - 1);

    const filtered = sorted.filter((p) => new Date(p.date) >= cutoff);
    return filtered.length > 0 ? filtered : sorted;
  }, [prices, timeRange]);

  const priceStats = useMemo(() => {
    if (filteredPrices.length === 0) return { min: 0, max: 0, change: 0, changePct: 0 };
    const first = filteredPrices[0].close;
    const last = filteredPrices[filteredPrices.length - 1].close;
    const change = last - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;
    const vals = filteredPrices.map((p) => p.close);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      change,
      changePct,
      isPositive: change >= 0,
    };
  }, [filteredPrices]);

  if (!prices || prices.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-muted-foreground text-sm">
        Keine historischen Kursdaten verfügbar
      </div>
    );
  }

  const colorPrimary = priceStats.isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="w-full space-y-4">
      {/* Top Controls & Mini Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">
            {formatCurrency(filteredPrices[filteredPrices.length - 1]?.close, currency)}
          </span>
          <span
            className={`text-xs font-semibold ${
              priceStats.isPositive ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {priceStats.change >= 0 ? '+' : ''}
            {priceStats.change.toFixed(2)} ({priceStats.changePct >= 0 ? '+' : ''}
            {priceStats.changePct.toFixed(2)} %)
          </span>
        </div>

        {/* Range Selector */}
        <div className="flex items-center space-x-1 bg-muted/60 p-1 rounded-md text-xs">
          {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                timeRange === r
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredPrices} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorPrimary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colorPrimary} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getDate()}.${d.getMonth() + 1}.`;
              }}
            />
            <YAxis
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(val) => val.toFixed(1)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as StockPrice;
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-md text-xs space-y-1">
                      <p className="font-semibold text-foreground">{data.date}</p>
                      <p className="text-muted-foreground">
                        Schlusskurs:{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(data.close, currency)}
                        </span>
                      </p>
                      {data.volume && (
                        <p className="text-muted-foreground">
                          Volumen:{' '}
                          <span className="font-medium text-foreground">
                            {new Intl.NumberFormat('de-DE').format(data.volume)}
                          </span>
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70">
                        Quelle: {data.data_source}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={colorPrimary}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
