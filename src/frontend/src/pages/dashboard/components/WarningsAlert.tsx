import React from 'react';
import { Alert } from '../../../components/ui/Alert';
import { DataWarning } from '../../../types';

interface WarningsAlertProps {
  warnings?: DataWarning[] | null;
}

export const WarningsAlert: React.FC<WarningsAlertProps> = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, idx) => (
        <Alert
          key={idx}
          variant={w.severity === 'error' ? 'error' : 'warning'}
          title={w.stock_name ? `Datenhinweis: ${w.stock_name}` : 'Systemhinweis'}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{w.message}</span>
            {w.recommendation && (
              <span className="text-xs font-medium underline opacity-90">
                {w.recommendation}
              </span>
            )}
          </div>
        </Alert>
      ))}
    </div>
  );
};
