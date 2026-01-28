#!/bin/bash
# Safe dev server startup with port checking and PID tracking
# Usage: ./scripts/dev-server-start.sh

set -e

DEV_PORT=3002
API_PORT=3111
PID_FILE=".dev-server.pid"

echo "🔍 Pre-flight checks..."

# Check if PID file exists and process is still running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "❌ Dev server already running (PID: $OLD_PID)"
    echo "   Stop it first with: kill $OLD_PID"
    exit 1
  else
    echo "⚠️  Stale PID file found, removing..."
    rm "$PID_FILE"
  fi
fi

# Check port availability
echo "🔍 Checking port $DEV_PORT..."
if ! ./scripts/check-port.sh $DEV_PORT; then
  exit 1
fi

echo "🔍 Checking port $API_PORT..."
if ! ./scripts/check-port.sh $API_PORT; then
  exit 1
fi

# All checks passed
echo ""
echo "✅ All pre-flight checks passed"
echo "🚀 Starting dev server on port $DEV_PORT (API: $API_PORT)..."
echo ""
echo "   Health check: http://localhost:$API_PORT/api/health"
echo "   Application:  http://localhost:$DEV_PORT"
echo ""
echo "   Press CTRL+C to stop"
echo ""

# Start the server and capture PID
npm run dev &
SERVER_PID=$!

# Save PID
echo $SERVER_PID > "$PID_FILE"

echo "📝 Server PID: $SERVER_PID (saved to $PID_FILE)"

# Wait for server and cleanup on exit
function cleanup {
  echo ""
  echo "🛑 Shutting down dev server (PID: $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "✅ Cleanup complete"
}

trap cleanup EXIT INT TERM

# Wait for the background process
wait $SERVER_PID
