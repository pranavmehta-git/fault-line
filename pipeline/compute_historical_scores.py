#!/usr/bin/env python3
"""
Fault Line - Historical Scores Computation

Computes monthly fragility score snapshots from all events, using the
same shared engine (scoring.py) as the live score calculation so the
two can never diverge. Adds trends, rankings, and a per-snapshot
systemic risk index.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

import scoring

# Labs only get scored after they exist.
LAB_FOUNDING_DATES = {
    "deepmind": "2010-11-01",
    "meta": "2013-12-01",
    "openai": "2015-12-01",
    "anthropic": "2021-01-01",
    "xai": "2023-07-01",
}

TREND_LOOKBACK_MONTHS = 3
TREND_THRESHOLD = 0.2


def month_end_dates(start_date: str, end_date: str) -> list[str]:
    """All month-end dates between start and end (inclusive)."""
    dates = []
    current = datetime.strptime(start_date, "%Y-%m-%d").replace(day=1)
    end = datetime.strptime(end_date, "%Y-%m-%d")

    while current <= end:
        if current.month == 12:
            next_month = current.replace(year=current.year + 1, month=1)
        else:
            next_month = current.replace(month=current.month + 1)
        month_end = next_month - timedelta(days=1)
        if month_end <= end:
            dates.append(month_end.strftime("%Y-%m-%d"))
        current = next_month

    return dates


def compute_snapshots(events: list[dict], checklist_items: list[dict]) -> list[dict]:
    """One snapshot per month-end, scored with the shared engine."""
    dates = [e["date"] for e in events if e.get("date")]
    if not dates:
        return []

    end_date = max(max(dates), datetime.now().strftime("%Y-%m-%d"))
    month_ends = month_end_dates(min(dates), end_date)
    print(f"Computing {len(month_ends)} monthly snapshots "
          f"({min(dates)} to {end_date})...")

    snapshots = []
    for date in month_ends:
        reference = datetime.strptime(date, "%Y-%m-%d")
        scores = {}
        lab_results = []
        for lab in scoring.LABS:
            founding = LAB_FOUNDING_DATES.get(lab)
            if founding and date < founding:
                scores[lab] = None
                continue
            result = scoring.score_lab(lab, events, reference, checklist_items)
            # Per-item detail would bloat the file across hundreds of snapshots.
            for dim in result["breakdown"].values():
                dim.pop("items", None)
            result.pop("top_drivers", None)
            result.pop("lab_id", None)
            scores[lab] = result
            lab_results.append({**result, "lab_id": lab})

        systemic = scoring.compute_systemic_risk(lab_results, events, reference)
        snapshots.append({
            "date": date,
            "scores": scores,
            "systemic_index": systemic["index"],
        })

    return snapshots


def add_trends(snapshots: list[dict]) -> None:
    """Trend vs the average of the previous TREND_LOOKBACK_MONTHS snapshots."""
    for i, snapshot in enumerate(snapshots):
        for lab_id, lab_data in snapshot["scores"].items():
            if lab_data is None:
                continue

            prev_scores = [
                snapshots[j]["scores"][lab_id]["total_score"]
                for j in range(max(0, i - TREND_LOOKBACK_MONTHS), i)
                if snapshots[j]["scores"].get(lab_id) is not None
            ]
            if not prev_scores:
                lab_data["trend"] = "stable"
                continue

            avg_prev = sum(prev_scores) / len(prev_scores)
            current = lab_data["total_score"]
            if current > avg_prev + TREND_THRESHOLD:
                lab_data["trend"] = "worsening"
            elif current < avg_prev - TREND_THRESHOLD:
                lab_data["trend"] = "improving"
            else:
                lab_data["trend"] = "stable"


def add_rankings(snapshots: list[dict]) -> None:
    for snapshot in snapshots:
        ranked = sorted(
            ((lab_id, data) for lab_id, data in snapshot["scores"].items()
             if data is not None),
            key=lambda x: -x[1]["total_score"],
        )
        for rank, (_, data) in enumerate(ranked, 1):
            data["rank"] = rank


def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "docs" / "data"

    print("=" * 50)
    print("Fault Line - Historical Scores Computation")
    print("=" * 50)

    with open(data_dir / "events.json") as f:
        events = sorted(json.load(f).get("events", []), key=lambda x: x.get("date", ""))
    with open(data_dir / "checklist.json") as f:
        checklist_items = json.load(f).get("checklist_items", [])

    snapshots = compute_snapshots(events, checklist_items)
    add_trends(snapshots)
    add_rankings(snapshots)

    output = {
        "version": "3.0.0",
        "generated_at": datetime.now().isoformat() + "Z",
        "half_life_days": scoring.HALF_LIFE_DAYS,
        "event_horizon_days": scoring.EVENT_HORIZON_DAYS,
        "snapshots": snapshots,
    }
    output_path = data_dir / "historical_scores.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Computed {len(snapshots)} snapshots")
    print(f"Saved to {output_path}")
    print("=" * 50)


if __name__ == "__main__":
    main()
