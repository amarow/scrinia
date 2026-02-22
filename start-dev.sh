#!/bin/bash
echo "Starting Scrinia..."

# Start Backend
echo "Starting Backend on port 3001..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

# Start Relay (Local Dev)
echo "Starting Relay on port 3002..."
cd relay
npm run dev &
RELAY_PID=$!
cd ..

# Start Frontend
echo "Starting Frontend..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

echo "All services started."
echo "Backend PID: $SERVER_PID"
echo "Relay PID: $RELAY_PID"
echo "Frontend PID: $CLIENT_PID"
echo "Press CTRL+C to stop all."

trap "kill $SERVER_PID $RELAY_PID $CLIENT_PID; exit" SIGINT

wait