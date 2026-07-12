#!/usr/bin/env bash
# Step 1: build the React UI (with backend URLs baked in) and sync into the
# native Android project. Backend URLs arrive via env from cloudbuild.yaml.
set -euo pipefail

printf 'VITE_API_BASE_URL=%s\nVITE_CURRICULUM_API_URL=%s\n' \
  "${VITE_API_BASE_URL}" "${VITE_CURRICULUM_API_URL}" > ui/.env
echo "--- ui/.env ---"; cat ui/.env

( cd ui && npm ci && npm run build )
# Capacitor CLI + native module resolution live under apps/mobile/node_modules.
( cd apps/mobile && npm ci && npx cap sync android )
