#!/usr/bin/env python3
"""
Recalculate current fragility scores based on events within the 180-day decay window.
This script reads events.json and updates scores.json to be consistent.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
DECAY_WINDOW_DAYS = 180
LABS = ["openai", "anthropic", "deepmind", "xai", "meta"]
DIMENSIONS = ["compute_chips", "cloud", "policy", "demand", "resilience"]

# Checklist item definitions
CHECKLIST_ITEMS = {
    "A1": {"dimension": "compute_chips", "points": 1},
    "A2": {"dimension": "compute_chips", "points": 1},
    "B1": {"dimension": "cloud", "points": 1},
    "B2": {"dimension": "cloud", "points": 1},
    "C1": {"dimension": "policy", "points": 1},
    "C2": {"dimension": "policy", "points": 1},
    "D1": {"dimension": "demand", "points": 1},
    "D2": {"dimension": "demand", "points": 1},
    "E1": {"dimension": "resilience", "points": -1},
    "E2": {"dimension": "resilience", "points": -1},
}


def load_events(events_path: Path) -> list[dict]:
    """Load events from JSON file."""
    with open(events_path, "r") as f:
        data = json.load(f)
    return data.get("events", [])


def load_scores(scores_path: Path) -> dict:
    """Load existing scores to get previous values for trend calculation."""
    with open(scores_path, "r") as f:
        return json.load(f)


def get_events_in_window(events: list[dict], reference_date: datetime, window_days: int = DECAY_WINDOW_DAYS) -> list[dict]:
    """Filter events to only those within the decay window."""
    cutoff_date = reference_date - timedelta(days=window_days)

    in_window = []
    for event in events:
        try:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d")
            if cutoff_date <= event_date <= reference_date:
                in_window.append(event)
        except (KeyError, ValueError):
            continue

    return in_window


def calculate_lab_score(lab_id: str, events: list[dict]) -> dict:
    """Calculate fragility score for a single lab based on events."""
    # Filter events for this lab
    lab_events = [e for e in events if e.get("lab") == lab_id]

    # Track which checklist items are triggered
    triggered_items = set()

    for event in lab_events:
        items = event.get("checklist_items_affected", [])
        for item in items:
            triggered_items.add(item)

    # Calculate dimension scores
    breakdown = {}
    for dimension in DIMENSIONS:
        dim_items = [item_id for item_id, info in CHECKLIST_ITEMS.items()
                     if info["dimension"] == dimension]

        triggered_in_dim = [item for item in dim_items if item in triggered_items]

        if dimension == "resilience":
            # Resilience items have negative points (reduce fragility)
            # Score represents how many resilience items are triggered (max 2)
            score = len(triggered_in_dim)
        else:
            score = sum(CHECKLIST_ITEMS[item]["points"] for item in triggered_in_dim)

        breakdown[dimension] = {
            "score": score,
            "max": 2,
            "items_triggered": triggered_in_dim
        }

    # Calculate total: (compute + cloud + policy + demand) - resilience
    raw_total = (
        breakdown["compute_chips"]["score"] +
        breakdown["cloud"]["score"] +
        breakdown["policy"]["score"] +
        breakdown["demand"]["score"] -
        breakdown["resilience"]["score"]
    )

    # Clamp to 0-10
    total_score = max(0, min(10, raw_total))

    # Get last event date
    if lab_events:
        dates = [e["date"] for e in lab_events]
        last_event_date = max(dates)
    else:
        last_event_date = None

    return {
        "lab_id": lab_id,
        "total_score": total_score,
        "breakdown": breakdown,
        "events_count": len(lab_events),
        "last_event_date": last_event_date,
        "triggered_items": list(triggered_items)
    }


def calculate_trend(current_score: int, previous_score: int) -> str:
    """Determine trend based on score change."""
    if current_score < previous_score:
        return "improving"  # Lower fragility is better
    elif current_score > previous_score:
        return "worsening"
    else:
        return "stable"


def main():
    # Paths
    base_path = Path(__file__).parent.parent
    events_path = base_path / "docs" / "data" / "events.json"
    scores_path = base_path / "docs" / "data" / "scores.json"

    # Load data
    events = load_events(events_path)
    old_scores = load_scores(scores_path)

    # Create lookup for old scores
    old_score_lookup = {s["lab_id"]: s for s in old_scores.get("scores", [])}

    # Reference date (today)
    reference_date = datetime.now()

    # Get events in decay window
    active_events = get_events_in_window(events, reference_date)

    print(f"Reference date: {reference_date.strftime('%Y-%m-%d')}")
    print(f"Decay window: {DECAY_WINDOW_DAYS} days")
    print(f"Total events: {len(events)}")
    print(f"Events in window: {len(active_events)}")
    print()

    # Calculate scores for each lab
    lab_scores = []
    for lab_id in LABS:
        score_data = calculate_lab_score(lab_id, active_events)

        # Get previous score for trend calculation
        old_data = old_score_lookup.get(lab_id, {})
        previous_score = old_data.get("total_score", score_data["total_score"])

        score_data["trend"] = calculate_trend(score_data["total_score"], previous_score)

        lab_scores.append(score_data)

        print(f"{lab_id}:")
        print(f"  Score: {score_data['total_score']} (was {previous_score})")
        print(f"  Trend: {score_data['trend']}")
        print(f"  Triggered items: {score_data['triggered_items']}")
        print(f"  Events in window: {score_data['events_count']}")
        print()

    # Sort by score (descending) for ranking
    lab_scores.sort(key=lambda x: (-x["total_score"], x["lab_id"]))

    # Assign ranks
    for i, score_data in enumerate(lab_scores):
        score_data["rank"] = i + 1
        # Remove internal field
        del score_data["triggered_items"]

    # Build output
    output = {
        "last_updated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scoring_version": "1.0.0",
        "scores": lab_scores
    }

    # Write updated scores
    with open(scores_path, "w") as f:
        json.dump(output, f, indent=2)

    print("=" * 50)
    print("Updated scores.json")
    print("\nFinal Rankings:")
    for score_data in lab_scores:
        print(f"  {score_data['rank']}. {score_data['lab_id']}: {score_data['total_score']}")


if __name__ == "__main__":
    main()
