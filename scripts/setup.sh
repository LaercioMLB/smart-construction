#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
docker run --rm --network none --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$task_root,target=/workspace" --workdir /workspace \
  node:24-bookworm-slim node scripts/setup.mjs
