#!/usr/bin/env bash
# Helper script for inspecting worker logs (filters out non-JSON lines like dotenv banners)

LOG_FILE="${1:-.worker.log}"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "Error: Log file not found: $LOG_FILE"
  exit 1
fi

echo "=== Worker Log Inspector ==="
echo "Log file: $LOG_FILE"
echo ""

# Count total lines vs JSON lines
TOTAL_LINES=$(wc -l < "$LOG_FILE")
JSON_LINES=$(grep -cE '^\{' "$LOG_FILE" || echo "0")
echo "Total lines: $TOTAL_LINES (JSON: $JSON_LINES, non-JSON: $((TOTAL_LINES - JSON_LINES)))"
echo ""

# Show any non-JSON lines (dotenv banners, etc.)
if grep -vE '^\{' "$LOG_FILE" | grep -q .; then
  echo "⚠️ Non-JSON lines detected:"
  grep -vE '^\{' "$LOG_FILE" | head -5
  echo ""
fi

# Check for errors and warnings
echo "=== Errors & Warnings ==="
grep -E '^\{' "$LOG_FILE" \
  | jq -c 'select(.level == "error" or .level == "warn")' \
  | tail -10

echo ""
echo "=== Job Claims ==="
grep -E '^\{' "$LOG_FILE" \
  | jq -c 'select(.message == "Job claimed") | {timestamp, jobId, manuscriptId, job_type}'

echo ""
echo "=== Null Job Checks (excluding startup/shutdown) ==="
NULLS=$(grep -E '^\{' "$LOG_FILE" \
  | jq -c 'select(.jobId == null and .message != "Worker started" and .message != "Worker shutdown complete" and .message != "Received SIGTERM, shutting down gracefully...")' \
  || echo "")

if [[ -z "$NULLS" ]]; then
  echo "✅ No unexpected null jobIds found"
else
  echo "❌ Found unexpected null jobIds:"
  echo "$NULLS"
fi

echo ""
echo "=== Recent Activity (last 10 entries) ==="
grep -E '^\{' "$LOG_FILE" \
  | jq -c '{timestamp, level, message, jobId}' \
  | tail -10
