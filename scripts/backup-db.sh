#!/usr/bin/env bash
# ==============================================================================
# Booyah Win - Weekly Database Backup Script (PostgreSQL / pg_dump)
# ==============================================================================
# SECURITY REQUIREMENTS:
# 1. Never stores, logs, or commits database credentials or dumps in git.
# 2. Refuses to write backup files inside the repository folder.
# 3. Output dump contains encrypted PII (PAN/Aadhaar) and must be kept secure.
# ==============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Get DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo -n "Enter PostgreSQL connection string (DATABASE_URL): "
  read -rs DATABASE_URL
  echo ""
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is required." >&2
  exit 1
fi

# 2. Get destination directory
DEFAULT_DEST="$HOME/booyah_backups"
echo -n "Enter destination directory for backup [default: $DEFAULT_DEST]: "
read -r DEST_DIR
DEST_DIR="${DEST_DIR:-$DEFAULT_DEST}"
mkdir -p "$DEST_DIR"
DEST_REAL="$(cd "$DEST_DIR" && pwd)"

# 3. Guard against saving inside the repository
if [[ "$DEST_REAL" == "$REPO_DIR"* ]]; then
  echo "Error: Refusing to write backup inside the repository directory ($REPO_DIR)." >&2
  echo "Please choose a secure directory outside the git repository." >&2
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$DEST_REAL/booyah_backup_${TIMESTAMP}.dump"

echo "Creating compressed custom-format backup..."
pg_dump "$DATABASE_URL" -F c -b -v -f "$OUTPUT_FILE"

echo "Backup created successfully: $OUTPUT_FILE"
echo "Remember to close this terminal window to clear environment history."
