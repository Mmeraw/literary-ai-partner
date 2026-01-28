#!/bin/bash
# Safe worker shutdown with process group cleanup
# Usage: ./scripts/worker-stop.sh
#
# Key improvements (Phase 2A):
# - Kill entire process group, not just parent PID
# - Graceful SIGTERM first, force SIGKILL after timeout
# - Fallback pattern kills to catch stragglers

set -euo pipefail

PID_FILE=".dev-worker.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "⚠️  No worker PID file found"
  echo "   No action needed"
  exit 0
fi

PID="$(cat "$PID_FILE" || true)"

if [ -z "${PID:-}" ]; then
  echo "⚠️  PID file empty; removing"
  rm -f "$PID_FILE"
  exit 0
fi

if ps -p "$PID" > /dev/null 2>&1; then
  echo "🛑 Stopping worker (PID: $PID)..."
  
  # Graceful shutdown: SIGTERM to entire process group
  kill -TERM -- -"$PID" 2>/dev/null || true
  
  # Wait up to 10 seconds for graceful shutdown
  for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
      echo "✅ Worker stopped gracefully"
      rm -f "$PID_FILE"
      exit 0
    fi
    sleep 1
  done
  
  # Force kill entire process group if still running
  echo "⚠️  Worker did not stop gracefully, force killing process group..."
  kill -9 -- -"$PID" 2>/dev/null || true
  echo "✅ Worker force-stopped"
  
  # Fallback pattern kills (catch any stragglers outside process group)
  pkill -9 -f "workers/phase2Worker" 2>/dev/null || true
  pkill -9 -f "tsx.*workers/phase2Worker" 2>/dev/null || true
else
  echo "⚠️  Worker process $PID not running"
fi

rm -f "$PID_FILE"
echo "✅ PID file removed"
