"""Canonical GCS layout for the Ganit Siksha content pipeline.

Single source of truth: the Job, the launcher and the serving image all import
this. Two buckets, deliberately:

  PUBLIC_BUCKET  gs://ganit-siksha            world readable, hosts the static
                 site. Holds only what the public should have: the source PDF
                 (a free WBBSE textbook) and the figure crops the UI renders
                 beside answers.
                     content/class7/book/class_VII.pdf
                     content/class7/figures/fig_p046_1022.png

  PRIVATE_BUCKET gs://ganit-siksha-pipeline   public access prevention enforced,
                 versioned. Holds the derived corpus -- the asset that costs
                 money to build.
                     content/class7/pages/    p001.png ...
                     content/class7/blocks/   p001.json ...
                     content/class7/index/v1/ vectors.npy, chunks.json, ...
                     content/class7/eval/     golden.jsonl
                     content/class7/_state/runs/<generation>.json

The split is not cosmetic: the public bucket has uniform bucket-level access,
so a prefix inside it CANNOT be made private -- per-object ACLs are disabled
and prefix IAM conditions can only grant, never revoke, the allUsers binding.

LOOP SAFETY
    GCS Eventarc events cannot be filtered by object path: the finalized event
    accepts only type= and bucket= (verified against the Eventarc provider).
    The trigger therefore fires on every object written to PUBLIC_BUCKET.
    Guards, in order of strength:
      1. The pipeline writes almost everything to PRIVATE_BUCKET, which has no
         trigger on it at all. Only figure crops go back to the public bucket.
      2. trigger/main.py refuses to launch unless the object is under
         BOOK_PREFIX and ends in .pdf.
      3. The Job claims a run by object generation, so a duplicate delivery is
         a no-op costing one GCS call.
"""
PUBLIC_BUCKET = "ganit-siksha"
PRIVATE_BUCKET = "ganit-siksha-pipeline"

ROOT = "content/class7"
INDEX_VERSION = "v1"

# ── public ────────────────────────────────────────────────────────────────
BOOK_PREFIX = f"{ROOT}/book"
BOOK_OBJECT = f"{BOOK_PREFIX}/class_VII.pdf"
FIGURES_PREFIX = f"{ROOT}/figures"

# ── private ───────────────────────────────────────────────────────────────
PAGES_PREFIX = f"{ROOT}/pages"
BLOCKS_PREFIX = f"{ROOT}/blocks"
INDEX_PREFIX = f"{ROOT}/index"
EVAL_PREFIX = f"{ROOT}/eval"
STATE_PREFIX = f"{ROOT}/_state"
RUNS_PREFIX = f"{STATE_PREFIX}/runs"


def index_prefix(version: str = INDEX_VERSION) -> str:
    return f"{INDEX_PREFIX}/{version}"


def run_marker(generation: str) -> str:
    """One marker per object generation. Generation is stable across Eventarc
    redeliveries of the same upload, so it is the correct idempotency key."""
    return f"{RUNS_PREFIX}/{generation}.json"


def uri(object_name: str, bucket: str = PRIVATE_BUCKET) -> str:
    return f"gs://{bucket}/{object_name}"


def public_url(object_name: str) -> str:
    return f"https://storage.googleapis.com/{PUBLIC_BUCKET}/{object_name}"
