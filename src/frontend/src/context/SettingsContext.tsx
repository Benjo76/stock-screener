import React, { createContext, useContext, useState } from 'react';
import { getApiKey, getApiUrl, setApiKey as saveApiKey, setApiUrl as saveApiUrl } from '../api/client';

interface SettingsContextType {
  apiUrl: string;
  apiKey: string;
  defaultCurrency: string;
  updateSettings: (newSettings: { apiUrl?: string; apiKey?: string; defaultCurrency?: string }) => void;
  formatCurrency: (value: number | null | undefined, currency?: string | null) => string;
  formatNumber: (value: number | null | undefined, decimals?: number) => string;
  formatPercent: (value: number | null | undefined) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiUrl, setApiUrlState] = useState<string>(getApiUrl());
  const [apiKey, setApiKeyState] = useState<string>(getApiKey());
  const [defaultCurrency, setDefaultCurrencyState] = useState<string>(
    () => localStorage.getItem('stock_screener_currency') || 'EUR'
  );

  const updateSettings = (newSettings: {
    apiUrl?: string;
    apiKey?: string;
    defaultCurrency?: string;
  }) => {
    if (newSettings.apiUrl !== undefined) {
      saveApiUrl(newSettings.apiUrl);
      setApiUrlState(newSettings.apiUrl);
    }
    if (newSettings.apiKey !== undefined) {
      saveApiKey(newSettings.apiKey);
      setApiKeyState(newSettings.apiKey);
    }
    if (newSettings.defaultCurrency !== undefined) {
      localStorage.setItem('stock_screener_currency', newSettings.defaultCurrency);
      setDefaultCurrencyState(newSettings.defaultCurrency);
    }
  };

  const formatCurrency = (value: number | null | undefined, currency?: string | null) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'Keine Daten';
    }
    const curr = currency || defaultCurrency || 'EUR';
    try {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: curr,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${curr}`;
    }
  };

  const formatNumber = (value: number | null | undefined, decimals: number = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '—';
    }
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '—';
    }
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)} %`;
  };

  return (
    <SettingsContext.Provider
      value={{
        apiUrl,
        apiKey,
        defaultCurrency,
        updateSettings,
        formatCurrency,
        formatNumber,
        formatPercent,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
