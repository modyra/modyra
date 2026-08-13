#!/usr/bin/env bash
# The browser suite on linux, locally, before any push — the functional half.
#
# Screenshot baselines are per platform, so a darwin machine cannot verify the `-linux.png` files
# the CI runner compares against. This runs the suite in the official Playwright image (amd64, like
# the runner) against a clean copy of the working tree, and catches everything that is not a pixel:
# a spec that breaks on linux, a snapshot that does not exist, a server that will not start.
#
# It deliberately skips screenshot comparison (`--ignore-snapshots`): measured 2026-08-13, this
# container's font rendering differs from the GitHub runner on 199 of the committed baselines
# (~2% of page pixels), so comparing here reports noise and recording here would poison the repo
# with pixels no runner produces. Baselines are recorded only by the "Visual baselines" workflow;
# `scripts/audit-baseline-parity.mjs` guards that every shot exists for both platforms.
#
# The repo is copied into the container's own filesystem: a bind mount on macOS goes through
# virtiofs, which has corrupted file modes mid-copy here before. Only results come back out.
#
# Usage:
#   scripts/e2e-linux.sh                 # full suite, snapshots ignored
#   scripts/e2e-linux.sh --project=plain # any playwright args are passed through
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PW_VERSION="$(node -p "require('$ROOT/node_modules/@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"
STAGE="$(mktemp -d)/repo"
OUT="$ROOT/test-results-linux"

trap 'rm -rf "$(dirname "$STAGE")"' EXIT

# A clean copy of HEAD plus the working tree's modifications — not node_modules, not dist.
git -C "$ROOT" archive --format=tar HEAD | (mkdir -p "$STAGE" && tar -x -C "$STAGE")
git -C "$ROOT" diff HEAD --name-only -z | while IFS= read -r -d '' f; do
  if [ -e "$ROOT/$f" ]; then mkdir -p "$STAGE/$(dirname "$f")" && cp "$ROOT/$f" "$STAGE/$f"; fi
done

rm -rf "$OUT"
mkdir -p "$OUT"

podman run --rm --platform linux/amd64 --shm-size=1g \
  -v "$STAGE":/src -v "$OUT":/out \
  "$IMAGE" bash -c "
    cp -a /src /repo && cd /repo &&
    npm i -g pnpm@10 >/dev/null 2>&1 &&
    pnpm install --frozen-lockfile --reporter=silent &&
    pnpm run build:packages > /out/build.log 2>&1 &&
    node scripts/audit-baseline-parity.mjs &&
    pnpm run build:demo && pnpm run build:examples &&
    npx playwright test --ignore-snapshots $*; EC=\$?
    cp -a test-results /out/ 2>/dev/null
    exit \$EC
  " && STATUS=green || STATUS=red

echo "e2e-linux (functional, snapshots ignored): $STATUS (details in $OUT)"
[ "$STATUS" = green ]
