#!/usr/bin/env bash
# Build and deploy the video-generation Cloud Run Job.
# Usage: ./deploy.sh <GCP_PROJECT_ID> [REGION]
#
# This is a Job, not a Service -- it runs to completion once per invocation
# (started by service/db/api.py's POST /api/admin/videos/generate) and is not
# reachable over HTTP. Update, don't recreate, on redeploys (`jobs update`).
#
# Prerequisites:
#   gcloud auth login && gcloud auth configure-docker
#   Cloud Text-to-Speech API enabled on the project
#     (gcloud services enable texttospeech.googleapis.com --project <PROJECT>)
#   A service account for the job with:
#     - Storage Object Admin on gs://ganit-siksha (write video/thumbnail)
#     - Cloud Text-to-Speech User (or equivalent)
#   The job's SA needs no Supabase-specific IAM -- SUPABASE_URL/KEY are passed
#   as secrets/env vars the same way service/db's are.

set -euo pipefail

PROJECT="${1:?Usage: ./deploy.sh <GCP_PROJECT_ID> [REGION] [SERVICE_ACCOUNT]}"
REGION="${2:-us-central1}"
JOB="bengali-math-video"
IMAGE="gcr.io/${PROJECT}/${JOB}"
JOB_SA="${3:-${JOB}@${PROJECT}.iam.gserviceaccount.com}"

echo "==> Building and pushing image..."
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT}" .

echo "==> Deploying Cloud Run Job..."
# --task-timeout: a full chapter (title + overview + ~5 sections' worth of
# explanation/keyPoints/examples/mistakes/takeaway slides, ~15-25 slides) does
# one TTS call and one Pillow render per slide, then one ffmpeg mux -- budget
# generously since TTS latency varies.
gcloud run jobs deploy "${JOB}" \
  --image "${IMAGE}" \
  --region "${REGION}" --project "${PROJECT}" \
  --service-account "${JOB_SA}" \
  --memory 2Gi --cpu 2 \
  --task-timeout 1200s --max-retries 0 \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL:?Set SUPABASE_URL},SUPABASE_KEY=${SUPABASE_KEY:?Set SUPABASE_KEY}"

echo "==> Done. service/db/api.py triggers executions of this job by name;"
echo "    set VIDEO_JOB_NAME=${JOB}, GCP_PROJECT=${PROJECT}, GCP_REGION=${REGION}"
echo "    as env vars on the bengali-math-api Cloud Run service."
