#!/bin/bash
echo "Preparing Scrinia for PROD mode..."

# Set Oracle Relay URL
export RELAY_URL="https://scrina.duckdns.org"

# Build and Start Backend
echo "Building and Starting Backend (Sync -> $RELAY_URL)..."
cd server
npm run build
npm start &
SERVER_PID=$!
cd ..

# Build and Start Frontend Preview
echo "Building and Starting Frontend (Production Build)..."
cd client
npm run build
npm run preview &
CLIENT_PID=$!
cd ..

echo "------------------------------------------------"
echo "Services started in PROD mode."
echo "Backend PID: $SERVER_PID"
echo "Frontend PID: $CLIENT_PID (usually on port 4173)"
echo "Press CTRL+C to stop all."
echo "------------------------------------------------"

trap "kill $SERVER_PID $CLIENT_PID; exit" SIGINT

wait
