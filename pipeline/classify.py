#!/usr/bin/env python3
"""
Fault Line - Article Classification Pipeline
Classifies articles by lab, dimension, and impact direction.
"""

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml


class ArticleClassifier:
    """Classifies articles using keyword matching and rules."""
    
    def __init__(self, config_path: str = "sources.yaml"):
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.checklist = self._load_checklist()
        
    def _load_config(self) -> dict:
        """Load classification patterns from config."""
        with open(self.config_path) as f:
            return yaml.safe_load(f)
    
    def _load_checklist(self) -> dict:
        """Load checklist definitions."""
        checklist_path = Path(__file__).parent.parent / "docs" / "data" / "checklist.json"
        if checklist_path.exists():
            with open(checklist_path) as f:
                return json.load(f)
        return {"checklist_items": []}
    
    def classify_article(self, article: dict) -> Optional[dict]:
        """Classify a single article into an event."""
        text = f"{article.get('title', '')} {article.get('summary', '')}".lower()
        
        # Identify lab(s)
        labs = self._identify_labs(text)
        if not labs:
            return None  # Skip articles not about our tracked labs
        
        # Identify dimension
        dimension = self._identify_dimension(text)
        if not dimension:
            return None  # Skip articles we can't categorize
        
        # Determine impact
        impact = self._determine_impact(text, dimension)
        
        # Map to checklist items
        checklist_items = self._map_to_checklist(text, dimension, impact)
        
        # Create event for each lab mentioned
        events = []
        for lab in labs:
            event = {
                "id": f"evt-{uuid.uuid4().hex[:8]}",
                "date": article.get("date", datetime.now().isoformat())[:10],
                "lab": lab,
                "dimension": dimension,
                "summary": self._create_summary(article),
                "source_url": article.get("url", ""),
                "source_name": article.get("source_name", "Unknown"),
                "impact": impact,
                "checklist_items_affected": checklist_items,
                "confidence": self._assess_confidence(text, labs, dimension),
                "tags": self._extract_tags(text),
                "auto_classified": True,
            }
            events.append(event)
        
        return events[0] if len(events) == 1 else events
    
    def _identify_labs(self, text: str) -> list[str]:
        """Identify which labs are mentioned in text."""
        labs = []
        patterns = self.config.get("lab_patterns", {})
        
        for lab_id, keywords in patterns.items():
            for keyword in keywords:
                if keyword.lower() in text:
                    if lab_id not in labs:
                        labs.append(lab_id)
                    break
        
        return labs
    
    def _identify_dimension(self, text: str) -> Optional[str]:
        """Identify the primary dimension of the article."""
        patterns = self.config.get("dimension_patterns", {})
        scores = {}
        
        for dimension, keywords in patterns.items():
            score = 0
            for keyword in keywords:
                if keyword.lower() in text:
                    score += 1
            if score > 0:
                scores[dimension] = score
        
        if not scores:
            return None
        
        # Return dimension with highest score
        return max(scores, key=scores.get)
    
    def _determine_impact(self, text: str, dimension: str) -> int:
        """Determine if article indicates increased or decreased fragility."""
        patterns = self.config.get("impact_patterns", {})
        
        positive_score = 0  # Increases fragility
        negative_score = 0  # Decreases fragility
        
        for keyword in patterns.get("positive_fragility", []):
            if keyword.lower() in text:
                positive_score += 1
        
        for keyword in patterns.get("negative_fragility", []):
            if keyword.lower() in text:
                negative_score += 1
        
        # Resilience dimension has inverted logic
        if dimension == "resilience":
            positive_score, negative_score = negative_score, positive_score
        
        if positive_score > negative_score:
            return 1
        elif negative_score > positive_score:
            return -1
        else:
            return 0
    
    def _map_to_checklist(self, text: str, dimension: str, impact: int) -> list[str]:
        """Map article to specific checklist items."""
        items = []
        
        for item in self.checklist.get("checklist_items", []):
            if item.get("dimension") != dimension:
                continue
            
            # Check if any keywords match
            keywords = item.get("keywords", [])
            for keyword in keywords:
                if keyword.lower() in text:
                    items.append(item["id"])
                    break
        
        return items
    
    def _create_summary(self, article: dict) -> str:
        """Create a concise summary from article title."""
        title = article.get("title", "")
        
        # Clean and truncate
        summary = re.sub(r"\s+", " ", title).strip()
        if len(summary) > 200:
            summary = summary[:197] + "..."
        
        return summary
    
    def _assess_confidence(self, text: str, labs: list, dimension: str) -> str:
        """Assess classification confidence."""
        # Simple heuristic: more keyword matches = higher confidence
        lab_matches = len(labs)
        
        dim_patterns = self.config.get("dimension_patterns", {}).get(dimension, [])
        dim_matches = sum(1 for k in dim_patterns if k.lower() in text)
        
        if lab_matches >= 2 and dim_matches >= 3:
            return "high"
        elif lab_matches >= 1 and dim_matches >= 2:
            return "medium"
        else:
            return "low"
    
    def _extract_tags(self, text: str) -> list[str]:
        """Extract relevant tags from text."""
        tags = []
        
        # Common tag patterns
        tag_keywords = [
            "partnership", "funding", "valuation", "regulation", "antitrust",
            "gpu", "nvidia", "tpu", "azure", "aws", "gcp", "infrastructure",
            "safety", "compliance", "revenue", "growth", "layoff"
        ]
        
        for keyword in tag_keywords:
            if keyword in text:
                tags.append(keyword)
        
        return tags[:5]  # Limit to 5 tags
    
    def process_articles(self, articles_path: str = "raw_articles.json") -> list[dict]:
        """Process all articles and return classified events."""
        with open(articles_path) as f:
            data = json.load(f)
        
        articles = data.get("articles", [])
        events = []
        
        print(f"Processing {len(articles)} articles...")
        
        for article in articles:
            result = self.classify_article(article)
            if result:
                if isinstance(result, list):
                    events.extend(result)
                else:
                    events.append(result)
        
        print(f"Generated {len(events)} events")
        return events
    
    def merge_with_existing(self, new_events: list[dict], existing_path: str) -> list[dict]:
        """Merge new events with existing events, avoiding duplicates."""
        existing_path = Path(existing_path)
        
        if existing_path.exists():
            with open(existing_path) as f:
                existing_data = json.load(f)
            existing_events = existing_data.get("events", [])
        else:
            existing_events = []
        
        # Create set of existing URLs to avoid duplicates
        existing_urls = {e.get("source_url") for e in existing_events}
        
        # Add only truly new events
        added = 0
        for event in new_events:
            if event.get("source_url") not in existing_urls:
                existing_events.append(event)
                existing_urls.add(event.get("source_url"))
                added += 1
        
        print(f"Added {added} new events")
        return existing_events
    
    def save_events(self, events: list[dict], output_path: str):
        """Save events to JSON file."""
        with open(output_path, "w") as f:
            json.dump({"events": events}, f, indent=2)
        print(f"Saved {len(events)} events to {output_path}")


def main():
    """Run the classification pipeline."""
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    config_path = script_dir / "sources.yaml"
    articles_path = script_dir / "raw_articles.json"
    
    classifier = ArticleClassifier(config_path=str(config_path))
    
    print("=" * 50)
    print("Fault Line - Classification")
    print("=" * 50)
    
    # Process new articles
    new_events = classifier.process_articles(articles_path=str(articles_path))
    
    # Merge with existing
    events_path = script_dir.parent / "docs" / "data" / "events.json"
    all_events = classifier.merge_with_existing(new_events, str(events_path))
    
    # Save
    classifier.save_events(all_events, str(events_path))
    
    print("=" * 50)
    print("Classification complete")
    print("=" * 50)


if __name__ == "__main__":
    main()
