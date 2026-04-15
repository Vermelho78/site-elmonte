// Set current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// HUD Canvas Animation
const canvas = document.getElementById('hudCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

function init() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    
    particles = [];
    const numParticles = Math.floor(width / 30);
    
    for(let i = 0; i < numParticles; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 1,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            color: Math.random() > 0.5 ? '#E51A22' : 'rgba(255, 255, 255, 0.2)'
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    
    // Draw Particles
    particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        
        // Wrap around bounds
        if(p.x < 0) p.x = width;
        if(p.x > width) p.x = 0;
        if(p.y < 0) p.y = height;
        if(p.y > height) p.y = 0;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        if(p.color === '#E51A22') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FF3333';
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.fill();
        
        // Draw connections
        for(let j = index + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            
            if(dist < 150) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                
                // Color based on distance
                const alpha = 1 - (dist / 150);
                if(p.color === '#E51A22' || p2.color === '#E51A22') {
                    ctx.strokeStyle = `rgba(229, 26, 34, ${alpha * 0.3})`;
                } else {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.05})`;
                }
                
                ctx.stroke();
            }
        }
    });
    
    if (isCanvasVisible) {
        requestAnimationFrame(draw);
    }
}

// Initial setup
init();

let isCanvasVisible = true;
let resizeTimer;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 250);
});

// Performance: Intersection Observer for Canvas
const heroSection = document.getElementById('hero');
if(heroSection) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                if(!isCanvasVisible) {
                    isCanvasVisible = true;
                    draw();
                }
            } else {
                isCanvasVisible = false;
            }
        });
    }, { threshold: 0.1 });
    // O canvas fica visual em hero e em partes do top.
    observer.observe(heroSection);
} else {
    draw();
}

// Glitch text effect logic
const glitchText = document.querySelector('.glitch');
const originalText = glitchText.getAttribute('data-text');
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*()<>{}[]';

let isGlitchVisible = true;
if(heroSection && glitchText) {
    const glitchObserver = new IntersectionObserver((entries) => {
        isGlitchVisible = entries[0].isIntersecting;
    }, { threshold: 0.1 });
    glitchObserver.observe(heroSection);
}

setInterval(() => {
    if(!isGlitchVisible) return;
    if(Math.random() > 0.95) {
        let textArray = originalText.split('');
        const indices = [
            Math.floor(Math.random() * textArray.length),
            Math.floor(Math.random() * textArray.length)
        ];
        
        indices.forEach(idx => {
            if(textArray[idx] !== ' ') {
                textArray[idx] = characters[Math.floor(Math.random() * characters.length)];
            }
        });
        
        glitchText.textContent = textArray.join('');
        
        setTimeout(() => {
            glitchText.textContent = originalText;
        }, 150);
    }
}, 300);

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const target = document.querySelector(this.getAttribute('href'));
        if(target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
