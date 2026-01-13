#!/usr/bin/env python3
"""
AI Fragility Tracker - News Ingestion Pipeline
Fetches articles from configured RSS feeds and normalizes them for classification.
"""

import json
import hashlib
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import feedparser
import yaml


class NewsIngester:
    """Fetches and normalizes news articles from RSS feeds."""
    
    def __init__(self, config_path: str = "sources.yaml"):
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.articles = []
        
    def _load_config(self) -> dict:
        """Load sources configuration."""
        with open(self.config_path) as f:
            return yaml.safe_load(f)
    
    def fetch_all(self) -> list[dict]:
        """Fetch articles from all enabled sources."""
        for source in self.config.get("sources", []):
            if not source.get("enabled", True):
                continue
                
            print(f"Fetching: {source['name']}")
            
            try:
                if source.get("type") == "rss":
                    articles = self._fetch_rss(source)
                    self.articles.extend(articles)
                    print(f"  Found {len(articles)} articles")
            except Exception as e:
                print(f"  Error: {e}")
                
        return self.articles
    
    def _fetch_rss(self, source: dict) -> list[dict]:
        """Fetch and parse RSS feed."""
        feed = feedparser.parse(source["url"])
        articles = []
        
        for entry in feed.entries:
            article = self._normalize_entry(entry, source)
            if article:
                articles.append(article)
                
        return articles
    
    def _normalize_entry(self, entry: dict, source: dict) -> Optional[dict]:
        """Normalize RSS entry to standard article format."""
        try:
            # Extract URL
            url = entry.get("link", "")
            if not url:
                return None
                
            # Generate deterministic ID from URL
            article_id = self._generate_id(url)
            
            # Parse date
            published = entry.get("published_parsed") or entry.get("updated_parsed")
            if published:
                date = datetime(*published[:6]).isoformat()
            else:
                date = datetime.now().isoformat()
            
            # Extract content
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            
            # Clean HTML from summary
            summary = self._clean_html(summary)
            
            # Truncate summary
            if len(summary) > 500:
                summary = summary[:500] + "..."
            
            return {
                "id": article_id,
                "url": url,
                "title": title,
                "summary": summary,
                "date": date,
                "source_name": source["name"],
                "source_url": source["url"],
                "fetched_at": datetime.now().isoformat(),
            }
            
        except Exception as e:
            print(f"    Error normalizing entry: {e}")
            return None
    
    def _generate_id(self, url: str) -> str:
        """Generate deterministic ID from URL."""
        # Normalize URL
        parsed = urlparse(url)
        normalized = f"{parsed.netloc}{parsed.path}"
        
        # Hash it
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
    
    def _clean_html(self, text: str) -> str:
        """Remove HTML tags from text."""
        clean = re.sub(r"<[^>]+>", " ", text)
        clean = re.sub(r"\s+", " ", clean)
        return clean.strip()
    
    def deduplicate(self) -> list[dict]:
        """Remove duplicate articles by URL."""
        seen_urls = set()
        unique = []
        
        for article in self.articles:
            url = article["url"]
            if url not in seen_urls:
                seen_urls.add(url)
                unique.append(article)
                
        removed = len(self.articles) - len(unique)
        if removed > 0:
            print(f"Removed {removed} duplicates")
            
        self.articles = unique
        return self.articles
    
    def filter_recent(self, days: int = 30) -> list[dict]:
        """Filter to articles from last N days."""
        cutoff = datetime.now() - timedelta(days=days)
        
        recent = []
        for article in self.articles:
            try:
                date = datetime.fromisoformat(article["date"].replace("Z", "+00:00"))
                if date.replace(tzinfo=None) >= cutoff:
                    recent.append(article)
            except:
                # Keep articles with unparseable dates
                recent.append(article)
                
        filtered = len(self.articles) - len(recent)
        if filtered > 0:
            print(f"Filtered {filtered} old articles")
            
        self.articles = recent
        return self.articles
    
    def save(self, output_path: str = "raw_articles.json"):
        """Save articles to JSON file."""
        with open(output_path, "w") as f:
            json.dump({"articles": self.articles, "fetched_at": datetime.now().isoformat()}, f, indent=2)
        print(f"Saved {len(self.articles)} articles to {output_path}")


def main():
    """Run the ingestion pipeline."""
    ingester = NewsIngester()
    
    print("=" * 50)
    print("AI Fragility Tracker - News Ingestion")
    print("=" * 50)
    
    # Fetch from all sources
    ingester.fetch_all()
    
    # Clean up
    ingester.deduplicate()
    ingester.filter_recent(days=30)
    
    # Save
    ingester.save()
    
    print("=" * 50)
    print(f"Total articles: {len(ingester.articles)}")
    print("=" * 50)


if __name__ == "__main__":
    main()
