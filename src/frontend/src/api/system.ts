import { api } from './client';
import { DashboardSummary, SystemStatus } from '../types';

export const systemApi = {
  getStatus: () =>
    api.get<SystemStatus>('/system/status'),

  getDashboardSummary: () =>
    api.get<DashboardSummary>('/dashboard/summary'),

  checkHealth: () =>
    api.get<{ status: string }>('/healthcheck'),
};
