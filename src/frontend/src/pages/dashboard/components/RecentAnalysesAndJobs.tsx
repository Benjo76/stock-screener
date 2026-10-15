import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { AnalysisJob, AnalysisResult } from '../../../types';
import { formatDate, formatTime } from '../../../utils/formatters';

interface RecentAnalysesAndJobsProps {
  recentAnalyses?: AnalysisResult[] | null;
  recentJobs?: AnalysisJob[] | null;
}

export const RecentAnalysesAndJobs: React.FC<RecentAnalysesAndJobsProps> = ({
  recentAnalyses,
  recentJobs,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Analyses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Zuletzt analysierte Aktien</CardTitle>
            <CardDescription>Automatisch generierte Research-Einschätzungen</CardDescription>
          </div>
          <Link to="/analysis">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <span>Alle Analysen</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentAnalyses && recentAnalyses.length > 0 ? (
            <div className="space-y-3">
              {recentAnalyses.map((ana) => (
                <div
                  key={ana.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60 hover:bg-accent/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={ana.stock_id ? `/analysis?stockId=${ana.stock_id}` : '/analysis'}
                        className="font-semibold text-sm hover:underline"
                      >
                        {ana.stock?.name || (ana.stock_id ? `Wertpapier #${ana.stock_id}` : 'Allgemeine Analyse')}
                      </Link>
                      <Badge variant="outline" className="text-[10px]">
                        v{ana.version}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-sm">
                      {ana.headline || ana.summary || 'Fundamentalanalyse abgeschlossen.'}
                    </p>
                  </div>

                  <div className="text-right">
                    {ana.score !== null && ana.score !== undefined ? (
                      <div
                        className={`text-sm font-bold ${
                          ana.score >= 70
                            ? 'text-emerald-500'
                            : ana.score >= 50
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`}
                      >
                        Score: {ana.score}/100
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Kein Score</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(ana.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Noch keine Analysen durchgeführt. Öffnen Sie die Aktienanalyse, um eine neue Bewertung zu starten.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Aktuelle Analysejobs</CardTitle>
            <CardDescription>Hintergrundaufgaben und Ausführungsstatus</CardDescription>
          </div>
          <Link to="/jobs">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <span>Alle Jobs</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentJobs && recentJobs.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {job.job_type === 'STOCK_ANALYSIS'
                          ? `Aktie: ${job.stock?.name || (job.stock_id ? `#${job.stock_id}` : '—')}`
                          : `Portfolio: ${job.portfolio?.name || (job.portfolio_id ? `#${job.portfolio_id}` : '—')}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Gestartet: {formatTime(job.created_at)}
                    </span>
                  </div>

                  <div>
                    {job.status === 'COMPLETED' ? (
                      <Badge variant="success">Erfolgreich</Badge>
                    ) : job.status === 'FAILED' ? (
                      <Badge variant="danger">Fehlgeschlagen</Badge>
                    ) : job.status === 'RUNNING' ? (
                      <Badge variant="warning">Läuft</Badge>
                    ) : (
                      <Badge variant="secondary">Ausstehend</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Keine aktuellen Analysejobs vorhanden.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
