#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

copy_tree() {
  local src="$1"
  local dst="$2"
  mkdir -p "$dst"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$src"/ "$dst"/
  else
    # Vercel's build image may not include rsync.
    cp -R "$src"/. "$dst"/
  fi
}

# Ensure Next.js standalone has latest static/public assets before boot.
if [ -d .next/static ]; then
  copy_tree ".next/static" ".next/standalone/.next/static"
fi
if [ -d public ]; then
  copy_tree "public" ".next/standalone/public"
fi
