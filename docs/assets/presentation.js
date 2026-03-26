/* ============================================
   FaultLine Presentation Controller
   ============================================ */

(function () {
    const slides = Array.from(document.querySelectorAll('.presentation-slide'));
    const counter = document.getElementById('slideCounter');
    const navButtons = Array.from(document.querySelectorAll('.slide-jump'));
    let currentSlide = 0;
    let graphAnimated = false;

    const LAB_COLORS = {
        openai: '#10a37f',
        anthropic: '#d4a574',
        deepmind: '#4285f4',
        xai: '#202124',
        meta: '#0668e1'
    };

    const LAB_NAMES = {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        deepmind: 'DeepMind',
        xai: 'xAI',
        meta: 'Meta AI'
    };

    /* ---------- Base path detection ---------- */
    function basePath() {
        const path = window.location.pathname;
        const idx = path.indexOf('/fault-line/');
        if (idx !== -1) return path.substring(0, idx) + '/fault-line/';
        return '/';
    }

    /* ---------- Slide navigation ---------- */
    function renderSlides() {
        slides.forEach((s, i) => s.classList.toggle('active', i === currentSlide));
        navButtons.forEach((b, i) => b.classList.toggle('active', i === currentSlide));
        if (counter) {
            counter.textContent = `${String(currentSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
        }
        // Trigger graph animation when method slide becomes active
        if (currentSlide === 3 && !graphAnimated) {
            graphAnimated = true;
            setTimeout(animateGraph, 400);
        }
    }

    function goToSlide(index) {
        currentSlide = Math.max(0, Math.min(index, slides.length - 1));
        renderSlides();
    }

    /* ---------- Event binding ---------- */
    function bindEvents() {
        document.getElementById('nextSlideBtn')?.addEventListener('click', () => goToSlide(currentSlide + 1));
        document.getElementById('prevSlideBtn')?.addEventListener('click', () => goToSlide(currentSlide - 1));
        document.querySelectorAll('.restart-deck').forEach(b => b.addEventListener('click', () => goToSlide(0)));
        document.querySelectorAll('.next-slide').forEach(b => b.addEventListener('click', () => goToSlide(currentSlide + 1)));
        navButtons.forEach(b => b.addEventListener('click', () => goToSlide(Number(b.dataset.target))));

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goToSlide(currentSlide + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goToSlide(currentSlide - 1); }
            if (e.key.toLowerCase() === 'r') goToSlide(0);
        });
    }

    /* ---------- Load live data ---------- */
    async function loadData() {
        const base = basePath() + 'data/';
        try {
            const [eventsRes, scoresRes, histRes] = await Promise.all([
                fetch(base + 'events.json'),
                fetch(base + 'scores.json'),
                fetch(base + 'historical_scores.json')
            ]);
            const eventsData = await eventsRes.json();
            const scoresData = await scoresRes.json();
            const histData = await histRes.json();

            // Update event count on intro slide
            const countEl = document.getElementById('eventCount');
            if (countEl && eventsData.events) {
                countEl.textContent = eventsData.events.length;
            }

            // Populate live scorecard
            populateScorecard(scoresData.scores || []);

            // Store historical data for graph animation
            window._histData = histData;
            window._scoresData = scoresData;

        } catch (err) {
            console.warn('Presentation: could not load live data', err);
        }
    }

    /* ---------- Live scorecard ---------- */
    function populateScorecard(scores) {
        const container = document.getElementById('liveScorecard');
        if (!container) return;

        // Sort by rank
        const sorted = [...scores].sort((a, b) => (a.rank || 99) - (b.rank || 99));

        // Keep header, clear rows
        const header = container.querySelector('.viz-rank-header');
        container.innerHTML = '';
        if (header) container.appendChild(header);

        sorted.forEach(lab => {
            const pct = Math.round((lab.total_score / 14) * 100);
            const row = document.createElement('div');
            row.className = 'viz-rank-row';
            row.innerHTML = `
                <span class="rank-lab">
                    <span class="rank-dot" style="background:${LAB_COLORS[lab.lab_id] || '#999'}"></span>
                    ${LAB_NAMES[lab.lab_id] || lab.lab_id}
                </span>
                <span class="rank-score">${lab.total_score} / 14</span>
                <span class="rank-bar"><span style="width:${pct}%"></span></span>
            `;
            container.appendChild(row);
        });
    }

    /* ---------- Animated historical graph ---------- */
    let graphData = null;

    function animateGraph() {
        const canvas = document.getElementById('storyGraph');
        if (!canvas || !window._histData) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = rect.height;

        const snapshots = window._histData.snapshots || [];
        if (snapshots.length === 0) return;

        // Filter to snapshots that have at least one non-null score
        const validSnapshots = snapshots.filter(s =>
            Object.values(s.scores).some(v => v !== null)
        );
        if (validSnapshots.length === 0) return;

        const labs = Object.keys(LAB_COLORS);
        const maxScore = 14;
        const pad = { top: 20, right: 20, bottom: 40, left: 40 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        // Build legend
        const legendEl = document.getElementById('graphLegend');
        if (legendEl) {
            legendEl.innerHTML = labs.map(id =>
                `<span class="legend-item"><span class="legend-dot" style="background:${LAB_COLORS[id]}"></span>${LAB_NAMES[id]}</span>`
            ).join('');
        }

        // Prepare data points per lab
        const labLines = {};
        labs.forEach(id => {
            labLines[id] = [];
            validSnapshots.forEach((snap, i) => {
                const entry = snap.scores[id];
                if (entry && entry.total_score !== undefined) {
                    const x = pad.left + (i / (validSnapshots.length - 1 || 1)) * chartW;
                    const y = pad.top + chartH - (entry.total_score / maxScore) * chartH;
                    labLines[id].push({ x, y });
                }
            });
        });

        // Draw grid
        function drawGrid() {
            ctx.strokeStyle = '#e8eaed';
            ctx.lineWidth = 1;
            // Horizontal grid lines
            for (let i = 0; i <= 4; i++) {
                const y = pad.top + (i / 4) * chartH;
                ctx.beginPath();
                ctx.moveTo(pad.left, y);
                ctx.lineTo(W - pad.right, y);
                ctx.stroke();

                // Y-axis labels
                ctx.fillStyle = '#9aa0a6';
                ctx.font = '11px Open Sans, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(Math.round(maxScore - (i / 4) * maxScore), pad.left - 8, y + 4);
            }

            // X-axis labels (first, middle, last)
            ctx.textAlign = 'center';
            ctx.fillStyle = '#9aa0a6';
            const dates = [0, Math.floor(validSnapshots.length / 2), validSnapshots.length - 1];
            dates.forEach(idx => {
                if (validSnapshots[idx]) {
                    const x = pad.left + (idx / (validSnapshots.length - 1 || 1)) * chartW;
                    const d = new Date(validSnapshots[idx].date);
                    ctx.fillText(d.getFullYear(), x, H - pad.bottom + 24);
                }
            });
        }

        // Animate line drawing
        const totalFrames = 90;
        let frame = 0;

        function drawFrame() {
            ctx.clearRect(0, 0, W, H);
            drawGrid();

            const progress = Math.min(frame / totalFrames, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            labs.forEach(id => {
                const pts = labLines[id];
                if (pts.length < 2) return;

                const drawCount = Math.max(2, Math.floor(pts.length * eased));
                ctx.strokeStyle = LAB_COLORS[id];
                ctx.lineWidth = 2.5;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i < drawCount; i++) {
                    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
                    else ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.stroke();

                // Draw endpoint dot
                if (drawCount > 0) {
                    const last = pts[drawCount - 1];
                    ctx.beginPath();
                    ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = LAB_COLORS[id];
                    ctx.fill();
                }
            });

            frame++;
            if (frame <= totalFrames) {
                requestAnimationFrame(drawFrame);
            }
        }

        drawFrame();
    }

    /* ---------- Init ---------- */
    renderSlides();
    bindEvents();
    loadData();
})();
