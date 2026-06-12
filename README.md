# Fault Line

A public dashboard for monitoring systemic fragility across frontier AI labs, powered by transparent methodology and continuous news ingestion.

## 🎯 What This Is

The Fault Line converts fragmented AI industry news into a coherent monitoring dashboard. It tracks **5 frontier AI labs** across **7 fragility dimensions**, producing a continuous **0-10 fragility score** per lab plus a cross-lab **Systemic Risk Index** that measures correlated, industry-wide risk (shared suppliers, simultaneous stress, score co-movement). Every signal is weighted by confidence, source type, recency (90-day half-life), and independent corroboration — see [the methodology](https://pranavmehta-git.github.io/fault-line/methodology.html) and `pipeline/scoring.py`.

### Tracked Labs
- **OpenAI** - GPT/ChatGPT
- **Anthropic** - Claude
- **DeepMind** - Gemini
- **xAI** - Grok
- **Meta** - Llama

### Fragility Dimensions
1. **Compute & Chips** - GPU/accelerator dependence, supply constraints
2. **Cloud Concentration** - Hyperscaler lock-in, switching costs
3. **Policy & Geopolitics** - Regulatory exposure, export controls
4. **Demand & Commercialization** - Revenue signals, adoption challenges
5. **Societal Impact** - Workforce displacement, misinformation, safety incidents
6. **Talent & Governance** - Leadership instability, board dysfunction
7. **Resilience** - Diversification efforts (reduces fragility)

## 📊 Live Dashboard

**[View the Dashboard →](https://pranavmehta-git.github.io/fault-line/)**

Features:
- Ranked table of labs by fragility score
- Drill-down into each lab's scorecard with evidence links
- Events explorer with filtering by dimension, impact, and date
- Full methodology documentation

## 🎤 Demo Presentation

**[View the Presentation →](https://pranavmehta-git.github.io/fault-line/presentation.html)**

A self-contained 5-minute lightning talk deck built into the site itself. Navigate with arrow keys, spacebar, or on-screen controls. Includes a countdown timer and speaker notes.

Slides: Intro → Background → Thesis → Methodology → Purpose → Limitations

## 🏗️ Architecture

This project uses a **static site + scheduled pipeline** architecture:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   RSS Feeds     │────▶│  GitHub Actions  │────▶│  GitHub Pages   │
│   (Sources)     │     │  (Python ETL)    │     │  (Static Site)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        docs/data/*.json
```

- **Frontend**: Pure HTML/CSS/JS served via GitHub Pages
- **Pipeline**: Python scripts run on schedule via GitHub Actions
- **Data**: JSON files committed to the repository

## 🚀 Quick Start

### 1. Fork This Repository

Click "Fork" in the top right corner of this page.

### 2. Enable GitHub Pages

1. Go to your fork's **Settings** → **Pages**
2. Set **Source** to "GitHub Actions"
3. The `deploy-pages.yml` workflow will automatically deploy the `docs/` folder on every push to `main`

Your site will be live at `https://yourusername.github.io/fault-line/`

### 3. Enable GitHub Actions

1. Go to **Actions** tab in your fork
2. Click "I understand my workflows, go ahead and enable them"
3. The pipeline will run automatically every 6 hours
4. You can also trigger manually via "Run workflow"

### 4. (Optional) Run Pipeline Locally

```bash
# Clone your fork
git clone https://github.com/yourusername/fault-line.git
cd fault-line

# Install dependencies
pip install -r requirements.txt

# Run the pipeline
python pipeline/ingest.py
python pipeline/classify.py

# Serve locally
cd docs && python -m http.server 8000
# Visit http://localhost:8000
```

## 📁 Project Structure

```
fault-line/
├── docs/                      # GitHub Pages root
│   ├── .nojekyll             # Bypass Jekyll processing
│   ├── index.html            # Dashboard
│   ├── presentation.html     # Lightning talk deck
│   ├── lab.html              # Lab detail view
│   ├── events.html           # Events explorer
│   ├── methodology.html      # Scoring documentation
│   ├── timeline.html         # Score timeline view
│   ├── roadmap.html          # Project roadmap
│   ├── 404.html              # Custom 404 page
│   ├── assets/
│   │   ├── styles.css        # Light theme stylesheet
│   │   ├── app.js            # Dashboard controllers
│   │   └── presentation.js   # Slide deck logic
│   └── data/
│       ├── events.json       # Processed events
│       ├── labs.json         # Lab profiles
│       ├── scores.json       # Computed scores
│       ├── checklist.json    # Scoring criteria
│       ├── historical_scores.json  # Score history
│       └── metadata.json     # Pipeline status
│
├── pipeline/                  # Python ETL
│   ├── ingest.py             # RSS fetching
│   ├── classify.py           # Event classification
│   ├── sources.yaml          # Feed configuration
│   └── overrides.yaml        # Manual corrections
│
├── .github/
│   └── workflows/
│       ├── update-data.yml   # Scheduled data pipeline
│       └── deploy-pages.yml  # GitHub Pages deployment
│
├── .gitignore                # Git ignore rules
├── requirements.txt          # Python dependencies
├── LICENSE                   # MIT License
└── README.md
```

## 📐 Scoring Methodology

### The Checklist (10 items across 5 dimensions)

**A) Compute & Chips (0-2 points)**
- A1: Single GPU vendor dependence
- A2: Supply constraints / delivery risk

**B) Cloud Concentration (0-2 points)**
- B1: Primary dependence on one hyperscaler
- B2: Switching costs / exclusivity signals

**C) Policy & Geopolitics (0-2 points)**
- C1: Export controls / cross-border restrictions
- C2: Regulatory action sensitivity

**D) Demand & Commercialization (0-2 points)**
- D1: Demand weakness / monetization challenges
- D2: Capex/opex overhang / runway strain

**E) Resilience (0-2 points, inverted)**
- E1: Multi-sourcing / diversification (-1)
- E2: Risk-reduction actions (-1)

### Score Calculation

```
Fragility Score = (A + B + C + D) - E
Clamped to range [0, 10]
```

### Evidence Rules
- Each checklist item must be supported by at least one event link
- Evidence expires after 180 days unless reaffirmed
- Contradictory evidence marks items as "contested"

## 🔧 Configuration

### Adding News Sources

Edit `pipeline/sources.yaml`:

```yaml
feeds:
  - name: "New Source"
    url: "https://example.com/feed.rss"
    category: "tech"
```

### Manual Overrides

Edit `pipeline/overrides.yaml` to correct classifications:

```yaml
overrides:
  - url: "https://example.com/article"
    lab: "openai"
    dimension: "cloud"
    impact: 1
    notes: "Corrected from 'chips' to 'cloud'"
```

### Adding a New Lab

1. Add entry to `docs/data/labs.json`
2. Add classification patterns to `pipeline/sources.yaml`
3. The pipeline will automatically include the new lab

## 🤝 Contributing

### Submit an Event

1. Click **Issues** → **New Issue**
2. Provide the event URL, affected lab, and relevant dimension
3. A maintainer will review and include it

### Improve the Code

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Report Issues

Found a bug or have a suggestion? [Open an issue](../../issues/new).

## 📜 Methodology Transparency

Every score in this tracker is:
- **Traceable**: Click any score to see the checklist items and evidence
- **Auditable**: All events include source URLs
- **Versioned**: Changes are tracked in git history
- **Documented**: Full methodology available at `/methodology.html`

## ⚖️ Legal & Ethical Notes

- We respect `robots.txt` and publisher terms
- RSS feeds are preferred over scraping
- No content is reproduced without attribution
- This is a research/monitoring tool, not financial advice

## 📊 Data Updates

The pipeline runs automatically every 6 hours via GitHub Actions. You can see the last update timestamp on the dashboard or check the Actions tab for run history.

## 🙏 Acknowledgments

Inspired by the need for transparent monitoring of AI industry systemic risks. Built with vanilla HTML/CSS/JS and Python for maximum accessibility and maintainability.

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

**Questions?** [Open an issue](../../issues/new) or check the [methodology page](https://yourusername.github.io/fault-line/methodology.html).

---

© 2026 Pranav Mehta. This project is developed as part of MATS.
