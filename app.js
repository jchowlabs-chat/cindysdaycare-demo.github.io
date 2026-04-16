const images = [
    'static/1.jpeg',
    'static/2.jpeg',
    'static/3.jpeg',
    'static/4.jpeg',
    'static/5.jpeg',
    'static/6.jpeg',
    'static/7.jpeg',
    'static/8.jpeg',
    'static/9.jpeg'
];

let currentIndex = 1;
const autoScrollDelay = 4000;
let autoScrollId = null;
const track = document.getElementById('carouselTrack');

function initCarousel() {
    images.forEach((src, index) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.setAttribute('data-index', index);
        
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Gallery image ${index + 1}`;
        item.appendChild(img);
        track.appendChild(item);
    });

    updateCarousel();
}

function updateCarousel() {
    const items = document.querySelectorAll('.carousel-item');

    items.forEach((item, index) => {
        item.classList.remove('center', 'side');
        item.style.display = 'none';
        
        if (index === currentIndex) {
            item.classList.add('center');
            item.style.display = 'block';
        }
        else if (index === (currentIndex - 1 + images.length) % images.length) {
            item.classList.add('side');
            item.style.display = 'block';
        }
        else if (index === (currentIndex + 1) % images.length) {
            item.classList.add('side');
            item.style.display = 'block';
        }
    });
}

function scrollCarousel(direction) {
    currentIndex = (currentIndex + direction + images.length) % images.length;
    updateCarousel();
}

function startAutoScroll() {
    stopAutoScroll();
    autoScrollId = window.setInterval(function() {
        scrollCarousel(1);
    }, autoScrollDelay);
}

function stopAutoScroll() {
    if (autoScrollId !== null) {
        window.clearInterval(autoScrollId);
        autoScrollId = null;
    }
}

initCarousel();
startAutoScroll();

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoScroll();
        return;
    }

    startAutoScroll();
});

// Hamburger Menu Toggle
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navLinks = document.querySelector('.nav-links');

hamburgerBtn.addEventListener('click', function() {
    hamburgerBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
});

// Close mobile menu when clicking on a link
const navLinkItems = document.querySelectorAll('.nav-links a');
navLinkItems.forEach(link => {
    link.addEventListener('click', function() {
        hamburgerBtn.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const isClickInsideNav = navLinks.contains(event.target);
    const isClickOnHamburger = hamburgerBtn.contains(event.target);
    
    if (!isClickInsideNav && !isClickOnHamburger && navLinks.classList.contains('active')) {
        hamburgerBtn.classList.remove('active');
        navLinks.classList.remove('active');
    }
});

window.addEventListener('load', function() {
    window.scrollTo(0, 0);
});

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
