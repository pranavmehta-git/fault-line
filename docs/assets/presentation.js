const slides = Array.from(document.querySelectorAll('.presentation-slide'));
const counter = document.getElementById('slideCounter');
const navButtons = Array.from(document.querySelectorAll('.slide-jump'));

let currentSlide = 0;

function renderSlides() {
    slides.forEach((slide, index) => slide.classList.toggle('active', index === currentSlide));
    navButtons.forEach((button, index) => button.classList.toggle('active', index === currentSlide));
    if (counter) {
        counter.textContent = `${String(currentSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    }
}

function goToSlide(index) {
    currentSlide = Math.max(0, Math.min(index, slides.length - 1));
    renderSlides();
}

function bindEvents() {
    document.getElementById('nextSlideBtn')?.addEventListener('click', () => goToSlide(currentSlide + 1));
    document.getElementById('prevSlideBtn')?.addEventListener('click', () => goToSlide(currentSlide - 1));
    document.querySelector('.restart-deck')?.addEventListener('click', () => goToSlide(0));
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
            goToSlide(0);
        }
    });
}

renderSlides();
bindEvents();
