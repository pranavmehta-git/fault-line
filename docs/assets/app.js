/**
 * Fault Line - Main Application
 * Loads JSON data and renders the dashboard
 */

// SVG Icon helper function - maps icon identifiers to inline SVGs
function getLabIcon(iconName, className = 'lab-icon') {
    const icons = {
        robot: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"/>
            <circle cx="12" cy="5" r="2"/>
            <path d="M12 7v4"/>
            <line x1="8" y1="16" x2="8" y2="16"/>
            <line x1="16" y1="16" x2="16" y2="16"/>
        </svg>`,
        microscope: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 18h8"/>
            <path d="M3 22h18"/>
            <path d="M14 22a7 7 0 1 0 0-14h-1"/>
            <path d="M9 14h2"/>
            <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/>
            <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>
        </svg>`,
        brain: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
        </svg>`,
        bolt: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>`,
        infinity: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/>
        </svg>`,
        location: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
        </svg>`,
        calendar: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>`,
        link: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>`,
        warning: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`,
        circle: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
        </svg>`,
        paperclip: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>`
    };
    return icons[iconName] || icons.microscope;
}

class FragilityTracker {
    constructor() {
        this.labs = [];
        this.events = [];
        this.scores = [];
        this.checklist = null;
        this.metadata = null;
        this.historicalScores = null;
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

        const [labsRes, eventsRes, scoresRes, checklistRes, metadataRes, historicalRes] = await Promise.all([
            fetch(`${basePath}data/labs.json`),
            fetch(`${basePath}data/events.json`),
            fetch(`${basePath}data/scores.json`),
            fetch(`${basePath}data/checklist.json`),
            fetch(`${basePath}data/metadata.json`),
            fetch(`${basePath}data/historical_scores.json`).catch(() => null)
        ]);

        this.labs = (await labsRes.json()).labs;
        this.events = (await eventsRes.json()).events;
        const scoresData = await scoresRes.json();
        this.scores = scoresData.scores;
        this.checklist = await checklistRes.json();
        this.metadata = await metadataRes.json();

        if (historicalRes && historicalRes.ok) {
            this.historicalScores = await historicalRes.json();
        }

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
        this.renderHistoricalContext();
        this.renderRecentEvents();
        this.renderLastUpdated();
    }

    renderHistoricalContext() {
        const trendsContainer = document.getElementById('historicalTrends');
        const milestonesContainer = document.getElementById('recentMilestones');

        if (!trendsContainer || !this.historicalScores) return;

        const snapshots = this.historicalScores.snapshots;
        if (!snapshots || snapshots.length < 2) return;

        // Calculate trends over different periods
        const latest = snapshots[snapshots.length - 1];
        const oneMonthAgo = snapshots[Math.max(0, snapshots.length - 2)];
        const threeMonthsAgo = snapshots[Math.max(0, snapshots.length - 4)];
        const oneYearAgo = snapshots[Math.max(0, snapshots.length - 13)];

        const calcAvgChange = (oldSnap, newSnap) => {
            let totalChange = 0;
            let count = 0;
            for (const labId of ['openai', 'anthropic', 'deepmind', 'xai', 'meta']) {
                const oldScore = oldSnap?.scores?.[labId]?.total_score;
                const newScore = newSnap?.scores?.[labId]?.total_score;
                if (oldScore !== undefined && newScore !== undefined) {
                    totalChange += newScore - oldScore;
                    count++;
                }
            }
            return count > 0 ? totalChange / count : 0;
        };

        const trend30d = calcAvgChange(oneMonthAgo, latest);
        const trend90d = calcAvgChange(threeMonthsAgo, latest);
        const trend1y = calcAvgChange(oneYearAgo, latest);

        const formatTrend = (val) => {
            if (val > 0.2) return { text: `+${val.toFixed(1)}`, class: 'worsening' };
            if (val < -0.2) return { text: val.toFixed(1), class: 'improving' };
            return { text: '0.0', class: 'stable' };
        };

        const t30 = formatTrend(trend30d);
        const t90 = formatTrend(trend90d);
        const t1y = formatTrend(trend1y);

        trendsContainer.innerHTML = `
            <div class="trend-stat">
                <div class="trend-stat-label">30-Day Avg</div>
                <div class="trend-stat-value ${t30.class}">${t30.text}</div>
            </div>
            <div class="trend-stat">
                <div class="trend-stat-label">90-Day Avg</div>
                <div class="trend-stat-value ${t90.class}">${t90.text}</div>
            </div>
            <div class="trend-stat">
                <div class="trend-stat-label">1-Year Avg</div>
                <div class="trend-stat-value ${t1y.class}">${t1y.text}</div>
            </div>
        `;

        // Get most significant recent historical events
        if (milestonesContainer) {
            const recentHistorical = this.events
                .filter(e => e.historical === true)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 2);

            if (recentHistorical.length > 0) {
                milestonesContainer.innerHTML = recentHistorical.map(event => {
                    const lab = this.labs.find(l => l.lab_id === event.lab);
                    return `
                        <div class="recent-milestone">
                            <div class="recent-milestone-lab">${lab?.name || event.lab}</div>
                            <div class="recent-milestone-text">${event.summary}</div>
                        </div>
                    `;
                }).join('');
            }
        }
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
                    <span class="lab-icon-wrapper">${getLabIcon(lab.logo_icon)}</span>
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
                        <span class="event-lab-icon">${getLabIcon(lab?.logo_icon || 'microscope', 'lab-icon-sm')}</span>
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
            this.updateLastSyncDisplay(updateTime, date);

            // Update relative time every minute
            if (this.lastSyncInterval) clearInterval(this.lastSyncInterval);
            this.lastSyncInterval = setInterval(() => {
                this.updateLastSyncDisplay(updateTime, date);
            }, 60000);
        }
    }

    updateLastSyncDisplay(element, date) {
        const relativeTime = this.formatRelativeTime(date);
        const utcTime = this.formatDateTime(date);
        element.textContent = relativeTime;
        element.title = utcTime;
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
            minute: '2-digit',
            timeZone: 'UTC'
        }) + ' UTC';
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'yesterday';
        return `${diffDays}d ago`;
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
        this.historicalScores = null;
    }

    async init() {
        if (!this.labId) {
            window.location.href = 'index.html';
            return;
        }

        try {
            await this.loadData();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('Failed to load lab data:', error);
        }
    }

    async loadData() {
        const basePath = window.location.pathname.includes('/docs/') ? '/docs/' : './';

        const [labsRes, eventsRes, scoresRes, checklistRes, historicalRes] = await Promise.all([
            fetch(`${basePath}data/labs.json`),
            fetch(`${basePath}data/events.json`),
            fetch(`${basePath}data/scores.json`),
            fetch(`${basePath}data/checklist.json`),
            fetch(`${basePath}data/historical_scores.json`).catch(() => null)
        ]);

        const labs = (await labsRes.json()).labs;
        this.lab = labs.find(l => l.lab_id === this.labId);

        const allEvents = (await eventsRes.json()).events;
        this.events = allEvents.filter(e => e.lab === this.labId);

        const scores = (await scoresRes.json()).scores;
        this.score = scores.find(s => s.lab_id === this.labId);

        this.checklist = await checklistRes.json();

        if (historicalRes && historicalRes.ok) {
            this.historicalScores = await historicalRes.json();
        }
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

        // Render history
        this.renderHistory();

        // Update timeline link
        const timelineLink = document.getElementById('viewFullTimeline');
        if (timelineLink) {
            timelineLink.href = `timeline.html?lab=${this.labId}`;
        }
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.lab-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;

                // Update active tab
                document.querySelectorAll('.lab-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Update active content
                document.querySelectorAll('.lab-tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === `${tabName}Tab`);
                });

                // Render history chart when switching to history tab
                if (tabName === 'history') {
                    setTimeout(() => this.renderHistoryChart(), 50);
                }
            });
        });
    }

    renderHeader() {
        const header = document.getElementById('labHeader');
        if (!header) return;

        header.innerHTML = `
            <span class="lab-header-icon">${getLabIcon(this.lab.logo_icon, 'lab-icon-lg')}</span>
            <div class="lab-header-content">
                <h1 class="lab-header-title">${this.lab.name}</h1>
                <div class="lab-header-meta">
                    <span>${getLabIcon('location', 'meta-icon')} ${this.lab.hq}</span>
                    <span>${getLabIcon('calendar', 'meta-icon')} Founded ${this.lab.founded}</span>
                    <a href="${this.lab.website}" target="_blank">${getLabIcon('link', 'meta-icon')} Website</a>
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
                    <div class="checklist-status">${isTriggered ? getLabIcon('warning', 'status-icon warning') : getLabIcon('circle', 'status-icon')}</div>
                    <div class="checklist-content">
                        <div class="checklist-name">${item.id}: ${item.name}</div>
                        <div class="checklist-desc">${item.description}</div>
                        ${isTriggered && relatedEvents.length > 0 ? `
                            <div class="checklist-evidence">
                                ${relatedEvents.slice(0, 2).map(e => `
                                    <a href="${e.source_url}" target="_blank" class="evidence-link">
                                        ${getLabIcon('paperclip', 'evidence-icon')} ${e.source_name}: ${e.summary.slice(0, 60)}...
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

    renderHistory() {
        const milestonesContainer = document.getElementById('labMilestones');
        if (!milestonesContainer) return;

        // Get historical events for this lab, sorted by date
        const historicalEvents = this.events
            .filter(e => e.historical === true)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        if (historicalEvents.length === 0) {
            milestonesContainer.innerHTML = '<div class="timeline-empty">No historical milestones available</div>';
            return;
        }

        milestonesContainer.innerHTML = historicalEvents.map(event => `
            <div class="milestone-item">
                <div class="milestone-date">${this.formatDate(event.date)}</div>
                <div class="milestone-content">
                    <div class="milestone-title">${event.summary}</div>
                    <div class="milestone-desc">
                        <span class="event-dimension ${event.dimension}">${this.formatDimension(event.dimension)}</span>
                        ${event.tags?.slice(0, 2).map(t => `<span class="timeline-tag">${t}</span>`).join('') || ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderHistoryChart() {
        const canvas = document.getElementById('labTrendCanvas');
        if (!canvas || !this.historicalScores) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Set canvas size for high DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        // Chart dimensions
        const padding = { top: 20, right: 20, bottom: 30, left: 35 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Get snapshots for this lab (sample every 3 months)
        const snapshots = this.historicalScores.snapshots
            .filter((_, i) => i % 3 === 0)
            .filter(s => s.scores[this.labId] !== null);

        if (snapshots.length < 2) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 10; i += 2) {
            const y = padding.top + chartHeight - (i / 10) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#5f6368';
            ctx.font = '10px JetBrains Mono';
            ctx.textAlign = 'right';
            ctx.fillText(i.toString(), padding.left - 8, y + 4);
        }

        // X-axis labels (years)
        const years = [...new Set(snapshots.map(s => s.date.substring(0, 4)))];
        ctx.fillStyle = '#5f6368';
        ctx.textAlign = 'center';
        years.forEach((year, i) => {
            const x = padding.left + (i / (years.length - 1)) * chartWidth;
            ctx.fillText(year, x, height - 5);
        });

        // Draw line for this lab
        const labColor = {
            openai: '#f28b82',
            anthropic: '#81c995',
            deepmind: '#8ab4f8',
            xai: '#fdd663',
            meta: '#bb86fc'
        }[this.labId] || '#8ab4f8';

        ctx.strokeStyle = labColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let started = false;
        snapshots.forEach((snapshot, i) => {
            const labScore = snapshot.scores[this.labId];
            if (!labScore) return;

            const x = padding.left + (i / (snapshots.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - (labScore.total_score / 10) * chartHeight;

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Fill area under the line
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = labColor.replace(')', ', 0.1)').replace('rgb', 'rgba');
        ctx.fill();
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
                        <span class="event-lab-icon">${getLabIcon(lab?.logo_icon || 'microscope', 'lab-icon-sm')}</span>
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

// Timeline Page Controller
class TimelinePage {
    constructor() {
        this.events = [];
        this.labs = [];
        this.historicalScores = null;
        this.metadata = null;
        this.filteredEvents = [];
        this.selectedEvent = null;
        this.filters = {
            labs: ['all'],
            dimension: 'all',
            impact: 'all',
            search: ''
        };
        this.zoomLevel = 'year';
        this.chartView = 'all';
        this.labColors = {
            openai: '#f28b82',
            anthropic: '#81c995',
            deepmind: '#8ab4f8',
            xai: '#fdd663',
            meta: '#bb86fc'
        };
    }

    async init() {
        try {
            await this.loadData();
            this.render();
            this.bindEvents();
            this.updateURLFromFilters();
        } catch (error) {
            console.error('Failed to load timeline data:', error);
        }
    }

    async loadData() {
        const basePath = window.location.pathname.includes('/docs/') ? '/docs/' : './';

        const [labsRes, eventsRes, scoresRes, metadataRes] = await Promise.all([
            fetch(`${basePath}data/labs.json`),
            fetch(`${basePath}data/events.json`),
            fetch(`${basePath}data/historical_scores.json`),
            fetch(`${basePath}data/metadata.json`)
        ]);

        this.labs = (await labsRes.json()).labs;
        this.events = (await eventsRes.json()).events;
        this.historicalScores = await scoresRes.json();
        this.metadata = await metadataRes.json();

        // Sort events by date descending for display
        this.events.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.filteredEvents = [...this.events];

        // Parse URL filters
        this.parseURLFilters();
    }

    parseURLFilters() {
        const params = new URLSearchParams(window.location.search);

        if (params.has('lab')) {
            const labs = params.get('lab').split(',');
            this.filters.labs = labs;
            // Update UI
            document.querySelectorAll('.filter-chip[data-lab]').forEach(chip => {
                if (labs.includes(chip.dataset.lab)) {
                    chip.classList.add('active');
                } else if (chip.dataset.lab !== 'all') {
                    chip.classList.remove('active');
                }
            });
            if (!labs.includes('all')) {
                document.querySelector('.filter-chip[data-lab="all"]')?.classList.remove('active');
            }
        }

        if (params.has('dimension')) {
            this.filters.dimension = params.get('dimension');
            const dimSelect = document.getElementById('filterDimension');
            if (dimSelect) dimSelect.value = this.filters.dimension;
        }

        if (params.has('impact')) {
            this.filters.impact = params.get('impact');
            const impactSelect = document.getElementById('filterImpact');
            if (impactSelect) impactSelect.value = this.filters.impact;
        }

        if (params.has('search')) {
            this.filters.search = params.get('search');
            const searchInput = document.getElementById('filterSearch');
            if (searchInput) searchInput.value = this.filters.search;
        }

        this.applyFilters();
    }

    updateURLFromFilters() {
        const params = new URLSearchParams();

        if (!this.filters.labs.includes('all') && this.filters.labs.length > 0) {
            params.set('lab', this.filters.labs.join(','));
        }
        if (this.filters.dimension !== 'all') {
            params.set('dimension', this.filters.dimension);
        }
        if (this.filters.impact !== 'all') {
            params.set('impact', this.filters.impact);
        }
        if (this.filters.search) {
            params.set('search', this.filters.search);
        }

        const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, '', newURL);
    }

    render() {
        this.renderLastUpdated();
        this.renderChart();
        this.renderTimeline();
        this.renderStats();
    }

    renderLastUpdated() {
        const container = document.getElementById('lastUpdated');
        if (!container || !this.metadata) return;

        const updateTime = container.querySelector('.update-time');
        if (updateTime) {
            const date = new Date(this.metadata.last_run);
            updateTime.textContent = this.formatRelativeTime(date);
            updateTime.title = this.formatDateTime(date);
        }
    }

    renderChart() {
        const canvas = document.getElementById('trendCanvas');
        const legendContainer = document.getElementById('chartLegend');
        if (!canvas || !this.historicalScores) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Set canvas size for high DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        // Chart dimensions
        const padding = { top: 20, right: 20, bottom: 40, left: 40 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Get snapshots (sample every 3 months for performance)
        const snapshots = this.historicalScores.snapshots.filter((_, i) => i % 3 === 0);
        if (snapshots.length === 0) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 10; i += 2) {
            const y = padding.top + chartHeight - (i / 10) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#5f6368';
            ctx.font = '10px JetBrains Mono';
            ctx.textAlign = 'right';
            ctx.fillText(i.toString(), padding.left - 8, y + 4);
        }

        // X-axis labels (years)
        const years = [...new Set(snapshots.map(s => s.date.substring(0, 4)))];
        ctx.fillStyle = '#5f6368';
        ctx.textAlign = 'center';
        years.forEach((year, i) => {
            const x = padding.left + (i / (years.length - 1)) * chartWidth;
            ctx.fillText(year, x, height - padding.bottom + 20);
        });

        // Draw lines for each lab
        const labIds = ['openai', 'anthropic', 'deepmind', 'xai', 'meta'];
        const activeLabs = this.filters.labs.includes('all') ? labIds : this.filters.labs;

        labIds.forEach(labId => {
            const isActive = activeLabs.includes(labId);
            ctx.strokeStyle = isActive ? this.labColors[labId] : 'rgba(128, 128, 128, 0.2)';
            ctx.lineWidth = isActive ? 2 : 1;

            ctx.beginPath();
            let started = false;

            snapshots.forEach((snapshot, i) => {
                const labScore = snapshot.scores[labId];
                if (!labScore) return;

                const x = padding.left + (i / (snapshots.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - (labScore.total_score / 10) * chartHeight;

                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
        });

        // Render legend
        if (legendContainer) {
            legendContainer.innerHTML = labIds.map(labId => {
                const lab = this.labs.find(l => l.lab_id === labId);
                const isActive = activeLabs.includes(labId);
                return `
                    <div class="legend-item ${isActive ? '' : 'dimmed'}" data-lab="${labId}">
                        <span class="legend-color ${labId}"></span>
                        <span>${lab?.name || labId}</span>
                    </div>
                `;
            }).join('');
        }
    }

    renderTimeline() {
        const container = document.getElementById('timelineContainer');
        if (!container) return;

        if (this.filteredEvents.length === 0) {
            container.innerHTML = '<div class="timeline-empty">No events match your filters</div>';
            return;
        }

        // Group events by year and month
        const grouped = this.groupEventsByDate(this.filteredEvents);

        let html = '';
        const years = Object.keys(grouped).sort((a, b) => b - a);

        years.forEach(year => {
            html += `<div class="timeline-year-group">`;
            html += `<div class="timeline-year-label">${year}</div>`;

            const months = Object.keys(grouped[year]).sort((a, b) => b - a);
            months.forEach(month => {
                const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
                html += `<div class="timeline-month-group">`;
                html += `<div class="timeline-month-label">${monthName}</div>`;

                grouped[year][month].forEach(event => {
                    html += this.renderTimelineEvent(event);
                });

                html += `</div>`;
            });

            html += `</div>`;
        });

        container.innerHTML = html;
    }

    groupEventsByDate(events) {
        const grouped = {};

        events.forEach(event => {
            const date = new Date(event.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            if (!grouped[year]) grouped[year] = {};
            if (!grouped[year][month]) grouped[year][month] = [];

            grouped[year][month].push(event);
        });

        return grouped;
    }

    renderTimelineEvent(event) {
        const lab = this.labs.find(l => l.lab_id === event.lab);
        const impactClass = event.impact > 0 ? 'impact-positive' : event.impact < 0 ? 'impact-negative' : '';

        return `
            <div class="timeline-event" data-event-id="${event.id}">
                <div class="timeline-event-marker ${event.dimension} ${impactClass}"></div>
                <div class="timeline-event-content">
                    <div class="timeline-event-header">
                        <span class="timeline-event-date">${this.formatDate(event.date)}</span>
                        <span class="timeline-event-lab">
                            ${getLabIcon(lab?.logo_icon || 'microscope', 'lab-icon-xs')}
                            ${lab?.name || event.lab}
                        </span>
                    </div>
                    <div class="timeline-event-summary">${event.summary}</div>
                    ${event.tags?.length ? `
                        <div class="timeline-event-tags">
                            ${event.tags.slice(0, 3).map(tag => `<span class="timeline-tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderStats() {
        const countEl = document.getElementById('eventCount');
        const rangeEl = document.getElementById('dateRange');

        if (countEl) {
            countEl.textContent = this.filteredEvents.length;
        }

        if (rangeEl && this.filteredEvents.length > 0) {
            const dates = this.filteredEvents.map(e => e.date).sort();
            const earliest = dates[0];
            const latest = dates[dates.length - 1];
            rangeEl.textContent = `${this.formatDate(earliest)} to ${this.formatDate(latest)}`;
        }
    }

    showEventDetail(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        this.selectedEvent = event;
        const panel = document.getElementById('eventDetailPanel');
        const content = document.getElementById('panelContent');

        if (!panel || !content) return;

        const lab = this.labs.find(l => l.lab_id === event.lab);
        const impactClass = event.impact > 0 ? 'positive' : event.impact < 0 ? 'negative' : 'neutral';
        const impactSymbol = event.impact > 0 ? '+' : event.impact < 0 ? '-' : '=';

        content.innerHTML = `
            <div class="panel-date">${this.formatFullDate(event.date)}</div>
            <div class="panel-lab">
                ${getLabIcon(lab?.logo_icon || 'microscope', 'lab-icon')}
                ${lab?.name || event.lab}
            </div>
            <div class="panel-summary">${event.summary}</div>
            <div class="panel-meta">
                <div class="panel-meta-item">
                    <span class="panel-meta-label">Dimension</span>
                    <span class="panel-dimension ${event.dimension}">${this.formatDimension(event.dimension)}</span>
                </div>
                <div class="panel-meta-item">
                    <span class="panel-meta-label">Impact</span>
                    <span class="panel-impact ${impactClass}">${impactSymbol}</span>
                </div>
                ${event.checklist_items_affected?.length ? `
                    <div class="panel-meta-item">
                        <span class="panel-meta-label">Checklist Items</span>
                        <div class="panel-checklist">
                            ${event.checklist_items_affected.map(item => `
                                <span class="panel-checklist-item">${item}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <div class="panel-meta-item">
                    <span class="panel-meta-label">Confidence</span>
                    <span class="panel-confidence ${event.confidence}">${event.confidence}</span>
                </div>
                ${event.tags?.length ? `
                    <div class="panel-meta-item">
                        <span class="panel-meta-label">Tags</span>
                        <div class="panel-tags">
                            ${event.tags.map(tag => `<span class="panel-tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <a href="${event.source_url}" target="_blank" class="panel-source-link">
                ${event.source_name} &rarr;
            </a>
        `;

        panel.classList.add('active');

        // Highlight selected event
        document.querySelectorAll('.timeline-event').forEach(el => {
            el.classList.toggle('selected', el.dataset.eventId === eventId);
        });
    }

    hideEventDetail() {
        const panel = document.getElementById('eventDetailPanel');
        if (panel) panel.classList.remove('active');

        document.querySelectorAll('.timeline-event.selected').forEach(el => {
            el.classList.remove('selected');
        });

        this.selectedEvent = null;
    }

    applyFilters() {
        this.filteredEvents = this.events.filter(event => {
            // Lab filter
            if (!this.filters.labs.includes('all') && !this.filters.labs.includes(event.lab)) {
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
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                const matches = event.summary.toLowerCase().includes(searchLower) ||
                    event.tags?.some(t => t.toLowerCase().includes(searchLower));
                if (!matches) return false;
            }

            return true;
        });

        this.renderTimeline();
        this.renderStats();
        this.renderChart();
        this.updateURLFromFilters();
    }

    bindEvents() {
        // Lab filter chips
        document.querySelectorAll('.filter-chip[data-lab]').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const lab = e.target.dataset.lab;

                if (lab === 'all') {
                    this.filters.labs = ['all'];
                    document.querySelectorAll('.filter-chip[data-lab]').forEach(c => {
                        c.classList.toggle('active', c.dataset.lab === 'all');
                    });
                } else {
                    // Remove 'all' from selection
                    this.filters.labs = this.filters.labs.filter(l => l !== 'all');

                    if (this.filters.labs.includes(lab)) {
                        this.filters.labs = this.filters.labs.filter(l => l !== lab);
                        e.target.classList.remove('active');
                    } else {
                        this.filters.labs.push(lab);
                        e.target.classList.add('active');
                    }

                    // If no labs selected, select 'all'
                    if (this.filters.labs.length === 0) {
                        this.filters.labs = ['all'];
                        document.querySelector('.filter-chip[data-lab="all"]')?.classList.add('active');
                    } else {
                        document.querySelector('.filter-chip[data-lab="all"]')?.classList.remove('active');
                    }
                }

                this.applyFilters();
            });
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

        // Search filter
        let searchTimeout;
        document.getElementById('filterSearch')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filters.search = e.target.value;
                this.applyFilters();
            }, 300);
        });

        // Zoom controls
        document.querySelectorAll('.zoom-btn[data-zoom]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.zoomLevel = e.target.dataset.zoom;
                document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // Re-render with new zoom level
                this.renderTimeline();
            });
        });

        // Chart view controls
        document.querySelectorAll('.control-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.chartView = e.target.dataset.view;
                document.querySelectorAll('.control-btn[data-view]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderChart();
            });
        });

        // Timeline event clicks
        document.getElementById('timelineContainer')?.addEventListener('click', (e) => {
            const eventEl = e.target.closest('.timeline-event');
            if (eventEl) {
                this.showEventDetail(eventEl.dataset.eventId);
            }
        });

        // Panel close
        document.getElementById('panelClose')?.addEventListener('click', () => {
            this.hideEventDetail();
        });

        // Legend clicks to toggle lab visibility
        document.getElementById('chartLegend')?.addEventListener('click', (e) => {
            const legendItem = e.target.closest('.legend-item');
            if (legendItem) {
                const lab = legendItem.dataset.lab;
                const chip = document.querySelector(`.filter-chip[data-lab="${lab}"]`);
                if (chip) chip.click();
            }
        });

        // Resize handler for chart
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.renderChart(), 100);
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedEvent) {
                this.hideEventDetail();
            }
        });
    }

    // Utility methods
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatFullDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    formatDateTime(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        }) + ' UTC';
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'yesterday';
        return `${diffDays}d ago`;
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

    if (path.includes('timeline.html')) {
        new TimelinePage().init();
    } else if (path.includes('lab.html')) {
        new LabDetailPage().init();
    } else if (path.includes('events.html')) {
        new EventsPage().init();
    } else {
        new FragilityTracker().init();
    }
});
