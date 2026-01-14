#!/usr/bin/env python3
"""
Fault Line - Metadata Update Script
Updates metadata.json with current timestamps and pipeline statistics.
"""

import json
from datetime import datetime, timezone
from pathlib import Path


def get_next_scheduled_run() -> str:
    """Calculate next scheduled run time based on cron: '0 */6 * * *' (every 6 hours)."""
    now = datetime.now(timezone.utc)
    # Find next 6-hour boundary (0, 6, 12, 18)
    current_hour = now.hour
    next_hour = ((current_hour // 6) + 1) * 6

    if next_hour >= 24:
        # Roll over to next day
        next_run = now.replace(hour=0, minute=0, second=0, microsecond=0)
        next_run = next_run.replace(day=now.day + 1)
    else:
        next_run = now.replace(hour=next_hour, minute=0, second=0, microsecond=0)

    return next_run.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_source_stats(raw_articles_path: Path) -> list[dict]:
    """Extract source statistics from raw articles data."""
    if not raw_articles_path.exists():
        return []

    with open(raw_articles_path) as f:
        data = json.load(f)

    articles = data.get("articles", [])

    # Count articles per source
    source_counts = {}
    source_urls = {}
    for article in articles:
        source_name = article.get("source_name", "Unknown")
        source_url = article.get("source_url", "")
        source_counts[source_name] = source_counts.get(source_name, 0) + 1
        source_urls[source_name] = source_url

    # Format as list
    sources = []
    for name, count in source_counts.items():
        sources.append({
            "name": name,
            "url": source_urls.get(name, ""),
            "status": "ok",
            "articles_found": count
        })

    return sources


def get_event_stats(events_path: Path, previous_count: int) -> tuple[int, int]:
    """Get event processing statistics."""
    if not events_path.exists():
        return 0, 0

    with open(events_path) as f:
        data = json.load(f)

    events = data.get("events", [])
    total_events = len(events)
    events_added = max(0, total_events - previous_count)

    return total_events, events_added


def update_metadata():
    """Update metadata.json with current run information."""
    script_dir = Path(__file__).parent
    metadata_path = script_dir.parent / "docs" / "data" / "metadata.json"
    events_path = script_dir.parent / "docs" / "data" / "events.json"
    raw_articles_path = script_dir / "raw_articles.json"

    # Load existing metadata
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
    else:
        metadata = {}

    # Get previous event count for calculating events_added
    previous_event_count = metadata.get("events_processed", 0)

    # Update timestamps
    metadata["last_run"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metadata["next_scheduled_run"] = get_next_scheduled_run()
    metadata["run_status"] = "success"

    # Update source stats
    sources = get_source_stats(raw_articles_path)
    if sources:
        metadata["sources_checked"] = sources

    # Update event stats
    events_processed, events_added = get_event_stats(events_path, previous_event_count)
    metadata["events_processed"] = events_processed
    metadata["events_added"] = events_added
    metadata["events_updated"] = 0  # Not currently tracked

    # Keep existing fields
    if "pipeline_version" not in metadata:
        metadata["pipeline_version"] = "1.0.0"
    if "scores_changed" not in metadata:
        metadata["scores_changed"] = []

    # Save updated metadata
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print("=" * 50)
    print("Metadata Updated")
    print("=" * 50)
    print(f"Last run: {metadata['last_run']}")
    print(f"Next scheduled: {metadata['next_scheduled_run']}")
    print(f"Events processed: {events_processed}")
    print(f"Events added: {events_added}")
    print(f"Sources checked: {len(sources)}")
    print("=" * 50)


if __name__ == "__main__":
    update_metadata()
