import { api } from './client';
import {
  FundamentalData,
  Stock,
  StockPrice,
  StockResolveResult,
  AnalysisResult,
  CompanyReport,
} from '../types';

export const stocksApi = {
  list: (params?: { query?: string; limit?: number; offset?: number }) =>
    api.get<Stock[]>('/stocks', params),

  get: (stockId: number) =>
    api.get<Stock>(`/stocks/${stockId}`),

  create: (data: {
    isin?: string;
    wkn?: string;
    ticker?: string;
    name?: string;
    exchange?: string;
    currency?: string;
  }) => api.post<Stock>('/stocks', data),

  update: (
    stockId: number,
    data: {
      name?: string;
      exchange?: string;
      currency?: string;
      sector?: string;
      industry?: string;
      country?: string;
      wkn?: string;
      isin?: string;
      ticker?: string;
    }
  ) => api.patch<Stock>(`/stocks/${stockId}`, data),

  delete: (stockId: number) =>
    api.delete<void>(`/stocks/${stockId}`),

  resolve: (query: string) =>
    api.post<StockResolveResult>(`/stocks/resolve?query=${encodeURIComponent(query)}`),

  sync: (stockId: number) =>
    api.post<Stock>(`/stocks/${stockId}/sync`),

  syncAll: () =>
    api.post<{ message: string; synced_count: number }>('/stocks/sync-all'),

  getPrices: (stockId: number) =>
    api.get<StockPrice[]>(`/stocks/${stockId}/prices`),

  getFundamentals: (stockId: number) =>
    api.get<FundamentalData[]>(`/stocks/${stockId}/fundamentals`),

  getReports: (stockId: number) =>
    api.get<CompanyReport[]>(`/stocks/${stockId}/reports`),

  getAnalyses: (stockId: number) =>
    api.get<AnalysisResult[]>(`/stocks/${stockId}/analyses`),
};
