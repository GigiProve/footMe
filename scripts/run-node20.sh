#!/usr/bin/env bash

set -euo pipefail

# The first argument may be a bare module path (e.g. "typescript/bin/tsc")
# instead of a real file. Resolve it from the current workspace so scripts pick
# up the workspace's own copy of a tool rather than whichever version npm
# happened to hoist to the repo root.
if [ "$#" -gt 0 ] && [ ! -f "$1" ]; then
  resolved="$(node -p "require.resolve('$1')" 2>/dev/null || true)"
  if [ -n "${resolved}" ]; then
    shift
    set -- "${resolved}" "$@"
  fi
fi

current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"

if [ "${current_major}" -ge 20 ]; then
  exec node "$@"
fi

cache_root="${HOME}/.npm/_npx"

if [ -d "${cache_root}" ]; then
  candidate="$(
    find "${cache_root}" -path '*/node_modules/node/bin/node' -type f 2>/dev/null | tail -n 1
  )"

  if [ -n "${candidate}" ]; then
    exec "${candidate}" "$@"
  fi
fi

echo "Node 20 is required but no cached Node 20 binary was found." >&2
echo "Run: npx -y -p node@20 node -v" >&2
exit 1
