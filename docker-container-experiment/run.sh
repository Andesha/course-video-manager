#!/bin/bash
set -eo pipefail

CONTAINER_NAME="${CLAUDE_SANDBOX_NAME:-claude-sandbox}"
REPOS_DIR="/home/agent/repos"

# --- Validation ---

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ITERATIONS="$1"

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: Container '${CONTAINER_NAME}' is not running."
  echo "Run setup.sh first."
  exit 1
fi

# Infer repo from current directory
if ! REPO_FULL=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null); then
  echo "Error: Not in a GitHub repo, or gh CLI not authenticated."
  exit 1
fi

REPO_NAME=$(basename "$REPO_FULL")
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SANDBOX_REPO_DIR="${REPOS_DIR}/${REPO_NAME}"

echo "=== RALPH ==="
echo "Repo:       ${REPO_FULL}"
echo "Branch:     ${BRANCH}"
echo "Iterations: ${ITERATIONS}"
echo ""

# --- Sync local repo into sandbox via git bundle ---

sync_to_sandbox() {
  local bundle_host
  bundle_host=$(mktemp --suffix=.bundle)

  # Bundle the entire local repo
  git bundle create "$bundle_host" --all

  # Copy bundle into container
  docker cp "$bundle_host" "${CONTAINER_NAME}:/tmp/repo.bundle"

  # Clean up host bundle
  rm -f "$bundle_host"

  # Clone or fetch inside sandbox
  if docker exec "$CONTAINER_NAME" test -d "$SANDBOX_REPO_DIR/.git"; then
    # Fetch from bundle to a temp ref, then reset the checked-out branch
    docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
      git fetch /tmp/repo.bundle "${BRANCH}:refs/ralph/sync" --force
    docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
      git checkout "$BRANCH"
    docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
      git reset --hard refs/ralph/sync
  else
    # First time: clone from bundle
    docker exec "$CONTAINER_NAME" \
      git clone /tmp/repo.bundle "$SANDBOX_REPO_DIR"
    docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
      git checkout "$BRANCH"
  fi

  # Install dependencies if a package.json exists
  if docker exec "$CONTAINER_NAME" test -f "$SANDBOX_REPO_DIR/package.json"; then
    echo "Installing dependencies..."
    docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" npm install
  fi

  # Clean up bundle inside container (docker cp copies as root, so remove as root)
  docker exec -u root "$CONTAINER_NAME" rm -f /tmp/repo.bundle
}

# --- Extract patch from sandbox and apply locally ---

extract_and_apply_patch() {
  local patch_dir
  patch_dir=$(mktemp -d)

  # Generate patch for the latest commit
  docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
    git format-patch -1 HEAD -o /tmp/patches 2>/dev/null

  # Copy patches out
  docker cp "${CONTAINER_NAME}:/tmp/patches/." "$patch_dir/"

  # Apply patches locally
  local patch_count=0
  for patch_file in "$patch_dir"/*.patch; do
    [ -f "$patch_file" ] || continue
    git am "$patch_file"
    patch_count=$((patch_count + 1))
  done

  # Clean up
  rm -rf "$patch_dir"
  docker exec -u root "$CONTAINER_NAME" rm -rf /tmp/patches

  echo "Applied ${patch_count} patch(es) locally."
}

# --- Check if sandbox has new commits ---

get_sandbox_head() {
  docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
    git rev-parse HEAD 2>/dev/null
}

# --- Load prompt from file ---

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="${SCRIPT_DIR}/prompt.md"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file not found at ${PROMPT_FILE}"
  exit 1
fi

PROMPT=$(cat "$PROMPT_FILE")

# --- jq filters (from afk.sh) ---

stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

# --- Main loop ---

echo "Syncing repo into sandbox..."
sync_to_sandbox

for ((i=1; i<=ITERATIONS; i++)); do
  echo ""
  echo "=== Iteration ${i}/${ITERATIONS} ==="
  echo ""

  tmpfile=$(mktemp)

  # Record HEAD before Claude runs
  head_before=$(get_sandbox_head)

  # Fetch context inside sandbox
  issues=$(docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
    gh issue list --repo "$REPO_FULL" --state open --json number,title,body,comments 2>/dev/null || echo "[]")

  ralph_commits=$(docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
    git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  # Run Claude inside sandbox
  docker exec -w "$SANDBOX_REPO_DIR" "$CONTAINER_NAME" \
    claude \
      --print \
      --verbose \
      --dangerously-skip-permissions \
      --output-format stream-json \
      --model claude-opus-4-6 \
      -p "ISSUES: ${issues}

Previous RALPH commits: ${ralph_commits}

${PROMPT}" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  # Check if Claude made a commit
  head_after=$(get_sandbox_head)

  if [ "$head_before" != "$head_after" ]; then
    echo ""
    echo "New commit detected. Extracting patch..."
    extract_and_apply_patch
  else
    echo ""
    echo "No new commit in this iteration."
  fi

  # Check for completion signal (after patch extraction)
  result=$(jq -r "$final_result" "$tmpfile")
  rm -f "$tmpfile"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "RALPH complete after ${i} iteration(s)."
    exit 0
  fi

  # Re-sync sandbox for next iteration
  echo "Re-syncing sandbox to match local state..."
  sync_to_sandbox
done

echo ""
echo "Completed ${ITERATIONS} iteration(s)."
