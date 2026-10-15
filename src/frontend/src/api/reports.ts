import { api } from './client';
import { CompanyReport, ReportAnalysis } from '../types';

export const reportsApi = {
  list: (params?: {
    stock_id?: number;
    report_type?: string;
    fiscal_year?: number;
    query?: string;
    limit?: number;
    offset?: number;
  }) => api.get<CompanyReport[]>('/reports', params),

  get: (reportId: number) =>
    api.get<CompanyReport>(`/reports/${reportId}`),

  create: (data: {
    stock_id: number;
    report_type: string;
    fiscal_year?: number;
    fiscal_period?: string;
    report_date?: string;
    title?: string;
    content_text: string;
    source_url?: string;
    auto_analyze?: boolean;
  }) => api.post<CompanyReport>('/reports', data),

  upload: (data: {
    stock_id: number;
    file: File;
    report_type?: string;
    fiscal_year?: number;
    fiscal_period?: string;
    title?: string;
    auto_analyze?: boolean;
  }) => {
    const formData = new FormData();
    formData.append('stock_id', String(data.stock_id));
    formData.append('file', data.file);
    if (data.report_type) formData.append('report_type', data.report_type);
    if (data.fiscal_year) formData.append('fiscal_year', String(data.fiscal_year));
    if (data.fiscal_period) formData.append('fiscal_period', data.fiscal_period);
    if (data.title) formData.append('title', data.title);
    if (data.auto_analyze !== undefined) formData.append('auto_analyze', String(data.auto_analyze));

    return api.postForm<CompanyReport>('/reports/upload', formData);
  },

  delete: (reportId: number) =>
    api.delete<void>(`/reports/${reportId}`),

  analyze: (reportId: number) =>
    api.post<ReportAnalysis>(`/reports/${reportId}/analyze`),

  verify: (
    analysisId: number,
    data: { is_verified?: boolean; verification_notes?: string }
  ) => api.patch<ReportAnalysis>(`/reports/analyses/${analysisId}/verify`, data),
};
