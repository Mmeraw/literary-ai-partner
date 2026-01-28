#!/bin/bash
# Safe dev server shutdown
# Usage: ./scripts/dev-server-stop.sh

PID_FILE=".dev-server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "⚠️  No PID file found"
  echo "   Checking for processes on ports 3002 and 3111..."
  
  FOUND=0
  for PORT in 3002 3111; do
    PID=$(lsof -t -i:$PORT 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
      echo "   Found process on port $PORT (PID: $PID)"
      kill -9 $PID 2>/dev/null || true
      echo "   ✅ Killed process $PID"
      FOUND=1
    fi
  done
  
  if [ $FOUND -eq 0 ]; then
    echo "   No dev server processes found"
  fi
  exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
  echo "🛑 Stopping dev server (PID: $PID)..."
  kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null || true
  sleep 1
  
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  Process still running, force killing..."
    kill -9 $PID
  fi
  
  echo "✅ Dev server stopped"
else
  echo "⚠️  Process $PID not running"
fi

rm -f "$PID_FILE"
echo "✅ PID file removed"
