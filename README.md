# Lokaler Aktien- & Portfolio-Research-Agent

Ein modularer, lokal betriebener Python- und FastAPI-Agent zur Fundamentalanalyse von Einzelaktien und Verwaltung privater Depots. Das System speichert historische Kurse und Finanzkennzahlen dauerhaft in PostgreSQL, wertet Quartals- sowie Geschäftsberichte aus und ermöglicht einen fehlertoleranten CSV-Import von Depotauszügen.

---

## Inhaltsverzeichnis

1. [Funktionsübersicht](#funktionsübersicht)
2. [Architektur & Technologien](#architektur--technologien)
3. [Voraussetzungen & Konfiguration](#voraussetzungen--konfiguration)
4. [Starten mit Docker Compose](#starten-mit-docker-compose)
5. [Datenbank & Alembic-Migrationen](#datenbank--alembic-migrationen)
6. [API-Nutzung & Endpunkte](#api-nutzung--endpunkte)
7. [CSV-Import (Bestand & Transaktionen)](#csv-import-bestand--transaktionen)
8. [Finanzdaten-Provider & Fundamentalanalyse](#finanzdaten-provider--fundamentalanalyse)
9. [Berichtsauswertung (Geschäftsberichte)](#berichtsauswertung-geschäftsberichte)
10. [Hintergrundjobs & Worker](#hintergrundjobs--worker)
11. [Automatisierte Tests](#automatisierte-tests)
12. [Backup & Wiederherstellung](#backup--wiederherstellung)
13. [Bekannte Einschränkungen](#bekannte-einschränkungen)

---

## Funktionsübersicht

- **Wertpapierverwaltung**: Anlegen, Suchen und Auflösen von Aktien anhand von ISIN, WKN oder Tickersymbol.
- **Depotverwaltung & CSV-Import**: Unterstützung von aktuellen Bestandsauszügen und vollständigen Transaktionshistorien (Kauf, Verkauf, Dividende) mit Vorschau-, Validierungs- und Duplikaterkennungsmechanismen.
- **Kostenlose Finanzdaten**: Anbindung an kostenlose Datenquellen (z. B. Yahoo Finance) sowie Offline-/Mock-Provider für Tests.
- **Regelbasierte Fundamentalanalyse**: Berechnung von Kennzahlen (Umsatz- und Gewinnwachstum, Margen, EPS, Operating/Free Cashflow, Net Debt, Debt-to-Equity, Current Ratio, KGV, KUV, KBV, Dividendenrendite) unter Berücksichtigung von Branchenunterschieden.
- **Transparenz & Datenintegrität**: Klare Unterscheidung zwischen fehlenden Datenwerten (`None`) und tatsächlich negativen Kennzahlen (z. B. Jahresfehlbetrag). Keine erfundenen Daten.
- **Berichtsauswertung**: Extraktion von Kennzahlen, Trends, Chancen und Risiken aus Quartals- und Geschäftsberichten mit standardmäßiger Kennzeichnung als *Ungeprüft*.
- **Versionierte Analysen & Jobs**: Manuelles Starten von Analysen, Speichern jeder Analyseversion ohne stillschweigendes Überschreiben und Verhindern paralleler Doppelausführungen desselben Jobs.
- **Lokale Sicherheit**: Standardmäßiges Binding an `127.0.0.1`, Authentifizierung via `X-API-KEY`, Upload-Größenlimits und Request-Validierung.

---

## Architektur & Technologien

- **Sprache & Framework**: Python 3.12, FastAPI, Pydantic v2
- **Datenbank & ORM**: PostgreSQL 16, SQLAlchemy 2.x
- **Schema-Migrationen**: Alembic
- **Containerisierung**: Docker & Docker Compose
- **HTTP-Client**: HTTPX
- **Testing**: pytest
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query, React Router, Lucide Icons

### Projektstruktur

```text
├── alembic/                 # Alembic-Migrationsskripte & Konfiguration
├── alembic.ini              # Alembic-INI-Datei
├── docker-compose.yaml      # Docker Compose für API, DB, Frontend und Worker
├── Dockerfile               # Backend Python 3.12 Dockerfile
├── Dockerfile.frontend      # Multi-Stage Node.js & Nginx Frontend Dockerfile
├── nginx.conf               # Nginx Reverse Proxy Konfiguration für Frontend & API
├── pyproject.toml           # Projektkonfiguration und Pytest-Einstellungen
├── requirements.txt         # Python-Abhängigkeiten
├── src/
│   ├── api/                 # FastAPI REST API Backend
│   │   ├── main.py          # FastAPI App Initialisierung & Lifespan
│   │   ├── dependencies.py  # DB-Session-Dependencies
│   │   ├── middlewares/     # Authentication-, Validation- & CORS-Middlewares
│   │   ├── openapi.py       # OpenAPI / Swagger Setup
│   │   ├── responses.py     # Einheitliche API-Responses
│   │   ├── routes/          # REST-Endpunkte (health, dashboard, stocks, portfolios, analyses, reports)
│   │   └── schemas/         # Pydantic Schemas (Stock, Portfolio, Analysis, Report, System)
│   ├── screener/            # Backend Fach- und Analyselogik
│   │   ├── config.py        # Datenbank- & Umgebungskonfiguration
│   │   ├── worker.py        # Hintergrund-Worker für asynchrone Jobs
│   │   ├── analysis/        # Analyse-Engines (Aktien, Depots, Geschäftsberichte)
│   │   ├── db/              # SQLAlchemy Base, Modelle und SessionLocal
│   │   ├── importers/       # Robuster CSV-Importer für Depots
│   │   ├── providers/       # Schnittstellen und Provider für Finanzdaten
│   │   └── services/        # Business-Logik-Services (Stock, Portfolio, Analysis, Report, Dashboard)
│   └── frontend/            # Vollständiges Webfrontend (React + TypeScript + Vite)
│       ├── package.json     # Node-Abhängigkeiten
│       ├── vite.config.ts   # Vite Build- & Proxy-Konfiguration
│       ├── tailwind.config.js # Tailwind CSS Konfiguration
│       └── src/
│           ├── api/         # API-Client & Service-Module
│           ├── components/  # Wiederverwendbare UI-, Layout- und Chart-Komponenten
│           ├── context/     # React Contexts (Theme: Light/Dark, Settings)
│           ├── pages/       # Hauptansichten (Dashboard, Portfolio, Stocks, Analysis, etc.)
│           └── types/       # TypeScript Typdefinitionen
└── tests/                   # Automatisierte Backend Unit- und Integrationstests
```

---

## Voraussetzungen & Konfiguration

### 1. `.env` anlegen

Kopiere die Vorlage `.env.example` in eine neue `.env`-Datei:

```bash
cp .env.example .env
```

### 2. Wichtige Umgebungsvariablen

| Variable | Beschreibung | Standardwert |
| :--- | :--- | :--- |
| `APP_ENV` | Umgebung (`production`, `development`, `test`) | `development` |
| `POSTGRES_DB` | Name der PostgreSQL-Datenbank | `stockagent` |
| `POSTGRES_USER` | Benutzername für PostgreSQL | `stockagent` |
| `POSTGRES_PASSWORD` | Sicheres Passwort für die Datenbank | *(erforderlich)* |
| `API_KEY` | Geheimschlüssel für den `X-API-KEY`-Header | `dev-secret-key` |
| `FINANCIAL_DATA_PROVIDER` | Aktiver Provider (`auto`, `yahoo`, `mock`) | `auto` |
| `MAX_UPLOAD_SIZE_BYTES` | Maximales Größenlimit für Uploads in Bytes | `10485760` (10 MB) |

---

## Starten mit Docker Compose

Starte die PostgreSQL-Datenbank, die FastAPI-Anwendung, den Screener-Worker und das Web-Frontend mit folgendem Befehl:

```bash
docker compose up --build -d
```

Nach erfolgreichem Start:
- **Web-Frontend (Dashboard)**: `http://localhost:3000` (oder `http://127.0.0.1:3000`)
- **API-Basisadresse**: `http://127.0.0.1:8000`
- **Interaktive API-Dokumentation (Swagger UI)**: `http://127.0.0.1:8000/docs`
- **Redoc**: `http://127.0.0.1:8000/redoc`

---

## Lokale Frontend-Entwicklung

Für die lokale Entwicklung des Frontends mit Hot-Module-Replacement (Vite):

```bash
# 1. In das Frontend-Verzeichnis wechseln
cd src/frontend

# 2. Abhängigkeiten installieren
npm install

# 3. Entwicklungs-Server starten
npm run dev
```

Der Vite-Entwicklungsserver läuft standardmäßig auf `http://localhost:5173` und leitet API-Aufrufe über den vorkonfigurierten Proxy automatisch an das Backend (`http://localhost:8000`) weiter.

### Frontend-Build & Type-Check

```bash
cd src/frontend
npm run build
```

Container-Status prüfen:

```bash
docker compose ps
```

Container-Logs ansehen:

```bash
docker compose logs -f api
docker compose logs -f screener
```

Container stoppen:

```bash
docker compose down
```

---

## Datenbank & Alembic-Migrationen

Alembic verwaltet alle Datenbankschemata. Bei jedem Container-Start führt das Image automatisch `alembic upgrade head` aus.

### Migrationen manuell ausführen

**Lokal (im Virtualenv):**
```bash
alembic upgrade head
```

**Im Docker-Container:**
```bash
docker compose exec api alembic upgrade head
```

**Neue Migration erstellen (bei Modelländerungen):**
```bash
alembic revision --autogenerate -m "beschreibung_der_aenderung"
```

---

## API-Nutzung & Endpunkte

Alle geschützten Endpunkte erfordern den Header `X-API-KEY: <dein-api-key>`.

### 1. System & Healthcheck
- `GET /healthcheck`: Allgemeiner Dienststatus (öffentlich).
- `GET /healthcheck/db`: Prüfung der Datenbankverbindung (öffentlich).

### 2. Wertpapiere (`/stocks`)
- `GET /stocks`: Liste aller Wertpapiere abrufen (mit Suchparameter `?query=AAPL`).
- `POST /stocks`: Wertpapier anlegen oder abrufen (anhand von ISIN, WKN oder Ticker).
- `GET /stocks/{stock_id}`: Detaildaten eines Wertpapiers.
- `POST /stocks/{stock_id}/sync`: Historische Kurse und Fundamentaldaten vom Provider abrufen.
- `GET /stocks/{stock_id}/prices`: Historische Kursdaten abrufen.
- `GET /stocks/{stock_id}/fundamentals`: Historische Fundamentaldaten nach Berichtsperioden abrufen.
- `GET /stocks/{stock_id}/reports`: Zugeordnete Unternehmensberichte abrufen.
- `GET /stocks/{stock_id}/analyses`: Alle historischen und versionierten Analyseergebnisse abrufen.

### 3. Depots & CSV-Import (`/portfolios`)
- `GET /portfolios`: Alle Depots auflisten.
- `POST /portfolios`: Neues Depot anlegen.
- `GET /portfolios/{portfolio_id}`: Depotdetails mit aktuellen Beständen und Transaktionen abrufen.
- `DELETE /portfolios/{portfolio_id}`: Depot löschen.
- `POST /portfolios/{portfolio_id}/import/preview`: CSV-Inhalt vor dem Import validieren und Vorschau anzeigen.
- `POST /portfolios/{portfolio_id}/import`: CSV-Depotauszug importieren.
- `GET /portfolios/{portfolio_id}/analyses`: Bisherige Depotanalysen abrufen.

### 4. Analysen (`/analyses`)
- `POST /analyses/stocks/{stock_id}`: Fundamentalanalyse für eine Aktie starten (`?sync=true` für sofortige synchrone Antwort).
- `POST /analyses/portfolios/{portfolio_id}`: Depot-Gesamtanalyse starten.
- `GET /analyses/jobs/{job_id}`: Status eines Hintergrundjobs abfragen (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`).
- `GET /analyses/{result_id}`: Detailliertes Analyseergebnis mit Scores, Risiken, Trends und Datenlücken abrufen.

### 5. Unternehmensberichte (`/reports`)
- `POST /reports`: Geschäfts- oder Quartalsbericht hochladen/speichern und automatische Auswertung starten.
- `GET /reports/{report_id}`: Bericht und dessen Auswertungen einsehen.
- `POST /reports/{report_id}/analyze`: Analyse für einen bestehenden Bericht erneut ausführen.
- `PATCH /reports/analyses/{analysis_id}/verify`: Extrahierten Bericht als *Geprüft* (`is_verified: true`) markieren.

---

## CSV-Import (Bestand & Transaktionen)

Der Importer erkennt automatisch Trennzeichen (Komma `,`, Semikolon `;`, Tabulator `\t`), Zahlenformate (deutsches `1.234,56` sowie internationales `1,234.56`) und Datumsformate.

### 1. Bestandsauszug (Holdings Snapshot)
Erwartete bzw. erkannte Spalten (deutsch oder englisch):
- `ISIN`, `WKN`, `Ticker` (mindestens ein Identifikator erforderlich)
- `Name` (Bezeichnung)
- `Bestand` / `Stück` / `Shares` / `Anzahl`
- `Einstandskurs` / `Kaufkurs` / `Price`
- `Gesamtwert` / `Kurswert` / `Total`
- `Währung` / `Currency`

**Beispiel (Semikolon-getrennt):**
```csv
ISIN;WKN;Name;Bestand;Einstandskurs;Währung
US0378331005;865985;Apple Inc.;10;150,50;EUR
DE0007164600;716460;SAP SE;25;120,00;EUR
```

### 2. Transaktionshistorie (Transactions History)
Erwartete bzw. erkannte Spalten:
- `Datum` / `Date`
- `Typ` / `Art` / `Type` (`BUY`/`Kauf`, `SELL`/`Verkauf`, `DIVIDEND`/`Dividende`)
- `ISIN` / `WKN` / `Ticker`
- `Stück` / `Shares`
- `Kurs` / `Price`
- `Gesamtbetrag` / `Amount`
- `Gebühren` / `Fees`
- `Währung` / `Currency`
- `Referenz` / `Transaction_ID` *(optional für Duplikaterkennung)*

**Beispiel:**
```csv
Date,Type,ISIN,WKN,Ticker,Shares,Price,Amount,Fees,Currency,Transaction_ID
2024-01-15,BUY,US0378331005,865985,AAPL,10,150.00,1505.00,5.00,USD,TX-1001
2024-02-15,BUY,US0378331005,865985,AAPL,5,160.00,805.00,5.00,USD,TX-1002
2024-03-01,SELL,US0378331005,865985,AAPL,4,180.00,715.00,5.00,USD,TX-1003
```

---

## Finanzdaten-Provider & Fundamentalanalyse

### Datenquellen
- **`YahooFinanceProvider`**: Kostenfreier Provider über offizielle Abfrage-Endpunkte ohne API-Key.
- **`MockDataProvider`**: Determinister Offline-Provider für automatisierte Tests und Offline-Betrieb.
- **`ProviderManager`**: Ermöglicht den transparenten Wechsel zwischen Providern.

### Analyse-Dimensionen
1. **Wachstum (25 Punkte)**: Umsatz-, Jahresüberschuss- und EPS-Wachstum im Mehrjahres-/Periodenvergleich.
2. **Rentabilität & Cashflow (25 Punkte)**: Brutto-, Operative- und Netto-Marge, Operating Cashflow und Free-Cashflow-Generierung.
3. **Finanzielle Stabilität (25 Punkte)**: Verschuldungsgrad (Debt-to-Equity), Netto-Verschuldung vs. Cashbestand, Current Ratio (Liquidität).
4. **Bewertung & Dividende (25 Punkte)**: KGV (P/E), KUV (P/S), KBV (P/B), Dividendenrendite und Ausschüttungskontinuität.

### Branchenspezifische Schwellenwerte
Die Engine passt Richtwerte dynamisch an (z. B. höhere Verschuldungstoleranz für Finanzdienstleister und Versorger, höhere Margenerwartungen für Softwareunternehmen).

---

## Berichtsauswertung (Geschäftsberichte)

Geschäftsberichte und Quartalsberichte können als Fließtext über `POST /reports` eingereicht werden.
- Die Engine extrahiert Umsatz, Margen, Cashflow-Größen, Management-Ausblicke (Guidance), Trends, Risiken und Chancen.
- **Ungeprüft-Kennzeichnung**: Alle automatisch extrahierten Werte erhalten zunächst den Status `is_verified: false` und werden transparent ausgewiesen.
- Über `PATCH /reports/analyses/{id}/verify` kann eine manuelle Verifikation hinterlegt werden.

---

## Hintergrundjobs & Worker

Für asynchrone Analysen oder zeitaufwendige Datensynchronisationen steht das Screener-Modul bereit:

```bash
# Direkt ausführen
python -m screener.worker
```

- Der Worker fragt periodisch nach Jobs im Status `PENDING` ab.
- Verhindert Mehrfachausführungen desselben Auftrags.
- Jede Analyse speichert ein neues, versioniertes Ergebnis in der Datenbank ab (`version = n + 1`).

---

## Automatisierte Tests

Die Testsuite deckt alle Kernfunktionen ohne externe Netzwerkabhängigkeiten ab:

```bash
# Tests lokal im Virtualenv ausführen
pytest -v
```

---

## Backup & Wiederherstellung

### PostgreSQL Backup erstellen
```bash
docker compose exec db pg_dump -U stockagent -d stockagent -F c -b -v -f /var/lib/postgresql/data/backup.dump
```

Das Backup befindet sich anschließend im persistenten Docker-Volume `postgres_data`.

### Backup wiederherstellen
```bash
docker compose exec db pg_restore -U stockagent -d stockagent -v -c /var/lib/postgresql/data/backup.dump
```

---

## Bekannte Einschränkungen

- **Kostenlose Datenquellen**: Öffentliche Endpunkte von Drittanbietern können Ratenbegrenzungen (Rate Limits) unterliegen.
- **Berichts-Parsing**: Automatisierte Regex- und Heuristik-Extraktion erfordert bei komplex formatierten Tabellen die manuelle Verifikation durch den Nutzer.
- **Keine Anlageberatung / Orderausführung**: Die Software dient ausschließlich der privaten Recherche. Es werden keine automatischen Handelsentscheidungen oder Orders ausgeführt.
