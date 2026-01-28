#!/bin/bash
# Safe worker startup with pre-flight checks
# Usage: ./scripts/worker-start.sh
#
# Key improvements (Phase 2A):
# - Prefer .env.staging.local for local dev
# - Use setsid to create process group for clean shutdown
# - Clear old logs on each start
# - Pass DOTENV_CONFIG_PATH to child process

set -euo pipefail

PID_FILE=".dev-worker.pid"
LOG_FILE=".worker.log"

# Load Supabase env (PREFER STAGING FOR LOCAL DEV)
if [ -f ".env.staging.local" ]; then
  echo "🌐 Loaded .env.staging.local for worker"
  export DOTENV_CONFIG_PATH=".env.staging.local"
elif [ -f ".env.local" ]; then
  echo "🌐 Loaded .env.local for worker"
  export DOTENV_CONFIG_PATH=".env.local"
else
  echo "⚠️  No .env.local or .env.staging.local found; env vars must be set manually"
  export DOTENV_CONFIG_PATH=""
fi

echo "🔍 Worker pre-flight checks..."

# Check if PID file exists and process is still running
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [ -n "${OLD_PID:-}" ] && ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "❌ Worker already running (PID: $OLD_PID)"
    echo "   Stop it first with: ./scripts/worker-stop.sh"
    exit 1
  else
    echo "⚠️  Stale PID file found, removing..."
    rm "$PID_FILE"
  fi
fi

# Check database connectivity (quick)
echo "🔍 Checking database connectivity..."
if ! curl -s http://localhost:54321/rest/v1/ -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" > /dev/null 2>&1; then
  echo "❌ Database not accessible"
  echo "   Start Supabase with: supabase start"
  exit 1
fi

echo "✅ Database accessible"

# Check if worker script exists
if [ ! -f "workers/phase2Worker.ts" ]; then
  echo "❌ Worker script not found: workers/phase2Worker.ts"
  exit 1
fi

# All checks passed
echo ""
echo "✅ All pre-flight checks passed"
echo "🚀 Starting worker daemon..."
echo ""
echo "   Monitor with: tail -f .worker.log"
echo "   Stop with:    ./scripts/worker-stop.sh"
echo "   Status check: ./scripts/worker-check.sh"
echo ""

# Clear old logs before starting (avoid confusion from previous runs)
: > .worker.log

# Start the worker in its own process group (setsid for background)
# Note: We need to capture the PID before setsid, so we use & and let bash handle it
if [ -n "$DOTENV_CONFIG_PATH" ]; then
  setsid bash -c "exec env DOTENV_CONFIG_PATH=\"$DOTENV_CONFIG_PATH\" DOTENV_CONFIG_OVERRIDE=true npx tsx workers/phase2Worker.ts >> .worker.log 2>&1" &
else
  setsid bash -c "exec npx tsx workers/phase2Worker.ts >> .worker.log 2>&1" &
fi

WORKER_PID=$!

# Wait briefly to ensure process has started
sleep 0.5

# Save PID
echo $WORKER_PID > "$PID_FILE"

echo "📝 Worker PID: $WORKER_PID (saved to $PID_FILE)"

# Sanity check: verify process group setup
PGID=$(ps -o pgid= -p "$WORKER_PID" | tr -d ' ')
SID=$(ps -o sid= -p "$WORKER_PID" | tr -d ' ')
echo "🔍 Process group sanity check:"
echo "   PID=$WORKER_PID  PGID=$PGID  SID=$SID"
if [ "$PGID" = "$WORKER_PID" ]; then
  echo "   ✅ Process is group leader (kill -- -$WORKER_PID will target entire group)"
else
  echo "   ⚠️  PGID != PID (kill may need adjustment)"
fi

echo "✅ Worker started"
echo ""
echo "   Logs: tail -f .worker.log"
