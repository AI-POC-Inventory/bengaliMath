# Bengali Math — Search (`service/search`)

Hybrid RAG search over the WBBSE Class VII textbook **গণিতপ্রভা**
(`class_VII.pdf`, 298 pages).

## Why this exists in the shape it does

The source PDF has **no text layer**. It was laid out in PageMaker 7.0 and
distilled with every glyph converted to vector outlines: `page.get_text()`
returns an empty string for all 298 pages and `get_fonts()` returns nothing.
Every character has to be *recognised*, not parsed. Ingestion is therefore a
vision problem, run once, offline.

## Layout

```
ingest/     runs once, offline, as a Cloud Run Job. Never deployed to the service.
  config.py         calibrated constants + provider settings
  gcs_paths.py      canonical bucket/prefix layout (two buckets — see below)
  render.py         02  PDF -> 298 page PNGs at 200 dpi
  metadata.py       03  chapter + printed page, from pixels and arithmetic
  prompts.py        04  extraction prompt
  vision.py         04  provider seam: anthropic | gemini
  extract.py        04  page -> typed blocks, checkpointed, resumable
  figures.py        05  real figure crops, page furniture filtered out
  normalize.py      06  Bengali-aware folding for lexical matching
  chunk.py          06  blocks -> atomic chunks + parents + context prefixes
  embed.py          07  embedding seam (Gemini, L2-normalised)
  build_index.py    07  writes the index bundle
  publish.py            GCS transfer, honours the public/private split
  job_entrypoint.py     the Job: idempotent by object generation

serve/      the deployed service. Loads a finished index; never extracts.
  store.py          index + BM25, built at startup
  retrieve.py       dense + lexical, RRF fused, parent expansion
  api.py            Flask: /health, /search

trigger/    Eventarc launcher (GCS upload -> Cloud Run Job)
```

## Two buckets, deliberately

| Bucket | Access | Holds |
|---|---|---|
| `gs://ganit-siksha` | **world readable**, hosts the static site | `content/class7/book/class_VII.pdf`, `content/class7/figures/*.png` |
| `gs://ganit-siksha-pipeline` | public access prevention **enforced**, versioned | `pages/`, `blocks/`, `index/v1/`, `eval/`, `_state/runs/` |

The public bucket has uniform bucket-level access, so a prefix inside it
**cannot** be made private — per-object ACLs are disabled and prefix IAM
conditions can only grant, never revoke, the `allUsers` binding. The derived
corpus (the expensive part) therefore lives in its own bucket.

## Auto-trigger

Uploading a PDF to `content/class7/book/` rebuilds and republishes the index.

```
GCS finalized -> Eventarc -> launcher (Cloud Run service) -> Jobs API -> ingestion Job
```

A launcher is needed because `--destination-run-job` does not exist in every
gcloud/Eventarc version (absent from 493.0.0, including beta and alpha).

**GCS events cannot be filtered by object path.** `gcloud eventarc providers
describe storage.googleapis.com` reports that
`google.cloud.storage.object.v1.finalized` accepts exactly two filtering
attributes: `type` and `bucket`. `--event-filters-path-pattern` applies only
to `resourceName` on Cloud Audit Log events. Three guards replace it:

1. The pipeline writes its output to the **private** bucket, which has no
   trigger — so it structurally cannot retrigger itself.
2. `trigger/main.py` refuses to launch unless the object is under
   `content/class7/book/` and ends in `.pdf`.
3. The Job claims a run by the object's GCS **generation** with
   `if_generation_match=0` (atomic create-if-absent), so Eventarc's
   at-least-once delivery cannot start the run twice.

## Running it

```bash
# one-off, local
export GOOGLE_API_KEY=...            # or ANTHROPIC_API_KEY + EXTRACT_PROVIDER=anthropic
export PDF_PATH=../content/extractor/class_VII.pdf
cd ingest && python render.py && python metadata.py && python extract.py

# infrastructure (idempotent)
./setup_trigger.sh root-slate-312607 us-central1

# deploy the search service (needs _work/dist populated)
python ingest/fetch_index.py && ./deploy.sh root-slate-312607
```

## Providers

`EXTRACT_PROVIDER=gemini` (default) or `anthropic`. Both are implemented in
`ingest/vision.py` behind one function. Anthropic (`claude-opus-5`) is the
higher-quality option; the project's current Anthropic key returns
`400 credit balance is too low`, so the deployed Job runs Gemini.

Embeddings are Gemini (`gemini-embedding-001`, 768-dim). Note that MRL-truncated
embeddings are **not** unit length — `embed.py` L2-normalises so that a dot
product is cosine similarity.

## Calibration

`PAGE_OFFSET = 10`, the matter boundaries and the chapter-chip rectangles in
`metadata.py` were measured against *this* PDF. Re-measure for another book —
and keep the assertions, which turn a silent mis-mapping into a failed run.
