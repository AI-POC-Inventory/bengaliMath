"""Cloud Run Job entrypoint: one full ingestion run for one uploaded book.

Invoked by trigger/main.py with BOOK_OBJECT and BOOK_GENERATION in the
environment. Safe to invoke repeatedly: the first task to create the run
marker wins, every other exits 0 immediately.
"""
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

from google.api_core.exceptions import PreconditionFailed
from google.cloud import storage

import gcs_paths as P

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("ingest")

BOOK_OBJECT = os.getenv("BOOK_OBJECT", P.BOOK_OBJECT)
GENERATION = os.getenv("BOOK_GENERATION", "manual")
FORCE = os.getenv("FORCE_REINDEX", "").lower() in ("1", "true", "yes")


def claim_run(bucket) -> bool:
    """Atomically claim this generation. False if already claimed.

    if_generation_match=0 means 'create only if absent'. GCS resolves this
    server-side, so two concurrent redeliveries cannot both win -- which a
    read-then-write check would allow.
    """
    blob = bucket.blob(P.run_marker(GENERATION))
    payload = json.dumps({
        "book_object": BOOK_OBJECT, "generation": GENERATION,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "execution": os.getenv("CLOUD_RUN_EXECUTION", "local"),
    })
    try:
        blob.upload_from_string(payload, content_type="application/json",
                                if_generation_match=0)
        return True
    except PreconditionFailed:
        return False


def finish_run(bucket, status: str, detail: dict | None = None) -> None:
    blob = bucket.blob(P.run_marker(GENERATION))
    try:
        state = json.loads(blob.download_as_text())
    except Exception:                                # noqa: BLE001
        state = {"generation": GENERATION}
    state.update(status=status,
                 finished_at=datetime.now(timezone.utc).isoformat(),
                 **(detail or {}))
    blob.upload_from_string(json.dumps(state, indent=1),
                            content_type="application/json")


def main() -> int:
    bucket = storage.Client().bucket(P.PRIVATE_BUCKET)

    if not FORCE and not claim_run(bucket):
        log.info("generation %s already processed -- nothing to do", GENERATION)
        return 0

    started = time.time()
    try:
        from publish import (download_book, restore_checkpoints,
                             upload_checkpoints, upload_all)
        from render import render_all
        from metadata import build as build_metadata
        from extract import run as extract_all
        from figures import extract_figures
        from chunk import build_chunks
        from build_index import build as build_index

        log.info("book gs://%s/%s gen=%s", P.PUBLIC_BUCKET, BOOK_OBJECT, GENERATION)
        download_book(BOOK_OBJECT)
        restore_checkpoints()

        log.info("step 02 render");   render_all()
        log.info("step 03 metadata"); meta = build_metadata()
        log.info("step 04 extract");  usage = extract_all()
        upload_checkpoints()
        if usage.get("failed"):
            raise RuntimeError(f"{len(usage['failed'])} pages failed extraction")
        log.info("step 05 figures");  figures = extract_figures()
        log.info("step 06 chunk");    chunks, parents = build_chunks(meta, figures)
        log.info("step 07 index");    manifest = build_index(chunks, parents)

        published = upload_all(P.index_prefix())
        finish_run(bucket, "succeeded", {
            "chapters": len(meta["chapters"]),
            "chunks": manifest["n_chunks"],
            "figures": len(figures),
            "index_prefix": published,
            "extract_tokens": {k: usage[k] for k in ("input_tokens", "output_tokens", "calls")},
            "duration_s": round(time.time() - started, 1),
        })
        log.info("done in %.0fs -> %s", time.time() - started, published)
        return 0

    except Exception as e:                           # noqa: BLE001
        log.exception("ingestion failed")
        finish_run(bucket, "failed",
                   {"error": f"{type(e).__name__}: {e}",
                    "duration_s": round(time.time() - started, 1)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
