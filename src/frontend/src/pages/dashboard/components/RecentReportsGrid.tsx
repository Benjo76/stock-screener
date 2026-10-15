import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { CompanyReport } from '../../../types';

interface RecentReportsGridProps {
  recentReports?: CompanyReport[] | null;
}

export const RecentReportsGrid: React.FC<RecentReportsGridProps> = ({ recentReports }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Zuletzt importierte Unternehmensberichte</CardTitle>
          <CardDescription>Dokumente und extrahierte Finanzdaten</CardDescription>
        </div>
        <Link to="/reports">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <span>Zur Berichtsverwaltung</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentReports && recentReports.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentReports.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{rep.title || `${rep.report_type} ${rep.fiscal_year || ''}`}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {rep.fiscal_year || 'FY'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unternehmen: {rep.stock?.name || `Wertpapier #${rep.stock_id}`}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Quelle: {rep.data_source}</span>
                  <Link to="/reports" className="text-primary hover:underline font-medium">
                    Details öffnen →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Keine Unternehmensberichte hinterlegt. Sie können PDF- oder Textberichte in der Berichtsverwaltung hochladen.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
