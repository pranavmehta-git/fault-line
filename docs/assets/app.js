/**
 * Fault Line - Main Application
 * Loads JSON data and renders the dashboard
 */

class FragilityTracker {
    constructor() {
        this.labs = [];
        this.events = [];
        this.scores = [];
        this.checklist = null;
        this.metadata = null;
        this.currentSort = 'score';
    }

    async init() {
        try {
            await this.loadData();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to load data. Please try again.');
        }
    }

    async loadData() {
        const basePath = this.getBasePath();
        
        const [labsRes, eventsRes, scoresRes, checklistRes, metadataRes] = await Promise.all([
            fetch(`${basePath}data/labs.json`),
            fetch(`${basePath}data/events.json`),
            fetch(`${basePath}data/scores.json`),
            fetch(`${basePath}data/checklist.json`),
            fetch(`${basePath}data/metadata.json`)
        ]);

        this.labs = (await labsRes.json()).labs;
        this.events = (await eventsRes.json()).events;
        const scoresData = await scoresRes.json();
        this.scores = scoresData.scores;
        this.checklist = await checklistRes.json();
        this.metadata = await metadataRes.json();

        // Merge lab info with scores
        this.scores = this.scores.map(score => {
            const lab = this.labs.find(l => l.lab_id === score.lab_id);
            return { ...score, ...lab };
        });

        // Sort by rank initially
        this.scores.sort((a, b) => a.rank - b.rank);
    }

    getBasePath() {
        // Handle both local development and GitHub Pages
        const path = window.location.pathname;
        if (path.includes('/docs/')) {
            return '/docs/';
        }
        return './';
    }

    render() {
        this.renderSummary();
        this.renderRankings();
        this.renderDimensions();
        this.renderRecentEvents();
        this.renderLastUpdated();
    }

    renderSummary() {
        const labsCount = document.getElementById('labsCount');
        const eventsCount = document.getElementById('eventsCount');
        const avgFragility = document.getElementById('avgFragility');
        const highestRisk = document.getElementById('highestRisk');

        if (labsCount) labsCount.textContent = this.labs.length;
        if (eventsCount) eventsCount.textContent = this.events.length;
        
        if (avgFragility) {
            const avg = this.scores.reduce((sum, s) => sum + s.total_score, 0) / this.scores.length;
            avgFragility.textContent = avg.toFixed(1);
        }

        if (highestRisk) {
            const highest = this.scores.reduce((max, s) => s.total_score > max.total_score ? s : max);
            highestRisk.textContent = highest.name;
        }
    }

    renderRankings() {
        const container = document.getElementById('rankingsTable');
        if (!container) return;

        container.innerHTML = this.scores.map(lab => `
            <a href="lab.html?lab=${lab.lab_id}" class="ranking-row">
                <div class="rank-badge rank-${lab.rank}">#${lab.rank}</div>
                <div class="lab-info">
                    <span class="lab-emoji">${lab.logo_emoji}</span>
                    <div class="lab-details">
                        <div class="lab-name">${lab.name}</div>
                        <div class="lab-hq">${lab.hq}</div>
                    </div>
                </div>
                <div class="score-display">
                    <span class="score-value ${this.getScoreClass(lab.total_score)}">${lab.total_score}</span>
                    <span class="score-max">/10</span>
                    ${this.getScoreTooltipHTML()}
                </div>
                <div class="dimension-bars">
                    ${this.renderDimensionBars(lab.breakdown)}
                </div>
                <div class="trend-indicator ${lab.trend}">
                    <span class="trend-icon">${this.getTrendIcon(lab.trend)}</span>
                    <span>${lab.trend}</span>
                </div>
            </a>
        `).join('');
    }

    renderDimensionBars(breakdown) {
        const dimensions = [
            { key: 'compute_chips', label: 'Compute', class: 'compute' },
            { key: 'cloud', label: 'Cloud', class: 'cloud' },
            { key: 'policy', label: 'Policy', class: 'policy' },
            { key: 'demand', label: 'Demand', class: 'demand' },
            { key: 'resilience', label: 'Resil.', class: 'resilience' }
        ];

        return dimensions.map(dim => {
            const data = breakdown[dim.key];
            const percent = (data.score / data.max) * 100;
            return `
                <div class="dim-bar">
                    <span class="dim-bar-label">${dim.label}</span>
                    <div class="dim-bar-track">
                        <div class="dim-bar-fill ${dim.class}" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDimensions() {
        const container = document.getElementById('dimensionsGrid');
        if (!container || !this.checklist) return;

        container.innerHTML = this.checklist.dimensions.map(dim => {
            // Calculate total triggered across all labs
            const totalTriggered = this.scores.reduce((sum, lab) => {
                return sum + (lab.breakdown[dim.id]?.items_triggered?.length || 0);
            }, 0);

            return `
                <div class="dimension-card ${dim.id.replace('_', '')}">
                    <div class="dimension-header">
                        <span class="dimension-icon">${dim.icon}</span>
                        <span class="dimension-score">${totalTriggered} triggers</span>
                    </div>
                    <div class="dimension-name">${dim.name}</div>
                    <div class="dimension-desc">${dim.description}</div>
                </div>
            `;
        }).join('');
    }

    renderRecentEvents() {
        const container = document.getElementById('recentEvents');
        if (!container) return;

        // Sort events by date descending and take first 5
        const recentEvents = [...this.events]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        container.innerHTML = recentEvents.map(event => {
            const lab = this.labs.find(l => l.lab_id === event.lab);
            return `
                <div class="event-card">
                    <div class="event-date">${this.formatDate(event.date)}</div>
                    <div class="event-lab">
                        <span class="event-lab-emoji">${lab?.logo_emoji || '🔬'}</span>
                        <span>${lab?.name || event.lab}</span>
                    </div>
                    <div class="event-content">
                        <div class="event-summary">${event.summary}</div>
                        <div class="event-meta">
                            <span class="event-dimension ${event.dimension}">${this.formatDimension(event.dimension)}</span>
                            <span class="event-source">${event.source_name}</span>
                        </div>
                    </div>
                    <div class="event-impact ${this.getImpactClass(event.impact)}">
                        ${this.getImpactSymbol(event.impact)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderLastUpdated() {
        const container = document.getElementById('lastUpdated');
        if (!container || !this.metadata) return;

        const updateTime = container.querySelector('.update-time');
        if (updateTime) {
            const date = new Date(this.metadata.last_run);
            updateTime.textContent = this.formatDateTime(date);
        }
    }

    bindEvents() {
        // Sort controls
        document.querySelectorAll('.control-btn[data-sort]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sortType = e.target.dataset.sort;
                this.sortRankings(sortType);
                
                // Update active state
                document.querySelectorAll('.control-btn[data-sort]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    sortRankings(sortType) {
        switch (sortType) {
            case 'score':
                this.scores.sort((a, b) => b.total_score - a.total_score);
                break;
            case 'name':
                this.scores.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'trend':
                const trendOrder = { worsening: 0, stable: 1, improving: 2 };
                this.scores.sort((a, b) => trendOrder[a.trend] - trendOrder[b.trend]);
                break;
        }
        this.renderRankings();
    }

    // Utility methods
    getScoreTooltipHTML() {
        return `
            <div class="score-tooltip-wrapper">
                <span class="score-tooltip-trigger" aria-label="Score explanation">?</span>
                <div class="score-tooltip-content" role="tooltip">
                    <div class="score-tooltip-title">Fragility Score</div>
                    <div class="score-tooltip-scale">
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator high">8-10</span>
                            <span class="score-tooltip-text">Critical systemic risk</span>
                        </div>
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator high">6-7</span>
                            <span class="score-tooltip-text">High vulnerability</span>
                        </div>
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator low">4-5</span>
                            <span class="score-tooltip-text">Moderate exposure</span>
                        </div>
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator low">0-3</span>
                            <span class="score-tooltip-text">Low fragility</span>
                        </div>
                    </div>
                    <div class="score-tooltip-note">
                        Higher scores indicate greater dependency on concentrated resources,
                        policy uncertainty, or limited resilience factors.
                    </div>
                </div>
            </div>
        `;
    }

    getScoreClass(score) {
        if (score >= 8) return 'score-critical';
        if (score >= 6) return 'score-high';
        if (score >= 4) return 'score-medium';
        if (score >= 2) return 'score-low';
        return 'score-minimal';
    }

    getTrendIcon(trend) {
        switch (trend) {
            case 'improving': return '↘';
            case 'worsening': return '↗';
            default: return '→';
        }
    }

    getImpactClass(impact) {
        if (impact > 0) return 'positive';
        if (impact < 0) return 'negative';
        return 'neutral';
    }

    getImpactSymbol(impact) {
        if (impact > 0) return '+';
        if (impact < 0) return '−';
        return '•';
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatDateTime(date) {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDimension(dim) {
        const labels = {
            compute_chips: 'Compute',
            cloud: 'Cloud',
            policy: 'Policy',
            demand: 'Demand',
            resilience: 'Resilience'
        };
        return labels[dim] || dim;
    }

    showError(message) {
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 4rem; color: var(--risk-critical);">
                    <p>${message}</p>
                </div>
            `;
        }
    }
}

// Lab Detail Page Controller
class LabDetailPage {
    constructor() {
        this.labId = new URLSearchParams(window.location.search).get('lab');
        this.lab = null;
        this.score = null;
        this.events = [];
        this.checklist = null;
    }

    async init() {
        if (!this.labId) {
            window.location.href = 'index.html';
            return;
        }

        try {
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Failed to load lab data:', error);
        }
    }

    async loadData() {
        const basePath = window.location.pathname.includes('/docs/') ? '/docs/' : './';
        
        const [labsRes, eventsRes, scoresRes, checklistRes] = await Promise.all([
            fetch(`${basePath}data/labs.json`),
            fetch(`${basePath}data/events.json`),
            fetch(`${basePath}data/scores.json`),
            fetch(`${basePath}data/checklist.json`)
        ]);

        const labs = (await labsRes.json()).labs;
        this.lab = labs.find(l => l.lab_id === this.labId);
        
        const allEvents = (await eventsRes.json()).events;
        this.events = allEvents.filter(e => e.lab === this.labId);
        
        const scores = (await scoresRes.json()).scores;
        this.score = scores.find(s => s.lab_id === this.labId);
        
        this.checklist = await checklistRes.json();
    }

    render() {
        if (!this.lab || !this.score) return;

        // Update page title
        document.title = `${this.lab.name} - Fragility Tracker`;

        // Render header
        this.renderHeader();
        
        // Render checklist
        this.renderChecklist();
        
        // Render events
        this.renderEvents();
    }

    renderHeader() {
        const header = document.getElementById('labHeader');
        if (!header) return;

        header.innerHTML = `
            <span class="lab-header-icon">${this.lab.logo_emoji}</span>
            <div class="lab-header-content">
                <h1 class="lab-header-title">${this.lab.name}</h1>
                <div class="lab-header-meta">
                    <span>📍 ${this.lab.hq}</span>
                    <span>🗓 Founded ${this.lab.founded}</span>
                    <a href="${this.lab.website}" target="_blank">🔗 Website</a>
                </div>
                <p class="lab-header-desc">${this.lab.description}</p>
            </div>
            <div class="lab-score-card">
                <div class="lab-score-label">Fragility Score ${this.getScoreTooltipHTML()}</div>
                <div class="lab-score-value ${this.getScoreClass(this.score.total_score)}">${this.score.total_score}</div>
                <div class="lab-score-trend trend-indicator ${this.score.trend}">
                    ${this.getTrendIcon(this.score.trend)} ${this.score.trend}
                </div>
            </div>
        `;
    }

    renderChecklist() {
        const container = document.getElementById('checklistGrid');
        if (!container || !this.checklist) return;

        // Get all triggered items for this lab
        const triggeredItems = new Set();
        Object.values(this.score.breakdown).forEach(dim => {
            dim.items_triggered?.forEach(item => triggeredItems.add(item));
        });

        container.innerHTML = this.checklist.checklist_items.map(item => {
            const isTriggered = triggeredItems.has(item.id);
            const relatedEvents = this.events.filter(e => 
                e.checklist_items_affected?.includes(item.id)
            );

            return `
                <div class="checklist-item ${isTriggered ? 'triggered' : 'not-triggered'}">
                    <div class="checklist-status">${isTriggered ? '⚠️' : '○'}</div>
                    <div class="checklist-content">
                        <div class="checklist-name">${item.id}: ${item.name}</div>
                        <div class="checklist-desc">${item.description}</div>
                        ${isTriggered && relatedEvents.length > 0 ? `
                            <div class="checklist-evidence">
                                ${relatedEvents.slice(0, 2).map(e => `
                                    <a href="${e.source_url}" target="_blank" class="evidence-link">
                                        📎 ${e.source_name}: ${e.summary.slice(0, 60)}...
                                    </a>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEvents() {
        const container = document.getElementById('labEvents');
        if (!container) return;

        const sortedEvents = [...this.events].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        container.innerHTML = sortedEvents.map(event => `
            <div class="event-card">
                <div class="event-date">${this.formatDate(event.date)}</div>
                <div class="event-lab">
                    <span class="event-dimension ${event.dimension}">${this.formatDimension(event.dimension)}</span>
                </div>
                <div class="event-content">
                    <div class="event-summary">${event.summary}</div>
                    <div class="event-meta">
                        <a href="${event.source_url}" target="_blank" class="event-source">
                            ${event.source_name} →
                        </a>
                    </div>
                </div>
                <div class="event-impact ${this.getImpactClass(event.impact)}">
                    ${this.getImpactSymbol(event.impact)}
                </div>
            </div>
        `).join('');
    }

    // Utility methods (same as main tracker)
    getScoreTooltipHTML() {
        return `
            <div class="score-tooltip-wrapper">
                <span class="score-tooltip-trigger" aria-label="Score explanation">?</span>
                <div class="score-tooltip-content" role="tooltip">
                    <div class="score-tooltip-title">Fragility Score</div>
                    <div class="score-tooltip-scale">
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator high">8-10</span>
                            <span class="score-tooltip-text">Critical systemic risk</span>
                        </div>
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator high">6-7</span>
                            <span class="score-tooltip-text">High vulnerability</span>
                        </div>
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator low">4-5</span>
                            <span class="score-tooltip-text">Moderate exposure</span>
                        </div>
                        <div class="score-tooltip-item">
                            <span class="score-tooltip-indicator low">0-3</span>
                            <span class="score-tooltip-text">Low fragility</span>
                        </div>
                    </div>
                    <div class="score-tooltip-note">
                        Higher scores indicate greater dependency on concentrated resources,
                        policy uncertainty, or limited resilience factors.
                    </div>
                </div>
            </div>
        `;
    }

    getScoreClass(score) {
        if (score >= 8) return 'score-critical';
        if (score >= 6) return 'score-high';
        if (score >= 4) return 'score-medium';
        if (score >= 2) return 'score-low';
        return 'score-minimal';
    }

    getTrendIcon(trend) {
        switch (trend) {
            case 'improving': return '↘';
            case 'worsening': return '↗';
            default: return '→';
        }
    }

    getImpactClass(impact) {
        if (impact > 0) return 'positive';
        if (impact < 0) return 'negative';
        return 'neutral';
    }

    getImpactSymbol(impact) {
        if (impact > 0) return '+';
        if (impact < 0) return '−';
        return '•';
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatDimension(dim) {
        const labels = {
            compute_chips: 'Compute',
            cloud: 'Cloud',
            policy: 'Policy',
            demand: 'Demand',
            resilience: 'Resilience'
        };
        return labels[dim] || dim;
    }
}

// Events Page Controller
class EventsPage {
    constructor() {
        this.events = [];
        this.labs = [];
        this.filteredEvents = [];
        this.filters = {
            lab: 'all',
            dimension: 'all',
            impact: 'all',
            search: ''
        };
    }

    async init() {
        try {
            await this.loadData();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to load events:', error);
        }
    }

    async loadData() {
        const basePath = window.location.pathname.includes('/docs/') ? '/docs/' : './';
        
        const [labsRes, eventsRes] = await Promise.all([
            fetch(`${basePath}data/labs.json`),
            fetch(`${basePath}data/events.json`)
        ]);

        this.labs = (await labsRes.json()).labs;
        this.events = (await eventsRes.json()).events;
        this.filteredEvents = [...this.events];
    }

    render() {
        this.renderFilters();
        this.renderEvents();
    }

    renderFilters() {
        // Populate lab filter
        const labSelect = document.getElementById('filterLab');
        if (labSelect) {
            labSelect.innerHTML = `
                <option value="all">All Labs</option>
                ${this.labs.map(lab => `
                    <option value="${lab.lab_id}">${lab.name}</option>
                `).join('')}
            `;
        }
    }

    renderEvents() {
        const container = document.getElementById('eventsGrid');
        const countEl = document.getElementById('eventsResultsCount');
        
        if (!container) return;

        // Sort by date descending
        const sortedEvents = [...this.filteredEvents].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        if (countEl) {
            countEl.textContent = `Showing ${sortedEvents.length} of ${this.events.length} events`;
        }

        container.innerHTML = sortedEvents.map(event => {
            const lab = this.labs.find(l => l.lab_id === event.lab);
            return `
                <div class="event-card">
                    <div class="event-date">${this.formatDate(event.date)}</div>
                    <div class="event-lab">
                        <span class="event-lab-emoji">${lab?.logo_emoji || '🔬'}</span>
                        <span>${lab?.name || event.lab}</span>
                    </div>
                    <div class="event-content">
                        <div class="event-summary">${event.summary}</div>
                        <div class="event-meta">
                            <span class="event-dimension ${event.dimension}">${this.formatDimension(event.dimension)}</span>
                            <a href="${event.source_url}" target="_blank" class="event-source">${event.source_name} →</a>
                        </div>
                    </div>
                    <div class="event-impact ${this.getImpactClass(event.impact)}">
                        ${this.getImpactSymbol(event.impact)}
                    </div>
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        // Lab filter
        document.getElementById('filterLab')?.addEventListener('change', (e) => {
            this.filters.lab = e.target.value;
            this.applyFilters();
        });

        // Dimension filter
        document.getElementById('filterDimension')?.addEventListener('change', (e) => {
            this.filters.dimension = e.target.value;
            this.applyFilters();
        });

        // Impact filter
        document.getElementById('filterImpact')?.addEventListener('change', (e) => {
            this.filters.impact = e.target.value;
            this.applyFilters();
        });

        // Search
        document.getElementById('filterSearch')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        });
    }

    applyFilters() {
        this.filteredEvents = this.events.filter(event => {
            // Lab filter
            if (this.filters.lab !== 'all' && event.lab !== this.filters.lab) {
                return false;
            }

            // Dimension filter
            if (this.filters.dimension !== 'all' && event.dimension !== this.filters.dimension) {
                return false;
            }

            // Impact filter
            if (this.filters.impact !== 'all') {
                if (this.filters.impact === 'positive' && event.impact <= 0) return false;
                if (this.filters.impact === 'negative' && event.impact >= 0) return false;
                if (this.filters.impact === 'neutral' && event.impact !== 0) return false;
            }

            // Search filter
            if (this.filters.search && !event.summary.toLowerCase().includes(this.filters.search)) {
                return false;
            }

            return true;
        });

        this.renderEvents();
    }

    // Utility methods
    getImpactClass(impact) {
        if (impact > 0) return 'positive';
        if (impact < 0) return 'negative';
        return 'neutral';
    }

    getImpactSymbol(impact) {
        if (impact > 0) return '+';
        if (impact < 0) return '−';
        return '•';
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatDimension(dim) {
        const labels = {
            compute_chips: 'Compute',
            cloud: 'Cloud',
            policy: 'Policy',
            demand: 'Demand',
            resilience: 'Resilience'
        };
        return labels[dim] || dim;
    }
}

// Initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path.includes('lab.html')) {
        new LabDetailPage().init();
    } else if (path.includes('events.html')) {
        new EventsPage().init();
    } else {
        new FragilityTracker().init();
    }
});
