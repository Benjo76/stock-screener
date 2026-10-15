import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Globe,
  Key,
  Moon,
  Save,
  Server,
  Shield,
  Sun,
} from 'lucide-react';
import { systemApi } from '../api/system';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Alert } from '../components/ui/Alert';

export const SettingsPage: React.FC = () => {
  const { apiUrl, apiKey, defaultCurrency, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();

  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [inputCurrency, setInputCurrency] = useState(defaultCurrency);
  const [isSaved, setIsSaved] = useState(false);

  // Analysis Preferences
  const [autoSync, setAutoSync] = useState(() => {
    return localStorage.getItem('stock_screener_auto_sync') !== 'false';
  });
  const [riskThreshold, setRiskThreshold] = useState(() => {
    return localStorage.getItem('stock_screener_risk_threshold') || '15';
  });

  const { data: status } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: systemApi.getStatus,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      apiUrl: inputUrl.trim(),
      apiKey: inputKey.trim(),
      defaultCurrency: inputCurrency,
    });
    localStorage.setItem('stock_screener_auto_sync', String(autoSync));
    localStorage.setItem('stock_screener_risk_threshold', riskThreshold);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Einstellungen & Systemkonfiguration
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Verwalten Sie API-Endpunkte, Authentifizierungsschlüssel, Währungsstandards und Erscheinungsbild.
        </p>
      </div>

      {isSaved && (
        <Alert variant="success" title="Einstellungen erfolgreich gespeichert!">
          Die Konfiguration wurde übernommen und lokal gesichert.
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Backend & API Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <span>API-Verbindung & Authentifizierung</span>
            </CardTitle>
            <CardDescription>
              Backend-Endpunkt und X-API-KEY für autorisierte API-Aufrufe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Backend API-URL"
              placeholder="http://localhost:8000 oder /api"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                X-API-KEY (Geheimschlüssel)
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 pr-10 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Geheimer API-Key"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <Shield className="h-3 w-3 text-emerald-500" />
                <span>Gespeichert im geschützten Browserspeicher (nie unverschlüsselt übertragen).</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Display & Localization Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>Darstellung & Währung</span>
            </CardTitle>
            <CardDescription>
              Standard-Währung für Gesamtkennzahlen und Farbschema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Standard-Basiswährung"
                value={inputCurrency}
                onChange={(e) => setInputCurrency(e.target.value)}
              >
                <option value="EUR">EUR (€) - Euro</option>
                <option value="USD">USD ($) - US-Dollar</option>
                <option value="CHF">CHF (Fr.) - Schweizer Franken</option>
                <option value="GBP">GBP (£) - Britisches Pfund</option>
              </Select>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  Erscheinungsbild (Theme)
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={theme === 'dark' ? 'primary' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    <span>Dark Mode</span>
                  </Button>
                  <Button
                    type="button"
                    variant={theme === 'light' ? 'primary' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>Light Mode</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>Analyseoptionen & Risikoschwellen</span>
            </CardTitle>
            <CardDescription>
              Parameter für automatische Depotwarnungen und Datenabfragen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Klumpenrisiko-Warnschwelle (%)"
                value={riskThreshold}
                onChange={(e) => setRiskThreshold(e.target.value)}
              >
                <option value="10">10 % - Streng</option>
                <option value="15">15 % - Empfohlen</option>
                <option value="20">20 % - Moderat</option>
                <option value="25">25 % - Tolerant</option>
              </Select>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Automatische Aktualisierung bei Bestandsänderungen</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" size="lg" className="gap-2">
            <Save className="h-4 w-4" />
            <span>Einstellungen speichern</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
