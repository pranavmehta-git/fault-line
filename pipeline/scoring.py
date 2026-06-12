#!/usr/bin/env python3
"""
Fault Line - Shared Scoring Engine (v3)

Single source of truth for fragility scoring, used by both
recalculate_scores.py (current scores) and compute_historical_scores.py
(monthly snapshots). v2 had two diverging copies of the scoring logic.

Methodology (v3)
================

The v2 score was a binary checklist: any single event inside a hard
180-day window permanently "lit up" a checklist item, and the total was
the count of lit items. That design had four structural faults:

1. Ceiling saturation. Once all items were lit the score pinned at
   10/10 and could not respond to further deterioration. 300 events
   scored the same as 14 well-placed ones.
2. Coverage bias. Labs with more press coverage (or an RSS-enabled
   blog) lit more items regardless of severity, so heavily-covered labs
   ranked as more fragile and thinly-covered labs (e.g. xAI) as less.
3. Hard decay cliff. An event counted at full weight on day 180 and at
   zero on day 181.
4. Direction blindness. Checklist items were triggered by keyword
   presence alone, so good-news articles (impact = -1) still added
   fragility points.

v3 replaces the binary trigger with a continuous evidence model:

* Each event contributes a signal
      signal = confidence_weight x source_type_weight x time_decay
  Time decay is exponential with a 90-day half-life (no cliff).
  Self-published lab blogs are down-weighted; regulatory filings are
  up-weighted. Events whose impact direction contradicts the item
  (impact < 0) are excluded.

* Corroboration, not volume. Signals are grouped by publisher domain
  and only the strongest signal per domain counts. Ten reposts by one
  outlet are one piece of evidence; the same story confirmed by three
  independent outlets is three.

* Each checklist item maps total evidence E to an intensity in [0, 1)
  with a saturating curve:
      intensity = E / (E + SATURATION_EVIDENCE)
  Marginal events always move the score (no frozen ceiling) but with
  diminishing returns (no runaway volume bias).

* Dimension score = sum of its item intensities (0-2, continuous).
  Total = 10 x max(0, fragility_dims_sum - resilience) / 12,
  reported to one decimal. 10 is now an asymptote, never a resting
  state.

Systemic (cross-lab) risk
=========================

v2 scored each lab independently, which misses the actual systemic
story: frontier labs share suppliers and fail together. v3 adds a
Systemic Risk Index built from four components (see
compute_systemic_risk for the exact weights):

* average lab fragility - the level term;
* correlated stress    - how many labs are stressed on the same
                         dimension at the same time;
* shared dependency    - concentration of all labs on the same few
                         suppliers (NVIDIA, Azure, AWS, GCP, ...);
* score co-movement    - trailing correlation of lab score histories;
                         labs that move together fail together.
"""

import math
from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import urlparse

# --- Tunables -------------------------------------------------------------

#: Exponential decay half-life: an event loses half its weight every 90 days.
HALF_LIFE_DAYS = 90

#: Events older than this contribute nothing (decay < 6% there anyway).
EVENT_HORIZON_DAYS = 365

#: Evidence units at which an item reaches 50% intensity. One fresh
#: high-confidence news report (signal 1.0) yields intensity 0.5;
#: three independent confirmations yield 0.75; ten yield 0.91.
SATURATION_EVIDENCE = 1.0

#: Classification-confidence multipliers (was 1.0/0.75/0.5 in v2; the spread
#: is widened so weakly-evidenced items no longer score near-full credit).
CONFIDENCE_WEIGHTS = {"high": 1.0, "medium": 0.6, "low": 0.3}

#: Source-type multipliers. Self-published lab blogs are PR and count half;
#: regulatory filings (SEC, FTC, EU) count extra.
SOURCE_TYPE_WEIGHTS = {"regulatory": 1.25, "news": 1.0, "lab_blog": 0.5}

#: A checklist item is listed as "triggered" (for UI display) above this
#: intensity. Purely cosmetic; the score itself is continuous.
TRIGGER_DISPLAY_THRESHOLD = 0.10

#: A dimension counts as "stressed" for systemic-breadth purposes when its
#: continuous score (0-2) reaches this value.
STRESS_THRESHOLD = 0.8

LABS = ["openai", "anthropic", "deepmind", "xai", "meta"]
FRAGILITY_DIMENSIONS = [
    "compute_chips", "cloud", "policy", "demand",
    "societal_impact", "talent_governance",
]
DIMENSIONS = FRAGILITY_DIMENSIONS + ["resilience"]

#: Maximum possible raw fragility (6 dimensions x 2 items at intensity 1).
MAX_RAW_FRAGILITY = 2 * len(FRAGILITY_DIMENSIONS)

#: Supplier tags used to measure shared-dependency concentration.
#: Tag -> human-readable supplier name.
PROVIDER_TAGS = {
    "nvidia": "NVIDIA",
    "azure": "Microsoft Azure",
    "microsoft": "Microsoft Azure",
    "aws": "Amazon Web Services",
    "gcp": "Google Cloud",
    "tpu": "Google TPU",
}


# --- Event-level signal ----------------------------------------------------

def time_decay(event_date: datetime, reference_date: datetime) -> float:
    """Exponential decay weight in [0, 1] for an event of a given age."""
    age_days = (reference_date - event_date).days
    if age_days < 0 or age_days > EVENT_HORIZON_DAYS:
        return 0.0
    return math.exp(-math.log(2) * age_days / HALF_LIFE_DAYS)


def event_signal(event: dict, reference_date: datetime) -> float:
    """Evidence contributed by one event: confidence x source type x decay."""
    try:
        event_date = datetime.strptime(event["date"], "%Y-%m-%d")
    except (KeyError, ValueError):
        return 0.0
    confidence = CONFIDENCE_WEIGHTS.get(event.get("confidence"), CONFIDENCE_WEIGHTS["low"])
    source_type = SOURCE_TYPE_WEIGHTS.get(event.get("source_type"), SOURCE_TYPE_WEIGHTS["news"])
    return confidence * source_type * time_decay(event_date, reference_date)


def publisher_domain(event: dict) -> str:
    """Publisher domain used to group corroborating coverage."""
    netloc = urlparse(event.get("source_url", "")).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc or event.get("source_name", "unknown")


def item_intensity(item_id: str, lab_events: list[dict], reference_date: datetime) -> dict:
    """Continuous intensity in [0, 1) for one checklist item.

    Only events that list the item and whose impact direction does not
    contradict it (impact >= 0) qualify. Evidence is the sum over
    publisher domains of the strongest signal per domain, then squashed
    through the saturating curve.
    """
    best_per_domain: dict[str, float] = defaultdict(float)
    for event in lab_events:
        if item_id not in event.get("checklist_items_affected", []):
            continue
        if event.get("impact", 0) < 0:
            continue
        signal = event_signal(event, reference_date)
        domain = publisher_domain(event)
        best_per_domain[domain] = max(best_per_domain[domain], signal)

    evidence = sum(best_per_domain.values())
    intensity = evidence / (evidence + SATURATION_EVIDENCE) if evidence > 0 else 0.0
    return {
        "intensity": intensity,
        "evidence": round(evidence, 3),
        "corroborating_sources": len([s for s in best_per_domain.values() if s > 0]),
    }


# --- Lab-level score -------------------------------------------------------

def score_lab(lab_id: str, events: list[dict], reference_date: datetime,
              checklist_items: list[dict]) -> dict:
    """Compute the v3 fragility score for one lab.

    `events` may contain all labs' events; they are filtered here.
    `checklist_items` is the checklist.json item list (id, dimension, ...).
    """
    lab_events = [e for e in events if e.get("lab") == lab_id]

    items_by_dimension: dict[str, list[dict]] = defaultdict(list)
    for item in checklist_items:
        items_by_dimension[item["dimension"]].append(item)

    breakdown = {}
    for dimension in DIMENSIONS:
        dim_score = 0.0
        item_details = {}
        triggered = []
        for item in items_by_dimension.get(dimension, []):
            detail = item_intensity(item["id"], lab_events, reference_date)
            dim_score += detail["intensity"]
            item_details[item["id"]] = {
                "intensity": round(detail["intensity"], 3),
                "evidence": detail["evidence"],
                "corroborating_sources": detail["corroborating_sources"],
            }
            if detail["intensity"] >= TRIGGER_DISPLAY_THRESHOLD:
                triggered.append(item["id"])

        breakdown[dimension] = {
            "score": round(dim_score, 2),
            "max": len(items_by_dimension.get(dimension, [])) or 2,
            "items_triggered": sorted(triggered),
            "items": item_details,
        }

    fragility_sum = sum(breakdown[d]["score"] for d in FRAGILITY_DIMENSIONS)
    resilience = breakdown["resilience"]["score"]
    total_score = round(10 * max(0.0, fragility_sum - resilience) / MAX_RAW_FRAGILITY, 1)

    dated = [e["date"] for e in lab_events if e.get("date")]
    return {
        "lab_id": lab_id,
        "total_score": total_score,
        "breakdown": breakdown,
        "events_count": len(lab_events),
        "last_event_date": max(dated) if dated else None,
        "top_drivers": _top_drivers(breakdown),
    }


def _top_drivers(breakdown: dict) -> list[dict]:
    """The three checklist items contributing most to the score, for the UI."""
    contributions = []
    for dimension in FRAGILITY_DIMENSIONS:
        for item_id, detail in breakdown[dimension]["items"].items():
            contributions.append({
                "item": item_id,
                "dimension": dimension,
                "intensity": detail["intensity"],
                "corroborating_sources": detail["corroborating_sources"],
            })
    contributions.sort(key=lambda c: -c["intensity"])
    return [c for c in contributions[:3] if c["intensity"] > 0]


# --- Systemic (cross-lab) risk ----------------------------------------------

def correlated_stress(lab_results: list[dict]) -> dict:
    """How broadly each fragility dimension is stressed across labs.

    A dimension stressed at one lab is idiosyncratic; the same dimension
    stressed at four of five labs simultaneously is a correlated,
    industry-wide failure mode. Returns per-dimension breadth (share of
    labs above STRESS_THRESHOLD) and their mean.
    """
    per_dimension = {}
    for dimension in FRAGILITY_DIMENSIONS:
        stressed = [r["lab_id"] for r in lab_results
                    if r["breakdown"][dimension]["score"] >= STRESS_THRESHOLD]
        per_dimension[dimension] = {
            "stressed_labs": sorted(stressed),
            "breadth": round(len(stressed) / max(1, len(lab_results)), 2),
        }
    breadths = [d["breadth"] for d in per_dimension.values()]
    return {
        "value": round(sum(breadths) / len(breadths), 3) if breadths else 0.0,
        "per_dimension": per_dimension,
    }


def shared_dependency(events: list[dict], reference_date: datetime) -> dict:
    """Concentration of all labs on the same suppliers.

    For each supplier tag, exposure = share of labs with at least one
    in-horizon event carrying that tag. The component value is the mean
    of the top three exposures: if every lab depends on NVIDIA and most
    on two hyperscalers, a single supplier shock propagates everywhere.
    """
    horizon_start = reference_date - timedelta(days=EVENT_HORIZON_DAYS)
    labs_per_supplier: dict[str, set] = defaultdict(set)

    for event in events:
        lab = event.get("lab")
        if lab not in LABS or event.get("impact", 0) < 0:
            continue
        try:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d")
        except (KeyError, ValueError):
            continue
        if not (horizon_start <= event_date <= reference_date):
            continue
        for tag in event.get("tags", []):
            supplier = PROVIDER_TAGS.get(tag)
            if supplier:
                labs_per_supplier[supplier].add(lab)

    exposures = [
        {"supplier": supplier, "labs_exposed": sorted(labs),
         "exposure": round(len(labs) / len(LABS), 2)}
        for supplier, labs in labs_per_supplier.items()
    ]
    exposures.sort(key=lambda e: -e["exposure"])
    top = [e["exposure"] for e in exposures[:3]]
    return {
        "value": round(sum(top) / len(top), 3) if top else 0.0,
        "suppliers": exposures,
    }


def score_co_movement(historical_snapshots: list[dict], months: int = 12) -> dict | None:
    """Average pairwise correlation of lab score histories.

    Computed over the trailing `months` monthly snapshots. High
    co-movement means lab fragility scores rise and fall together -
    shocks are common-mode, not lab-specific. Returns None when there is
    not enough usable history.
    """
    recent = historical_snapshots[-months:]
    if len(recent) < 4:
        return None

    series: dict[str, list[float]] = {}
    for lab in LABS:
        values = [snap.get("scores", {}).get(lab, {}).get("total_score")
                  for snap in recent
                  if snap.get("scores", {}).get(lab) is not None]
        if len(values) == len(recent):
            series[lab] = values

    correlations = []
    labs = sorted(series)
    for i in range(len(labs)):
        for j in range(i + 1, len(labs)):
            r = _pearson(series[labs[i]], series[labs[j]])
            if r is not None:
                correlations.append(r)
    if not correlations:
        return None

    mean_r = sum(correlations) / len(correlations)
    return {
        # Map r in [-1, 1] to [0, 1] so it composes with the other components.
        "value": round((mean_r + 1) / 2, 3),
        "mean_correlation": round(mean_r, 3),
        "window_months": len(recent),
        "labs_included": labs,
    }


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    var_x = sum((x - mean_x) ** 2 for x in xs)
    var_y = sum((y - mean_y) ** 2 for y in ys)
    if var_x == 0 or var_y == 0:
        return None  # flat series carries no correlation information
    return cov / math.sqrt(var_x * var_y)


def compute_systemic_risk(lab_results: list[dict], events: list[dict],
                          reference_date: datetime,
                          historical_snapshots: list[dict] | None = None) -> dict:
    """Combine the four systemic components into a 0-10 index.

    Weights: average fragility 0.35, correlated stress 0.30, shared
    dependency 0.20, co-movement 0.15. When score history is too short
    for co-movement, its weight is redistributed proportionally.
    """
    avg_fragility = (sum(r["total_score"] for r in lab_results) / len(lab_results)
                     if lab_results else 0.0)
    stress = correlated_stress(lab_results)
    dependency = shared_dependency(events, reference_date)
    co_movement = score_co_movement(historical_snapshots or [])

    components = {
        "average_lab_fragility": {
            "value": round(avg_fragility / 10, 3),
            "weight": 0.35,
            "description": "Mean fragility score across labs (0-1).",
        },
        "correlated_stress": {
            "value": stress["value"],
            "weight": 0.30,
            "description": "Share of labs simultaneously stressed on the same "
                           "dimensions - correlated rather than idiosyncratic risk.",
            "per_dimension": stress["per_dimension"],
        },
        "shared_dependency": {
            "value": dependency["value"],
            "weight": 0.20,
            "description": "Concentration of all labs on the same few suppliers "
                           "(common-mode single points of failure).",
            "suppliers": dependency["suppliers"],
        },
        "co_movement": {
            "value": co_movement["value"] if co_movement else None,
            "weight": 0.15,
            "description": "Trailing 12-month correlation of lab score histories; "
                           "labs that move together fail together.",
            "detail": co_movement,
        },
    }

    active = {k: c for k, c in components.items() if c["value"] is not None}
    total_weight = sum(c["weight"] for c in active.values())
    index = 10 * sum(c["value"] * c["weight"] for c in active.values()) / total_weight

    return {
        "index": round(index, 1),
        "components": components,
        "description": "Cross-lab systemic risk: high when labs are fragile, "
                       "stressed on the same dimensions, dependent on the same "
                       "suppliers, and historically move together.",
    }
