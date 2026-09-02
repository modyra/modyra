#!/bin/sh
# Copy this repository's hooks into .git/hooks, which git does not version.
#
# Run by a person, not by `postinstall`: a hook that installs itself when a dependency is added is a
# hook nobody chose, and one of these two rewrites commit messages. Both are readable above the copy.
set -e
root=$(git rev-parse --show-toplevel)
for hook in "$root"/scripts/hooks/*; do
  name=$(basename "$hook")
  cp "$hook" "$root/.git/hooks/$name"
  chmod +x "$root/.git/hooks/$name"
  echo "installed $name"
done
