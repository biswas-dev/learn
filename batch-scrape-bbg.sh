#!/bin/bash
# Batch scrape all ByteByteGo courses into learn.biswas.me
# Usage: ./batch-scrape-bbg.sh
#
# Environment:
#   LEARN_API_URL   — learn API base (default: http://localhost:8080)
#   LEARN_API_KEY   — API key for learn (required, or auto-created)
#   BBG_COURSE      — single course slug to scrape (default: all courses)
#   LEARN_IMAGES_DIR — where to store images (default: data/images)

set -euo pipefail
cd "$(dirname "$0")"

# All known BBG courses with content
COURSES=(
  "system-design-interview"
  "machine-learning-system-design-interview"
)

# Refresh cookie from Chrome
echo "==> Refreshing ByteByteGo cookie from Chrome..."
python3 get-bbg-cookie.py --write

# Auto-create API key if not set
if [ -z "${LEARN_API_KEY:-}" ]; then
  LEARN_API_URL="${LEARN_API_URL:-http://localhost:8080}"
  echo "==> Creating API key..."
  TOKEN=$(curl -s "$LEARN_API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"anshuman@anshumanbiswas.com","password":"'"${LEARN_PASSWORD:-admin}"'"}' \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

  if [ -z "$TOKEN" ]; then
    echo "ERROR: Could not login to learn API"
    exit 1
  fi

  LEARN_API_KEY=$(curl -s "$LEARN_API_URL/api/api-keys" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"bbg-scraper-'"$(date +%s)"'"}' \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('key',''))")

  if [ -z "$LEARN_API_KEY" ]; then
    echo "ERROR: Could not create API key"
    exit 1
  fi
  echo "  API key created: ${LEARN_API_KEY:0:20}..."
  export LEARN_API_KEY
fi

# If a specific course is requested, only scrape that one
if [ -n "${BBG_COURSE:-}" ]; then
  COURSES=("$BBG_COURSE")
fi

# Build the scraper
echo "==> Building scraper..."
go build -o /tmp/scrape-bytebytego ./cmd/scrape-bytebytego/

TOTAL=${#COURSES[@]}
for i in "${!COURSES[@]}"; do
  COURSE="${COURSES[$i]}"
  NUM=$((i + 1))
  echo ""
  echo "=========================================="
  echo "[$NUM/$TOTAL] Scraping: $COURSE"
  echo "=========================================="

  export BBG_COURSE="$COURSE"
  /tmp/scrape-bytebytego 2>&1

  echo "  Done: $COURSE"
done

echo ""
echo "==> All courses scraped!"
echo "  Courses: $TOTAL"
echo "  Images dir: ${LEARN_IMAGES_DIR:-data/images}"
echo "  Image count: $(ls -1 "${LEARN_IMAGES_DIR:-data/images}" 2>/dev/null | wc -l | tr -d ' ')"
