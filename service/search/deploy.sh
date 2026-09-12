#!/usr/bin/env bash
# Deploy the search service to Cloud Run. The index bundle is baked into the
# image, so _work/dist must be populated first -- either by running the
# pipeline locally, or with:
#   python ingest/fetch_index.py        (pulls the published bundle from GCS)
#
#   ./deploy.sh <GCP_PROJECT_ID> [REGION]
set -euo pipefail

PROJECT="${1:?Usage: ./deploy.sh <GCP_PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"
SERVICE="bengali-math-search"
IMAGE="gcr.io/${PROJECT}/${SERVICE}"

test -f _work/dist/manifest.json || {
  echo "ERROR: _work/dist/manifest.json missing -- build or fetch the index first" >&2
  exit 1
}
echo "==> index: $(python -c "import json;m=json.load(open('_work/dist/manifest.json'));print(m['n_chunks'],'chunks,',m['vectors_mb'],'MB,',m['embedding_model'])")"

gcloud builds submit --tag "${IMAGE}" --project "${PROJECT}" .

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" --project "${PROJECT}" \
  --allow-unauthenticated \
  --memory=1Gi --cpu=1 --cpu-boost \
  --min-instances=0 --max-instances=5 \
  --concurrency=80 --timeout=30 \
  --set-secrets="GOOGLE_API_KEY=ganit-google-api-key:latest" \
  --set-env-vars="INDEX_DIR=/app/index,CORS_ORIGINS=${CORS_ORIGINS:-*}"

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT}" --format='value(status.url)')"
echo
echo "Deployed: ${URL}"
echo "  health : curl -s ${URL}/health"
echo "  search : curl -s --get --data-urlencode 'q=কষে দেখি 1.2' ${URL}/search"
