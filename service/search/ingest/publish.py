"""GCS transfer for the ingestion Job. Honours the public/private split."""
import logging
from pathlib import Path

from google.cloud import storage

import gcs_paths as P
from config import PDF_PATH, DIST, PAGES_DIR, BLOCK_DIR, FIG_DIR, WORK

log = logging.getLogger("publish")
_client = None


def _c():
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


def _bucket(name: str):
    return _c().bucket(name)


def download_book(object_name: str = P.BOOK_OBJECT) -> Path:
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    _bucket(P.PUBLIC_BUCKET).blob(object_name).download_to_filename(PDF_PATH)
    log.info("downloaded gs://%s/%s (%.1f MB)", P.PUBLIC_BUCKET, object_name,
             PDF_PATH.stat().st_size / 1e6)
    return PDF_PATH


def _upload_dir(local: Path, bucket: str, prefix: str, pattern: str = "*") -> int:
    b, n = _bucket(bucket), 0
    for f in sorted(local.glob(pattern)):
        if f.is_file():
            b.blob(f"{prefix}/{f.name}").upload_from_filename(f)
            n += 1
    log.info("uploaded %d -> gs://%s/%s", n, bucket, prefix)
    return n


def restore_checkpoints() -> int:
    """Pull existing per-page blocks so a re-run skips pages already done."""
    BLOCK_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    for blob in _c().list_blobs(P.PRIVATE_BUCKET, prefix=f"{P.BLOCKS_PREFIX}/"):
        if blob.name.endswith(".json"):
            blob.download_to_filename(BLOCK_DIR / Path(blob.name).name)
            n += 1
    log.info("restored %d block checkpoints", n)
    return n


def upload_checkpoints() -> int:
    """Call right after extraction so a later crash doesn't re-buy those pages."""
    return _upload_dir(BLOCK_DIR, P.PRIVATE_BUCKET, P.BLOCKS_PREFIX, "*.json")


def upload_all(index_prefix: str) -> str:
    # private: the derived corpus
    _upload_dir(PAGES_DIR, P.PRIVATE_BUCKET, P.PAGES_PREFIX, "*.png")
    _upload_dir(BLOCK_DIR, P.PRIVATE_BUCKET, P.BLOCKS_PREFIX, "*.json")
    _upload_dir(DIST, P.PRIVATE_BUCKET, index_prefix)
    meta = WORK / "page_metadata.json"
    if meta.exists():
        _bucket(P.PRIVATE_BUCKET).blob(f"{P.STATE_PREFIX}/page_metadata.json") \
            .upload_from_filename(meta)
    # public: only the figure crops the UI renders beside answers
    _upload_dir(FIG_DIR, P.PUBLIC_BUCKET, P.FIGURES_PREFIX, "*.png")
    return P.uri(index_prefix, P.PRIVATE_BUCKET)


def download_index(index_prefix: str, dest: Path) -> int:
    """Used by the Docker build to fetch a published bundle."""
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    for blob in _c().list_blobs(P.PRIVATE_BUCKET, prefix=f"{index_prefix}/"):
        name = Path(blob.name).name
        if name and name != ".keep":
            blob.download_to_filename(dest / name)
            n += 1
    return n
