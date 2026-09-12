"""What the ingestion run actually cost, from recorded usage.

extract.py records per-page {input_tokens, output_tokens, model, provider} in
every block JSON. This reads those back, so the totals are measured rather
than estimated, and prices them against a rate card you control.

    python tools/cost_model.py [BLOCK_DIR]
"""
import json
import sys
from pathlib import Path

# USD per 1M tokens. Anthropic rates are first-party list prices; the Batch
# API halves both columns. Fill in your provider's current rate before quoting
# these to anyone -- prices move.
RATES = {
    "claude-opus-5":   (5.00, 25.00),
    "claude-sonnet-5": (2.00, 10.00),
    "claude-haiku-4-5": (1.00, 5.00),
    # Gemini rates vary by tier and change; set them from current pricing.
    "gemini-2.5-flash": (None, None),
}


def collect(block_dir: Path) -> dict:
    tot = {"pages": 0, "input_tokens": 0, "output_tokens": 0, "models": set()}
    for f in sorted(block_dir.glob("p*.json")):
        u = json.loads(f.read_text(encoding="utf-8")).get("usage") or {}
        if not u:
            continue
        tot["pages"] += 1
        tot["input_tokens"] += u.get("input_tokens", 0)
        tot["output_tokens"] += u.get("output_tokens", 0)
        tot["models"].add(u.get("model", "?"))
    return tot


def main(block_dir: Path) -> None:
    t = collect(block_dir)
    if not t["pages"]:
        print(f"no usage recorded under {block_dir}")
        return

    pi = t["input_tokens"] / t["pages"]
    po = t["output_tokens"] / t["pages"]
    print(f"measured over {t['pages']} pages  (models: {', '.join(sorted(t['models']))})")
    print(f"  input  {t['input_tokens']:>10,} tok   {pi:>8,.0f} / page")
    print(f"  output {t['output_tokens']:>10,} tok   {po:>8,.0f} / page")
    print()
    print(f"{'model':<20}{'standard':>12}{'batch -50%':>13}")
    print("-" * 45)
    for model, (ri, ro) in RATES.items():
        if ri is None:
            print(f"{model:<20}{'set rate':>12}{'set rate':>13}")
            continue
        std = t["input_tokens"] / 1e6 * ri + t["output_tokens"] / 1e6 * ro
        print(f"{model:<20}{'$' + format(std, '.2f'):>12}{'$' + format(std / 2, '.2f'):>13}")
    print()
    print("One full pass over the book. Budget 2-3 passes while tuning the prompt.")


if __name__ == "__main__":
    d = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("_work/blocks")
    main(d)
