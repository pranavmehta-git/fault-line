#!/usr/bin/env python3
"""
Fault Line - News Ingestion Pipeline

Fetches articles from configured RSS feeds and normalizes them for
classification. Fixes over the v1 ingester:

* Applies the `excluded_domains` list from overrides.yaml (previously
  defined but never enforced).
* Deduplicates on a canonical URL (tracking params and fragments
  stripped) plus same-title-same-domain reposts, instead of exact URL
  string match. Same-title articles from *different* domains are kept
  on purpose: independent corroboration is a scoring signal.
* No longer fabricates dates: entries without a parseable date are
  stamped with fetch time but flagged `date_estimated` so downstream
  consumers can discount them.
* Emits a per-source and per-lab coverage report
  (pipeline/ingest_report.json) so structural coverage gaps - e.g. a
  lab with no dedicated feed and few mentions - are visible instead of
  silently biasing scores downward.
"""

import json
import hashlib
import re
import socket
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

import feedparser
import yaml

FETCH_TIMEOUT_SECONDS = 30
SUMMARY_MAX_CHARS = 500
RECENT_DAYS = 30

#: Query parameters that identify content (kept); everything else - utm_*,
#: fbclid, etc. - is tracking noise and is stripped during canonicalization.
CONTENT_QUERY_PARAMS = {"id", "p", "page_id", "story", "sid", "v", "cik", "action", "output"}


def canonical_url(url: str) -> str:
    """Normalize a URL for deduplication: lowercase host, no www, no
    fragment, only content-bearing query params, no trailing slash."""
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    query = urlencode(sorted(
        (k, v) for k, v in parse_qsl(parsed.query)
        if k.lower() in CONTENT_QUERY_PARAMS
    ))
    return urlunparse((parsed.scheme.lower(), netloc, parsed.path.rstrip("/"),
                       "", query, ""))


def normalize_title(title: str) -> str:
    """Lowercased, punctuation-free title for repost detection."""
    return re.sub(r"[^a-z0-9 ]", "", title.lower()).strip()


def clean_html(text: str) -> str:
    """Strip HTML tags and collapse whitespace."""
    clean = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", clean).strip()


class NewsIngester:
    """Fetches and normalizes news articles from RSS feeds."""

    def __init__(self, config_path: str = "sources.yaml",
                 overrides_path: Optional[str] = None):
        self.config = self._load_yaml(Path(config_path))
        overrides = self._load_yaml(Path(overrides_path)) if overrides_path else {}
        self.excluded_domains = set(overrides.get("excluded_domains") or [])
        self.articles: list[dict] = []
        self.source_stats: dict[str, dict] = {}

    @staticmethod
    def _load_yaml(path: Path) -> dict:
        if not path.exists():
            return {}
        with open(path) as f:
            return yaml.safe_load(f) or {}

    # --- Fetching -----------------------------------------------------------

    def fetch_all(self) -> list[dict]:
        """Fetch articles from all enabled sources, recording per-source stats."""
        for source in self.config.get("sources", []):
            if not source.get("enabled", True):
                continue
            if source.get("type") != "rss":
                continue

            print(f"Fetching: {source['name']}")
            stats = {"found": 0, "kept": 0, "excluded": 0, "error": None}
            try:
                articles = self._fetch_rss(source, stats)
                self.articles.extend(articles)
                print(f"  Found {stats['found']}, kept {stats['kept']}")
                if stats["found"] == 0:
                    print("  WARNING: feed returned no entries (dead feed?)")
            except Exception as e:
                stats["error"] = str(e)
                print(f"  Error: {e}")
            self.source_stats[source["name"]] = stats

        return self.articles

    def _fetch_rss(self, source: dict, stats: dict) -> list[dict]:
        feed = feedparser.parse(source["url"])
        articles = []

        for entry in feed.entries:
            stats["found"] += 1
            article = self._normalize_entry(entry, source)
            if article is None:
                continue
            if self._is_excluded(article["url"]):
                stats["excluded"] += 1
                continue
            articles.append(article)
            stats["kept"] += 1

        return articles

    def _is_excluded(self, url: str) -> bool:
        netloc = urlparse(url).netloc.lower()
        return any(netloc == d or netloc.endswith("." + d)
                   for d in self.excluded_domains)

    def _normalize_entry(self, entry: dict, source: dict) -> Optional[dict]:
        """Normalize an RSS entry to the standard article format."""
        url = entry.get("link", "")
        if not url:
            return None

        published = entry.get("published_parsed") or entry.get("updated_parsed")
        if published:
            date = datetime(*published[:6]).isoformat()
            date_estimated = False
        else:
            # Flag rather than fabricate: downstream can discount these.
            date = datetime.now().isoformat()
            date_estimated = True

        summary = clean_html(entry.get("summary", ""))
        if len(summary) > SUMMARY_MAX_CHARS:
            summary = summary[:SUMMARY_MAX_CHARS] + "..."

        canonical = canonical_url(url)
        return {
            "id": hashlib.sha256(canonical.encode()).hexdigest()[:16],
            "url": url,
            "canonical_url": canonical,
            "title": entry.get("title", ""),
            "summary": summary,
            "date": date,
            "date_estimated": date_estimated,
            "source_name": source["name"],
            "source_url": source["url"],
            "source_type": source.get("source_type", "news"),
            "source_priority": source.get("priority", 2),
            "lab_id": source.get("lab_id"),
            "fetched_at": datetime.now().isoformat(),
        }

    # --- Cleanup ------------------------------------------------------------

    def deduplicate(self) -> list[dict]:
        """Drop exact duplicates (canonical URL) and same-domain reposts
        (same normalized title). Cross-domain repeats are kept as
        corroboration."""
        seen_canonical = set()
        seen_domain_title = set()
        unique = []

        for article in self.articles:
            canonical = article["canonical_url"]
            domain_title = (urlparse(canonical).netloc,
                            normalize_title(article["title"]))
            if canonical in seen_canonical or domain_title in seen_domain_title:
                continue
            seen_canonical.add(canonical)
            if domain_title[1]:
                seen_domain_title.add(domain_title)
            unique.append(article)

        removed = len(self.articles) - len(unique)
        if removed:
            print(f"Removed {removed} duplicates")
        self.articles = unique
        return self.articles

    def filter_recent(self, days: int = RECENT_DAYS) -> list[dict]:
        """Keep articles from the last N days. Estimated dates are recent
        by construction (stamped at fetch time) so they pass through."""
        cutoff = datetime.now(timezone.utc).timestamp() - days * 86400

        recent = []
        for article in self.articles:
            try:
                date = datetime.fromisoformat(article["date"].replace("Z", "+00:00"))
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone.utc)
                if date.timestamp() >= cutoff:
                    recent.append(article)
            except (ValueError, TypeError, KeyError):
                continue

        filtered = len(self.articles) - len(recent)
        if filtered:
            print(f"Filtered {filtered} old articles")
        self.articles = recent
        return self.articles

    # --- Reporting ------------------------------------------------------------

    def coverage_report(self) -> dict:
        """Per-lab mention counts so coverage asymmetry is visible.

        A lab that few sources cover will accumulate fewer events and
        therefore a structurally lower score; this report makes that
        bias measurable instead of invisible.
        """
        lab_patterns = self.config.get("lab_patterns", {})
        mentions = Counter()
        dedicated_feeds = Counter()

        for article in self.articles:
            if article.get("lab_id"):
                dedicated_feeds[article["lab_id"]] += 1
            text = f"{article['title']} {article['summary']}".lower()
            for lab_id, keywords in lab_patterns.items():
                if any(k.lower() in text for k in keywords):
                    mentions[lab_id] += 1

        report = {}
        for lab_id in lab_patterns:
            report[lab_id] = {
                "mentions": mentions.get(lab_id, 0),
                "dedicated_feed_articles": dedicated_feeds.get(lab_id, 0),
            }
            if mentions.get(lab_id, 0) == 0 and dedicated_feeds.get(lab_id, 0) == 0:
                print(f"WARNING: no coverage for '{lab_id}' this run - "
                      f"its score reflects missing data, not low fragility")
        return report

    def save_report(self, output_path: str):
        report = {
            "generated_at": datetime.now().isoformat(),
            "sources": self.source_stats,
            "lab_coverage": self.coverage_report(),
            "articles_kept": len(self.articles),
        }
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"Saved ingestion report to {output_path}")

    def save(self, output_path: str = "raw_articles.json"):
        with open(output_path, "w") as f:
            json.dump({"articles": self.articles,
                       "fetched_at": datetime.now().isoformat()}, f, indent=2)
        print(f"Saved {len(self.articles)} articles to {output_path}")


def main():
    """Run the ingestion pipeline."""
    socket.setdefaulttimeout(FETCH_TIMEOUT_SECONDS)
    script_dir = Path(__file__).parent

    ingester = NewsIngester(
        config_path=str(script_dir / "sources.yaml"),
        overrides_path=str(script_dir / "overrides.yaml"),
    )

    print("=" * 50)
    print("Fault Line - News Ingestion")
    print("=" * 50)

    ingester.fetch_all()
    ingester.deduplicate()
    ingester.filter_recent()

    ingester.save(output_path=str(script_dir / "raw_articles.json"))
    ingester.save_report(output_path=str(script_dir / "ingest_report.json"))

    print("=" * 50)
    print(f"Total articles: {len(ingester.articles)}")
    print("=" * 50)


if __name__ == "__main__":
    main()
