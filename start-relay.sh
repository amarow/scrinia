#!/bin/bash

# Scrinia Relay (Local Test Instance)
echo "Starting Scrinia Relay on Port 3002..."
cd relay
npx ts-node src/index.ts
