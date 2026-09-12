"""Pull the published index bundle from GCS into _work/dist for a local build."""
import sys
from pathlib import Path

import gcs_paths as P
from publish import download_index

if __name__ == "__main__":
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("_work/dist")
    n = download_index(P.index_prefix(), dest)
    print(f"downloaded {n} files -> {dest}")
