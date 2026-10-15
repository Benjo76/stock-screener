import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface AllocationPieChartProps {
  data: Record<string, number>;
  height?: number;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
];

export const AllocationPieChart: React.FC<AllocationPieChartProps> = ({
  data,
  height = 240,
}) => {
  const chartData = Object.entries(data)
    .filter(([_, val]) => val > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-muted-foreground text-xs">
        Keine Verteilungsdaten verfügbar
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-border bg-card p-2 shadow-md text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-muted-foreground">
                        Anteil: <span className="font-medium text-foreground">{item.value.toFixed(1)} %</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs w-full max-w-sm">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate pr-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="truncate">{item.name}</span>
            </div>
            <span className="font-medium text-foreground">{item.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
