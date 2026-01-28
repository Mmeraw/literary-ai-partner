#!/bin/bash
# Worker process health check
# Usage: ./scripts/worker-check.sh

PID_FILE=".dev-worker.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "❌ Worker not running (no PID file)"
  exit 1
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
  echo "✅ Worker running (PID: $PID)"
  echo ""
  ps -p "$PID" -o pid,ppid,etime,cmd
  exit 0
else
  echo "❌ Worker not running (stale PID: $PID)"
  rm -f "$PID_FILE"
  exit 1
fi
