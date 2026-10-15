import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { PortfoliosPage } from './pages/PortfoliosPage';
import { PortfolioDetailPage } from './pages/PortfolioDetailPage';
import { StocksPage } from './pages/StocksPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { PortfolioAnalysisPage } from './pages/PortfolioAnalysisPage';
import { ReportsPage } from './pages/ReportsPage';
import { JobsPage } from './pages/JobsPage';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/portfolios" element={<PortfoliosPage />} />
          <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
          <Route path="/stocks" element={<StocksPage />} />
          <Route path="/analysis" element={<StockDetailPage />} />
          <Route path="/portfolio-analysis" element={<PortfolioAnalysisPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
