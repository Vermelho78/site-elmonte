// ═══════════════════════════════════════════════════
// EL MONTE — script.js
// HUD Canvas, Glitch, Smooth Scroll & ROI Calculator
// ═══════════════════════════════════════════════════

// Set current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// ───────────────────────────────────────────────────
// HUD Canvas Animation
// ───────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────
// Glitch text effect logic
// ───────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────
// Smooth scroll for nav links
// ───────────────────────────────────────────────────
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


// ═══════════════════════════════════════════════════
// PLANETARY ROI CALCULATOR — NEWTONIAN PHYSICS
// ═══════════════════════════════════════════════════

// ── Category definitions with shapes ──
const CATEGORIES = {
    modelagem: { 
        label: 'Modelagem & MEP', 
        color: '#ff4444', 
        shape: 'circle',
        suite: 'projetista',
        suiteLabel: 'Suite Projetista',
        suitePrice: 99
    },
    desempenho: { 
        label: 'Desempenho', 
        color: '#f0c040', 
        shape: 'hexagon',
        suite: 'bim_manager',
        suiteLabel: 'Suite BIM Manager',
        suitePrice: 149
    },
    familias: { 
        label: 'Famílias', 
        color: '#44cc88', 
        shape: 'square',
        suite: 'libmaker',
        suiteLabel: 'Suite Libmaker',
        suitePrice: 129
    },
    dados: { 
        label: 'Dados & Tabelas', 
        color: '#4488ff', 
        shape: 'diamond',
        suite: 'bim_manager',
        suiteLabel: 'Suite BIM Manager',
        suitePrice: 149
    },
    documentacao: { 
        label: 'Documentação', 
        color: '#bb66ff', 
        shape: 'pentagon',
        suite: 'projetista',
        suiteLabel: 'Suite Projetista',
        suitePrice: 99
    },
    interop: { 
        label: 'Interoperabilidade', 
        color: '#ff8844', 
        shape: 'octagon',
        suite: 'bim_manager',
        suiteLabel: 'Suite BIM Manager',
        suitePrice: 149
    }
};

// ── Shape clip-paths ──
const SHAPE_CLIPS = {
    circle: '',
    hexagon: 'polygon(25% 5%, 75% 5%, 97% 50%, 75% 95%, 25% 95%, 3% 50%)',
    square: '',
    diamond: 'polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)',
    pentagon: 'polygon(50% 2%, 98% 38%, 80% 98%, 20% 98%, 2% 38%)',
    octagon: 'polygon(30% 2%, 70% 2%, 98% 30%, 98% 70%, 70% 98%, 30% 98%, 2% 70%, 2% 30%)'
};

// ── 24 Pains (4/category, short labels) ──
const ALL_PAINS = [
    { id: 1,  cat: 'modelagem', label: 'Conexões MEP', hours: 8, recovery: 85, tool: 'Auto-Routing Hub' },
    { id: 2,  cat: 'modelagem', label: 'Roteamento MEP', hours: 10, recovery: 90, tool: 'Smart Path MEP' },
    { id: 3,  cat: 'modelagem', label: 'Suportes manuais', hours: 12, recovery: 95, tool: 'Hanger Placement Engine' },
    { id: 4,  cat: 'modelagem', label: 'Alinhamento BIM', hours: 8, recovery: 75, tool: 'Coordination Align' },

    { id: 5,  cat: 'desempenho', label: 'Lentidão Revit', hours: 8, recovery: 60, tool: 'Performance Booster' },
    { id: 6,  cat: 'desempenho', label: 'Warnings', hours: 9, recovery: 85, tool: 'Warning Resolver AI' },
    { id: 7,  cat: 'desempenho', label: 'Purge ineficaz', hours: 3, recovery: 95, tool: 'Deep Purge Utility' },
    { id: 8,  cat: 'desempenho', label: 'Crashes', hours: 6, recovery: 40, tool: 'Crash Sentinel' },

    { id: 9,  cat: 'familias', label: 'Conectores MEP', hours: 9, recovery: 85, tool: 'Connector Master' },
    { id: 10, cat: 'familias', label: 'Reset parâmetros', hours: 8, recovery: 85, tool: 'Parameter Sync' },
    { id: 11, cat: 'familias', label: 'Shared Params', hours: 7, recovery: 80, tool: 'Shared Param Injector' },
    { id: 12, cat: 'familias', label: 'Import DWG/SKP', hours: 7, recovery: 75, tool: 'Clean Import Filter' },

    { id: 13, cat: 'dados', label: 'Edição em lote', hours: 8, recovery: 90, tool: 'Batch Data Editor' },
    { id: 14, cat: 'dados', label: 'Excel manual', hours: 7, recovery: 85, tool: 'Excel Bi-Directional Link' },
    { id: 15, cat: 'dados', label: 'Renumeração', hours: 6, recovery: 95, tool: 'Smart Renumber' },
    { id: 16, cat: 'dados', label: 'Find & Replace', hours: 5, recovery: 95, tool: 'Data Search Engine' },

    { id: 17, cat: 'documentacao', label: 'Cotagem manual', hours: 9, recovery: 90, tool: 'Auto-Dimension AI' },
    { id: 18, cat: 'documentacao', label: 'Tags cegas', hours: 8, recovery: 80, tool: 'Tag Placer 360' },
    { id: 19, cat: 'documentacao', label: 'Desenho 2D', hours: 7, recovery: 60, tool: 'Detailing Automator' },
    { id: 20, cat: 'documentacao', label: 'Filtros vista', hours: 6, recovery: 75, tool: 'View Filter Manager' },

    { id: 21, cat: 'interop', label: 'Export IFC', hours: 8, recovery: 75, tool: 'IFC Optimizer' },
    { id: 22, cat: 'interop', label: 'PDFs manuais', hours: 7, recovery: 95, tool: 'Batch PDF / Print' },
    { id: 23, cat: 'interop', label: 'Coordenadas', hours: 6, recovery: 60, tool: 'Coordinate Sync' },
    { id: 24, cat: 'interop', label: 'Export NWC', hours: 5, recovery: 80, tool: 'Navisworks Exporter' }
];

// ── State ──
let selectedPains = new Set();
let bubbles = [];
let animationId = null;
let lastInteractionTime = 0;

// ── DOM Elements ──
const painCloud = document.getElementById('painCloud');
const categoryLegend = document.getElementById('categoryLegend');
const generatePlanWrap = document.getElementById('generatePlanWrap');
const btnGeneratePlan = document.getElementById('btnGeneratePlan');
const selectedCountEl = document.getElementById('selectedCount');
const totalHoursPreviewEl = document.getElementById('totalHoursPreview');
const customPlanResult = document.getElementById('customPlanResult');
const customPlanBody = document.getElementById('customPlanBody');
const calculatorCta = document.getElementById('calculatorCta');
const roiPercentEl = document.getElementById('roiPercent');

// ═══════════════════════════════════════════════════
// NEWTONIAN PLANETARY SYSTEM
// ═══════════════════════════════════════════════════

function initCalculator() {
    if (!painCloud) return;
    renderLegend();
    renderBubbleCloud();
    settleInitialPositions();
    startPhysics();
    setupGenerateButton();
}

function renderLegend() {
    if (!categoryLegend) return;
    categoryLegend.innerHTML = '';
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="legend-shape shape-${cat.shape}" style="--cat-color:${cat.color}"></span><span class="legend-label">${cat.label}</span>`;
        categoryLegend.appendChild(item);
    }
}

function getBubbleRadius(hours) {
    const minR = 46, maxR = 78;
    const minH = 3, maxH = 12;
    return minR + ((hours - minH) / (maxH - minH)) * (maxR - minR);
}

function renderBubbleCloud() {
    if (!painCloud) return;
    painCloud.innerHTML = '';
    painCloud.style.position = 'relative';
    bubbles = [];

    const cloudW = painCloud.offsetWidth || 1100;
    const catKeys = Object.keys(CATEGORIES);
    const numCats = catKeys.length;
    const centerX = cloudW / 2;
    const centerY = 380;
    const orbitR = Math.min(cloudW * 0.36, 340);

    let idx = 0;
    for (const catKey of catKeys) {
        const cat = CATEGORIES[catKey];
        const catPains = ALL_PAINS.filter(p => p.cat === catKey);
        const sectorAngle = (idx / numCats) * Math.PI * 2 - Math.PI / 2;
        const sectorCX = centerX + Math.cos(sectorAngle) * orbitR;
        const sectorCY = centerY + Math.sin(sectorAngle) * orbitR;

        catPains.forEach((pain, i) => {
            const r = getBubbleRadius(pain.hours);
            const subAngle = sectorAngle + (i - 1.5) * 0.55;
            const subR = 10 + i * 35;
            const x = sectorCX + Math.cos(subAngle) * subR;
            const y = sectorCY + Math.sin(subAngle) * subR;

            const el = document.createElement('div');
            el.className = `bubble shape-${cat.shape}`;
            el.dataset.painId = pain.id;
            el.style.width = `${r * 2}px`;
            el.style.height = `${r * 2}px`;
            el.style.setProperty('--cat-color', cat.color);

            const clip = SHAPE_CLIPS[cat.shape];
            if (clip) {
                el.style.clipPath = clip;
                el.style.webkitClipPath = clip;
            }

            el.innerHTML = `
                <span class="bubble-label">${pain.label}</span>
                <span class="bubble-meta">${pain.hours}h</span>
            `;
            el.addEventListener('click', () => toggleBubble(pain.id));
            painCloud.appendChild(el);

            bubbles.push({
                id: pain.id, el, x, y,
                tx: x, ty: y,
                homeX: x, homeY: y,
                r, mass: pain.hours,
                vx: 0, vy: 0,
                cat: catKey, selected: false
            });
        });
        idx++;
    }

    // Add exactly one fixed EL MONTE shield in the center (The sun)
    const sunEl = document.createElement('div');
    sunEl.className = 'sun-logo';
    sunEl.innerHTML = `<img src="assets/selo_ai_softwares.png" alt="EL MONTE" style="width: 100%; height: auto; display: block; filter: drop-shadow(0 0 25px rgba(229, 26, 34, 0.5));" />`;
    sunEl.style.position = 'absolute';
    const sunR = 50;
    sunEl.style.width = `${sunR * 2}px`;
    sunEl.style.height = `${sunR * 2}px`;
    sunEl.style.borderRadius = '50%';
    sunEl.style.zIndex = '5';
    sunEl.style.pointerEvents = 'none'; // so it doesn't block clicks
    painCloud.appendChild(sunEl);

    bubbles.push({
        id: 'sun', el: sunEl, x: centerX, y: centerY,
        tx: centerX, ty: centerY, homeX: centerX, homeY: centerY,
        r: sunR, mass: 300, // very high mass gravity well
        vx: 0, vy: 0, cat: 'sun', selected: true, isSun: true
    });

    for (const b of bubbles) {
        b.el.style.left = `${b.x - b.r}px`;
        b.el.style.top = `${b.y - b.r}px`;
    }
    painCloud.style.height = `${centerY * 2 + 100}px`;
}

function settleInitialPositions() {
    const cloudW = painCloud.offsetWidth || 1100;
    const cloudH = painCloud.offsetHeight || 840;

    for (let iter = 0; iter < 200; iter++) {
        for (let i = 0; i < bubbles.length; i++) {
            const a = bubbles[i];
            let fx = 0, fy = 0;
            for (let j = 0; j < bubbles.length; j++) {
                if (i === j) continue;
                const b = bubbles[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                const minDist = a.r + b.r + 8;
                if (dist < minDist) {
                    const overlap = minDist - dist;
                    fx += (dx / dist) * overlap * 0.4;
                    fy += (dy / dist) * overlap * 0.4;
                }
            }
            a.x += fx; a.y += fy;
            a.x = Math.max(a.r, Math.min(cloudW - a.r, a.x));
            a.y = Math.max(a.r, Math.min(cloudH - a.r, a.y));
        }
    }

    for (const b of bubbles) {
        b.homeX = b.x; b.homeY = b.y;
        b.tx = b.x; b.ty = b.y;
        b.vx = 0; b.vy = 0;
        b.el.style.left = `${b.x - b.r}px`;
        b.el.style.top = `${b.y - b.r}px`;
    }
}

function toggleBubble(painId) {
    const bubble = bubbles.find(b => b.id === painId);
    if (!bubble || bubble.isSun) return;

    if (selectedPains.has(painId)) {
        selectedPains.delete(painId);
        bubble.selected = false;
        bubble.el.classList.remove('selected');
    } else {
        selectedPains.add(painId);
        bubble.selected = true;
        bubble.el.classList.add('selected');
    }

    lastInteractionTime = performance.now();
    recalcTargets();
    updateSelectionUI();
}

// ── Planetary target positions ──
function recalcTargets() {
    const cloudW = painCloud.offsetWidth || 1100;
    const cloudH = painCloud.offsetHeight || 840;
    const centerX = cloudW / 2;
    const centerY = 380;

    const selBubbles = bubbles.filter(b => b.selected && !b.isSun);
    const unselBubbles = bubbles.filter(b => !b.selected && !b.isSun);

    if (selBubbles.length === 0) {
        for (const b of bubbles) { 
            if (!b.isSun) { b.tx = b.homeX; b.ty = b.homeY; }
        }
        return;
    }

    // Planets: orbit the Sun
    const orbitR = Math.min(80 + selBubbles.length * 15, 240);
    selBubbles.forEach((b, i) => {
        const angle = (i / selBubbles.length) * Math.PI * 2 - Math.PI / 2;
        b.tx = centerX + Math.cos(angle) * orbitR;
        b.ty = centerY + Math.sin(angle) * orbitR;
    });

    // Unselected: push toward edges (away from center)
    const edgeR = Math.min(cloudW * 0.36, 340);
    for (const b of unselBubbles) {
        const dx = b.homeX - centerX;
        const dy = b.homeY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pushDist = Math.max(dist, edgeR * 0.85);
        b.tx = centerX + (dx / dist) * pushDist;
        b.ty = centerY + (dy / dist) * pushDist;
        b.tx = Math.max(b.r + 5, Math.min(cloudW - b.r - 5, b.tx));
        b.ty = Math.max(b.r + 5, Math.min(cloudH - b.r - 5, b.ty));
    }
}

// ── Newtonian physics (with 10-second stability envelope) ──
function startPhysics() {
    const G = 0.015;
    const MAX_SPEED = 4;
    const PUSH = 0.35;

    function tick() {
        const cloudW = painCloud.offsetWidth || 1100;
        const cloudH = painCloud.offsetHeight || 840;

        // Time-decay envelope: damping ramps from 0.96→0.55 over 10s
        const elapsed = (performance.now() - lastInteractionTime) / 1000;
        const t = Math.min(elapsed / 10, 1);
        const damping = 0.96 - t * 0.41;
        const spdCap = MAX_SPEED * Math.max(1 - t * 0.95, 0.01);

        for (let i = 0; i < bubbles.length; i++) {
            const a = bubbles[i];
            let fx = 0, fy = 0;
            const dtx = a.tx - a.x, dty = a.ty - a.y;
            const dTarget = Math.sqrt(dtx * dtx + dty * dty);

            if (a.isSun) {
                a.x = a.tx; a.y = a.ty;
                a.vx = 0; a.vy = 0;
            } else {
                // Gravitational spring (F ∝ mass × displacement)
                if (dTarget > 1) {
                    const strength = G * a.mass;
                    fx += dtx * strength;
                    fy += dty * strength;
                }

                // Mass-weighted collision
                for (let j = 0; j < bubbles.length; j++) {
                    if (i === j) continue;
                    const b = bubbles[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                    const cushion = (a.isSun || b.isSun) ? 22 : 6;
                    const minD = a.r + b.r + cushion;
                    if (dist < minD) {
                        const overlap = minD - dist;
                        const weight = b.isSun ? 1 : (b.mass / (a.mass + b.mass));
                        fx += (dx / dist) * overlap * PUSH * weight;
                        fy += (dy / dist) * overlap * PUSH * weight;
                    }
                }

                a.vx = (a.vx + fx) * damping;
                a.vy = (a.vy + fy) * damping;

                const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
                if (spd > spdCap) {
                    a.vx = (a.vx / spd) * spdCap;
                    a.vy = (a.vy / spd) * spdCap;
                }

                if (spd < 0.06 && dTarget < 2) {
                    a.vx = 0; a.vy = 0;
                    a.x = a.tx; a.y = a.ty;
                } else {
                    a.x += a.vx; a.y += a.vy;
                }

                a.x = Math.max(a.r, Math.min(cloudW - a.r, a.x));
                a.y = Math.max(a.r, Math.min(cloudH - a.r, a.y));
            }
            
            a.el.style.left = `${a.x - a.r}px`;
            a.el.style.top = `${a.y - a.r}px`;
        }

        animationId = requestAnimationFrame(tick);
    }
    tick();
}

// ── Selection UI ──
function updateSelectionUI() {
    if (!generatePlanWrap) return;
    if (selectedPains.size > 0) {
        generatePlanWrap.style.display = 'flex';
        let totalH = 0;
        for (const id of selectedPains) {
            const p = ALL_PAINS.find(pp => pp.id === id);
            if (p) totalH += p.hours;
        }
        if (selectedCountEl) selectedCountEl.textContent = selectedPains.size;
        if (totalHoursPreviewEl) totalHoursPreviewEl.textContent = totalH;
    } else {
        generatePlanWrap.style.display = 'none';
        if (customPlanResult) customPlanResult.style.display = 'none';
        if (calculatorCta) calculatorCta.style.display = 'none';
    }
}

function setupGenerateButton() {
    if (!btnGeneratePlan) return;
    btnGeneratePlan.addEventListener('click', generateCustomPlan);
}

// ── Generate Custom Plan ──
function generateCustomPlan() {
    if (selectedPains.size === 0) return;

    let totalLost = 0, totalSaved = 0;
    const catTotals = {};

    for (const painId of selectedPains) {
        const pain = ALL_PAINS.find(p => p.id === painId);
        if (!pain) continue;
        const saved = pain.hours * (pain.recovery / 100);
        totalLost += pain.hours;
        totalSaved += saved;
        if (!catTotals[pain.cat]) catTotals[pain.cat] = { lost: 0, saved: 0, pains: [] };
        catTotals[pain.cat].lost += pain.hours;
        catTotals[pain.cat].saved += saved;
        catTotals[pain.cat].pains.push(pain.label);
    }

    totalSaved = Math.round(totalSaved);
    const percent = totalLost > 0 ? Math.round((totalSaved / 160) * 100) : 0;

    let toolCardsHTML = '';
    let finalPrice = selectedPains.size * 69; // R$ 69/mês por ferramenta específica
    if (selectedPains.size >= 5) finalPrice = Math.round(finalPrice * 0.85);

    let idx = 1;
    for (const painId of selectedPains) {
        const pain = ALL_PAINS.find(p => p.id === painId);
        if (!pain) continue;
        const cat = CATEGORIES[pain.cat];
        toolCardsHTML += `
            <div class="plan-suite-card">
                <div class="plan-suite-dot shape-${cat.shape}" style="background:${cat.color}"></div>
                <div class="plan-suite-info">
                    <strong>${pain.tool}</strong>
                    <span>Substitui: ${pain.label}</span>
                </div>
                <div class="plan-suite-price">Módulo ${idx++}</div>
            </div>`;
    }

    let breakdownHTML = '';
    for (const [catKey, totals] of Object.entries(catTotals)) {
        const cat = CATEGORIES[catKey];
        breakdownHTML += `
            <div class="plan-cat-row">
                <div class="plan-cat-dot shape-${cat.shape}" style="--cat-color:${cat.color}"></div>
                <div class="plan-cat-info">
                    <strong>${cat.label}</strong>
                    <span>${totals.pains.join(' · ')}</span>
                </div>
                <div class="plan-cat-hours">
                    <span class="plan-lost">${totals.lost}h</span>
                    <span class="plan-arrow">→</span>
                    <span class="plan-saved">${totals.saved.toFixed(0)}h</span>
                </div>
            </div>`;
    }

    const discount = selectedPains.size >= 5 ? `<div class="plan-discount">🎯 Categoria Premium atingida: <strong>15% OFF aplicado</strong></div>` : '';
    const costPerHour = totalSaved > 0 ? (finalPrice / totalSaved).toFixed(2) : '—';

    if (customPlanBody) {
        customPlanBody.innerHTML = `
            <div class="plan-section">
                <h4>DIAGNÓSTICO</h4>
                <div class="plan-breakdown">${breakdownHTML}</div>
            </div>
            <div class="plan-section">
                <h4>SUA SUÍTE EXCLUSIVA (MÓDULOS)</h4>
                <div class="plan-suites-list">${toolCardsHTML}</div>
                ${discount}
            </div>
            <div class="plan-totals">
                <div class="plan-total-big">
                    <span>Perdido:</span><strong>${totalLost}h/mês</strong>
                </div>
                <div class="plan-total-big highlight">
                    <span>Recuperável:</span><strong>${totalSaved}h/mês</strong>
                </div>
                <div class="plan-total-big">
                    <span>Investimento:</span><strong>R$ ${finalPrice}/mês</strong>
                </div>
                <div class="plan-total-small">
                    <span>Custo/hora recuperada:</span><strong>R$ ${costPerHour}</strong>
                </div>
                <div class="plan-total-small">
                    <span>Economia anual:</span><strong>${totalSaved * 12}h</strong>
                </div>
            </div>`;
    }

    if (customPlanResult) customPlanResult.style.display = 'block';
    if (calculatorCta) calculatorCta.style.display = 'block';
    if (roiPercentEl) roiPercentEl.textContent = percent + '%';
    customPlanResult?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Resize ──
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        renderBubbleCloud();
        settleInitialPositions();
        for (const painId of selectedPains) {
            const b = bubbles.find(bb => bb.id === painId);
            if (b && !b.isSun) { b.selected = true; b.el.classList.add('selected'); }
        }
        lastInteractionTime = performance.now();
        recalcTargets();
    }, 300);
});

// ── Boot ──
document.addEventListener('DOMContentLoaded', initCalculator);

