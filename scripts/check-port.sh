#!/bin/bash
# Port availability check
# Usage: ./scripts/check-port.sh 3002

PORT=$1

if [ -z "$PORT" ]; then
  echo "❌ Error: Port number required"
  echo "Usage: $0 <port>"
  exit 1
fi

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "❌ Port $PORT is already in use"
  echo ""
  echo "Process details:"
  lsof -Pi :$PORT -sTCP:LISTEN
  echo ""
  echo "To kill the process: kill -9 \$(lsof -t -i:$PORT)"
  exit 1
else
  echo "✅ Port $PORT is available"
  exit 0
fi
