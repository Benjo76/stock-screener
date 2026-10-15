import { api } from './client';
import { AnalysisJob, AnalysisResult } from '../types';

export const analysesApi = {
  analyzeStock: (stockId: number, sync: boolean = true) =>
    api.post<AnalysisJob>(`/analyses/stocks/${stockId}?sync=${sync}`),

  analyzePortfolio: (portfolioId: number, sync: boolean = true) =>
    api.post<AnalysisJob>(`/analyses/portfolios/${portfolioId}?sync=${sync}`),

  listJobs: (params?: {
    status?: string;
    job_type?: string;
    stock_id?: number;
    portfolio_id?: number;
    limit?: number;
    offset?: number;
  }) => api.get<AnalysisJob[]>('/analyses/jobs', params),

  getJob: (jobId: number) =>
    api.get<AnalysisJob>(`/analyses/jobs/${jobId}`),

  runJob: (jobId: number) =>
    api.post<AnalysisJob>(`/analyses/jobs/${jobId}/run`),

  runPending: () =>
    api.post<{ message: string; executed_count: number }>('/analyses/run-pending'),

  getResult: (resultId: number) =>
    api.get<AnalysisResult>(`/analyses/results/${resultId}`),
};
