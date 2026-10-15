import { api } from './client';
import {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
  PortfolioTransaction,
  AnalysisResult,
  CsvImportPreview,
  CsvImportResult,
} from '../types';

export const portfoliosApi = {
  list: () =>
    api.get<Portfolio[]>('/portfolios'),

  get: (portfolioId: number) =>
    api.get<Portfolio>(`/portfolios/${portfolioId}`),

  create: (data: { name: string; description?: string; currency?: string }) =>
    api.post<Portfolio>('/portfolios', data),

  update: (portfolioId: number, data: { name?: string; description?: string; currency?: string }) =>
    api.patch<Portfolio>(`/portfolios/${portfolioId}`, data),

  delete: (portfolioId: number) =>
    api.delete<{ status: string; message: string }>(`/portfolios/${portfolioId}`),

  getSummary: (portfolioId: number) =>
    api.get<PortfolioSummary>(`/portfolios/${portfolioId}/summary`),

  getAnalyses: (portfolioId: number) =>
    api.get<AnalysisResult[]>(`/portfolios/${portfolioId}/analyses`),

  addHolding: (
    portfolioId: number,
    data: {
      stock_id?: number;
      isin?: string;
      wkn?: string;
      ticker?: string;
      name?: string;
      shares: number;
      average_buy_price?: number;
      currency?: string;
    }
  ) => api.post<PortfolioHolding>(`/portfolios/${portfolioId}/holdings`, data),

  deleteHolding: (portfolioId: number, holdingId: number) =>
    api.delete<void>(`/portfolios/${portfolioId}/holdings/${holdingId}`),

  addTransaction: (
    portfolioId: number,
    data: {
      stock_id: number;
      transaction_type?: string;
      shares?: number;
      price_per_share?: number;
      total_amount: number;
      fees?: number;
      currency?: string;
      transaction_date?: string;
      notes?: string;
    }
  ) => api.post<PortfolioTransaction>(`/portfolios/${portfolioId}/transactions`, data),

  previewCsv: (
    portfolioId: number,
    csvContent: string,
    forcedType?: 'holdings' | 'transactions'
  ) =>
    api.post<CsvImportPreview>(`/portfolios/${portfolioId}/import/preview`, {
      csv_content: csvContent,
      forced_type: forcedType,
    }),

  executeCsv: (
    portfolioId: number,
    csvContent: string,
    forcedType?: 'holdings' | 'transactions'
  ) =>
    api.post<CsvImportResult>(`/portfolios/${portfolioId}/import`, {
      csv_content: csvContent,
      forced_type: forcedType,
    }),
};
