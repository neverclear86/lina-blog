#!/bin/sh
# PostToolUse hook for Edit|Write: runs `biome check --write` on the edited file.
# If diagnostics remain, prints them to stderr and exits 2 so Claude sees them.
# Files outside this project (for example, worktrees of the issue workflow in a
# scratchpad) are skipped: the hook runs in the session's cwd, and those
# worktrees have their own checks.
set -u

project="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0
case "$file" in
  "$project"/*) ;;
  *) exit 0 ;;
esac

biome="$project/node_modules/.bin/biome"
[ -x "$biome" ] || exit 0

if ! out=$(cd "$project" && "$biome" check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" 2>&1); then
  printf 'biome check reported problems in %s:\n%s\n' "$file" "$out" >&2
  exit 2
fi
exit 0
