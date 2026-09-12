#!/usr/bin/env bash
# Wire "book uploaded -> index rebuilt" end to end.
#
#   ./setup_trigger.sh <GCP_PROJECT_ID> [REGION]
#
# Creates 2 service accounts, the ingestion Cloud Run Job, the Eventarc
# launcher service, and the trigger. Re-running is safe: create-or-update.
set -euo pipefail

PROJECT="${1:?Usage: ./setup_trigger.sh <GCP_PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"

PUBLIC_BUCKET="ganit-siksha"              # source PDF + figure crops (world readable)
PRIVATE_BUCKET="ganit-siksha-pipeline"    # derived corpus (public access prevention on)
BOOK_PATH="content/class7/book"           # MUST match ingest/gcs_paths.py

JOB="bengali-math-ingest"
LAUNCHER="bengali-math-ingest-trigger"
JOB_SA="ingest-job@${PROJECT}.iam.gserviceaccount.com"
TRG_SA="ingest-trigger@${PROJECT}.iam.gserviceaccount.com"
GCS_SA="$(gcloud storage service-agent --project="${PROJECT}")"

echo "==> 1/7 APIs"
gcloud services enable run.googleapis.com eventarc.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  pubsub.googleapis.com storage.googleapis.com secretmanager.googleapis.com \
  --project="${PROJECT}"

echo "==> 2/7 service accounts"
gcloud iam service-accounts create ingest-job --project="${PROJECT}" \
  --display-name="Ganit Siksha ingestion job" 2>/dev/null || echo "    exists"
gcloud iam service-accounts create ingest-trigger --project="${PROJECT}" \
  --display-name="Ganit Siksha ingestion trigger" 2>/dev/null || echo "    exists"

echo "==> 3/7 IAM"
gcloud storage buckets add-iam-policy-binding "gs://${PUBLIC_BUCKET}" \
  --member="serviceAccount:${JOB_SA}" --role="roles/storage.objectAdmin" --project="${PROJECT}"
gcloud storage buckets add-iam-policy-binding "gs://${PRIVATE_BUCKET}" \
  --member="serviceAccount:${JOB_SA}" --role="roles/storage.objectAdmin" --project="${PROJECT}"
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${TRG_SA}" --role="roles/eventarc.eventReceiver" --condition=None
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${GCS_SA}" --role="roles/pubsub.publisher" --condition=None
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${TRG_SA}" --role="roles/run.invoker" --condition=None
# The Job reads the extraction API key from Secret Manager.
gcloud secrets add-iam-policy-binding ganit-google-api-key --project="${PROJECT}" \
  --member="serviceAccount:${JOB_SA}" --role="roles/secretmanager.secretAccessor"

echo "==> 4/7 build images"
# --file is not a valid flag for `gcloud builds submit` on every SDK version
# (absent from 493.0.0), so each image has an explicit cloudbuild config that
# points at its Dockerfile while keeping service/search as the build context.
gcloud builds submit --project="${PROJECT}" --config ingest/cloudbuild.yaml .
gcloud builds submit --project="${PROJECT}" --config trigger/cloudbuild.yaml .

echo "==> 5/7 ingestion job"
# ~298 vision calls. Jobs bill only while a task runs.
gcloud run jobs deploy "${JOB}" \
  --image "gcr.io/${PROJECT}/${JOB}" \
  --region="${REGION}" --project="${PROJECT}" \
  --service-account="${JOB_SA}" \
  --memory=4Gi --cpu=2 \
  --task-timeout=3600s --max-retries=1 \
  --set-env-vars="EXTRACT_PROVIDER=gemini,EXTRACT_WORKERS=6" \
  --set-secrets="GOOGLE_API_KEY=ganit-google-api-key:latest"

echo "==> 6/7 launcher service"
gcloud run deploy "${LAUNCHER}" \
  --image "gcr.io/${PROJECT}/${LAUNCHER}" \
  --region="${REGION}" --project="${PROJECT}" \
  --service-account="${TRG_SA}" \
  --no-allow-unauthenticated \
  --memory=512Mi --min-instances=0 --max-instances=2 --timeout=30 \
  --set-env-vars="GCP_PROJECT=${PROJECT},GCP_REGION=${REGION},JOB_NAME=${JOB}"

echo "==> 7/7 eventarc trigger"
# IMPORTANT -- there is no object/path filter for GCS events.
#   gcloud eventarc providers describe storage.googleapis.com
# reports that google.cloud.storage.object.v1.finalized accepts exactly two
# filtering attributes: "type" and "bucket". --event-filters-path-pattern
# applies only to resourceName on Cloud Audit Log events, NOT here.
#
# So this trigger fires on EVERY object created in the public bucket -- every
# UI asset deploy included. The path check inside trigger/main.py is the real
# loop guard. The pipeline writes its own output to the PRIVATE bucket, which
# has no trigger, so it cannot retrigger itself.
gcloud eventarc triggers create "${JOB}-on-upload" \
  --project="${PROJECT}" --location="${REGION}" \
  --destination-run-service="${LAUNCHER}" \
  --destination-run-region="${REGION}" \
  --event-filters="type=google.cloud.storage.object.v1.finalized" \
  --event-filters="bucket=${PUBLIC_BUCKET}" \
  --service-account="${TRG_SA}" 2>/dev/null \
  || gcloud eventarc triggers update "${JOB}-on-upload" \
       --project="${PROJECT}" --location="${REGION}" \
       --destination-run-service="${LAUNCHER}" \
       --destination-run-region="${REGION}"

echo
echo "Done."
echo "  Trigger : fires on gs://${PUBLIC_BUCKET}; launcher filters to ${BOOK_PATH}/*.pdf"
echo "  Verify  : gcloud eventarc triggers describe ${JOB}-on-upload --location=${REGION}"
echo "  Test    : gcloud storage cp class_VII.pdf gs://${PUBLIC_BUCKET}/${BOOK_PATH}/class_VII.pdf"
echo "  Watch   : gcloud run jobs executions list --job=${JOB} --region=${REGION}"
