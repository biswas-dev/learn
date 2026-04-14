#!/usr/bin/env bash
# Batch scrape educative courses into local learn server.
# Scrapes N courses from catalog.json, verifies images, updates status.
#
# Usage: ./batch-scrape.sh [count] [api_key]
# Stops and exits with code 2 if a course has <10 images (needs investigation).

set -euo pipefail

COUNT="${1:-100}"
API_KEY="${2:-lrn_ce51a0e9f5e7f4036a338fe4b8e2b60b81c850594a340972c12bf364c9d6cf5e}"
CATALOG="$HOME/.config/go-educative/catalog.json"
COOKIE_FILE="$HOME/.config/go-educative/cookie.txt"
API_URL="http://localhost:8080"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Get JWT for verification
JWT=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"anshuman@biswas.me","password":"md27rV9oVfqOUnM7B4aT"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "=== Batch scrape: $COUNT courses ==="
echo "API Key: ${API_KEY:0:15}..."
echo "JWT: ${JWT:0:15}..."
echo ""

# Extract pending courses
PENDING=$(python3 -c "
import json
with open('$CATALOG') as f:
    data = json.load(f)
pending = [c for c in data['courses'] if c.get('status', 'pending') == 'pending']
for c in pending[:$COUNT]:
    print(f'{c[\"id\"]}|{c[\"author_id\"]}|{c[\"slug\"]}|{c[\"title\"]}')
")

TOTAL=$(echo "$PENDING" | wc -l | tr -d ' ')
echo "Found $TOTAL pending courses to scrape"
echo ""

SUCCESS=0
FAILED=0

while IFS='|' read -r COURSE_ID AUTHOR_ID SLUG TITLE; do
  SUCCESS=$((SUCCESS + 1))
  echo "===================================================================="
  echo "[$SUCCESS/$TOTAL] $TITLE"
  echo "  slug=$SLUG author=$AUTHOR_ID id=$COURSE_ID"
  echo "===================================================================="

  # Delete existing course with same slug (in case of partial previous run)
  EXISTING_ID=$(curl -s -H "Authorization: Bearer $JWT" "$API_URL/api/courses" \
    | python3 -c "
import json, sys
for c in json.load(sys.stdin):
    # Match by checking if the slug would collide
    if c.get('slug','').replace('-','') == '$SLUG'.replace('-','').replace('_',''):
        print(c['id']); break
" 2>/dev/null)
  if [ -n "$EXISTING_ID" ]; then
    echo "  Deleting existing course id=$EXISTING_ID (partial previous run)"
    curl -s -X DELETE -H "Authorization: Bearer $JWT" "$API_URL/api/courses/$EXISTING_ID" > /dev/null
  fi

  # Run the scraper
  cd "$PROJECT_DIR"
  SCRAPE_OUTPUT=$(EDU_COOKIE_FILE="$COOKIE_FILE" \
    EDU_AUTHOR_ID="$AUTHOR_ID" \
    EDU_COLLECTION_ID="$COURSE_ID" \
    EDU_COURSE_URL="https://www.educative.io/courses/$SLUG/" \
    LEARN_API_KEY="$API_KEY" \
    LEARN_API_URL="$API_URL" \
    go run ./cmd/scrape-and-import 2>&1) || true

  echo "$SCRAPE_OUTPUT" | tail -5

  # Check for fatal errors (cookie expired, API errors)
  if echo "$SCRAPE_OUTPUT" | grep -q "FATAL\|cookie may be expired"; then
    echo ""
    echo "!!! FATAL ERROR — cookie may be expired. Stopping."
    echo "!!! Get a fresh cookie and restart."
    exit 1
  fi

  # Check if course was created (look for "Done!" or "Course published")
  if ! echo "$SCRAPE_OUTPUT" | grep -q "Done!\|Course published"; then
    echo "  ⚠ Course may not have been created properly. Skipping verification."
    FAILED=$((FAILED + 1))
    continue
  fi

  # Extract the course slug from scraper output
  COURSE_SLUG=$(echo "$SCRAPE_OUTPUT" | grep -o 'slug=[a-z0-9-]*' | head -1 | cut -d= -f2)
  if [ -z "$COURSE_SLUG" ]; then
    # Try to find it from the "Course published" line
    COURSE_SLUG=$(echo "$SCRAPE_OUTPUT" | grep "Course published" | grep -o '/courses/[^"]*' | sed 's|/courses/||')
  fi

  # Verify images
  echo "  Verifying images..."
  IMG_COUNT=$(python3 << PYEOF
import json, re, urllib.request

jwt = "$JWT"
api = "$API_URL"
slug = "$COURSE_SLUG"

if not slug:
    print("0")
    exit()

req = urllib.request.Request(f"{api}/api/courses/{slug}",
    headers={"Authorization": f"Bearer {jwt}"})
try:
    course = json.loads(urllib.request.urlopen(req).read())
except:
    print("0")
    exit()

total_imgs = 0
checked = 0
for sec in course.get("sections", []):
    for page in sec.get("pages", []):
        if checked >= 5:  # spot-check first 5 pages with content
            break
        try:
            url = f"{api}/api/courses/{slug}/sections/{sec['slug']}/pages/{page['slug']}"
            req2 = urllib.request.Request(url, headers={"Authorization": f"Bearer {jwt}"})
            pg = json.loads(urllib.request.urlopen(req2).read())
            content = pg.get("content", "")
            imgs = re.findall(r'<img[^>]+src="([^"]+)"', content)
            total_imgs += len(imgs)
            if imgs:
                checked += 1
        except:
            pass
print(total_imgs)
PYEOF
)

  echo "  Images found (sampled): $IMG_COUNT"

  # Count total pages and images from scraper output
  TOTAL_IMGS=$(echo "$SCRAPE_OUTPUT" | grep -c "imgs)" || true)
  TOTAL_PAGES=$(echo "$SCRAPE_OUTPUT" | grep -c "Scraping:" || true)

  echo "  Pages scraped: $TOTAL_PAGES, Pages with images: $TOTAL_IMGS"

  # ALWAYS stop if <10 images — user must verify before continuing
  if [ "$IMG_COUNT" -lt 10 ] && [ "$TOTAL_IMGS" -lt 3 ]; then
    echo ""
    echo "!!! STOPPED: LOW IMAGE COUNT"
    echo "!!! Course: $TITLE ($SLUG)"
    echo "!!! Images found (sampled): $IMG_COUNT, Pages with images: $TOTAL_IMGS, Total pages: $TOTAL_PAGES"
    echo "!!!"
    echo "!!! Please verify on educative.io if this course is genuinely text-only."
    echo "!!! If yes, restart the script to continue."
    echo "!!! If no, investigate unhandled component types:"
    echo "!!!   EDU_AUTHOR_ID=$AUTHOR_ID EDU_COLLECTION_ID=$COURSE_ID"
    echo ""
    # Still mark as downloaded since it was scraped successfully
    python3 << PYEOF2
import json
with open("$CATALOG") as f:
    data = json.load(f)
for c in data["courses"]:
    if c["id"] == $COURSE_ID:
        c["status"] = "downloaded"
        break
data["downloaded"] = len([c for c in data["courses"] if c.get("status") == "downloaded"])
data["pending"] = len([c for c in data["courses"] if c.get("status", "pending") == "pending"])
with open("$CATALOG", "w") as f:
    json.dump(data, f, indent=2)
PYEOF2
    echo "  ✓ Course marked as downloaded. Waiting for user input before next course."
    exit 2
  fi

  # Update catalog.json
  python3 << PYEOF
import json
with open("$CATALOG") as f:
    data = json.load(f)
for c in data["courses"]:
    if c["id"] == $COURSE_ID:
        c["status"] = "downloaded"
        break
data["downloaded"] = len([c for c in data["courses"] if c.get("status") == "downloaded"])
data["pending"] = len([c for c in data["courses"] if c.get("status", "pending") == "pending"])
with open("$CATALOG", "w") as f:
    json.dump(data, f, indent=2)
PYEOF

  echo "  ✓ Marked as downloaded in catalog (downloaded: $(python3 -c "import json; print(json.load(open('$CATALOG'))['downloaded'])"))"
  echo ""

done <<< "$PENDING"

echo "===================================================================="
echo "Batch complete: $SUCCESS courses processed, $FAILED failed"
echo "===================================================================="
