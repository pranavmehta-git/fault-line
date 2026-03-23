const slides = Array.from(document.querySelectorAll('.presentation-slide'));
const queue = document.getElementById('slideQueue');
const notes = document.getElementById('speakerNotes');
const timer = document.getElementById('presentationTimer');
const counter = document.getElementById('slideCounter');
const navButtons = Array.from(document.querySelectorAll('.slide-jump'));

let currentSlide = 0;
let remainingSeconds = 5 * 60;

function renderQueue() {
    if (!queue) return;
    queue.innerHTML = slides.map((slide, index) => `
        <button class="queue-item ${index === currentSlide ? 'active' : ''}" data-index="${index}">
            <span class="queue-number">${String(index + 1).padStart(2, '0')}</span>
            <span class="queue-title">${slide.dataset.title}</span>
        </button>
    `).join('');

    queue.querySelectorAll('.queue-item').forEach((button) => {
        button.addEventListener('click', () => goToSlide(Number(button.dataset.index)));
    });
}

function renderNotes() {
    if (!notes) return;
    const slideNotes = (slides[currentSlide]?.dataset.notes || '').split('|').filter(Boolean);
    notes.innerHTML = slideNotes.map(note => `<li>${note}</li>`).join('');
}

function renderSlides() {
    slides.forEach((slide, index) => slide.classList.toggle('active', index === currentSlide));
    navButtons.forEach((button, index) => button.classList.toggle('active', index === currentSlide));
    if (counter) {
        counter.textContent = `${String(currentSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    }
    renderQueue();
    renderNotes();
}

function goToSlide(index) {
    currentSlide = Math.max(0, Math.min(index, slides.length - 1));
    renderSlides();
}

function tickTimer() {
    if (!timer) return;
    const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const secs = String(remainingSeconds % 60).padStart(2, '0');
    timer.textContent = `${mins}:${secs} remaining`;
    if (remainingSeconds > 0) remainingSeconds -= 1;
}

function bindEvents() {
    document.getElementById('nextSlideBtn')?.addEventListener('click', () => goToSlide(currentSlide + 1));
    document.getElementById('prevSlideBtn')?.addEventListener('click', () => goToSlide(currentSlide - 1));
    document.querySelector('.restart-deck')?.addEventListener('click', () => {
        remainingSeconds = 5 * 60;
        tickTimer();
        goToSlide(0);
    });
    document.querySelectorAll('.next-slide').forEach((button) => {
        button.addEventListener('click', () => goToSlide(currentSlide + 1));
    });
    navButtons.forEach((button) => {
        button.addEventListener('click', () => goToSlide(Number(button.dataset.target)));
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === ' ') {
            event.preventDefault();
            goToSlide(currentSlide + 1);
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            goToSlide(currentSlide - 1);
        }
        if (event.key.toLowerCase() === 'r') {
            remainingSeconds = 5 * 60;
            tickTimer();
            goToSlide(0);
        }
    });
}

renderSlides();
tickTimer();
setInterval(tickTimer, 1000);
bindEvents();
