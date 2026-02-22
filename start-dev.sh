#!/bin/bash
echo "Starting Scrinia Dev Environment..."

# Start Backend
echo "Starting Backend on port 3001..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

# Start Relay Backend (Local Dev)
echo "Starting Relay Backend on port 3002..."
cd relay
npm run dev &
RELAY_PID=$!
cd ..

# Start Main Frontend
echo "Starting Main Frontend..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

# Start Relay Frontend (Optional, for HMR)
echo "Starting Relay Frontend..."
cd relay/client
npm run dev &
RELAY_CLIENT_PID=$!
cd ..

echo "All services started."
echo "---------------------------------------------------"
echo "Main Backend:   http://localhost:3001"
echo "Relay Backend:  http://localhost:3002 (serves static UI)"
echo "Admin Frontend:  http://localhost:5174 (usually)"
echo "Relay Frontend: http://localhost:5173 (usually, for dev)"
echo "---------------------------------------------------"
echo "PIDs: Server=$SERVER_PID, Relay=$RELAY_PID, Client=$CLIENT_PID, RelayClient=$RELAY_CLIENT_PID"
echo "Press CTRL+C to stop all."

trap "kill $SERVER_PID $RELAY_PID $CLIENT_PID $RELAY_CLIENT_PID; exit" SIGINT

wait