#!/bin/bash
# Development script to run both API backend and web frontend

set -e

VAULT_PATH="${1:-}"

if [ -z "$VAULT_PATH" ]; then
    echo "Usage: ./scripts/dev-web.sh <vault-path>"
    echo ""
    echo "Example:"
    echo "  ./scripts/dev-web.sh ~/Documents/MyVault"
    echo "  ./scripts/dev-web.sh ./anki-vault"
    exit 1
fi

# Resolve to absolute path
if [[ "$VAULT_PATH" != /* ]]; then
    VAULT_PATH="$(pwd)/$VAULT_PATH"
fi

echo "Starting development servers..."
echo "  Vault: $VAULT_PATH"
echo "  API:   http://localhost:3001"
echo "  Web:   http://localhost:5173"
echo ""

# Kill background processes on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $API_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start API backend
echo "Starting API backend..."
cd "$(dirname "$0")/../packages/api-backend"
VAULT_PATH="$VAULT_PATH" npx tsx src/index.ts &
API_PID=$!
cd - > /dev/null

# Wait for API to be ready
echo "Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "API is ready!"
        break
    fi
    sleep 0.5
done

# Start web frontend with API URL
echo "Starting web frontend..."
cd "$(dirname "$0")/../packages/web"
VITE_API_URL=http://localhost:3001 npx vite &
WEB_PID=$!
cd - > /dev/null

echo ""
echo "Both servers are running!"
echo "  Open http://localhost:5173 in your browser"
echo "  Press Ctrl+C to stop"
echo ""

# Wait for either process to exit
wait $API_PID $WEB_PID
