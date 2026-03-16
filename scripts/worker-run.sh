#!/bin/bash
set -eo pipefail

# Usage: worker-run.sh <branch_name> <issue_numbers_json> <task_prompt>
#
# Environment variables required:
#   CLAUDE_CODE_OAUTH_TOKEN - Claude Code auth token
#   GH_TOKEN               - GitHub token for reading issues

BRANCH_NAME="$1"
ISSUE_NUMBERS="$2"
TASK_PROMPT="$3"

if [ -z "$BRANCH_NAME" ] || [ -z "$ISSUE_NUMBERS" ] || [ -z "$TASK_PROMPT" ]; then
  echo "Usage: $0 <branch_name> <issue_numbers_json> <task_prompt>"
  exit 1
fi

# --- Create work branch ---

git checkout -b "$BRANCH_NAME"

# --- Fetch issue context ---

ISSUE_CONTEXT=""
for num in $(echo "$ISSUE_NUMBERS" | jq -r '.[]'); do
  ISSUE_JSON=$(gh issue view "$num" --json number,title,body,comments)
  ISSUE_CONTEXT="${ISSUE_CONTEXT}${ISSUE_JSON}"$'\n\n'
done

# --- Fetch recent RALPH commits ---

RALPH_COMMITS=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

# --- Build prompt ---

WORKER_PROMPT=$(cat "$(dirname "${BASH_SOURCE[0]}")/worker-prompt.md")

FULL_PROMPT="## Your Task

${TASK_PROMPT}

## Issue Context

${ISSUE_CONTEXT}

## Previous RALPH Commits

${RALPH_COMMITS}

${WORKER_PROMPT}"

# --- Run Claude Code with streaming output ---

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

tmpfile=$(mktemp)
trap "rm -f $tmpfile" EXIT

# jq filter to extract final result text
final_result='select(.type == "result").result // empty'

echo "$FULL_PROMPT" | claude -p \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --verbose \
| grep --line-buffered '^{' \
| tee "$tmpfile" \
| jq --unbuffered -rj "$stream_text"

# --- Extract result and PR metadata ---

RESULT=$(jq -r "$final_result" "$tmpfile")

PR_TITLE=$(echo "$RESULT" | sed -n '/<pr_title>/,/<\/pr_title>/p' | sed '1d;$d')
PR_DESCRIPTION=$(echo "$RESULT" | sed -n '/<pr_description>/,/<\/pr_description>/p' | sed '1d;$d')

if [ -z "$PR_TITLE" ] || [ -z "$PR_DESCRIPTION" ]; then
  echo "Error: Claude did not output <pr_title> and <pr_description> tags."
  echo "Raw result:"
  echo "$RESULT"
  exit 1
fi

# --- Push branch ---

git config user.name "claude-code[bot]"
git config user.email "claude-code[bot]@users.noreply.github.com"

if ! git diff --quiet HEAD origin/main 2>/dev/null; then
  git push origin "$BRANCH_NAME"
  HAS_CHANGES=true
else
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "RALPH: ${TASK_PROMPT}"
    git push origin "$BRANCH_NAME"
    HAS_CHANGES=true
  else
    echo "No changes to push"
    HAS_CHANGES=false
  fi
fi

# --- Open PR ---

if [ "$HAS_CHANGES" = "true" ]; then
  gh pr create \
    --base main \
    --head "$BRANCH_NAME" \
    --title "$PR_TITLE" \
    --body "$PR_DESCRIPTION"
fi
