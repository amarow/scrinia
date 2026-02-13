# Entwicklungsplan: Tagzilla Modern

## Übergeordnetes Ziel
- Modernes Dokumenten-Management-System (DMS) für lokale Dateien.
- Tag-basiertes System anstelle von hierarchischen Ordnerstrukturen.
- Integrierte Dateivorschau für gängige Formate (Text, PDF, Office, Bilder).
- Unterstützung für externe Viewer (systemweites Öffnen von Dateien).
- Verwaltung mehrerer Quellverzeichnisse (Scopes).

## Aktueller Status (Februar 2026)

### Backend (Node.js/Express) - IMPLEMENTIERT
- **Technologie:** TypeScript, Express 5.
- **Crawler:** Scannt Scopes, erkennt Dateiänderungen (Größe, Datum) und verwaltet FileHandles in der DB.
- **Datenbank:** SQLite via `better-sqlite3`. Schema umfasst `FileHandle`, `Tag`, `Scope`, `User`, `PrivacyProfile`, `ApiKey`.
- **Authentifizierung:** JWT-basiert für die UI, API-Keys für externe Tools.
- **Features:** 
    - Full-Text-Search (FTS5) Vorbereitung.
    - Dokumenten-Extraktion (.docx via mammoth, .odt via zip/xml, .heic Konvertierung via sharp/heic-convert).
    - ZIP-Browser (Anzeige und Extraktion einzelner Dateien aus Archiven).
    - Datenschutz: Schwärzung (Redaction) sensibler Daten in der Textvorschau via Privacy-Regeln.
    - System-Integration: Öffnen von Dateien mit Standard-Apps (Linux: `xdg-open`/`gio`, Win/Mac Support).

### Frontend (React/Vite) - IMPLEMENTIERT
- **Technologie:** TypeScript, Vite, React 19.
- **UI-Library:** Mantine v8 (Dark/Light Mode ready).
- **State-Management:** Zustand (persistiert AppState).
- **Features:**
    - Dreigeteiltes Layout: Header (Suche/User), Tags-Area (links), File-List (rechts).
    - Drag & Drop: Dateien auf Tags ziehen oder Tags auf Dateien ziehen (dnd-kit).
    - Lokalisierung (i18n): Deutsch/Englisch Support.
    - Responsive Design für Desktop und Tablet.

## Nächste Schritte & Offene Punkte

### Kurzfristig (Prio 1)
- [ ] **FTS-Optimierung:** Sicherstellen, dass der Index bei Änderungen am Dateisystem zuverlässig aktualisiert wird.
- [ ] **Vorschau-Erweiterung:** PDF-Rendering im Browser verbessern (aktuell oft Download oder externer Viewer).
- [ ] **UI Polishing:** Performance bei sehr großen Dateilisten (Virtual Scrolling ist bereits vorbereitet via `@tanstack/react-virtual`).

### Mittelfristig (Prio 2)
- [ ] **Automatische Verschlagwortung:** Einfache KI-gestützte oder Regel-basierte Tag-Vorschläge basierend auf Dateiinhalten.
- [ ] **Erweiterte Filter:** Kombinationen von Tags (AND/OR/NOT) in der UI intuitiver gestalten.
- [ ] **Export/Backup:** Export der Datenbank und der Tag-Zuordnungen als JSON/CSV.

### Langfristig (Prio 3)
- [ ] **Multi-User Collaboration:** Teilen von Scopes zwischen Benutzern (aktuell stark auf lokalen Einzelnutzer fokussiert).
- [ ] **Plugin-System:** Eigene Parser für exotische Dateiformate.

## Infrastruktur
- Nur lokaler Betrieb (Self-Hosted).
- Start via `start.sh` (Server + Client).
