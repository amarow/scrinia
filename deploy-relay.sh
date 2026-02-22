#!/bin/bash
set -e # Bricht ab, sobald ein Befehl fehlschlägt

# --- KONFIGURATION (BITTE ANPASSEN) ---
# IP oder Hostname deines Oracle Servers (Alias aus ~/.ssh/config)
REMOTE_HOST="oracle" 
# SSH User (bei Oracle Linux standardmäßig 'opc')
REMOTE_USER="opc"
# Zielverzeichnis auf dem Server
REMOTE_DIR="/home/opc/scrinia/relay"
# Name des PM2 Prozesses auf dem Server
PM2_NAME="scrinia-relay"
# --------------------------------------

echo "=== 🚀 Start Deployment: Scrinia Relay ==="

# 1. Lokal bauen
echo "🔨 [1/6] Baue TypeScript Backend lokal..."
cd relay
npm install --silent
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Backend Build fehlgeschlagen!"
    exit 1
fi

echo "🔨 [2/6] Baue React Frontend lokal..."
cd client
npm install --silent
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend Build fehlgeschlagen!"
    exit 1
fi
cd ../..

# 2. Artefakt vorbereiten
echo "📦 [3/6] Erstelle Deployment-Paket..."
rm -rf deploy_tmp
mkdir -p deploy_tmp
mkdir -p deploy_tmp/client

# Wir kopieren nur das, was für die Produktion nötig ist
cp relay/package.json deploy_tmp/
cp relay/package-lock.json deploy_tmp/
cp -r relay/dist deploy_tmp/
cp -r relay/client/dist deploy_tmp/client/
# Optional: .env kopieren, falls sie lokal verwaltet wird
# cp relay/.env deploy_tmp/ 

# 3. Übertragen
echo "📡 [4/6] Übertrage Daten an $REMOTE_HOST..."
# Rsync synchronisiert nur Änderungen
rsync -avz --delete deploy_tmp/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

# 4. Remote Installation
echo "🔧 [5/6] Installiere Abhängigkeiten auf dem Server..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && npm install --omit=dev"

# 5. Neustart (Robust: Restart oder Start)
echo "🔄 [6/6] Starte Service via PM2..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && (pm2 restart $PM2_NAME || pm2 start dist/index.js --name $PM2_NAME)"

# Aufräumen
rm -rf deploy_tmp

echo "=== ✅ Deployment erfolgreich abgeschlossen! ==="
