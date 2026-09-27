#!/bin/sh
# Serve a built worktree (dist/ must exist) with astro preview and capture pages with headless Chromium.
# Each path is captured at every width in SHOT_WIDTHS (default "1440 390") in light and dark
# (prefers-color-scheme), saved as <out-dir>/<name>-<width>-<light|dark>.png.
# Only the preview server of this worktree is stopped (astro preview stop, no pkill -f).
#
# Usage: sh .claude/scripts/screenshot.sh <worktree> <port> <out-dir> <path>...
#   e.g. SHOT_WIDTHS="1440 1024 768 390" sh .claude/scripts/screenshot.sh /tmp/.../wt-27 4611 /tmp/.../shots-27/after /ja/ /en/
# Env: SHOT_WIDTHS (widths), SHOT_HEIGHT (window height, default 4400), CHROME (browser binary).
set -eu

[ $# -ge 4 ] || { echo "usage: screenshot.sh <worktree> <port> <out-dir> <path>..." >&2; exit 1; }
wt="$1"
port="$2"
out="$3"
shift 3
widths="${SHOT_WIDTHS:-1440 390}"
height="${SHOT_HEIGHT:-4400}"

[ -d "$wt/dist" ] || { echo "dist/ not found. run bun run build in $wt first" >&2; exit 1; }
chrome="${CHROME:-}"
[ -n "$chrome" ] || chrome=$(command -v chrome-headless-shell || command -v chromium || command -v google-chrome-stable || command -v google-chrome || true)
[ -n "$chrome" ] || chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | sort -V | tail -n 1)
[ -n "$chrome" ] && [ -x "$chrome" ] || { echo "no headless chromium found (set CHROME)" >&2; exit 1; }
if ss -ltnH "sport = :$port" | grep -q .; then echo "port $port is in use" >&2; exit 1; fi
mkdir -p "$out"

# Astro 7 detaches preview into the background when it runs under an agent, so start it with
# --background explicitly and stop it with `astro preview stop` (its lock file lives in the worktree).
env -C "$wt" bunx astro preview --background --host 127.0.0.1 --port "$port" >"$out/preview.log" 2>&1
profile=$(mktemp -d)
trap 'env -C "$wt" bunx astro preview stop >/dev/null 2>&1 || true; rm -rf "$profile"' EXIT

i=0
until curl -fsS -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -le 60 ] || { echo "preview did not start (see $out/preview.log)" >&2; exit 1; }
  sleep 0.5
done

for path in "$@"; do
  name=$(printf '%s' "$path" | sed 's#^/##; s#/$##; s#/#_#g')
  [ -n "$name" ] || name=index
  for w in $widths; do
    for theme in light dark; do
      if [ "$theme" = dark ]; then scheme="--force-dark-mode --blink-settings=preferredColorScheme=0"; else scheme="--blink-settings=preferredColorScheme=1"; fi
      # shellcheck disable=SC2086
      "$chrome" --headless --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$profile" $scheme \
        --virtual-time-budget=5000 --window-size="$w,$height" --screenshot="$out/$name-$w-$theme.png" \
        "http://127.0.0.1:$port$path" >/dev/null 2>&1
      echo "$out/$name-$w-$theme.png"
    done
  done
done
