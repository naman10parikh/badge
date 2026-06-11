#!/bin/bash
# memory-search.sh — BM25-style search over badge's EXPERTISE BRAIN (and memory system)
# Usage: ./scripts/memory-search.sh "query" [--limit N] [--verbose]
#
# Primary corpus (badge): brain/**.md — the queryable memory layer (CP123 A5).
# Also searches: LEARNINGS.md, daily/*.md, topics/*.md, vault/*.md, rules/*.md
# Scoring: term frequency x recency x source weight (brain/ weighted highest — it IS badge's memory)
# Returns: top N results (default 5) with file path + cited node id (KP-A1 / BTS-5) + surrounding context

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEMORY_DIR="$PROJECT_DIR/memory"
BRAIN_DIR="$PROJECT_DIR/brain"
VAULT_DIR="$PROJECT_DIR/vault"
RULES_DIR="$PROJECT_DIR/.claude/rules"

# Parse arguments
QUERY=""
LIMIT=5
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: memory-search.sh \"query\" [--limit N] [--verbose]"
      echo ""
      echo "Searches across Energy's memory system:"
      echo "  - memory/LEARNINGS.md (learnings & patterns)"
      echo "  - memory/daily/*.md (session logs)"
      echo "  - memory/topics/*.md (permanent topic files)"
      echo "  - vault/*.md (Obsidian notes)"
      echo "  - .claude/rules/*.md (hard rules)"
      echo ""
      echo "Options:"
      echo "  --limit N    Return top N results (default: 5)"
      echo "  --verbose    Show scoring details"
      exit 0
      ;;
    *)
      QUERY="$1"
      shift
      ;;
  esac
done

if [ -z "$QUERY" ]; then
  echo "Error: No query provided"
  echo "Usage: memory-search.sh \"query\" [--limit N] [--verbose]"
  exit 1
fi

# Split query into individual terms for scoring
IFS=' ' read -ra TERMS <<< "$QUERY"

# Temp file for results
RESULTS_FILE=$(mktemp)
trap "rm -f $RESULTS_FILE" EXIT

# Source weight map (higher = more authoritative)
weight_for_source() {
  local file="$1"
  case "$file" in
    */brain/*)           echo 6 ;;  # The expertise brain IS badge's memory — highest priority
    */.claude/rules/*)   echo 5 ;;  # Rules are high priority
    */memory/LEARNINGS*) echo 4 ;;  # Learnings are core knowledge
    */memory/topics/*)   echo 4 ;;  # Topic files are curated
    */memory/daily/*)    echo 3 ;;  # Daily logs are session-scoped
    */vault/*)           echo 2 ;;  # Vault is navigation layer
    *)                   echo 1 ;;
  esac
}

# Recency weight: files modified recently score higher
recency_weight() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo 1
    return
  fi
  local age_days
  # macOS stat
  if stat -f %m "$file" >/dev/null 2>&1; then
    local mod_epoch
    mod_epoch=$(stat -f %m "$file")
    local now_epoch
    now_epoch=$(date +%s)
    age_days=$(( (now_epoch - mod_epoch) / 86400 ))
  else
    # Linux fallback
    age_days=$(( ($(date +%s) - $(stat -c %Y "$file")) / 86400 ))
  fi

  if [ "$age_days" -le 1 ]; then
    echo 10
  elif [ "$age_days" -le 3 ]; then
    echo 8
  elif [ "$age_days" -le 7 ]; then
    echo 6
  elif [ "$age_days" -le 14 ]; then
    echo 4
  elif [ "$age_days" -le 30 ]; then
    echo 2
  else
    echo 1
  fi
}

# Score a file: count matching term occurrences (BM25-like term frequency)
score_file() {
  local file="$1"
  local total_hits=0

  for term in "${TERMS[@]}"; do
    # Case-insensitive match count
    local hits
    hits=$(grep -ci "$term" "$file" 2>/dev/null | tr -d '[:space:]' || true)
    hits=${hits:-0}
    [ -z "$hits" ] && hits=0
    total_hits=$((total_hits + hits))
  done

  echo "$total_hits"
}

# Extract context around the best match in a file
extract_context() {
  local file="$1"
  local context_lines=2

  # Find the line with the most query terms
  local best_line=0
  local best_score=0

  while IFS= read -r line_data; do
    local line_num="${line_data%%:*}"
    local line_content="${line_data#*:}"
    local line_score=0

    for term in "${TERMS[@]}"; do
      if echo "$line_content" | grep -qi "$term" 2>/dev/null; then
        line_score=$((line_score + 1))
      fi
    done

    if [ "$line_score" -gt "$best_score" ]; then
      best_score=$line_score
      best_line=$line_num
    fi
  done < <(grep -ni "${TERMS[0]}" "$file" 2>/dev/null | head -20)

  if [ "$best_line" -gt 0 ]; then
    local start=$((best_line - context_lines))
    [ "$start" -lt 1 ] && start=1
    local end=$((best_line + context_lines))
    sed -n "${start},${end}p" "$file" 2>/dev/null
  fi
}

# Find the line number of the best query-term match in a file (for node-id lookup)
best_match_line() {
  local file="$1"
  local best_line=0
  local best_score=0
  while IFS= read -r line_data; do
    local line_num="${line_data%%:*}"
    local line_content="${line_data#*:}"
    local line_score=0
    for term in "${TERMS[@]}"; do
      if echo "$line_content" | grep -qi "$term" 2>/dev/null; then
        line_score=$((line_score + 1))
      fi
    done
    if [ "$line_score" -gt "$best_score" ]; then
      best_score=$line_score
      best_line=$line_num
    fi
  done < <(grep -ni "${TERMS[0]}" "$file" 2>/dev/null | head -40)
  echo "$best_line"
}

# Derive the citable brain node id (e.g. KP-A1 / BTS-5) nearest above the best match.
# KNOWN-PITFALLS headers look like "### A1. ..." -> KP-A1
# BATTLE-TESTED-SCENARIOS headers look like "## SCENARIO 5 ..." -> BTS-5
# OPINIONS headers look like "**O16. ..." -> OP-O16 ; EXPERTISE-MAP "## JTBD-4" -> EM-JTBD-4
node_id_for() {
  local file="$1"
  local match_line="$2"
  [ "${match_line:-0}" -lt 1 ] && return 0
  local base; base="$(basename "$file")"
  local prefix=""
  case "$base" in
    KNOWN-PITFALLS.md)          prefix="KP" ;;
    BATTLE-TESTED-SCENARIOS.md) prefix="BTS" ;;
    OPINIONS.md)                prefix="OP" ;;
    EXPERTISE-MAP.md)           prefix="EM" ;;
    GAPS-AND-DISPUTES.md)       prefix="GD" ;;
    TOOL-MATRIX.md)             prefix="TM" ;;
    *) return 0 ;;
  esac
  # Header line at or above the match: ### A1.  |  ## SCENARIO 5  |  **O16.  |  ## JTBD-4
  local hdr
  hdr=$(sed -n "1,${match_line}p" "$file" 2>/dev/null \
    | grep -nE '^#{2,3} (SCENARIO )?[A-Z]?[0-9]+|^#{2,3} JTBD-[0-9]+|^\*\*[A-Z][0-9]+\.' \
    | tail -1)
  [ -z "$hdr" ] && return 0
  local hdr_text="${hdr#*:}"
  local token=""
  case "$prefix" in
    BTS) token="BTS-$(echo "$hdr_text" | grep -oE 'SCENARIO [0-9]+' | grep -oE '[0-9]+' | head -1)" ;;
    OP)  token="OP-$(echo "$hdr_text" | grep -oE 'O[0-9]+' | head -1)" ;;
    EM)  token="EM-$(echo "$hdr_text" | grep -oE 'JTBD-[0-9]+' | head -1)" ;;
    *)   token="${prefix}-$(echo "$hdr_text" | grep -oE '[A-Z][0-9]+' | head -1)" ;;
  esac
  # Only emit if we actually resolved a node id
  case "$token" in *-) return 0 ;; "${prefix}-") return 0 ;; esac
  echo "$token"
}

# Build file list to search
FILES=()

# brain/**.md — the PRIMARY corpus (badge's queryable expertise memory layer, CP123 A5).
# Index the CURATED synthesis files (EXPERTISE-MAP, BATTLE-TESTED-SCENARIOS, KNOWN-PITFALLS,
# OPINIONS, GAPS-AND-DISPUTES, TOOL-MATRIX, MOC) — NOT brain/research/raw/** (that's raw
# provenance, not the queryable memory; it would out-shout the cited synthesis nodes).
if [ -d "$BRAIN_DIR" ]; then
  while IFS= read -r f; do
    [ -f "$f" ] && FILES+=("$f")
  done < <(find "$BRAIN_DIR" -type f -name '*.md' -not -path '*/research/*' 2>/dev/null)
fi

# LEARNINGS.md
[ -f "$MEMORY_DIR/LEARNINGS.md" ] && FILES+=("$MEMORY_DIR/LEARNINGS.md")

# Daily logs
for f in "$MEMORY_DIR"/daily/*.md; do
  [ -f "$f" ] && FILES+=("$f")
done

# Topic files
for f in "$MEMORY_DIR"/topics/*.md; do
  [ -f "$f" ] && FILES+=("$f")
done

# Vault notes
for f in "$VAULT_DIR"/*.md; do
  [ -f "$f" ] && FILES+=("$f")
done

# Rules
for f in "$RULES_DIR"/*.md; do
  [ -f "$f" ] && FILES+=("$f")
done

# Archive (lower priority but still searchable)
for f in "$MEMORY_DIR"/archive/*.md; do
  [ -f "$f" ] && FILES+=("$f")
done

# Score each file
for file in "${FILES[@]}"; do
  tf_score=$(score_file "$file")
  [ "$tf_score" -eq 0 ] && continue

  src_weight=$(weight_for_source "$file")
  rec_weight=$(recency_weight "$file")

  # Combined score: tf * source_weight * recency_weight
  combined=$((tf_score * src_weight * rec_weight))

  # Relative path for display
  rel_path="${file#$PROJECT_DIR/}"

  echo "$combined|$rel_path|$tf_score|$src_weight|$rec_weight" >> "$RESULTS_FILE"
done

# Sort by score descending and take top N
if [ ! -s "$RESULTS_FILE" ]; then
  echo "No results found for: $QUERY"
  exit 0
fi

echo "=== Memory Search: \"$QUERY\" ==="
echo ""

RANK=0
sort -t'|' -k1 -nr "$RESULTS_FILE" | head -"$LIMIT" | while IFS='|' read -r score path tf sw rw; do
  RANK=$((RANK + 1))
  full_path="$PROJECT_DIR/$path"

  # Citable brain node id (KP-A1 / BTS-5 / OP-O16 …) for the best-matching line
  match_line=$(best_match_line "$full_path")
  node_id=$(node_id_for "$full_path" "$match_line")
  if [ -n "$node_id" ]; then
    echo "[$RANK] $path  [$node_id]  (score: $score)"
  else
    echo "[$RANK] $path (score: $score)"
  fi

  if [ "$VERBOSE" = true ]; then
    echo "    term_freq=$tf  source_wt=$sw  recency_wt=$rw"
  fi

  # Show context
  context=$(extract_context "$full_path")
  if [ -n "$context" ]; then
    echo "    ---"
    echo "$context" | sed 's/^/    /'
    echo "    ---"
  fi
  echo ""
done

TOTAL=$(wc -l < "$RESULTS_FILE" | tr -d ' ')
echo "Found $TOTAL matching files. Showing top $LIMIT."
