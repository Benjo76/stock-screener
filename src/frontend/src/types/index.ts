export interface StockPrice {
  id: number;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  adjusted_close: number | null;
  volume: number | null;
  currency: string | null;
  data_source: string;
}

export interface FundamentalData {
  id: number;
  period_type: string;
  fiscal_year: number | null;
  fiscal_period: string | null;
  period_end_date: string | null;
  revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  eps: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  operating_cash_flow: number | null;
  free_cash_flow: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
  current_ratio: number | null;
  debt_to_equity: number | null;
  dividend_per_share: number | null;
  dividend_yield: number | null;
  pe_ratio: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  currency: string | null;
  data_source: string;
  created_at: string | null;
}

export interface Stock {
  id: number;
  isin: string | null;
  wkn: string | null;
  ticker: string | null;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  created_at?: string;
  prices?: StockPrice[];
  fundamentals?: FundamentalData[];
}

export interface StockResolveResult {
  resolved: boolean;
  isin: string | null;
  wkn: string | null;
  ticker: string | null;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  provider: string | null;
  message: string | null;
}

export interface PortfolioHolding {
  id: number;
  portfolio_id: number;
  stock_id: number;
  stock?: Stock;
  shares: number;
  average_buy_price: number | null;
  purchase_price?: number | null;
  current_price?: number | null;
  total_cost: number | null;
  market_value?: number | null;
  gain_loss?: number | null;
  return_pct?: number | null;
  currency: string | null;
  data_source?: string | null;
  last_imported_at?: string | null;
}

export interface PortfolioTransaction {
  id: number;
  portfolio_id: number;
  stock_id: number;
  stock?: Stock;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'SPLIT' | string;
  shares: number | null;
  price_per_share: number | null;
  total_amount: number;
  fees: number;
  currency: string | null;
  transaction_date: string;
  external_transaction_id: string | null;
  notes: string | null;
}

export interface Portfolio {
  id: number;
  name: string;
  description: string | null;
  currency: string;
  created_at?: string;
  updated_at?: string;
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
}

export interface TopPositionItem {
  holding_id?: number;
  stock_id: number;
  portfolio_id: number;
  portfolio_name?: string;
  name: string;
  ticker: string | null;
  isin: string | null;
  shares: number;
  average_buy_price: number | null;
  purchase_price?: number | null;
  current_price: number | null;
  total_cost: number | null;
  market_value: number | null;
  gain_loss: number | null;
  return_pct: number | null;
  currency: string;
  weight_pct: number | null;
  sector: string | null;
}

export interface PortfolioSummary {
  portfolio_id: number;
  name: string;
  currency: string;
  total_cost: number | null;
  total_value: number | null;
  total_gain_loss: number | null;
  total_return_pct: number | null;
  positions_count: number;
  top_holdings: TopPositionItem[];
  sector_allocation: Record<string, number>;
  currency_allocation: Record<string, number>;
}

export interface AnalysisJob {
  id: number;
  job_type: 'STOCK_ANALYSIS' | 'PORTFOLIO_ANALYSIS' | string;
  stock_id: number | null;
  portfolio_id: number | null;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  error_message: string | null;
  params: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  stock?: Stock;
  portfolio?: Portfolio;
}

export interface AnalysisResult {
  id: number;
  job_id: number | null;
  stock_id: number | null;
  portfolio_id: number | null;
  version: number;
  analysis_type: string;
  headline: string | null;
  score: number | null;
  summary: string | null;
  details: Record<string, any>;
  data_gaps: string[] | null;
  uncertainties: string[] | null;
  data_sources: string[] | null;
  data_timestamp: string | null;
  created_at: string | null;
  stock?: Stock;
  portfolio?: Portfolio;
}

export interface ReportAnalysis {
  id: number;
  report_id: number;
  stock_id: number;
  summary: string | null;
  extracted_kpis: Record<string, any> | null;
  extracted_statements: Array<{ topic: string; statement: string; sentiment?: string }> | null;
  identified_trends: string[] | null;
  risks: string[] | null;
  opportunities: string[] | null;
  is_verified: boolean;
  verification_notes: string | null;
  data_source: string;
  created_at: string | null;
}

export interface CompanyReport {
  id: number;
  stock_id: number;
  report_type: string;
  fiscal_year: number | null;
  fiscal_period: string | null;
  report_date: string | null;
  title: string | null;
  content_text: string | null;
  source_url: string | null;
  data_source: string;
  created_at: string | null;
  analyses: ReportAnalysis[];
  stock?: Stock;
}

export interface SystemStatus {
  status: string;
  database: string;
  active_provider: string;
  available_providers: string[];
  version: string;
  total_stocks: number;
  total_portfolios: number;
  total_reports: number;
  total_jobs: number;
}

export interface DataWarning {
  severity: 'warning' | 'info' | 'error';
  stock_id: number | null;
  stock_name: string | null;
  message: string;
  recommendation: string | null;
}

export interface HistoricalPerformance {
  date: string;
  total_value: number;
  total_cost: number;
}

export interface DashboardSummary {
  total_portfolio_value: number | null;
  total_invested_cost: number | null;
  total_unrealized_gain_loss: number | null;
  total_unrealized_return_pct: number | null;
  currency: string;
  portfolios_count: number;
  stocks_count: number;
  holdings_count: number;
  top_positions: TopPositionItem[];
  sector_allocation: Record<string, number>;
  currency_allocation: Record<string, number>;
  recent_analyses: AnalysisResult[];
  recent_jobs: AnalysisJob[];
  recent_reports: CompanyReport[];
  data_warnings: DataWarning[];
  performance_history: HistoricalPerformance[];
}

export interface CsvPreviewItem {
  row_number: number;
  isin?: string;
  wkn?: string;
  ticker?: string;
  name?: string;
  shares?: number;
  average_buy_price?: number;
  purchase_price?: number;
  current_price?: number;
  price?: number;
  total_cost?: number;
  price_per_share?: number;
  total_amount?: number;
  fees?: number;
  currency?: string;
  transaction_type?: string;
  transaction_date?: string;
  is_valid: boolean;
  errors: string[];
}

export interface CsvImportPreview {
  import_type: 'holdings' | 'transactions' | string;
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  errors: string[];
  warnings: string[];
  preview_items: CsvPreviewItem[];
}

export interface CsvImportResult {
  portfolio_id: number;
  import_type: string;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  row_errors: Array<{ row: number; errors: string[]; data: any }>;
}
