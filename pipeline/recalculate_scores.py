#!/usr/bin/env python3
"""
Recalculate current fragility scores from events.json and write scores.json.

All scoring logic lives in scoring.py (shared with
compute_historical_scores.py). This script only handles I/O, trend
computation against the previous scores file, ranking, and the
cross-lab systemic risk block. See scoring.py for the methodology.
"""

import json
from datetime import datetime
from pathlib import Path

import scoring


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    with open(path) as f:
        return json.load(f)


def calculate_trend(current: float, previous: float, threshold: float = 0.2) -> str:
    """Lower fragility is better; small float wobble counts as stable."""
    if current < previous - threshold:
        return "improving"
    if current > previous + threshold:
        return "worsening"
    return "stable"


def main():
    base_path = Path(__file__).parent.parent
    data_dir = base_path / "docs" / "data"

    events = load_json(data_dir / "events.json", {}).get("events", [])
    checklist_items = load_json(data_dir / "checklist.json", {}).get("checklist_items", [])
    old_scores = load_json(data_dir / "scores.json", {}) or {}
    historical = load_json(data_dir / "historical_scores.json", {}) or {}

    old_score_lookup = {s["lab_id"]: s for s in old_scores.get("scores", [])}
    reference_date = datetime.now()

    print(f"Reference date: {reference_date.strftime('%Y-%m-%d')}")
    print(f"Decay half-life: {scoring.HALF_LIFE_DAYS} days "
          f"(horizon {scoring.EVENT_HORIZON_DAYS} days)")
    print(f"Total events: {len(events)}")
    print()

    lab_scores = []
    for lab_id in scoring.LABS:
        result = scoring.score_lab(lab_id, events, reference_date, checklist_items)

        previous = old_score_lookup.get(lab_id, {}).get("total_score", result["total_score"])
        result["trend"] = calculate_trend(result["total_score"], previous)
        lab_scores.append(result)

        print(f"{lab_id}:")
        print(f"  Score: {result['total_score']} (was {previous})")
        print(f"  Trend: {result['trend']}")
        print(f"  Top drivers: {[d['item'] for d in result['top_drivers']]}")
        print(f"  Events considered: {result['events_count']}")
        print()

    lab_scores.sort(key=lambda x: (-x["total_score"], x["lab_id"]))
    for rank, result in enumerate(lab_scores, 1):
        result["rank"] = rank

    systemic = scoring.compute_systemic_risk(
        lab_scores, events, reference_date,
        historical_snapshots=historical.get("snapshots", []),
    )

    output = {
        "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scoring_version": "3.0.0",
        "methodology": {
            "half_life_days": scoring.HALF_LIFE_DAYS,
            "event_horizon_days": scoring.EVENT_HORIZON_DAYS,
            "saturation_evidence": scoring.SATURATION_EVIDENCE,
            "confidence_weights": scoring.CONFIDENCE_WEIGHTS,
            "source_type_weights": scoring.SOURCE_TYPE_WEIGHTS,
        },
        "systemic": systemic,
        "scores": lab_scores,
    }

    with open(data_dir / "scores.json", "w") as f:
        json.dump(output, f, indent=2)

    print("=" * 50)
    print("Updated scores.json")
    print(f"\nSystemic Risk Index: {systemic['index']}/10")
    for name, component in systemic["components"].items():
        print(f"  {name}: {component['value']}")
    print("\nFinal Rankings:")
    for result in lab_scores:
        print(f"  {result['rank']}. {result['lab_id']}: {result['total_score']}")


if __name__ == "__main__":
    main()
