"""Eventarc launcher: GCS object finalized -> execute the ingestion Cloud Run Job.

Why a launcher at all: Eventarc can target a Cloud Run *service* directly, but
targeting a Cloud Run *Job* needs --destination-run-job, which is not available
in every gcloud/API version (it is absent from 493.0.0, including beta/alpha).
This ~60-line service is version-proof: it accepts the CloudEvent and calls the
Run Admin API itself. It scales to zero, so it costs nothing between uploads.

Contract with Eventarc:
  * Return 2xx FAST. Eventarc retries on non-2xx and on timeout, and the
    ingestion run takes ~30 minutes -- far longer than any ack window. So we
    start the Job and return immediately; we never wait for it.
  * Delivery is AT LEAST ONCE. The same upload can arrive more than once.
    Idempotency is enforced in the Job via the object generation marker, not
    here -- doing it here would still race between two concurrent deliveries.
"""
import logging
import os

from flask import Flask, request
from google.cloud import run_v2

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
from gcs_paths import BOOK_PREFIX, PUBLIC_BUCKET  # noqa: E402

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("launcher")

PROJECT = os.environ["GCP_PROJECT"]
REGION = os.getenv("GCP_REGION", "us-central1")
JOB_NAME = os.getenv("JOB_NAME", "bengali-math-ingest")

_jobs = run_v2.JobsClient()


@app.get("/health")
def health():
    return {"ok": True, "job": JOB_NAME, "watching": f"gs://{PUBLIC_BUCKET}/{BOOK_PREFIX}"}


@app.post("/")
def on_object_finalized():
    bucket = request.headers.get("ce-subject", "")            # "objects/<name>"
    name = request.get_json(silent=True) or {}
    obj = name.get("name") or bucket.removeprefix("objects/")
    src_bucket = name.get("bucket", PUBLIC_BUCKET)
    generation = str(name.get("generation", ""))

    # THE loop guard, not defence in depth. GCS events cannot be filtered by
    # object path (finalized accepts only type= and bucket=), so this trigger
    # fires on every object written to the bucket -- UI assets, and all ~600
    # artefacts the pipeline itself produces. Weakening this check turns a
    # single upload into an unbounded retrigger loop billing vision calls.
    if src_bucket != PUBLIC_BUCKET or not obj.startswith(f"{BOOK_PREFIX}/") or not obj.endswith(".pdf"):
        log.info("ignoring gs://%s/%s", src_bucket, obj)
        return {"skipped": obj}, 200

    log.info("launching %s for gs://%s/%s gen=%s", JOB_NAME, src_bucket, obj, generation)
    op = _jobs.run_job(
        request=run_v2.RunJobRequest(
            name=f"projects/{PROJECT}/locations/{REGION}/jobs/{JOB_NAME}",
            overrides=run_v2.RunJobRequest.Overrides(
                container_overrides=[
                    run_v2.RunJobRequest.Overrides.ContainerOverride(
                        env=[
                            run_v2.EnvVar(name="BOOK_OBJECT", value=obj),
                            run_v2.EnvVar(name="BOOK_GENERATION", value=generation),
                        ]
                    )
                ]
            ),
        )
    )
    # Deliberately NOT op.result() -- see the contract note above.
    return {"launched": JOB_NAME, "object": obj, "generation": generation,
            "operation": op.operation.name}, 202
