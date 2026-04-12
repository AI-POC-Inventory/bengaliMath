#!/usr/bin/env bash
# Deploy service/db/api.py to GCP Cloud Run
# Usage: ./deploy.sh <GCP_PROJECT_ID> [REGION]
# Example: ./deploy.sh my-gcp-project us-central1
#
# Prerequisites:
#   gcloud auth login
#   gcloud auth configure-docker

set -euo pipefail

PROJECT="${1:?Usage: ./deploy.sh <GCP_PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"
SERVICE="bengali-math-api"
IMAGE="gcr.io/${PROJECT}/${SERVICE}"

echo "==> Building and pushing Docker image..."
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT}" \
  .

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL:?Set SUPABASE_URL},SUPABASE_KEY=${SUPABASE_KEY:?Set SUPABASE_KEY}" \
  --set-env-vars "CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:5173}" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 60

echo ""
echo "==> Deployed! Service URL:"
gcloud run services describe "${SERVICE}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --format "value(status.url)"
