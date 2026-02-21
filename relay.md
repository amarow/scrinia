# Scrinia Relay: Architektur & Konzept

## Vision
Erweiterung von Scrinia um eine **High-Availability-Verteilungsschicht**.
Ziel ist es, Dokumente sicher und effizient an Dritte (Schüler, Kunden) oder maschinelle Konsumenten (KI-Agenten) bereitzustellen, ohne dass der lokale Rechner des Nutzers permanent eingeschaltet sein muss.

## Kernkonzepte

### 1. Das Konzept "Share"
Wir führen den Begriff **"Share"** als zentrales Nutzer-Element ein (ersetzt in der UI den technischen Begriff "API-Key").
*   Ein **Share** ist eine benannte Freigabe von Inhalten (z.B. "Unterlagen Mathe 10b").
*   Ein Share definiert:
    *   **Inhalt:** Welche Dateien (via Tags) enthalten sind.
    *   **Sicherheit:** Welche Privacy-Regeln (Schwärzungen) angewendet werden.
    *   **Zugriff:** Generiert technisch einen **API-Key** (Token), der als Teil eines Links weitergegeben wird.
*   **Status:** Ein Share kann **"Lokal"** (nur im LAN/Tunnel erreichbar) oder **"Cloud Synced"** (auf Relay gespiegelt) sein.

### 2. Content-Addressable Storage (CAS)
Um Bandbreite und Speicherplatz zu sparen (z.B. Lehrer verteilt das gleiche 50MB Video über 5 verschiedene Shares), nutzt der Relay-Server ein Hash-basiertes Speichersystem.
*   Dateien werden nicht unter Dateinamen gespeichert, sondern unter ihrem Hash (SHA-256).
*   **Deduplizierung:** Wenn Datei A im Share "Klasse 10b" hochgeladen wird, und später im Share "Nachhilfe Max", wird sie physisch nicht erneut übertragen. Der Server verlinkt nur den neuen Share auf den existierenden Blob.

### 3. Context Merging & Privacy (AI-Ready)
Der Relay-Server übernimmt die rechenintensive Aufgabe, aus vielen Einzeldateien einen einzigen Kontext-Strom für LLMs zu generieren.
*   **Ablauf:**
    1.  **Lokal:** Nutzer definiert visuell Schwärzungsregeln (z.B. per Drag & Drop in der Vorschau).
    2.  **Sync:** Nur die *Original-Dateien* (dedupliziert) und die *Regel-Konfiguration* (JSON) werden zum Relay übertragen.
    3.  **Relay (On-Demand):** Beim Abruf durch eine KI wendet der Relay-Server die hochgeladenen Regeln dynamisch auf den extrahierten Text an und liefert den geschwärzten Stream aus.
*   **Vorteil:** Regeln können nachträglich geändert werden, ohne dass große Dateien neu hochgeladen werden müssen.

---

## Architektur

### Komponente A: Scrinia Local (Master)
*   **Rolle:** Verwaltung, Tagging, Erstellen von Shares, Definition von Privacy-Regeln.
*   **Neuer Prozess (Sync Worker):**
    1.  Prüft alle Shares mit Status `cloud_sync: true`.
    2.  Ermittelt die zugehörigen Dateien basierend auf Tags.
    3.  Berechnet Hashes der Dateien.
    4.  Fragt Relay: "Hast du Hash `xyz` schon?"
    5.  Lädt nur fehlende Chunks hoch.
    6.  Übermittelt Metadaten & Regeln: "Share-ID `ABC` darf Hash `xyz` sehen + Wende Regelset `R1` an."

### Komponente B: Scrinia Relay (Server)
*   **Hosting:** VPS (z.B. Oracle Cloud Always Free) mit Persistent Storage (Block Volume).
*   **Tech Stack:** Node.js (Lightweight), SQLite.
*   **Datenbank (Relay-DB):**
    *   `Artifact`: { hash, size, stored_path }
    *   `AccessRule`: { share_token_hash, allowed_artifact_hash, virtual_filename, privacy_profile_config }
*   **Aufgabe:** Authentifizierung, Text-Extraktion (Caching), Anwendung von Privacy-Regeln, Auslieferung.

### Komponente C: Public Clients
Der Relay-Server bedient zwei Arten von Clients:

1.  **Das "Share-Frontend" (Human Interface):**
    *   Eine minimale React-Web-App, die direkt vom Relay-Server ausgeliefert wird.
    *   Zugriff via Share-Link (enthält Token).
    *   Funktionen: Dateiliste ansehen, Vorschau (PDF/Bild), Download.
    *   *Design:* Read-Only, extrem schnell, mobile-friendly.

2.  **Der "Context-Stream" (Machine Interface):**
    *   Endpunkt: `GET /api/v1/context?share_key=...`
    *   Funktion: Iteriert über alle Dateien im Share, extrahiert Text, wendet die synchronisierten Privacy-Regeln an und streamt alles als ein großes Markdown-Dokument zurück.

---

## Workflow-Beispiel: "Der Nachhilfelehrer"

1.  **Vorbereitung:**
    *   Lehrer legt lokal Ordner/Tags an: `#Klasse10b`.
    *   Öffnet eine Datei in der Vorschau, markiert "IBAN" -> "Neue Regel: IBAN schwärzen".
    *   Erstellt einen neuen **Share** "Klasse 10b - Sommersemester".
    *   Wählt Tag `#Klasse10b` und Regel "IBAN schwärzen".
    *   Aktiviert Option: "Cloud Sync".

2.  **Sync:**
    *   Scrinia Local hashd die PDFs.
    *   Lädt die Daten (falls neu) und die Regel-Config zum Relay hoch.

3.  **Verteilung:**
    *   Lehrer kopiert den **Share-Link** `https://files.scrinia.de/s/k10b...` und schickt ihn in die WhatsApp-Gruppe.
    *   Lehrer schaltet seinen Laptop aus.

4.  **Zugriff:**
    *   Schüler klickt Link -> Sieht Dateiliste.
    *   KI-Agent ruft Kontext ab -> Bekommt Text *ohne* IBAN (wurde vom Relay live geschwärzt).

5.  **Update:**
    *   Lehrer merkt: "Telefonnummer vergessen!". Fügt lokal Regel hinzu.
    *   Sync -> Nur die Regel-Config wird aktualisiert (Millisekunden).
    *   Ab sofort liefert das Relay auch keine Telefonnummern mehr aus.
