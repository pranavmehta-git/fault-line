#!/usr/bin/env python3
"""
Fault Line - Historical Scores Computation
Computes monthly fragility score snapshots from all events.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
from typing import Optional


class HistoricalScoreCalculator:
    """Calculates historical fragility scores with decay window."""

    DECAY_WINDOW_DAYS = 180
    LABS = ["openai", "anthropic", "deepmind", "xai", "meta"]
    DIMENSIONS = ["compute_chips", "cloud", "policy", "demand", "resilience"]

    # Lab founding dates for score calculation start
    LAB_FOUNDING_DATES = {
        "deepmind": "2010-11-01",
        "meta": "2013-12-01",
        "openai": "2015-12-01",
        "anthropic": "2021-01-01",
        "xai": "2023-07-01"
    }

    def __init__(self, events_path: str, checklist_path: str):
        self.events = self._load_events(events_path)
        self.checklist = self._load_checklist(checklist_path)

    def _load_events(self, path: str) -> list:
        """Load events from JSON file."""
        with open(path) as f:
            data = json.load(f)
        return sorted(data.get("events", []), key=lambda x: x.get("date", ""))

    def _load_checklist(self, path: str) -> dict:
        """Load checklist definitions."""
        with open(path) as f:
            return json.load(f)

    def _get_month_end_dates(self, start_date: str, end_date: str) -> list:
        """Generate list of month-end dates between start and end."""
        dates = []
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        while current <= end:
            # Get last day of month
            if current.month == 12:
                month_end = current.replace(day=31)
            else:
                next_month = current.replace(month=current.month + 1, day=1)
                month_end = next_month - timedelta(days=1)

            if month_end <= end:
                dates.append(month_end.strftime("%Y-%m-%d"))

            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1, day=1)
            else:
                current = current.replace(month=current.month + 1, day=1)

        return dates

    def _get_events_in_window(self, snapshot_date: str, lab: str) -> list:
        """Get events within decay window before snapshot date."""
        snapshot_dt = datetime.strptime(snapshot_date, "%Y-%m-%d")
        window_start = snapshot_dt - timedelta(days=self.DECAY_WINDOW_DAYS)

        events_in_window = []
        for event in self.events:
            if event.get("lab") != lab:
                continue

            event_date = datetime.strptime(event.get("date", "2099-01-01"), "%Y-%m-%d")
            if window_start <= event_date <= snapshot_dt:
                events_in_window.append(event)

        return events_in_window

    def _calculate_dimension_score(self, events: list, dimension: str) -> dict:
        """Calculate score for a single dimension from events."""
        # Get checklist items for this dimension
        dim_items = [item for item in self.checklist.get("checklist_items", [])
                     if item.get("dimension") == dimension]

        items_triggered = set()

        for event in events:
            if event.get("dimension") != dimension:
                continue

            for item_id in event.get("checklist_items_affected", []):
                # Check if this item belongs to this dimension
                for item in dim_items:
                    if item.get("id") == item_id:
                        items_triggered.add(item_id)
                        break

        # Calculate score based on triggered items
        score = 0
        for item_id in items_triggered:
            for item in dim_items:
                if item.get("id") == item_id:
                    score += abs(item.get("points", 1))
                    break

        return {
            "score": min(score, 2),  # Cap at max 2 per dimension
            "max": 2,
            "items_triggered": sorted(list(items_triggered))
        }

    def _calculate_lab_score(self, snapshot_date: str, lab: str) -> Optional[dict]:
        """Calculate fragility score for a lab at a snapshot date."""
        # Check if lab exists at this date
        founding = self.LAB_FOUNDING_DATES.get(lab)
        if founding and snapshot_date < founding:
            return None

        events = self._get_events_in_window(snapshot_date, lab)

        breakdown = {}
        for dim in self.DIMENSIONS:
            breakdown[dim] = self._calculate_dimension_score(events, dim)

        # Calculate total score
        # Formula: (Compute + Cloud + Policy + Demand) - Resilience
        fragility_sum = (
            breakdown["compute_chips"]["score"] +
            breakdown["cloud"]["score"] +
            breakdown["policy"]["score"] +
            breakdown["demand"]["score"]
        )
        resilience = breakdown["resilience"]["score"]
        total_score = max(0, min(10, fragility_sum - resilience))

        # Count events and get last event date
        events_count = len(events)
        last_event_date = None
        if events:
            last_event_date = max(e.get("date") for e in events)

        return {
            "total_score": total_score,
            "breakdown": breakdown,
            "events_count": events_count,
            "last_event_date": last_event_date
        }

    def _calculate_trends(self, snapshots: list) -> list:
        """Calculate trend for each snapshot based on previous months."""
        for i, snapshot in enumerate(snapshots):
            for lab_id, lab_data in snapshot.get("scores", {}).items():
                if lab_data is None:
                    continue

                # Look back 3 months for trend
                if i < 3:
                    lab_data["trend"] = "stable"
                    continue

                prev_scores = []
                for j in range(max(0, i - 3), i):
                    prev_lab = snapshots[j].get("scores", {}).get(lab_id)
                    if prev_lab:
                        prev_scores.append(prev_lab.get("total_score", 0))

                if not prev_scores:
                    lab_data["trend"] = "stable"
                    continue

                avg_prev = sum(prev_scores) / len(prev_scores)
                current = lab_data.get("total_score", 0)

                if current > avg_prev + 0.5:
                    lab_data["trend"] = "worsening"
                elif current < avg_prev - 0.5:
                    lab_data["trend"] = "improving"
                else:
                    lab_data["trend"] = "stable"

        return snapshots

    def _add_rankings(self, snapshots: list) -> list:
        """Add rank to each lab in each snapshot."""
        for snapshot in snapshots:
            scores_dict = snapshot.get("scores", {})

            # Get labs with scores (not None)
            valid_labs = [(lab_id, data) for lab_id, data in scores_dict.items()
                          if data is not None]

            # Sort by score descending
            valid_labs.sort(key=lambda x: x[1].get("total_score", 0), reverse=True)

            # Assign ranks
            for rank, (lab_id, data) in enumerate(valid_labs, 1):
                data["rank"] = rank

        return snapshots

    def compute_all_snapshots(self) -> dict:
        """Compute all monthly snapshots from earliest event to present."""
        if not self.events:
            return {"snapshots": []}

        # Find date range
        dates = [e.get("date") for e in self.events if e.get("date")]
        start_date = min(dates)
        end_date = max(dates)

        # Add current date if later
        today = datetime.now().strftime("%Y-%m-%d")
        if today > end_date:
            end_date = today

        # Get month-end dates
        month_ends = self._get_month_end_dates(start_date, end_date)

        print(f"Computing {len(month_ends)} monthly snapshots...")
        print(f"Date range: {start_date} to {end_date}")

        snapshots = []
        for date in month_ends:
            scores = {}
            for lab in self.LABS:
                scores[lab] = self._calculate_lab_score(date, lab)

            snapshots.append({
                "date": date,
                "scores": scores
            })

        # Add trends and rankings
        snapshots = self._calculate_trends(snapshots)
        snapshots = self._add_rankings(snapshots)

        print(f"Computed {len(snapshots)} snapshots")

        return {
            "version": "1.0.0",
            "generated_at": datetime.now().isoformat() + "Z",
            "decay_window_days": self.DECAY_WINDOW_DAYS,
            "snapshots": snapshots
        }

    def save(self, data: dict, output_path: str):
        """Save historical scores to JSON file."""
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Saved to {output_path}")


def main():
    """Run historical scores computation."""
    script_dir = Path(__file__).parent
    events_path = script_dir.parent / "docs" / "data" / "events.json"
    checklist_path = script_dir.parent / "docs" / "data" / "checklist.json"
    output_path = script_dir.parent / "docs" / "data" / "historical_scores.json"

    print("=" * 50)
    print("Fault Line - Historical Scores Computation")
    print("=" * 50)

    calculator = HistoricalScoreCalculator(
        events_path=str(events_path),
        checklist_path=str(checklist_path)
    )

    data = calculator.compute_all_snapshots()
    calculator.save(data, str(output_path))

    print("=" * 50)
    print("Computation complete")
    print("=" * 50)


if __name__ == "__main__":
    main()
