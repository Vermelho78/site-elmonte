// ============================================================
// GAMIFICAÇÃO — JORNADA DO REMADOR
// Vaa Vermelho Dashboard — gamification.js
// ============================================================

// ---- CONSTANTES DE DADOS DE JOGO ----

const LEVELS = [
    { level: 1, title: 'Aprendiz das Águas',  xpRequired: 0    },
    { level: 2, title: 'Remador Iniciado',     xpRequired: 500  },
    { level: 3, title: 'Guardião das Ondas',   xpRequired: 1500 },
    { level: 4, title: 'Guerreiro Náutico',    xpRequired: 3500 },
    { level: 5, title: 'Mestre do Remo',       xpRequired: 7000 },
    { level: 6, title: 'Lenda das Águas',      xpRequired: 12000},
];

let ISLANDS = [];
let ACHIEVEMENTS = [];

function rebuildDynamicGameMetadata() {
    const ap = (typeof athleteProfile !== 'undefined' && athleteProfile) ? athleteProfile : null;
    const goal = ap && ap.goal ? ap.goal : null;
    const goalTarget = (goal && goal.target) || 30; // weekly target in km

    ACHIEVEMENTS = [
        { id: 'first_workout', icon: '🌊', name: 'Primeira Remada',  desc: 'Importe seu primeiro treino.',      check: (s) => s.totalWorkouts >= 1 },
        { id: 'centuria',      icon: '💯', name: 'Centurião',        desc: '100 km acumulados.',                check: (s) => s.totalDistance >= 100 },
        { id: 'break10',       icon: '🚀', name: 'Barreira dos 10',  desc: 'Vel. média ≥ 10 km/h em treino.',  check: (s) => s.bestSingleSpeed >= 10 },
        { id: 'ocean_master',  icon: '🗺️', name: 'Mestre do Oceano', desc: '500 km acumulados.',               check: (s) => s.totalDistance >= 500 },
        { id: 'perfect_week',  icon: '📅', name: 'Semana Perfeita',  desc: '4 treinos em uma semana.',         check: (s) => s.bestWeek >= 4 },
        { id: 'drill_master',  icon: '🎯', name: 'Mestre Técnico',   desc: 'Proficiência técnica ≥ 85%.',      check: (s) => s.bestDrill >= 85 },
        { id: 'veteran',       icon: '⚓', name: 'Veterano',         desc: 'Remando desde 2022.',              check: (s) => s.yearStarted <= 2022 },
        { id: 'podium',        icon: '🏆', name: 'Pódio',            desc: 'Top 5 em competição.',             check: (s) => s.hasTop5 },
    ];

    // Filter workouts to the current week (Monday to Sunday)
    const now = new Date();
    const currentWeekRange = typeof getWeekRange === 'function' ? getWeekRange(now) : { monday: new Date(), sunday: new Date() };
    
    const ws = (typeof workouts !== 'undefined' ? workouts : []);
    const currentWeekWorkouts = ws.filter(w => {
        const d = new Date(w.date + "T12:00:00");
        return d >= currentWeekRange.monday && d <= currentWeekRange.sunday;
    });
    const sortedWs = [...currentWeekWorkouts].sort((a, b) => new Date(a.date) - new Date(b.date));

    const workoutIslands = [];

    // Start Island
    workoutIslands.push({
        id: 'start',
        name: '🏝️ Início',
        desc: 'Ponto de partida da sua jornada semanal.',
        req: 'Sempre',
        color: '#06d6a0',
        x: 0.08, y: 0.50,
        size: 42,
        unlocked: () => true,
        isWorkout: false,
    });

    const currentWeekDistance = sortedWs.reduce((sum, w) => sum + (w.distance || 0), 0);
    const remaining = Math.max(2.0, goalTarget - currentWeekDistance); // min 2.0 km segment to show goal island
    const totalJourneyKm = currentWeekDistance + remaining;

    let accumulatedDistance = 0;
    sortedWs.forEach((w, idx) => {
        accumulatedDistance += w.distance || 0;
        const fraction = totalJourneyKm > 0 ? accumulatedDistance / totalJourneyKm : 0;
        const x = 0.08 + fraction * 0.82;
        const y = 0.50 + Math.sin(fraction * Math.PI * 2.5) * 0.18;
        
        const [yr, mo, dy] = w.date.split('-');
        workoutIslands.push({
            id: `workout_${w.id}`,
            name: `🚣 ${dy}/${mo}/${yr}`,
            desc: `${(w.distance || 0).toFixed(1)} km — ${w.boat || 'Canoa'}`,
            req: 'Treino registrado',
            color: '#00b4d8',
            x: Math.max(0.08, Math.min(0.90, x)),
            y: Math.max(0.15, Math.min(0.85, y)),
            size: 36,
            unlocked: () => true,
            isWorkout: true,
            workoutData: w,
        });
    });

    // Add Goal Island (🏁 Meta)
    const goalEmoji = '🏁';
    const goalLabel = `${goalTarget} km`;
    const fractionGoal = 1.0;
    const gx = 0.90;
    const gy = 0.50 + Math.sin(fractionGoal * Math.PI * 2.5) * 0.18;

    workoutIslands.push({
        id: 'goal',
        name: `${goalEmoji} Meta: ${goalLabel}`,
        desc: `Objetivo final da semana: alcançar ${goalTarget} km.`,
        req: `Distância total semanal ≥ ${goalTarget} km`,
        color: '#ffd700',
        x: gx, y: gy,
        size: 58,
        isGoal: true,
        unlocked: (stats) => currentWeekDistance >= goalTarget,
    });

    ISLANDS = workoutIslands;
}

function getAvatarMood(stats) {
    const lastWorkout = stats.daysSinceLast;
    const trend = stats.globalAvgSpeed > 9.5 ? 'high' : 'low';
    if (lastWorkout > 14) return 'sad'; // Inativo
    if (lastWorkout <= 2 && trend === 'high') return 'excited'; // Ativo e rápido
    return 'happy'; // Base
}

const ITEMS = [
    // Remos
    { id: 'paddle_wood',   slot: 'paddle',    icon: '🛶', name: 'Remo de Madeira', bonus: '',             unlocked: () => true },
    { id: 'paddle_crespo', slot: 'paddle',    icon: '🚣', name: 'Remo Crespo C118', bonus: '+5% vel.',   unlocked: (s) => s.globalAvgSpeed >= 9.5 },
    { id: 'paddle_legend', slot: 'paddle',    icon: '⚡', name: 'Remo Lendário',   bonus: '+10% vel.',   unlocked: (s) => s.level >= 5 },
    // Roupas
    { id: 'outfit_basic',  slot: 'outfit',    icon: '👕', name: 'Camiseta Comum',  bonus: '',             unlocked: () => true },
    { id: 'outfit_race',   slot: 'outfit',    icon: '🔴', name: 'Traje Vermelho',  bonus: '+5% técnica',  unlocked: (s) => s.totalDistance >= 50 },
    { id: 'outfit_epic',   slot: 'outfit',    icon: '🥷', name: 'Traje Épico',     bonus: '+8% técnica',  unlocked: (s) => s.level >= 4 },
    // Coletes
    { id: 'vest_none',     slot: 'vest',      icon: '〰️', name: 'Sem Colete',      bonus: '',             unlocked: () => true },
    { id: 'vest_safety',   slot: 'vest',      icon: '🦺', name: 'Colete Seguro',   bonus: '+5% consist.', unlocked: (s) => s.activeWeeks >= 3 },
    // Acessórios
    { id: 'acc_none',      slot: 'accessory', icon: '〰️', name: 'Sem Acessório',   bonus: '',             unlocked: () => true },
    { id: 'acc_sunglasses',slot: 'accessory', icon: '🕶️', name: 'Óculos de Sol',   bonus: '+3% vel.',     unlocked: (s) => s.islandsUnlocked.includes('speed') },
    { id: 'acc_bandana',   slot: 'accessory', icon: '🏅', name: 'Bandana Campeão', bonus: '+5% técnica +3% vel.', unlocked: (s) => s.islandsUnlocked.includes('champion') },
];

// As conquistas reais são geradas dinamicamente com base na meta selecionada

// Slots padrão
const DEFAULT_EQUIP = {
    paddle: 'paddle_wood',
    outfit: 'outfit_basic',
    vest: 'vest_none',
    accessory: 'acc_none',
};

// ---- ESTADO DO MÓDULO ----
let gStats = {};
let gEquipped = { ...DEFAULT_EQUIP };
let gAchieved = {};
let gCompetitions = [];
let mapAnimFrame = null;
let avatarAnimFrame = null;
let waveOffset = 0;
let avatarFrame = 0;
let mapParticles = [];
let compassAngle = 0;

// ---- PONTO DE ENTRADA ----
function initGamification() {
    rebuildDynamicGameMetadata();
    // Carrega estado salvo
    const savedEquip = localStorage.getItem('vaa_equip');
    if (savedEquip) gEquipped = { ...DEFAULT_EQUIP, ...JSON.parse(savedEquip) };
    const savedAchieved = localStorage.getItem('vaa_achieved');
    if (savedAchieved) gAchieved = JSON.parse(savedAchieved);
    const savedComps = localStorage.getItem('vaa_competitions');
    if (savedComps) gCompetitions = JSON.parse(savedComps);

    // Calcula stats
    gStats = computeGameStats();

    // Renderiza tudo
    renderXPHeader();
    renderAvatarCard();
    renderNauticalMap();
    renderInventory();
    renderAchievements();
    renderCompetitions();

    // Inicia loop de animação do mapa e avatar
    startMapAnimation();
    startAvatarAnimation();

    // Verifica conquistas novas
    checkAndNotifyAchievements();

    // Event listeners internos
    setupGameEventListeners();
}

// ---- CÁLCULO DE STATS DE JOGO ----
function computeGameStats() {
    rebuildDynamicGameMetadata();
    const ws = typeof workouts !== 'undefined' ? workouts : [];
    const evs = typeof evaluations !== 'undefined' ? evaluations : {};
    const comps = gCompetitions;

    let totalDist = 0, speedSum = 0, bestSpeed = 0, bestSingleSpeed = 0;
    ws.forEach(w => {
        totalDist += w.distance || 0;
        speedSum += w.avgSpeed || 0;
        if ((w.avgSpeed || 0) > bestSpeed) bestSpeed = w.avgSpeed;
        if ((w.maxSpeed || 0) > bestSingleSpeed) bestSingleSpeed = w.maxSpeed;
    });
    const globalAvgSpeed = ws.length > 0 ? speedSum / ws.length : 0;

    // Drill score médio
    let drillSum = 0, drillCount = 0, bestDrill = 0;
    Object.values(evs).forEach(ev => {
        const score = ((ev.phase1 || 0) + (ev.phase2 || 0) + (ev.phase3 || 0) + (ev.phase4 || 0)) / 4;
        drillSum += score;
        drillCount++;
        if (score > bestDrill) bestDrill = score;
    });
    const avgDrill = drillCount > 0 ? drillSum / drillCount : 0;

    // Semanas ativas (últimas 12 semanas)
    const now = new Date();
    const weekMap = {};
    ws.forEach(w => {
        const d = new Date(w.date);
        const weekKey = Math.floor((now - d) / (7 * 24 * 3600 * 1000));
        if (weekKey >= 0 && weekKey < 12) {
            weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
        }
    });
    const activeWeeks = Object.keys(weekMap).length;
    const bestWeek = Math.max(0, ...Object.values(weekMap));

    // XP
    const xp = calculateXP(ws, evs);
    const lvlData = getPlayerLevel(xp);

    // Ilhas desbloqueadas
    const hasTop5 = comps.some(c => c.place <= 5);
    const tempStats = {
        globalAvgSpeed, avgDrill, totalDistance: totalDist,
        activeWeeks, level: lvlData.level, islandsUnlocked: [], hasTop5,
    };
    const islandsUnlocked = ISLANDS.filter(isl => isl.unlocked(tempStats)).map(i => i.id);

    // Ano inicial (data mais antiga dos treinos)
    let yearStarted = new Date().getFullYear();
    if (ws.length > 0) {
        const oldest = ws.reduce((a, b) => new Date(a.date) < new Date(b.date) ? a : b);
        yearStarted = new Date(oldest.date).getFullYear();
    }

    // Treino mais recente
    const sortedWs = [...ws].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastWorkoutDate = sortedWs.length > 0 ? new Date(sortedWs[0].date) : null;
    const daysSinceLast = lastWorkoutDate
        ? Math.floor((now - lastWorkoutDate) / (24 * 3600 * 1000))
        : 999;

    return {
        totalWorkouts: ws.length,
        totalDistance: totalDist,
        globalAvgSpeed,
        bestSingleSpeed,
        avgDrill,
        bestDrill,
        activeWeeks,
        bestWeek,
        xp,
        level: lvlData.level,
        title: lvlData.title,
        xpForLevel: lvlData.xpForLevel,
        xpNextLevel: lvlData.xpNextLevel,
        islandsUnlocked,
        hasTop5,
        yearStarted,
        daysSinceLast,
        // c1: A "ilha atual" é o último treino na rota, ou 'start' se sem treinos
        currentIsland: (() => {
            // Busca a última ilha de treino na ordem do mapa
            const workoutIslands = ISLANDS.filter(i => i.isWorkout);
            if (workoutIslands.length > 0) {
                // A ilha mais à direita (maior x) é o treino mais recente
                return workoutIslands[workoutIslands.length - 1].id;
            }
            return islandsUnlocked.length > 0 ? islandsUnlocked[islandsUnlocked.length - 1] : 'start';
        })(),
    };
}

function calculateXP(ws, evs) {
    let xp = 0;
    ws.forEach(w => {
        xp += (w.distance || 0) * 10;
        if ((w.avgSpeed || 0) >= 10) xp += 20;
    });
    Object.values(evs).forEach(ev => {
        const score = ((ev.phase1||0)+(ev.phase2||0)+(ev.phase3||0)+(ev.phase4||0))/4;
        if (score > 50) xp += (score - 50) * 5;
    });
    // XP de conquistas
    const prevAchieved = gAchieved || {};
    ACHIEVEMENTS.forEach(a => {
        if (prevAchieved[a.id]) xp += 50;
    });
    // XP de competições
    gCompetitions.forEach(c => {
        xp += 100;
        if (c.place <= 5) xp += 150;
        if (c.place === 1) xp += 200;
    });
    return Math.round(xp);
}

function getPlayerLevel(xp) {
    let currentLevel = LEVELS[0];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i].xpRequired) {
            currentLevel = LEVELS[i];
            break;
        }
    }
    const nextLevel = LEVELS.find(l => l.xpRequired > xp);
    const xpForLevel = currentLevel.xpRequired;
    const xpNextLevel = nextLevel ? nextLevel.xpRequired : currentLevel.xpRequired;
    return { ...currentLevel, xpForLevel, xpNextLevel };
}

function getAvatarMood(stats) {
    if (stats.totalWorkouts === 0) return { state: 'neutro', emoji: '😐', speech: 'Importe um treino e comece sua jornada!' };

    const ws = (typeof workouts !== 'undefined' ? workouts : []);
    const sorted = [...ws].sort((a, b) => new Date(b.date) - new Date(a.date));

    const last = sorted[0];
    const prev = sorted[1];
    const last3 = sorted.slice(0, 3);
    const last3Avg = last3.length > 0 ? last3.reduce((acc, w) => acc + (w.avgSpeed || 0), 0) / last3.length : 0;

    const ap = (typeof athleteProfile !== 'undefined' && athleteProfile) ? athleteProfile : null;
    const goal = ap && ap.goal ? ap.goal : null;
    const goalType = (goal && goal.type) || 'speed';
    const goalTarget = (goal && goal.target) || 11.0;

    const trainedToday = stats.daysSinceLast === 0;
    const trainedRecently = stats.daysSinceLast <= 2;

    // c2: Relação último vs. penúltimo
    const vsLastTrend = prev ? (last.avgSpeed - prev.avgSpeed) : 0;
    const improvingVsLast = vsLastTrend > 0.2;
    const decliningVsLast = vsLastTrend < -0.2;

    // c2: Relação último vs. média dos 3 últimos
    const vsAvg3 = last ? (last.avgSpeed - last3Avg) : 0;
    const aboveAvg3 = vsAvg3 > 0.15;

    // c2: Relação global vs. meta
    const currentGlobalMetric = goalType === 'speed' ? stats.globalAvgSpeed : stats.totalDistance;
    const pctToGoal = goalTarget > 0 ? (currentGlobalMetric / goalTarget) * 100 : 0;
    const nearGoal = pctToGoal >= 90;
    const atGoal = pctToGoal >= 100;

    // --- Avaliação de estado ---
    if (atGoal) {
        return { state: 'epico', emoji: '🏆', speech: 'META ALCANÇADA! Você chegou onde poucos chegam. Lenda!' };
    }
    if (nearGoal && trainedRecently) {
        return { state: 'epico', emoji: '🔥', speech: `${Math.round(pctToGoal)}% da meta — A chegada está próxima!` };
    }
    if (improvingVsLast && aboveAvg3 && trainedToday) {
        return { state: 'epico', emoji: '🚀', speech: `Sessão incrível! +${vsLastTrend.toFixed(1)} km/h vs. último treino.` };
    }
    if (improvingVsLast && trainedRecently) {
        return { state: 'determinado', emoji: '💪', speech: `Melhorando! +${vsLastTrend.toFixed(1)} km/h vs. sessão anterior.` };
    }
    if (decliningVsLast && trainedRecently) {
        return { state: 'entediado', emoji: '😔', speech: `Queda de ${Math.abs(vsLastTrend).toFixed(1)} km/h. Foco na técnica na próxima!` };
    }
    if (stats.daysSinceLast >= 7) {
        return { state: 'desanimado', emoji: '😢', speech: 'Saudade do mar... faz 7 dias sem remar.' };
    }
    if (stats.daysSinceLast >= 3) {
        return { state: 'entediado', emoji: '😔', speech: 'Já 3 dias sem tocar a água... o oceano chama.' };
    }
    if (aboveAvg3 && trainedRecently) {
        return { state: 'energizado', emoji: '😊', speech: `Acima da sua média recente! ${vsAvg3 > 0 ? '+' : ''}${vsAvg3.toFixed(1)} km/h.` };
    }
    if (trainedToday && stats.activeWeeks >= 3) {
        return { state: 'determinado', emoji: '💪', speech: 'Hoje é dia de guerra! Consistência é tudo.' };
    }
    if (trainedRecently) {
        return { state: 'energizado', emoji: '😊', speech: 'Corpo em movimento, mente em paz. Bora remar!' };
    }
    return { state: 'neutro', emoji: '😐', speech: 'Pronto para a próxima sessão. O mar espera.' };
}

// ---- RENDERIZAÇÃO: HEADER XP ----
function renderXPHeader() {
    const s = gStats;
    document.getElementById('g-level-num').textContent = s.level;
    document.getElementById('g-level-title').textContent = s.title;
    document.getElementById('g-player-title').textContent = s.title;

    const xpInLevel = s.xp - s.xpForLevel;
    const xpNeeded = s.xpNextLevel - s.xpForLevel;
    const pct = s.xpNextLevel > s.xpForLevel ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100;

    document.getElementById('g-xp-current').textContent = `${s.xp} XP`;
    document.getElementById('g-xp-next').textContent = s.xpNextLevel > s.xp ? `/ ${s.xpNextLevel} XP` : '(Nível máximo!)';
    setTimeout(() => {
        document.getElementById('g-xp-bar').style.width = pct + '%';
    }, 200);
}

// ---- RENDERIZAÇÃO: CARD DO AVATAR ----
function renderAvatarCard() {
    const s = gStats;
    const mood = getAvatarMood(s);

    // Mood indicator
    document.getElementById('avatar-mood-emoji').textContent = mood.emoji;

    // Speech
    const speechEl = document.getElementById('avatar-speech');
    speechEl.innerHTML = `<span>${mood.speech}</span>`;

    // Island name
    const currentIsl = ISLANDS.find(i => i.id === s.currentIsland) || ISLANDS[0];
    document.getElementById('avatar-island-name').textContent = currentIsl.name;
    // Stats
    document.getElementById('g-stat-speed').textContent = s.globalAvgSpeed.toFixed(1) + ' km/h';
    document.getElementById('g-stat-drill').textContent = Math.round(s.avgDrill) + '%';
    document.getElementById('g-stat-km').textContent = s.totalDistance.toFixed(1) + ' km';
    document.getElementById('g-stat-xp').textContent = s.xp;

    // Draw pixel avatar
    drawPixelAvatar(mood.state);
}

// ---- PIXEL ART AVATAR ----
function drawPixelAvatar(mood) {
    const canvas = document.getElementById('avatar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;   // 256
    const H = canvas.height;  // 384

    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Get time/animation frame
    const t = Date.now() / 1000;
    avatarFrame++;

    // Breathing offset for idle animation
    const breath = Math.sin(t * 3.5) * 2.5;

    // Equipped gear
    const equipped = gEquipped;
    const paddleType = equipped.paddle;

    // Mood specific skin/eye settings
    let skinColor = '#f5c6b3'; // Manga style light peach skin
    let shadowSkinColor = '#e39f84';
    let hairColorMain = '#1e1a24';
    let hairColorHighlight = '#3f394d';

    if (mood === 'desanimado') {
        skinColor = '#dab8ab'; // grayish skin
        shadowSkinColor = '#b39487';
    }

    // Aura/Background glow based on mood
    if (mood === 'epico') {
        const glowGrad = ctx.createRadialGradient(W/2, H/2 - 20, 20, W/2, H/2 - 20, 140);
        glowGrad.addColorStop(0, 'rgba(255, 110, 0, 0.45)');
        glowGrad.addColorStop(0.5, 'rgba(255, 215, 0, 0.22)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(W/2, H/2 - 20, 140, 0, Math.PI * 2);
        ctx.fill();
    } else if (mood === 'determinado') {
        const glowGrad = ctx.createRadialGradient(W/2, H/2 - 20, 20, W/2, H/2 - 20, 140);
        glowGrad.addColorStop(0, 'rgba(0, 180, 216, 0.35)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(W/2, H/2 - 20, 140, 0, Math.PI * 2);
        ctx.fill();
    } else if (mood === 'energizado') {
        const glowGrad = ctx.createRadialGradient(W/2, H/2 - 20, 20, W/2, H/2 - 20, 140);
        glowGrad.addColorStop(0, 'rgba(6, 214, 160, 0.28)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(W/2, H/2 - 20, 140, 0, Math.PI * 2);
        ctx.fill();
    }

    // DRAW MANGA ACTION SPEED LINES (behind character)
    if (mood === 'epico' || mood === 'determinado' || mood === 'energizado') {
        ctx.strokeStyle = mood === 'epico' ? 'rgba(255, 90, 0, 0.15)' : 
                          mood === 'determinado' ? 'rgba(0, 180, 216, 0.12)' : 'rgba(6, 214, 160, 0.12)';
        ctx.lineWidth = 1.2;
        const numLines = 36;
        const centerX = W / 2;
        const centerY = H / 2 - 30;
        ctx.save();
        for (let i = 0; i < numLines; i++) {
            const angle = (i * Math.PI * 2) / numLines + (t * 0.12);
            const jitter = Math.sin(t * 15 + i) * 6;
            const startDist = 75 + jitter;
            const endDist = 200;
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle) * startDist, centerY + Math.sin(angle) * startDist);
            ctx.lineTo(centerX + Math.cos(angle) * endDist, centerY + Math.sin(angle) * endDist);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Aura fire particles (behind avatar)
    if (mood === 'epico') {
        ctx.fillStyle = 'rgba(255, 90, 0, 0.55)';
        for (let i = 0; i < 12; i++) {
            const pX = (W/2 - 70) + ((i * 27 + t * 65) % 140);
            const pY = H - 35 - ((t * 110 + i * 35) % 240);
            const pSize = 4 + Math.sin(t * 6 + i) * 3;
            ctx.beginPath();
            ctx.arc(pX, pY, pSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- DRAW AVATAR BODY ---
    const bodyY = 177 + breath;
    const headX = 128;
    const headY = bodyY - 55;

    // A. Hair Layer 1: Back Spiky Hair (drawn behind head base)
    if (mood === 'epico') {
        hairColorMain = '#ff4500';
        hairColorHighlight = '#ffd700';
    } else if (mood === 'energizado') {
        hairColorMain = '#055030';
        hairColorHighlight = '#06d6a0';
    } else {
        hairColorMain = '#1e1a24';
        hairColorHighlight = '#3f394d';
    }

    let hairGrad = ctx.createLinearGradient(128, headY - 95, 128, headY + 30);
    hairGrad.addColorStop(0, hairColorHighlight);
    hairGrad.addColorStop(1, hairColorMain);
    
    ctx.fillStyle = hairGrad;
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(128 - 30, headY - 5); // left temple
    // Left side spikes
    ctx.lineTo(128 - 52, headY - 18);
    ctx.lineTo(128 - 42, headY - 25);
    ctx.lineTo(128 - 62, headY - 42);
    ctx.lineTo(128 - 46, headY - 48);
    // Top-left spikes
    ctx.lineTo(128 - 55, headY - 72);
    ctx.lineTo(128 - 32, headY - 66);
    ctx.lineTo(128 - 24, headY - 92);
    // Center spikes
    ctx.lineTo(128 - 8, headY - 77);
    ctx.lineTo(128, headY - 100); // taller center spike
    ctx.lineTo(128 + 8, headY - 77);
    ctx.lineTo(128 + 24, headY - 92);
    // Top-right spikes
    ctx.lineTo(128 + 32, headY - 66);
    ctx.lineTo(128 + 55, headY - 72);
    // Right side spikes
    ctx.lineTo(128 + 46, headY - 48);
    ctx.lineTo(128 + 62, headY - 42);
    ctx.lineTo(128 + 42, headY - 25);
    ctx.lineTo(128 + 52, headY - 18);
    ctx.lineTo(128 + 30, headY - 5); // right temple
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner line art to back spikes
    ctx.strokeStyle = 'rgba(14, 11, 18, 0.4)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(128 - 32, headY - 66);
    ctx.quadraticCurveTo(128 - 25, headY - 35, 128 - 20, headY - 15);
    ctx.moveTo(128 + 32, headY - 66);
    ctx.quadraticCurveTo(128 + 25, headY - 35, 128 + 20, headY - 15);
    ctx.stroke();

    // B. Neck & Collarbones (Drawn behind the chin)
    // Shadow under chin
    ctx.fillStyle = shadowSkinColor;
    ctx.beginPath();
    ctx.moveTo(128 - 15, headY + 20);
    ctx.lineTo(128 + 15, headY + 20);
    ctx.lineTo(128 + 17, bodyY + 22);
    ctx.lineTo(128 - 17, bodyY + 22);
    ctx.closePath();
    ctx.fill();

    // Manga diagonal ink lines (hachuras) on neck shadow
    ctx.strokeStyle = 'rgba(14, 11, 18, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const offset = -10 + i * 4;
        ctx.moveTo(128 + offset, headY + 24);
        ctx.lineTo(128 + offset - 3, headY + 32);
    }
    ctx.stroke();

    // Neck skin
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.moveTo(128 - 14, headY + 29);
    ctx.lineTo(128 + 14, headY + 29);
    ctx.lineTo(128 + 15, bodyY + 22);
    ctx.lineTo(128 - 15, bodyY + 22);
    ctx.closePath();
    ctx.fill();

    // Neck line-art border
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128 - 15, headY + 28);
    ctx.lineTo(128 - 15, bodyY + 22);
    ctx.moveTo(128 + 15, headY + 28);
    ctx.lineTo(128 + 15, bodyY + 22);
    ctx.stroke();

    // Shoulders & Collarbones (bare skin)
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.moveTo(128 - 15, bodyY + 22); // neck base left
    ctx.lineTo(128 - 60, bodyY + 32); // left shoulder
    ctx.lineTo(128 - 56, bodyY + 65); // left underarm
    ctx.lineTo(128 + 56, bodyY + 65); // right underarm
    ctx.lineTo(128 + 60, bodyY + 32); // right shoulder
    ctx.lineTo(128 + 15, bodyY + 22); // neck base right
    ctx.closePath();
    ctx.fill();

    // Collarbones
    ctx.strokeStyle = shadowSkinColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(128 - 15, bodyY + 28);
    ctx.quadraticCurveTo(128 - 32, bodyY + 32, 128 - 50, bodyY + 30);
    ctx.moveTo(128 + 15, bodyY + 28);
    ctx.quadraticCurveTo(128 + 32, bodyY + 32, 128 + 50, bodyY + 30);
    ctx.stroke();

    // C. Head Face base (tapered manga jaw shape)
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(128 - 32, headY - 20);
    ctx.lineTo(128 - 30, headY + 5);
    ctx.quadraticCurveTo(128 - 28, headY + 26, 128, headY + 39); // chin point
    ctx.quadraticCurveTo(128 + 28, headY + 26, 128 + 30, headY + 5);
    ctx.lineTo(128 + 32, headY - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(128 - 31, headY + 2, 7, 12, Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(128 + 31, headY + 2, 7, 12, -Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ears inner manga ink folds
    ctx.strokeStyle = shadowSkinColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128 - 32, headY - 2);
    ctx.quadraticCurveTo(128 - 35, headY + 2, 128 - 29, headY + 6);
    ctx.moveTo(128 + 32, headY - 2);
    ctx.quadraticCurveTo(128 + 35, headY + 2, 128 + 29, headY + 6);
    ctx.stroke();

    // D. Face Features (Large Expressive Manga Eyes, Nose, Mouth)
    const eyeLX = 111;
    const eyeRX = 145;

    // Eyebrows
    ctx.strokeStyle = '#1d1a24';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    if (mood === 'determinado' || mood === 'epico') {
        // Angled down (intense look)
        ctx.moveTo(eyeLX - 14, headY - 15);
        ctx.lineTo(eyeLX + 8, headY - 7);
        ctx.moveTo(eyeRX + 14, headY - 15);
        ctx.lineTo(eyeRX - 8, headY - 7);
    } else if (mood === 'desanimado') {
        // Angled up (worried look)
        ctx.moveTo(eyeLX - 11, headY - 6);
        ctx.lineTo(eyeLX + 7, headY - 16);
        ctx.moveTo(eyeRX + 11, headY - 6);
        ctx.lineTo(eyeRX - 7, headY - 16);
    } else {
        // Normal curved
        ctx.moveTo(eyeLX - 12, headY - 12);
        ctx.quadraticCurveTo(eyeLX - 3, headY - 16, eyeLX + 8, headY - 11);
        ctx.moveTo(eyeRX + 12, headY - 12);
        ctx.quadraticCurveTo(eyeRX + 3, headY - 16, eyeRX - 8, headY - 11);
    }
    ctx.stroke();

    // Eyelid crease (thin line above eyes)
    ctx.strokeStyle = 'rgba(14, 11, 18, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(eyeLX - 10, headY - 7);
    ctx.quadraticCurveTo(eyeLX, headY - 10, eyeLX + 6, headY - 6);
    ctx.moveTo(eyeRX - 6, headY - 6);
    ctx.quadraticCurveTo(eyeRX, headY - 10, eyeRX + 10, headY - 7);
    ctx.stroke();

    if (mood !== 'entediado') {
        // Thick eyelashes
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        // Left eyelash
        ctx.moveTo(eyeLX - 14, headY - 2);
        ctx.quadraticCurveTo(eyeLX - 1, headY - 11, eyeLX + 10, headY - 1);
        // Right eyelash
        ctx.moveTo(eyeRX - 10, headY - 1);
        ctx.quadraticCurveTo(eyeRX + 1, headY - 11, eyeRX + 14, headY - 2);
        ctx.stroke();

        // Outer flick lashes
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(eyeLX - 13, headY - 3);
        ctx.lineTo(eyeLX - 18, headY - 7);
        ctx.moveTo(eyeRX + 13, headY - 3);
        ctx.lineTo(eyeRX + 18, headY - 7);
        ctx.stroke();

        // Lower lash line
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(eyeLX - 8, headY + 8);
        ctx.quadraticCurveTo(eyeLX, headY + 11, eyeLX + 8, headY + 7);
        ctx.moveTo(eyeRX - 8, headY + 7);
        ctx.quadraticCurveTo(eyeRX, headY + 11, eyeRX + 8, headY + 8);
        ctx.stroke();

        // Irises
        let irisColor = '#00b4d8'; // deep cyan
        let irisColor2 = '#0077b6';
        let irisColorMid = '#0096c7';
        if (mood === 'epico') {
            irisColor = '#ff3333';
            irisColorMid = '#ff6b6b';
            irisColor2 = '#800000';
        } else if (mood === 'desanimado') {
            irisColor = '#708090';
            irisColorMid = '#64748b';
            irisColor2 = '#334155';
        } else if (mood === 'energizado') {
            irisColor = '#06d6a0';
            irisColorMid = '#38b000';
            irisColor2 = '#055c46';
        }

        // Draw Left Iris
        let leftIrisGrad = ctx.createLinearGradient(0, headY - 6, 0, headY + 9);
        leftIrisGrad.addColorStop(0, irisColor2);
        leftIrisGrad.addColorStop(0.5, irisColorMid);
        leftIrisGrad.addColorStop(1, irisColor);
        ctx.fillStyle = leftIrisGrad;
        ctx.beginPath();
        ctx.ellipse(eyeLX, headY + 1, 8.5, 10.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw Right Iris
        let rightIrisGrad = ctx.createLinearGradient(0, headY - 6, 0, headY + 9);
        rightIrisGrad.addColorStop(0, irisColor2);
        rightIrisGrad.addColorStop(0.5, irisColorMid);
        rightIrisGrad.addColorStop(1, irisColor);
        ctx.fillStyle = rightIrisGrad;
        ctx.beginPath();
        ctx.ellipse(eyeRX, headY + 1, 8.5, 10.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Secondary inner crescent light
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.ellipse(eyeLX + 1.5, headY + 4, 4.5, 4.5, 0, 0.2, Math.PI - 0.2);
        ctx.ellipse(eyeRX + 1.5, headY + 4, 4.5, 4.5, 0, 0.2, Math.PI - 0.2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#0a0a0f';
        ctx.beginPath();
        ctx.arc(eyeLX, headY + 1, 3.5, 0, Math.PI * 2);
        ctx.arc(eyeRX, headY + 1, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Shiny specular highlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeLX - 3.5, headY - 3, 3, 0, Math.PI * 2); // main left
        ctx.arc(eyeLX + 3.5, headY + 4, 1.5, 0, Math.PI * 2); // sub left
        ctx.arc(eyeRX - 3.5, headY - 3, 3, 0, Math.PI * 2); // main right
        ctx.arc(eyeRX + 3.5, headY + 4, 1.5, 0, Math.PI * 2); // sub right
        ctx.fill();

        // Epico flame sparks in eyes
        if (mood === 'epico') {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(eyeLX - 1, headY + 5, 1.2, 0, Math.PI * 2);
            ctx.arc(eyeRX - 1, headY + 5, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        // Entediado closed curved eyes
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(eyeLX, headY + 2, 8, Math.PI + 0.3, Math.PI * 2 - 0.3);
        ctx.arc(eyeRX, headY + 2, 8, Math.PI + 0.3, Math.PI * 2 - 0.3);
        ctx.stroke();
    }

    // Blush lines/wash
    ctx.fillStyle = 'rgba(255, 100, 120, 0.22)';
    ctx.beginPath();
    ctx.ellipse(eyeLX - 9, headY + 11, 8, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeRX + 9, headY + 11, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Manga diagonal blush hatch lines
    ctx.strokeStyle = 'rgba(255, 50, 70, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        ctx.moveTo(eyeLX - 13 + i * 3, headY + 12);
        ctx.lineTo(eyeLX - 11 + i * 3, headY + 9);
        ctx.moveTo(eyeRX + 6 + i * 3, headY + 12);
        ctx.lineTo(eyeRX + 8 + i * 3, headY + 9);
    }
    ctx.stroke();

    // Nose
    ctx.strokeStyle = shadowSkinColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(128, headY + 9);
    ctx.lineTo(128, headY + 16);
    ctx.lineTo(128 - 2.5, headY + 16);
    ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#8b5e5c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (mood === 'desanimado') {
        // Sad curve down
        ctx.arc(128, headY + 29, 7, Math.PI + 0.3, Math.PI * 2 - 0.3);
        ctx.stroke();
    } else if (mood === 'entediado') {
        // Sleepy neutral 'o'
        ctx.fillStyle = '#8b5e5c';
        ctx.beginPath();
        ctx.arc(128, headY + 24, 4, 0, Math.PI * 2);
        ctx.fill();
    } else if (mood === 'epico') {
        // Wide open shouting mouth!
        ctx.fillStyle = '#ff4d6d';
        ctx.strokeStyle = '#100f14';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(128, headY + 23, 9, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Teeth
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(128 - 6, headY + 23, 12, 3);
    } else if (mood === 'energizado' || mood === 'determinado') {
        // Smirk/confident smile
        ctx.beginPath();
        ctx.moveTo(128 - 8, headY + 24);
        ctx.quadraticCurveTo(128 + 2, headY + 28, 128 + 9, headY + 23);
        ctx.stroke();
        // Shadow line under lip
        ctx.strokeStyle = shadowSkinColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(128 - 2, headY + 29);
        ctx.lineTo(128 + 3, headY + 29);
        ctx.stroke();
    } else {
        // Neutral line
        ctx.beginPath();
        ctx.moveTo(128 - 6, headY + 26);
        ctx.lineTo(128 + 6, headY + 26);
        ctx.stroke();
    }

    // E. Forehead bangs (Drawn on top of forehead/face features)
    ctx.fillStyle = hairGrad;
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(128 - 28, headY - 22);
    ctx.lineTo(128 - 22, headY - 10); // bang 1
    ctx.lineTo(128 - 17, headY - 17);
    ctx.lineTo(128 - 9, headY - 5);   // bang 2
    ctx.lineTo(128 - 3, headY - 15);
    ctx.lineTo(128 + 4, headY - 5);   // bang 3
    ctx.lineTo(128 + 10, headY - 17);
    ctx.lineTo(128 + 22, headY - 10); // bang 4
    ctx.lineTo(128 + 28, headY - 22);
    ctx.quadraticCurveTo(128, headY - 45, 128 - 28, headY - 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Individual hair lines inside bangs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(128 - 22, headY - 20); ctx.lineTo(128 - 21, headY - 12);
    ctx.moveTo(128 - 8, headY - 23);  ctx.lineTo(128 - 9, headY - 8);
    ctx.moveTo(128 + 5, headY - 23);  ctx.lineTo(128 + 4, headY - 8);
    ctx.moveTo(128 + 22, headY - 20); ctx.lineTo(128 + 21, headY - 12);
    ctx.stroke();

    // Shiny reflection highlights on bangs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(128 - 20, headY - 22);
    ctx.lineTo(128 - 15, headY - 25);
    ctx.lineTo(128 - 10, headY - 22);
    ctx.lineTo(128 - 15, headY - 19);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(128, headY - 26);
    ctx.lineTo(128 + 5, headY - 29);
    ctx.lineTo(128 + 10, headY - 26);
    ctx.lineTo(128 + 5, headY - 23);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(128 + 15, headY - 22);
    ctx.lineTo(128 + 20, headY - 25);
    ctx.lineTo(128 + 25, headY - 22);
    ctx.lineTo(128 + 20, headY - 19);
    ctx.closePath();
    ctx.fill();

    // F. Accessories (Visor / Bandana)
    if (equipped.accessory === 'acc_bandana') {
        ctx.fillStyle = '#e63946'; // red bandana band
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(128 - 29, headY - 13);
        ctx.lineTo(128 + 29, headY - 13);
        ctx.lineTo(128 + 26, headY - 24);
        ctx.lineTo(128 - 26, headY - 24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White emblem on center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(128, headY - 18.5, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Flapping ties on left side
        ctx.fillStyle = '#e63946';
        ctx.save();
        ctx.translate(128 - 27, headY - 18);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-15, 5 + Math.sin(t * 6) * 4, -25, -5 + Math.sin(t * 6) * 6);
        ctx.quadraticCurveTo(-15, -5 + Math.sin(t * 6) * 4, 0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-10, 15 + Math.cos(t * 6) * 4, -20, 10 + Math.cos(t * 6) * 6);
        ctx.quadraticCurveTo(-10, 5 + Math.cos(t * 6) * 4, 0, -3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }

    if (equipped.accessory === 'acc_sunglasses') {
        // Sport sunglasses visor
        const glassesGrad = ctx.createLinearGradient(128 - 28, headY, 128 + 28, headY);
        glassesGrad.addColorStop(0, '#00f2ff');
        glassesGrad.addColorStop(0.5, '#8a00ff');
        glassesGrad.addColorStop(1, '#0055ff');
        
        ctx.fillStyle = glassesGrad;
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 3.5;
        
        ctx.beginPath();
        ctx.moveTo(128 - 27, headY - 6);
        ctx.lineTo(128 + 27, headY - 6);
        ctx.bezierCurveTo(128 + 29, headY + 5, 128 + 12, headY + 10, 128, headY + 7);
        ctx.bezierCurveTo(128 - 12, headY + 10, 128 - 29, headY + 5, 128 - 27, headY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Shiny visor stripes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(128 - 15, headY - 2);
        ctx.lineTo(128 - 5, headY + 6);
        ctx.moveTo(128 + 5, headY - 2);
        ctx.lineTo(128 + 15, headY + 6);
        ctx.stroke();
    }

    // G. Torso Outfit (Tank Top / Jersey)
    let outfitColor = '#1c4e80'; // default blue
    let outfitAccent = '#00b4d8';
    if (equipped.outfit === 'outfit_race') {
        outfitColor = '#e63946'; // red
        outfitAccent = '#ffd700'; // gold
    } else if (equipped.outfit === 'outfit_epic') {
        outfitColor = '#1a1a24'; // stealth black
        outfitAccent = '#ff003c'; // neon red
    }

    ctx.fillStyle = outfitColor;
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    ctx.moveTo(128 - 30, bodyY + 35); // left strap inner
    ctx.lineTo(128 - 52, bodyY + 33); // left shoulder outer
    ctx.quadraticCurveTo(128 - 58, bodyY + 65, 128 - 52, bodyY + 105); // left side body
    ctx.lineTo(128 + 52, bodyY + 105); // hips right
    ctx.quadraticCurveTo(128 + 58, bodyY + 65, 128 + 52, bodyY + 33); // right shoulder outer
    ctx.lineTo(128 + 30, bodyY + 35); // right strap inner
    ctx.quadraticCurveTo(128, bodyY + 49, 128 - 30, bodyY + 35); // chest cut
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stripes on outfit
    ctx.strokeStyle = outfitAccent;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(128 - 46, bodyY + 34);
    ctx.lineTo(128 - 48, bodyY + 105);
    ctx.moveTo(128 + 46, bodyY + 34);
    ctx.lineTo(128 + 48, bodyY + 105);
    ctx.stroke();

    // H. Life Vest (Colete) if equipped
    if (equipped.vest === 'vest_safety') {
        ctx.fillStyle = '#ff6b00'; // safety orange
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 3.5;
        
        // Draw left panel
        ctx.beginPath();
        ctx.moveTo(128 - 52, bodyY + 33);
        ctx.lineTo(128 - 14, bodyY + 39);
        ctx.lineTo(128 - 12, bodyY + 100);
        ctx.lineTo(128 - 50, bodyY + 95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw right panel
        ctx.beginPath();
        ctx.moveTo(128 + 52, bodyY + 33);
        ctx.lineTo(128 + 14, bodyY + 39);
        ctx.lineTo(128 + 12, bodyY + 100);
        ctx.lineTo(128 + 50, bodyY + 95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Seams
        ctx.strokeStyle = 'rgba(14, 11, 18, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(128 - 33, bodyY + 40); ctx.lineTo(128 - 31, bodyY + 95);
        ctx.moveTo(128 + 33, bodyY + 40); ctx.lineTo(128 + 31, bodyY + 95);
        ctx.stroke();

        // Silver reflector strips
        ctx.fillStyle = '#e2e2e2';
        ctx.strokeStyle = '#0e0b12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(128 - 44, bodyY + 48, 22, 10);
        ctx.rect(128 + 22, bodyY + 48, 22, 10);
        ctx.fill();
        ctx.stroke();
        
        // Straps and Buckles
        ctx.fillStyle = '#1c1c1f';
        ctx.fillRect(128 - 14, bodyY + 64, 28, 8);
        ctx.fillRect(128 - 14, bodyY + 80, 28, 8);
        
        // Buckles details
        ctx.fillStyle = '#ffd700';
        ctx.strokeRect(128 - 4, bodyY + 63, 8, 10);
        ctx.fillRect(128 - 4, bodyY + 63, 8, 10);
        ctx.strokeRect(128 - 4, bodyY + 79, 8, 10);
        ctx.fillRect(128 - 4, bodyY + 79, 8, 10);
    }

    // I. Arms and Paddling Pose (Aligned to right-side paddling biomechanics)
    const gripX = 156;
    const gripY = bodyY - 15;
    const bladeStartX = 185;
    const bladeStartY = bodyY + 95;
    const bladeEndX = 195;
    const bladeEndY = bodyY + 145;

    const padAngle = Math.atan2(bladeStartY - gripY, bladeStartX - gripX);

    const handLeftX = gripX;
    const handLeftY = gripY;

    // Right Hand holds the shaft lower down
    const handRightX = gripX + (bladeStartX - gripX) * 0.45;
    const handRightY = gripY + (bladeStartY - gripY) * 0.45;

    // 1. Draw outer black contours of arms first
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 23;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Right arm contour
    ctx.beginPath();
    ctx.moveTo(128 + 52, bodyY + 33);
    ctx.lineTo(198, bodyY + 45);
    ctx.lineTo(handRightX, handRightY);
    ctx.stroke();

    // Left arm contour (reaches across chest to the top grip)
    ctx.beginPath();
    ctx.moveTo(128 - 52, bodyY + 33);
    ctx.lineTo(116, bodyY + 16);
    ctx.lineTo(handLeftX, handLeftY);
    ctx.stroke();

    // 2. Draw skin inner fill of arms
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 15.5;

    // Right arm fill
    ctx.beginPath();
    ctx.moveTo(128 + 52, bodyY + 33);
    ctx.lineTo(198, bodyY + 45);
    ctx.lineTo(handRightX, handRightY);
    ctx.stroke();

    // Left arm fill
    ctx.beginPath();
    ctx.moveTo(128 - 52, bodyY + 33);
    ctx.lineTo(116, bodyY + 16);
    ctx.lineTo(handLeftX, handLeftY);
    ctx.stroke();

    // Bicep/Forearm shading line
    ctx.strokeStyle = shadowSkinColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128 + 48, bodyY + 38);
    ctx.lineTo(193, bodyY + 44);
    ctx.moveTo(82, bodyY + 31);
    ctx.lineTo(114, bodyY + 18);
    ctx.stroke();

    // J. Shorts & Bare Legs (at the bottom)
    ctx.fillStyle = '#0f2537'; // Shorts dark blue
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3.5;
    // Left leg short
    ctx.beginPath();
    ctx.rect(128 - 48, bodyY + 105, 40, 42);
    ctx.fill();
    ctx.stroke();
    // Right leg short
    ctx.beginPath();
    ctx.rect(128 + 8, bodyY + 105, 40, 42);
    ctx.fill();
    ctx.stroke();

    // Bare legs
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.rect(128 - 38, bodyY + 147, 20, 50);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(128 + 18, bodyY + 147, 20, 50);
    ctx.fill();
    ctx.stroke();

    // Shading on legs
    ctx.fillStyle = shadowSkinColor;
    ctx.beginPath();
    ctx.rect(128 - 38, bodyY + 147, 6, 50);
    ctx.rect(128 + 18, bodyY + 147, 6, 50);
    ctx.fill();

    // K. Paddle drawing (Drawn in front of body & arms, but hands drawn over it)
    let padColorGrad = ctx.createLinearGradient(gripX, gripY, bladeStartX, bladeStartY);
    let bladeColorGrad = ctx.createLinearGradient(bladeStartX, bladeStartY, bladeEndX, bladeEndY);

    if (paddleType === 'paddle_legend') {
        padColorGrad.addColorStop(0, '#ffd700');
        padColorGrad.addColorStop(0.5, '#ffae00');
        padColorGrad.addColorStop(1, '#ff8c00');
        
        bladeColorGrad.addColorStop(0, '#ffe57f');
        bladeColorGrad.addColorStop(0.5, '#ffd700');
        bladeColorGrad.addColorStop(1, '#ff9100');
    } else if (paddleType === 'paddle_crespo') {
        padColorGrad.addColorStop(0, '#4a4a54');
        padColorGrad.addColorStop(1, '#1e1e24');
        
        bladeColorGrad.addColorStop(0, '#2e2e36');
        bladeColorGrad.addColorStop(1, '#0e0e12');
    } else {
        padColorGrad.addColorStop(0, '#b86f3d');
        padColorGrad.addColorStop(1, '#783c18');
        
        bladeColorGrad.addColorStop(0, '#cf8a5b');
        bladeColorGrad.addColorStop(1, '#663110');
    }

    // Draw Shaft outline and color
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(bladeStartX, bladeStartY);
    ctx.stroke();

    ctx.strokeStyle = padColorGrad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(bladeStartX, bladeStartY);
    ctx.stroke();

    if (paddleType === 'paddle_wood') {
        ctx.strokeStyle = 'rgba(120, 60, 24, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(padAngle);
        ctx.beginPath();
        const dist = Math.sqrt((bladeStartX - gripX) ** 2 + (bladeStartY - gripY) ** 2);
        for (let i = 1; i <= 4; i++) {
            const px = dist * (i * 0.2);
            ctx.moveTo(px, -2);
            ctx.lineTo(px + 4, 2);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Draw Grip
    ctx.fillStyle = '#0e0b12';
    ctx.save();
    ctx.translate(gripX, gripY);
    ctx.rotate(padAngle - Math.PI / 2);
    ctx.fillRect(-12, -4, 24, 8);
    ctx.fillStyle = padColorGrad;
    ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();

    // Draw Blade
    ctx.fillStyle = bladeColorGrad;
    ctx.save();
    ctx.translate(bladeStartX, bladeStartY);
    ctx.rotate(padAngle - Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-18, 14, -26, 36, 0, 58);
    ctx.bezierCurveTo(26, 36, 18, 14, 0, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    if (paddleType === 'paddle_wood') {
        ctx.strokeStyle = 'rgba(102, 49, 16, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.quadraticCurveTo(-8, 22, -4, 45);
        ctx.moveTo(0, 5);
        ctx.quadraticCurveTo(8, 25, 4, 48);
        ctx.stroke();
    } else if (paddleType === 'paddle_crespo') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let j = -20; j < 60; j += 6) {
            ctx.beginPath(); ctx.moveTo(j, 0); ctx.lineTo(j + 30, 60); ctx.stroke();
        }
        for (let j = -20; j < 60; j += 6) {
            ctx.beginPath(); ctx.moveTo(j + 30, 0); ctx.lineTo(j, 60); ctx.stroke();
        }
    } else if (paddleType === 'paddle_legend') {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#fffbdf';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, 10); ctx.lineTo(-12, 22); ctx.lineTo(-4, 25); ctx.lineTo(-8, 38);
        ctx.moveTo(5, 15); ctx.lineTo(10, 27); ctx.lineTo(3, 31); ctx.lineTo(7, 44);
        ctx.stroke();
    }
    ctx.restore();

    // L. Hands (Drawn over the paddle shaft to wrap it)
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = '#0e0b12';
    ctx.lineWidth = 3.5;
    
    // Right Hand (Shaft lower wrap)
    ctx.beginPath();
    ctx.arc(handRightX, handRightY, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Left Hand (T-grip top wrap)
    ctx.beginPath();
    ctx.arc(handLeftX, handLeftY, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- FOREGROUND EFFECTS ---
    // A. Epico aura sparkles
    if (mood === 'epico') {
        ctx.fillStyle = 'rgba(255, 235, 100, 0.85)';
        for (let i = 0; i < 10; i++) {
            const spX = (headX - 60) + ((i * 33 + t * 65) % 120);
            const spY = (headY + 60) - ((t * 80 + i * 50) % 160);
            ctx.beginPath();
            ctx.arc(spX, spY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // B. Determinado energy ripple
    if (mood === 'determinado') {
        ctx.strokeStyle = `rgba(0, 180, 216, ${0.45 + 0.3 * Math.sin(t*4.5)})`;
        ctx.lineWidth = 3;
        const ringRadius = 35 + (avatarFrame % 50) * 1.6;
        ctx.beginPath();
        ctx.ellipse(W/2, bodyY + 45, ringRadius, ringRadius * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // C. Energizado cross sparkles
    if (mood === 'energizado') {
        ctx.strokeStyle = `rgba(6, 214, 160, ${0.7 + 0.3 * Math.sin(t*4)})`;
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) {
            const rot = t * 2.5 + i * Math.PI / 3;
            const cx = headX + 70 * Math.sin(t + i * 1.5);
            const cy = headY + 30 + 60 * Math.cos(t * 1.4 + i);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
            ctx.moveTo(0, -9); ctx.lineTo(0, 9);
            ctx.stroke();
            ctx.restore();
        }
    }

    // D. Desanimado rain cloud & tears
    if (mood === 'desanimado') {
        // Cloud
        ctx.fillStyle = '#444452';
        ctx.beginPath();
        ctx.arc(headX - 32, 22, 24, 0, Math.PI * 2);
        ctx.arc(headX + 32, 22, 24, 0, Math.PI * 2);
        ctx.arc(headX, 17, 30, 0, Math.PI * 2);
        ctx.fill();

        // Cloud border
        ctx.strokeStyle = '#22222d';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Rain
        ctx.fillStyle = 'rgba(0, 180, 255, 0.65)';
        for (let i = 0; i < 15; i++) {
            const rx = (headX - 60) + ((i * 18 + t * 80) % 120);
            const ry = 30 + ((t * 200 + i * 38) % 220);
            if (ry < H - 20) {
                ctx.fillRect(rx, ry, 2.2, 9);
            }
        }

        // Tears
        ctx.fillStyle = 'rgba(0, 160, 255, 0.88)';
        const tearY = headY + 9 + ((t * 30) % 25);
        ctx.beginPath();
        ctx.arc(eyeLX + 3, tearY, 3, 0, Math.PI * 2);
        ctx.arc(eyeRX - 3, tearY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // E. Entediado sleeping bubbles
    if (mood === 'entediado') {
        const bubbleProgress = (t % 2) / 2; // 0 to 1
        const scale = bubbleProgress * 20 + 10;
        const zX = headX + 45 + bubbleProgress * 25;
        const zY = headY - 15 - bubbleProgress * 75;
        const opacity = 1 - bubbleProgress;

        ctx.fillStyle = `rgba(180, 190, 255, ${opacity * 0.8})`;
        ctx.font = `bold ${scale}px 'Outfit', sans-serif`;
        ctx.fillText('Z', zX, zY);
    }
}

// ---- ANIMAÇÃO DO AVATAR ----
function startAvatarAnimation() {
    if (avatarAnimFrame) cancelAnimationFrame(avatarAnimFrame);
    const mood = getAvatarMood(gStats);

    function loop() {
        drawPixelAvatar(mood.state);
        avatarAnimFrame = requestAnimationFrame(loop);
    }
    loop();
}

// ---- MAPA NÁUTICO (CANVAS) ----
function renderNauticalMap() {
    const canvas = document.getElementById('nautical-map-canvas');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 700;
    canvas.height = canvas.offsetHeight || 480;

    // Mouse hover para tooltips
    canvas.addEventListener('mousemove', onMapMouseMove);
    canvas.addEventListener('mouseleave', () => {
        document.getElementById('island-tooltip').classList.remove('visible');
    });
}

function startMapAnimation() {
    if (mapAnimFrame) cancelAnimationFrame(mapAnimFrame);
    const canvas = document.getElementById('nautical-map-canvas');
    if (!canvas) return;

    function loop() {
        waveOffset += 0.8;
        drawNauticalMap(canvas);
        mapAnimFrame = requestAnimationFrame(loop);
    }
    loop();
}

function drawNauticalMap(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const stats = gStats;

    // ---- Fundo do oceano profundo ----
    const oceanGrad = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, Math.max(W, H));
    oceanGrad.addColorStop(0, '#041c32');
    oceanGrad.addColorStop(1, '#020d1e');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, H);

    // ---- Grade náutica (linhas de longitude/latitude muito sutis) ----
    ctx.strokeStyle = 'rgba(0, 180, 216, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ---- Partículas bioluminescentes flutuantes ----
    if (mapParticles.length === 0) {
        for (let i = 0; i < 25; i++) {
            mapParticles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: 1 + Math.random() * 2,
                alpha: 0.1 + Math.random() * 0.45,
                speedY: -0.08 - Math.random() * 0.12,
                pulseSpeed: 0.015 + Math.random() * 0.025,
                pulsePhase: Math.random() * Math.PI
            });
        }
    }
    mapParticles.forEach(p => {
        p.y += p.speedY;
        if (p.y < 0) {
            p.y = H;
            p.x = Math.random() * W;
        }
        p.pulsePhase += p.pulseSpeed;
        const finalAlpha = Math.max(0, p.alpha * (0.3 + 0.7 * Math.sin(p.pulsePhase)));
        ctx.fillStyle = `rgba(6, 214, 160, ${finalAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // ---- Ondas animadas ----
    drawOceanWaves(ctx, W, H);

    // ---- Caminhos entre ilhas ----
    drawIslandPaths(ctx, W, H, stats);

    // ---- Ilhas ----
    ISLANDS.forEach(isl => {
        const unlocked = isl.unlocked(stats);
        const isCurrent = isl.id === stats.currentIsland;
        drawIsland(ctx, isl, W, H, unlocked, isCurrent);
    });

    // ---- Avatar / bote no mapa ---- c4: posicionar ao LADO da ilha, não sobre ela
    const curIsl = ISLANDS.find(i => i.id === stats.currentIsland) || ISLANDS[0];
    const boatOffsetX = (curIsl.size / 2 + 22) * (curIsl.x < 0.8 ? 1 : -1); // lado direito, exceto perto da borda
    drawBoatOnMap(ctx, curIsl.x * W + boatOffsetX, curIsl.y * H - 5);

    // ---- Rosa dos Ventos (Compass Rose) animada ----
    compassAngle += 0.0025;
    const cx = 75;
    const cy = H - 80;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(compassAngle);
    
    // Anel externo dourado
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
        ctx.stroke();
    }

    // Estrela de 8 pontas
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#b39200';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle + 0.15) * 10, Math.sin(angle + 0.15) * 10);
        ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
        ctx.lineTo(Math.cos(angle - 0.15) * 10, Math.sin(angle - 0.15) * 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    ctx.fillStyle = '#b39200';
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle + 0.1) * 6, Math.sin(angle + 0.1) * 6);
        ctx.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
        ctx.lineTo(Math.cos(angle - 0.1) * 6, Math.sin(angle - 0.1) * 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    // Centro
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Direções fixas
    ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - 36);
    ctx.fillText('S', cx, cy + 36);
    ctx.fillText('W', cx - 36, cy);
    ctx.fillText('E', cx + 36, cy);

    // ---- Título náutico ----
    ctx.fillStyle = 'rgba(0,180,216,0.2)';
    ctx.font = `bold 10px 'Outfit', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('MAPA NÁUTICO — VAA VERMELHO JORNADA', 140, H - 14);
}

function drawOceanWaves(ctx, W, H) {
    for (let layer = 0; layer < 3; layer++) {
        const amp = 8 - layer * 2;
        const freq = 0.005 + layer * 0.003;
        const speed = (waveOffset * (0.5 + layer * 0.35)) % W;
        const yBase = H * (0.32 + layer * 0.23);
        
        ctx.beginPath();
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 8) {
            const y = yBase + Math.sin((x + speed) * freq) * amp;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        
        const grad = ctx.createLinearGradient(0, yBase - amp, 0, H);
        if (layer === 0) {
            grad.addColorStop(0, 'rgba(4, 30, 66, 0.22)');
            grad.addColorStop(1, 'rgba(2, 13, 30, 0.45)');
        } else if (layer === 1) {
            grad.addColorStop(0, 'rgba(0, 74, 111, 0.16)');
            grad.addColorStop(1, 'rgba(4, 20, 46, 0.45)');
        } else {
            grad.addColorStop(0, 'rgba(0, 150, 199, 0.08)');
            grad.addColorStop(1, 'rgba(4, 15, 36, 0.55)');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = layer === 2 ? 'rgba(0, 180, 216, 0.14)' : 'rgba(0, 119, 182, 0.09)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 8) {
            const y = yBase + Math.sin((x + speed) * freq) * amp;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function drawIslandPaths(ctx, W, H, stats) {
    const time = Date.now() / 1000;
    const evs = typeof evaluations !== 'undefined' ? evaluations : {};

    for (let i = 0; i < ISLANDS.length - 1; i++) {
        const a = ISLANDS[i];
        const b = ISLANDS[i + 1];
        const ax = a.x * W, ay = a.y * H;
        const bx = b.x * W, by = b.y * H;

        const aUnlocked = a.unlocked(stats);
        const bUnlocked = b.unlocked(stats);
        const active = aUnlocked && bUnlocked;

        ctx.save();
        ctx.shadowColor = active ? '#06d6a0' : 'transparent';
        ctx.shadowBlur = active ? 4 : 0;
        ctx.strokeStyle = active
            ? 'rgba(6, 214, 160, 0.28)'
            : 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 2.2;
        
        const cpx = (ax + bx) / 2 + (ay - by) * 0.18;
        const cpy = (ay + by) / 2 - 25;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(cpx, cpy, bx, by);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (active) {
            const t = (time * 0.35 + i * 0.25) % 1;
            const mt = 1 - t;
            const dotX = mt * mt * ax + 2 * mt * t * cpx + t * t * bx;
            const dotY = mt * mt * ay + 2 * mt * t * cpy + t * t * by;

            ctx.fillStyle = '#06d6a0';
            ctx.beginPath();
            ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(6, 214, 160, 0.35)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // Midpoint of a quadratic curve at t = 0.5
        const x_mid = 0.25 * ax + 0.5 * cpx + 0.25 * bx;
        const y_mid = 0.25 * ay + 0.5 * cpy + 0.25 * by;

        let segmentDistance = 0;
        let weather = null;

        if (b.isWorkout && b.workoutData) {
            segmentDistance = b.workoutData.distance || 0;
            const ev = evs[b.workoutData.id];
            if (ev && ev.weather) {
                weather = ev.weather;
            }
        } else if (b.isGoal) {
            const ap = (typeof athleteProfile !== 'undefined' && athleteProfile) ? athleteProfile : null;
            const goal = ap && ap.goal ? ap.goal : null;
            const goalTarget = (goal && goal.target) || 30;
            const workoutsOfCurrentWeek = ISLANDS.filter(isl => isl.isWorkout).map(isl => isl.workoutData);
            const totalWeekDist = workoutsOfCurrentWeek.reduce((sum, w) => sum + (w.distance || 0), 0);
            segmentDistance = Math.max(0, goalTarget - totalWeekDist);
        }

        if (segmentDistance > 0) {
            // Draw Distance Label Pill
            ctx.save();
            ctx.fillStyle = 'rgba(2, 13, 30, 0.85)';
            ctx.strokeStyle = active ? 'rgba(6, 214, 160, 0.5)' : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            const text = `${segmentDistance.toFixed(1)} km`;
            ctx.font = 'bold 9px Outfit, sans-serif';
            const textWidth = ctx.measureText(text).width;
            
            ctx.beginPath();
            ctx.roundRect(x_mid - textWidth/2 - 6, y_mid - 25, textWidth + 12, 16, 4);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x_mid, y_mid - 17);
            ctx.restore();

            // Draw Weather Animation
            drawSegmentWeather(ctx, x_mid, y_mid + 15, weather, time);
        }
    }
}

function drawSegmentWeather(ctx, cx, cy, weather, time) {
    let type = 'sunny';
    if (weather) {
        const rain = weather.rain || "Sem Chuva";
        const wind = weather.wind || "";
        const swell = weather.swell || "";
        
        if (rain !== "Sem Chuva" && rain !== "") {
            type = 'rainy';
        } else if (wind !== "" && (wind.toLowerCase().includes('kt') || wind.toLowerCase().includes('km') || wind.match(/\d+/))) {
            type = 'windy';
        } else if (swell !== "" && (swell.toLowerCase().includes('m') || swell.match(/\d+/))) {
            type = 'swell';
        }
    }

    ctx.save();
    ctx.translate(cx, cy);

    if (type === 'sunny') {
        ctx.strokeStyle = '#ffd700';
        ctx.fillStyle = '#ffb700';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const angleOffset = time * 0.8;
        for (let i = 0; i < 8; i++) {
            const angle = angleOffset + (i * Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 5.5, Math.sin(angle) * 5.5);
            ctx.lineTo(Math.cos(angle) * 8.5, Math.sin(angle) * 8.5);
            ctx.stroke();
        }
    } else if (type === 'rainy') {
        ctx.fillStyle = '#8692a6';
        ctx.beginPath();
        ctx.arc(-3, -2, 4, 0, Math.PI * 2);
        ctx.arc(3, -2, 4, 0, Math.PI * 2);
        ctx.arc(0, -4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#3a86c8';
        ctx.lineWidth = 1.2;
        const dropOffset = (time * 24) % 10;
        for (let i = 0; i < 3; i++) {
            const rx = -4 + i * 4;
            const ry = 2 + ((dropOffset + i * 3.3) % 8);
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 1, ry + 3);
            ctx.stroke();
        }
    } else if (type === 'windy') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.2;
        const windOffset = (time * 28) % 25;
        for (let i = 0; i < 2; i++) {
            const wy = -3 + i * 6;
            ctx.beginPath();
            ctx.moveTo(-10 + windOffset, wy);
            ctx.bezierCurveTo(-5 + windOffset, wy - 3, 0 + windOffset, wy + 3, 5 + windOffset, wy);
            ctx.stroke();
        }
    } else if (type === 'swell') {
        ctx.strokeStyle = '#0077b6';
        ctx.lineWidth = 1.5;
        const bob = Math.sin(time * 5) * 2;
        ctx.beginPath();
        ctx.moveTo(-10, bob);
        ctx.quadraticCurveTo(-5, bob - 3, 0, bob);
        ctx.quadraticCurveTo(5, bob + 3, 10, bob);
        ctx.stroke();
    }

    ctx.restore();
}

function drawIsland(ctx, isl, W, H, unlocked, isCurrent) {
    const x = isl.x * W;
    const y = isl.y * H;
    const r = isl.size / 2;

    ctx.save();

    if (unlocked) {
        const radG = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
        radG.addColorStop(0, `${isl.color}25`);
        radG.addColorStop(0.6, `${isl.color}05`);
        radG.addColorStop(1, 'transparent');
        ctx.fillStyle = radG;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
        ctx.fill();
    }

    if (unlocked && isCurrent) {
        ctx.strokeStyle = `${isl.color}44`;
        ctx.lineWidth = 1.8;
        const pulseR = r * 1.35 + Math.sin(waveOffset * 0.05) * 4.5;
        ctx.beginPath();
        ctx.arc(x, y, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `${isl.color}15`;
        ctx.beginPath();
        ctx.arc(x, y, pulseR + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    if (isl.id === 'start') {
        ctx.moveTo(-r, -r*0.2);
        ctx.bezierCurveTo(-r, -r*1.1, r*0.2, -r*1.1, r*0.8, -r*0.4);
        ctx.bezierCurveTo(r*0.4, -r*0.6, -r*0.2, -r*0.5, -r*0.3, -r*0.1);
        ctx.bezierCurveTo(-r*0.4, r*0.3, r*0.4, r*0.3, r*0.8, 0.1);
        ctx.bezierCurveTo(r*0.2, r*0.8, -r, r*0.8, -r, -r*0.2);
    } else if (isl.id === 'drill') {
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
            const noiseR = r * (0.85 + 0.16 * Math.sin(a * 4 + 1.2));
            const rx = noiseR * Math.cos(a);
            const ry = noiseR * 0.68 * Math.sin(a);
            if (a === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
    } else if (isl.id === 'speed') {
        ctx.moveTo(-r * 0.85, -r * 0.35);
        ctx.lineTo(r * 0.85, -r * 0.55);
        ctx.lineTo(r * 0.1, 0);
        ctx.lineTo(r * 0.75, r * 0.45);
        ctx.lineTo(-r * 0.85, r * 0.35);
        ctx.lineTo(-r * 0.25, 0);
    } else if (isl.id === 'volume') {
        for (let a = 0; a < Math.PI * 2; a += 0.25) {
            const noiseR = r * (0.88 + 0.12 * Math.sin(a * 5 + 0.7));
            const rx = noiseR * Math.cos(a);
            const ry = noiseR * 0.72 * Math.sin(a);
            if (a === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
    } else if (isl.id === 'champion') {
        const points = 5;
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points;
            const cr = i % 2 === 0 ? r : r * 0.48;
            const rx = cr * Math.cos(angle);
            const ry = cr * 0.76 * Math.sin(angle);
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
    } else {
        for (let a = 0; a < Math.PI * 2; a += 0.3) {
            const noiseR = r * (0.88 + 0.14 * Math.sin(a * 3.5));
            const rx = noiseR * Math.cos(a);
            const ry = noiseR * 0.68 * Math.sin(a);
            if (a === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
        }
    }
    ctx.closePath();

    if (unlocked) {
        ctx.fillStyle = '#edd1a1';
        ctx.fill();
        
        ctx.save();
        ctx.scale(0.85, 0.85);
        ctx.fillStyle = '#2d6a4f';
        ctx.fill();
        
        ctx.scale(0.72, 0.72);
        ctx.fillStyle = '#52b788';
        ctx.fill();
        ctx.restore();
    } else {
        ctx.fillStyle = '#22223b';
        ctx.fill();
        ctx.strokeStyle = '#4a4e69';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();

    if (unlocked) {
        // Ilhas de treino: exibir marcador de performance
        if (isl.isWorkout && isl.workoutData) {
            const w = isl.workoutData;
            // Mini gráfico de velocidade (ponto colorido)
            const speedColor = (w.avgSpeed || 0) >= 10 ? '#06d6a0' : (w.avgSpeed || 0) >= 9 ? '#ff9f1c' : '#e63946';
            ctx.fillStyle = speedColor;
            ctx.beginPath();
            ctx.arc(x, y - 3, 5, 0, Math.PI * 2);
            ctx.fill();
            // Halo de performance
            ctx.strokeStyle = speedColor + '55';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y - 3, 8, 0, Math.PI * 2);
            ctx.stroke();
        } else if (isl.isGoal) {
            // Ilha meta: feixe de luz dourado e bandeira
            const beamGrad = ctx.createLinearGradient(x, y, x, y - 100);
            beamGrad.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
            beamGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = beamGrad;
            ctx.beginPath();
            ctx.moveTo(x - 7, y + 4);
            ctx.lineTo(x + 7, y + 4);
            ctx.lineTo(x + 3, y - 85);
            ctx.lineTo(x - 3, y - 85);
            ctx.closePath();
            ctx.fill();

            // Bandeira de chegada (estilo xadrez)
            const flagX = x - 1.5;
            const flagY = y - 18;
            ctx.fillStyle = '#5c3d2e';
            ctx.fillRect(flagX, flagY, 2.5, 20);
            for (let fy = 0; fy < 2; fy++) {
                for (let fx = 0; fx < 2; fx++) {
                    ctx.fillStyle = (fx + fy) % 2 === 0 ? '#fff' : '#000';
                    ctx.fillRect(flagX + 2.5 + fx * 6, flagY + fy * 6, 6, 6);
                }
            }
        } else {
            // Ilhas normais (start, etc.)
            ctx.fillStyle = '#5c3d2e';
            ctx.fillRect(x - 1.5, y - 5, 2.5, 9);
            ctx.fillStyle = '#38b000';
            ctx.beginPath();
            ctx.arc(x - 0.5, y - 6, 4.5, 0, Math.PI * 2);
            ctx.fill();

            if (isl.id === 'start') {
                ctx.fillStyle = '#5c3d2e';
                ctx.fillRect(x + 6, y + 2, 2, 7);
                ctx.fillStyle = '#38b000';
                ctx.beginPath();
                ctx.arc(x + 7, y + 1.5, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.font = `bold ${r * 0.65}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', x, y);
    }

    ctx.fillStyle = unlocked ? '#e2e8f0' : 'rgba(255,255,255,0.22)';
    ctx.font = `bold 11px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    const nameText = isl.name.replace(/[^\w\s\u00C0-\u017E]/gu, '').trim();
    ctx.fillText(nameText, x, y + r * 0.85 + 4);
    ctx.shadowBlur = 0;

    ctx.restore();
}

function drawBoatOnMap(ctx, x, y) {
    const t = waveOffset * 0.05;
    const bobY = Math.sin(t) * 2.2;
    const bobAngle = Math.cos(t * 1.5) * 0.025;

    ctx.save();
    ctx.translate(x, y + bobY);
    ctx.rotate(bobAngle);

    const scale = 0.8;
    ctx.scale(scale, scale);

    ctx.strokeStyle = 'rgba(0, 180, 216, 0.32)';
    ctx.lineWidth = 1.2;
    const boatWake = (waveOffset * 1.3) % 25;
    
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(-25 - boatWake, -8 - boatWake * 0.25, -35 - boatWake * 1.3, -12 - boatWake * 0.4);
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(-25 - boatWake, 8 + boatWake * 0.25, -35 - boatWake * 1.3, 12 + boatWake * 0.4);
    ctx.stroke();

    ctx.fillStyle = '#c1121f';
    ctx.beginPath();
    ctx.moveTo(-18, -16);
    ctx.lineTo(12, -16);
    ctx.bezierCurveTo(18, -16, 20, -15, 16, -18);
    ctx.lineTo(-14, -18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.2;
    
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(4, -17);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-14, -17);
    ctx.stroke();

    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.bezierCurveTo(-20, -3, 20, -3, 35, 0);
    ctx.bezierCurveTo(20, 3, -20, 3, -35, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(35, 0);
    ctx.bezierCurveTo(32, -2, 28, -1, 30, 0);
    ctx.fill();

    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-2, -5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-2, -5);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#b39200';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(2, -4);
    ctx.lineTo(6, 6);
    ctx.stroke();
    
    ctx.fillStyle = '#ffc107';
    ctx.beginPath();
    ctx.ellipse(6, 6, 1.8, 3.5, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function onMapMouseMove(e) {
    const canvas = document.getElementById('nautical-map-canvas');
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const W = canvas.width, H = canvas.height;
    const tooltip = document.getElementById('island-tooltip');
    const evs = typeof evaluations !== 'undefined' ? evaluations : {};

    let found = null;
    ISLANDS.forEach(isl => {
        const ix = isl.x * W, iy = isl.y * H;
        const dist = Math.sqrt((mx - ix) ** 2 + (my - iy) ** 2);
        if (dist < isl.size) found = isl;
    });

    if (found) {
        const unlocked = found.unlocked(gStats);
        tooltip.classList.add('visible');
        tooltip.style.left = (e.offsetX + 14) + 'px';
        tooltip.style.top = (e.offsetY - 10) + 'px';
        tooltip.style.borderColor = unlocked ? '#06d6a0' : '#555';

        if (found.isWorkout && found.workoutData) {
            const w = found.workoutData;
            const ev = evs[w.id] || {};
            const wth = ev.weather || {};

            const startTimeStr = w.startTime || "06:00";
            const endTimeStr = w.endTime || (() => {
                if (!w.duration) return "--:--";
                const [sh, sm] = startTimeStr.split(':').map(Number);
                const durSec = w.duration;
                const startSec = sh * 3600 + sm * 60;
                const endSec = startSec + durSec;
                const eh = Math.floor((endSec / 3600) % 24);
                const em = Math.floor((endSec % 3600) / 60);
                return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
            })();

            const boatType = w.boat || "V1";
            const boatWeight = ev.boatWeight ? `${ev.boatWeight} kg` : (boatType === "OC1" ? "14.0 kg" : "13.5 kg");
            const speedVal = (w.avgSpeed || 0).toFixed(1);
            const distVal = (w.distance || 0).toFixed(1);

            const weatherEmoji = wth.rain && wth.rain !== "Sem Chuva" ? "🌧️" : 
                                 wth.wind && parseInt(wth.wind) > 10 ? "💨" : 
                                 wth.swell && parseFloat(wth.swell) > 0.4 ? "🌊" : "☀️";

            tooltip.innerHTML = `
                <div class="island-tooltip-name">${found.name}</div>
                <div class="island-tooltip-grid" style="display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; font-size: 11px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
                    <span style="color:var(--text-secondary);">Distância:</span><strong>${distVal} km</strong>
                    <span style="color:var(--text-secondary);">Vel. Média:</span><strong>${speedVal} km/h</strong>
                    <span style="color:var(--text-secondary);">Canoa:</span><strong>${boatType} (${boatWeight})</strong>
                    <span style="color:var(--text-secondary);">Horário:</span><strong>${startTimeStr} às ${endTimeStr}</strong>
                    <span style="color:var(--text-secondary);">Clima/Mar:</span><strong>${weatherEmoji} ${wth.temp ? wth.temp + '°C' : '--°C'} ${wth.tide ? '(' + wth.tide + ')' : ''}</strong>
                </div>
                <div class="island-tooltip-req" style="margin-top:6px; font-size:10px; color:#06d6a0;">✅ Treino Realizado</div>
            `;
        } else {
            tooltip.innerHTML = `
                <div class="island-tooltip-name">${found.name}</div>
                <div class="island-tooltip-desc">${found.desc}</div>
                <div class="island-tooltip-req">${unlocked ? '✅ Desbloqueada!' : `🔒 ${found.req}`}</div>
            `;
        }
    } else {
        tooltip.classList.remove('visible');
    }
}

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const stats = gStats;

    ITEMS.forEach(item => {
        const unlocked = item.unlocked(stats);
        const isEquipped = gEquipped[item.slot] === item.id;

        const div = document.createElement('div');
        div.className = 'inventory-item' + (isEquipped ? ' equipped' : '') + (!unlocked ? ' locked' : '');
        div.title = `${item.name}\n${item.bonus || 'Sem bônus'}${!unlocked ? '\n🔒 Bloqueado' : ''}`;

        div.innerHTML = `
            <span class="inventory-item-icon">${item.icon}</span>
            <div class="inventory-item-name">${item.name}</div>
            ${item.bonus ? `<div class="inventory-item-bonus">${item.bonus}</div>` : ''}
            ${!unlocked ? '<div class="lock-overlay">🔒</div>' : ''}
            ${isEquipped ? '<div class="equipped-badge">E</div>' : ''}
        `;

        if (unlocked) {
            div.addEventListener('click', () => equipItem(item));
        }
        grid.appendChild(div);
    });

    // Atualiza slots equipados
    updateEquipSlots();
}

function updateEquipSlots() {
    ['paddle', 'outfit', 'vest', 'accessory'].forEach(slot => {
        const el = document.getElementById(`slot-${slot}`);
        if (!el) return;
        const itemId = gEquipped[slot];
        const item = ITEMS.find(i => i.id === itemId);
        if (item) {
            el.querySelector('.equip-slot-icon').textContent = item.icon;
            el.title = `Equipado: ${item.name}`;
            el.classList.add('has-item');
        }
    });
}

function equipItem(item) {
    gEquipped[item.slot] = item.id;
    localStorage.setItem('vaa_equip', JSON.stringify(gEquipped));
    renderInventory();
    drawPixelAvatar(getAvatarMood(gStats).state);

    // Toast rápido
    showToast(`${item.icon} ${item.name} equipado!`, 'success');
}

// ---- RENDERIZAÇÃO: CONQUISTAS ----
function renderAchievements() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const stats = gStats;
    ACHIEVEMENTS.forEach(a => {
        const unlocked = a.check(stats);

        const div = document.createElement('div');
        div.className = 'achievement-badge ' + (unlocked ? 'unlocked' : 'locked');
        div.title = `${a.name}\n${a.desc}${unlocked ? '\n✅ Conquistada!' : '\n🔒 Bloqueada'}`;

        div.innerHTML = `
            <div class="achievement-icon-wrap">${a.icon}</div>
            <div class="achievement-badge-name">${a.name}</div>
        `;
        grid.appendChild(div);
    });
}

// ---- NOTIFICAÇÃO DE CONQUISTA NOVA ----
function checkAndNotifyAchievements() {
    const stats = gStats;
    const newlyUnlocked = [];

    ACHIEVEMENTS.forEach(a => {
        const wasAchieved = gAchieved[a.id];
        const isAchieved = a.check(stats);

        if (isAchieved && !wasAchieved) {
            newlyUnlocked.push(a);
            gAchieved[a.id] = true;
        }
    });

    if (newlyUnlocked.length > 0) {
        localStorage.setItem('vaa_achieved', JSON.stringify(gAchieved));
        // Notifica em sequência com delay
        newlyUnlocked.forEach((a, i) => {
            setTimeout(() => showAchievementToast(a), i * 2500);
        });
        // Recalcula XP com conquistas novas
        gStats.xp = calculateXP(
            typeof workouts !== 'undefined' ? workouts : [],
            typeof evaluations !== 'undefined' ? evaluations : {}
        );
        renderXPHeader();
        renderAchievements();
    }
}

function showAchievementToast(achievement) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="achievement-toast-icon">${achievement.icon}</div>
        <div class="achievement-toast-text">
            <strong>🏆 Conquista Desbloqueada!</strong>
            <span>${achievement.name}</span>
            <small>${achievement.desc}</small>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 450);
    }, 4500);
}

// ---- RENDERIZAÇÃO: COMPETIÇÕES ----
function renderCompetitions() {
    const list = document.getElementById('comp-list');
    if (!list) return;
    list.innerHTML = '';

    gCompetitions.forEach((comp, idx) => {
        const isTop3 = comp.place <= 3;
        const medalEmoji = comp.place === 1 ? '🥇' : comp.place === 2 ? '🥈' : comp.place === 3 ? '🥉' : `${comp.place}º`;
        const div = document.createElement('div');
        div.className = 'comp-item';
        div.innerHTML = `
            <div class="comp-item-info">
                <strong>${comp.name}</strong>
                <small>${comp.date ? new Date(comp.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''} — ${comp.place}º de ${comp.total}</small>
            </div>
            <div class="comp-placement ${isTop3 ? 'top3' : ''}">${medalEmoji}</div>
            <button class="btn-remove-comp" data-idx="${idx}" title="Remover">✕</button>
        `;
        list.appendChild(div);
    });

    list.querySelectorAll('.btn-remove-comp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            gCompetitions.splice(idx, 1);
            localStorage.setItem('vaa_competitions', JSON.stringify(gCompetitions));
            gStats = computeGameStats();
            renderCompetitions();
            renderXPHeader();
            renderAchievements();
        });
    });
}

// ---- EVENT LISTENERS INTERNOS ----
function setupGameEventListeners() {
    const btnSaveComp = document.getElementById('btn-save-competition');
    if (btnSaveComp) {
        btnSaveComp.addEventListener('click', () => {
            const name  = document.getElementById('comp-name').value.trim();
            const date  = document.getElementById('comp-date').value;
            const place = parseInt(document.getElementById('comp-place').value);
            const total = parseInt(document.getElementById('comp-total').value);

            if (!name || isNaN(place) || isNaN(total)) {
                showToast('Preencha nome, colocação e total de atletas.', 'warning');
                return;
            }
            if (place > total) {
                showToast('A colocação não pode ser maior que o total de atletas.', 'warning');
                return;
            }

            gCompetitions.push({ name, date, place, total });
            localStorage.setItem('vaa_competitions', JSON.stringify(gCompetitions));

            // Limpa formulário
            document.getElementById('comp-name').value = '';
            document.getElementById('comp-date').value = '';
            document.getElementById('comp-place').value = '';
            document.getElementById('comp-total').value = '';

            gStats = computeGameStats();
            renderCompetitions();
            renderXPHeader();
            renderAchievements();
            checkAndNotifyAchievements();

            showToast(`🏅 Prova "${name}" registrada! +100 XP`, 'success');
        });
    }
}

// ---- HOOK NO SISTEMA DE NAVEGAÇÃO ----
document.addEventListener('DOMContentLoaded', () => {
    // Aguarda o app.js inicializar (que roda no mesmo DOMContentLoaded)
    // Usa setTimeout para garantir que o initApp() do app.js já rodou
    setTimeout(() => {
        // Adiciona o handler para a aba de gamificação no sistema de navegação existente
        const gamificationBtn = document.getElementById('btn-gamification');
        if (gamificationBtn) {
            gamificationBtn.addEventListener('click', () => {
                // Aguarda a aba ficar visível para renderizar o canvas corretamente
                setTimeout(() => {
                    const canvas = document.getElementById('nautical-map-canvas');
                    if (canvas) {
                        canvas.width = canvas.offsetWidth;
                        canvas.height = canvas.offsetHeight || 480;
                    }
                    gStats = computeGameStats();
                    renderXPHeader();
                    renderAvatarCard();
                    renderNauticalMap();
                    startMapAnimation();
                    startAvatarAnimation();
                    renderInventory();
                    renderAchievements();
                    renderCompetitions();
                    checkAndNotifyAchievements();
                }, 50);
            });
        }

        // Inicializa se a aba já estiver ativa
        const tab = document.getElementById('tab-gamification');
        if (tab && tab.classList.contains('active')) {
            initGamification();
        }
    }, 100);
});
