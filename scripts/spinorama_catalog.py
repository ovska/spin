#!/usr/bin/env python3
"""Lists speakers in a spinorama checkout whose *default* measurement is
Klippel-format data, from a source this app knows how to attribute (ASR or
Erin's Audio Corner), at or above a minimum quality tier.

Pure stdlib: imports datas.speaker_<a-z> directly from the checkout (they're
plain Python modules, so this also resolves any values shared between
speakers - e.g. a common data_acquisition block - exactly as the real
package does, which a from-scratch parser of the source text would not).

Usage: python3 spinorama_catalog.py <path-to-checkout> [--min-quality high] [--origins ASR,ErinsAudioCorner]
Prints a JSON array of catalog entries to stdout.
"""

import argparse
import json
import re
import sys
from pathlib import Path

QUALITY_RANK = {"low": 0, "medium": 1, "high": 2}
LETTERS = "abcdefghijklmnopqrstuvwxyz"

# origin (as spinorama's metadata spells it) -> (display name, review-dict key).
# ASR ships a LICENSE.txt in its measurement directories (CC BY-NC-SA 4.0);
# EAC does not, so build-data attributes it with a link to the original
# review instead of asserting a license we haven't independently verified.
KNOWN_ORIGINS = {
    "ASR": {"displayName": "Audio Science Review", "reviewKey": "asr"},
    "ErinsAudioCorner": {"displayName": "Erin's Audio Corner", "reviewKey": "eac"},
}


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "speaker"


def load_all_speakers(checkout: Path) -> dict:
    sys.path.insert(0, str(checkout))
    merged: dict = {}
    for letter in LETTERS:
        try:
            module = __import__(f"datas.speaker_{letter}", fromlist=["*"])
        except ModuleNotFoundError:
            continue
        merged.update(getattr(module, f"speakers_info_{letter}", {}))
    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkout", type=Path)
    parser.add_argument(
        "--min-quality",
        choices=["low", "medium", "high"],
        default="high",
        help="Minimum measurement quality to include (default: high).",
    )
    parser.add_argument(
        "--origins",
        default="ASR",
        help="Comma-separated list of spinorama origins to accept "
        f"(known: {', '.join(KNOWN_ORIGINS)}; default: ASR).",
    )
    args = parser.parse_args()
    min_rank = QUALITY_RANK[args.min_quality]
    origins = {o.strip() for o in args.origins.split(",") if o.strip()}
    unknown = origins - set(KNOWN_ORIGINS)
    if unknown:
        parser.error(f"unknown origin(s): {', '.join(sorted(unknown))} (known: {', '.join(KNOWN_ORIGINS)})")

    speakers = load_all_speakers(args.checkout)

    seen_slugs: dict[str, int] = {}
    catalog = []
    for model_name, info in speakers.items():
        default_key = info.get("default_measurement")
        if not default_key:
            continue
        measurement = info.get("measurements", {}).get(default_key)
        if not measurement:
            continue
        origin = measurement.get("origin")
        if origin not in origins:
            continue
        if measurement.get("format") != "klippel":
            continue
        # Quality is omitted for the common case, which means "high" - see
        # src/metaedit/models.py in spinorama itself.
        quality = measurement.get("quality", "high")
        if QUALITY_RANK.get(quality, -1) < min_rank:
            continue

        slug = slugify(model_name)
        n = seen_slugs.get(slug, 0)
        seen_slugs[slug] = n + 1
        speaker_id = slug if n == 0 else f"{slug}-{n + 1}"

        origin_meta = KNOWN_ORIGINS[origin]
        review_url = measurement.get("reviews", {}).get(origin_meta["reviewKey"])

        catalog.append(
            {
                "id": speaker_id,
                "brand": info.get("brand"),
                "model": info.get("model"),
                "name": model_name,
                "measurementKey": default_key,
                "quality": quality,
                "origin": origin,
                "originDisplayName": origin_meta["displayName"],
                "reviewUrl": review_url,
            }
        )

    catalog.sort(key=lambda s: s["id"])
    json.dump(catalog, sys.stdout, indent=2)
    print(file=sys.stderr)
    print(
        f"{len(catalog)} speakers qualify (min quality: {args.min_quality}, origins: {', '.join(sorted(origins))})",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
