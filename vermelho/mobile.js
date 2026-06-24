// ==========================================
// VAA VERMELHO MOBILE - CONTROLLER LOGIC
// ==========================================

// Global state variables (shares the same localStorage namespaces as desktop)
let workouts = [];
let evaluations = {};
let athleteProfile = null;

// Maps and Charts references
let activeMap = null;
let mapPolyline = null;
let mapMarkers = [];

let chartSpeed = null;
let chartCadence = null;
let chartHR = null;
let chartRadar = null;

// DOM Elements loaded
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
    loadLocalData();
    updateProfileUI();
    renderDashboard();
    initRadarChart();
});

// Initialize application data
function initApp() {
    const storedWorkouts = localStorage.getItem("vaa_workouts");
    const storedEvals = localStorage.getItem("vaa_evaluations");
    const storedProfile = localStorage.getItem("vaa_athlete_profile");

    // Profile initialization
    if (storedProfile) {
        athleteProfile = JSON.parse(storedProfile);
    } else if (window.dadosRemadaLocais && window.dadosRemadaLocais.latestBackup && window.dadosRemadaLocais.latestBackup.profile) {
        athleteProfile = window.dadosRemadaLocais.latestBackup.profile;
    } else {
        athleteProfile = {
            name: "Remador",
            height: 1.80,
            weight: 78,
            age: 47,
            since: 2022,
            watch: "Garmin 165 Music",
            paddle: "Remo Crespo C118",
            photo: "",
            goal: { type: "distance", baseline: 0, target: 30 }
        };
    }
    
    // Ensure goal structure is distance-based
    if (athleteProfile) {
        if (!athleteProfile.goal) athleteProfile.goal = {};
        athleteProfile.goal.type = "distance";
        athleteProfile.goal.baseline = 0;
        if (!athleteProfile.goal.target) athleteProfile.goal.target = 30;
        localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
    }

    // Workouts & evaluations initialization
    if (storedWorkouts && storedEvals) {
        workouts = JSON.parse(storedWorkouts);
        evaluations = JSON.parse(storedEvals);
    } else {
        const hasLocalData = window.dadosRemadaLocais && 
            ((window.dadosRemadaLocais.latestBackup && window.dadosRemadaLocais.latestBackup.workouts && window.dadosRemadaLocais.latestBackup.workouts.length > 0) || 
             (window.dadosRemadaLocais.gpxFiles && Object.keys(window.dadosRemadaLocais.gpxFiles).length > 0));
             
        if (hasLocalData) {
            workouts = [];
            evaluations = {};
            if (window.dadosRemadaLocais.latestBackup) {
                if (window.dadosRemadaLocais.latestBackup.workouts) workouts = window.dadosRemadaLocais.latestBackup.workouts;
                if (window.dadosRemadaLocais.latestBackup.evaluations) evaluations = window.dadosRemadaLocais.latestBackup.evaluations;
            }
        } else {
            generateMockData();
        }
    }
}

// Generate high fidelity mock data if storage is empty
function generateMockData() {
    workouts = [];
    evaluations = {};
    const baseDate = new Date();
    
    const mockConfigs = [
        { dayOffset: 12, boat: "V1",  dist: 9.8,  avgSpeed: 9.0, maxSpeed: 10.8, avgCad: 60, avgHr: 145, techScore: 50, errors: ["Colapso da Biela", "Falsa Trava na Entrada"], drills: ["Biela de Aço"] },
        { dayOffset: 6,  boat: "V1",  dist: 10.1, avgSpeed: 9.5, maxSpeed: 11.2, avgCad: 62, avgHr: 148, techScore: 70, errors: ["Binário Brusco/Tardio"], drills: ["Acelerador de Moto"] },
        { dayOffset: 0,  boat: "V1",  dist: 10.0, avgSpeed: 10.1, maxSpeed: 12.0, avgCad: 64, avgHr: 152, techScore: 88, errors: [], drills: ["Biela de Aço", "Acelerador de Moto"] }
    ];

    mockConfigs.forEach((cfg, idx) => {
        const id = "mock_workout_" + idx;
        const wDate = new Date(baseDate.getTime() - cfg.dayOffset * 24 * 60 * 60 * 1000);
        
        // Generate circular trackpoints in Florianópolis (Sambaqui/Santo Antônio)
        const trackpoints = [];
        const centerLat = -27.485;
        const centerLon = -48.538;
        const numPoints = 80;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const r = 0.015 + 0.003 * Math.sin(angle * 3); // realistic route curvature
            const lat = centerLat + r * Math.cos(angle);
            const lon = centerLon + r * Math.sin(angle);
            
            const ptTime = new Date(wDate.getTime() + i * 45 * 1000).toISOString();
            const accumDist = (i / numPoints) * cfg.dist;
            
            // Random fluctuations around stats
            const speed = cfg.avgSpeed + 1.2 * Math.sin(angle * 2) + (Math.random() - 0.5) * 0.4;
            const hr = cfg.avgHr + Math.round(5 * Math.sin(angle * 2.5) + (Math.random() - 0.5) * 3);
            const cadence = cfg.avgCad + Math.round(4 * Math.sin(angle * 4) + (Math.random() - 0.5) * 2);
            
            trackpoints.push({
                lat: lat,
                lon: lon,
                ele: 3.2,
                time: ptTime,
                dist: accumDist,
                speed: parseFloat(Math.min(cfg.maxSpeed, Math.max(2, speed)).toFixed(1)),
                hr: hr,
                cadence: cadence
            });
        }
        
        workouts.push({
            id: id,
            name: `Remada ${cfg.boat} Sambaqui`,
            date: wDate.toISOString().split("T")[0] + "T08:30:00Z",
            distance: cfg.dist,
            avgSpeed: cfg.avgSpeed,
            maxSpeed: cfg.maxSpeed,
            avgCadence: cfg.avgCad,
            avgHR: cfg.avgHr,
            duration: cfg.dist / (cfg.avgSpeed / 3.6),
            boatType: cfg.boat,
            boatWeight: cfg.boat === "V1" ? 13.5 : 16.0,
            trackpoints: trackpoints,
            filename: `simulated_${id}.gpx`
        });

        // Evaluations
        evaluations[id] = {
            workoutId: id,
            phase1: cfg.techScore > 80 ? 4.5 : (cfg.techScore > 60 ? 3.8 : 2.5),
            phase2: cfg.techScore > 80 ? 4.8 : (cfg.techScore > 60 ? 3.5 : 2.0),
            phase3: cfg.techScore > 80 ? 4.2 : (cfg.techScore > 60 ? 3.7 : 3.0),
            phase4: cfg.techScore > 80 ? 4.5 : (cfg.techScore > 60 ? 4.0 : 3.5),
            comments: cfg.errors.length > 0 
                ? `Foco em corrigir: ${cfg.errors.join(", ")}. Drills indicados: ${cfg.drills.join(", ")}.` 
                : "Excelente consistência técnica geral. Manter padrão atual e aumentar cadência gradualmente.",
            errors: cfg.errors,
            drills: cfg.drills
        };
    });

    saveToLocalStorage();
}

// Save lists to LocalStorage
function saveToLocalStorage() {
    localStorage.setItem("vaa_workouts", JSON.stringify(workouts));
    localStorage.setItem("vaa_evaluations", JSON.stringify(evaluations));
}

// Consolidated Garmin database parser loader
function loadLocalData() {
    if (!window.dadosRemadaLocais) return;
    
    let hasChanged = false;
    
    // Import Backup profile & logs
    if (window.dadosRemadaLocais.latestBackup) {
        const backup = window.dadosRemadaLocais.latestBackup;
        if (backup.profile) {
            athleteProfile = backup.profile;
            localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
            hasChanged = true;
        }
        if (backup.evaluations) {
            Object.entries(backup.evaluations).forEach(([wId, ev]) => {
                evaluations[wId] = ev;
                hasChanged = true;
            });
        }
        if (backup.workouts) {
            backup.workouts.forEach(bw => {
                const index = workouts.findIndex(w => w.id === bw.id);
                if (index === -1) {
                    workouts.push(bw);
                    hasChanged = true;
                } else {
                    workouts[index] = bw;
                    hasChanged = true;
                }
            });
        }
    }
    
    // Parse GPX files
    if (window.dadosRemadaLocais.gpxFiles) {
        Object.entries(window.dadosRemadaLocais.gpxFiles).forEach(([filename, xmlText]) => {
            const existsByFilename = workouts.some(w => w.filename === filename);
            if (existsByFilename) return;
            
            try {
                const workout = parseGarminFile(xmlText, filename);
                if (workout) {
                    const existsById = workouts.some(w => w.id === workout.id);
                    if (!existsById) {
                        workouts.push(workout);
                        hasChanged = true;
                    }
                }
            } catch (err) {
                console.error(`Erro ao parsear arquivo local ${filename}:`, err);
            }
        });
    }
    
    if (hasChanged) {
        workouts.sort((a,b) => new Date(b.date) - new Date(a.date));
        saveToLocalStorage();
    }
}

// Parse single Garmin GPX file content
function parseGarminFile(xmlText, fileName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    if (xmlDoc.getElementsByTagNameNS("*", "parsererror").length > 0) return null;

    const trackpoints = [];
    let startTimestamp = null;
    let distanceValue = 0;
    let hrSum = 0, hrCount = 0, maxHR = 0;
    let cadSum = 0, cadCount = 0;
    let lastTime = null;

    const trkpts = xmlDoc.getElementsByTagNameNS("*", "trkpt");
    if (trkpts.length === 0) return null;

    for (let i = 0; i < trkpts.length; i++) {
        const pt = trkpts[i];
        const lat = parseFloat(pt.getAttribute("lat"));
        const lon = parseFloat(pt.getAttribute("lon"));
        if (isNaN(lat) || isNaN(lon)) continue;

        const eleNode = pt.getElementsByTagNameNS("*", "ele")[0];
        const ele = eleNode ? parseFloat(eleNode.textContent) : 0;
        
        const timeNode = pt.getElementsByTagNameNS("*", "time")[0];
        const time = timeNode ? timeNode.textContent : "";
        if (!time || isNaN(new Date(time).getTime())) continue;

        if (startTimestamp === null) startTimestamp = time;

        let hr = null;
        let cadence = null;
        
        const hrNodes = pt.getElementsByTagNameNS("*", "hr");
        if (hrNodes.length > 0) hr = parseInt(hrNodes[0].textContent);

        const cadNodes = pt.getElementsByTagNameNS("*", "cad");
        if (cadNodes.length > 0) {
            cadence = parseInt(cadNodes[0].textContent);
        } else {
            const cadenceNodes = pt.getElementsByTagNameNS("*", "cadence");
            if (cadenceNodes.length > 0) cadence = parseInt(cadenceNodes[0].textContent);
        }

        if (hr && !isNaN(hr)) {
            hrSum += hr;
            hrCount++;
            if (hr > maxHR) maxHR = hr;
        }
        if (cadence && !isNaN(cadence)) {
            cadSum += cadence;
            cadCount++;
        }

        if (trackpoints.length > 0) {
            const prevPt = trackpoints[trackpoints.length - 1];
            distanceValue += haversineDistance(prevPt.lat, prevPt.lon, lat, lon);
        }

        let speed = 0;
        if (trackpoints.length > 0 && lastTime) {
            const seconds = (new Date(time) - new Date(lastTime)) / 1000;
            if (seconds > 0) {
                const distDiff = (distanceValue - trackpoints[trackpoints.length - 1].dist) * 1000;
                speed = (distDiff / seconds) * 3.6;
                if (speed > 25) speed = trackpoints[trackpoints.length - 1].speed;
            }
        }

        trackpoints.push({
            lat: lat,
            lon: lon,
            ele: ele,
            time: time,
            dist: distanceValue,
            speed: parseFloat(speed.toFixed(2)),
            hr: hr,
            cadence: cadence
        });
        lastTime = time;
    }

    const avgSpeedVal = distanceValue / (((new Date(lastTime) - new Date(startTimestamp)) / 1000) / 3600);

    // Generate unique ID based on date
    const workoutId = "gpx_" + new Date(startTimestamp).getTime();
    
    return {
        id: workoutId,
        name: fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        date: startTimestamp,
        distance: parseFloat(distanceValue.toFixed(2)),
        avgSpeed: parseFloat(avgSpeedVal.toFixed(2)) || 8.0,
        maxSpeed: parseFloat(Math.max(...trackpoints.map(p => p.speed)).toFixed(2)) || 11.0,
        avgCadence: cadCount > 0 ? Math.round(cadSum / cadCount) : 60,
        avgHR: hrCount > 0 ? Math.round(hrSum / hrCount) : 0,
        duration: (new Date(lastTime) - new Date(startTimestamp)) / 1000,
        boatType: fileName.toLowerCase().includes("v1") ? "V1" : "OC1",
        boatWeight: fileName.toLowerCase().includes("v1") ? 13.5 : 16.0,
        trackpoints: trackpoints,
        filename: fileName
    };
}

// Distance Haversine
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Update Topbar and Profile Form UI values
function updateProfileUI() {
    if (!athleteProfile) return;
    
    // Header Avatar update
    const headerProfileImg = document.getElementById("header-profile-img");
    const headerProfileFallback = document.getElementById("header-profile-fallback");
    if (athleteProfile.photo) {
        if (headerProfileImg) {
            headerProfileImg.src = athleteProfile.photo;
            headerProfileImg.style.display = "block";
        }
        if (headerProfileFallback) headerProfileFallback.style.display = "none";
    } else {
        if (headerProfileImg) headerProfileImg.style.display = "none";
        if (headerProfileFallback) headerProfileFallback.style.display = "block";
    }

    // Populate profile edit form fields
    const fields = {
        "edit-athlete-name": athleteProfile.name,
        "edit-athlete-weight": athleteProfile.weight,
        "edit-athlete-height": athleteProfile.height,
        "edit-athlete-age": athleteProfile.age,
        "edit-athlete-since": athleteProfile.since,
        "edit-athlete-watch": athleteProfile.watch,
        "edit-athlete-paddle": athleteProfile.paddle,
        "edit-goal-target": athleteProfile.goal ? athleteProfile.goal.target : 30
    };

    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });

    updateGoalProgress();
}

// Calculate and update the dynamic goals
function updateGoalProgress() {
    if (!athleteProfile) return;
    
    const target = athleteProfile.goal ? athleteProfile.goal.target : 30;
    
    // Filter workouts inside current week
    const now = new Date();
    const currentWeekWorkouts = workouts.filter(w => {
        const wDate = new Date(w.date);
        const diffTime = Math.abs(now - wDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7; // simplified weekly check
    });

    const totalDist = currentWeekWorkouts.reduce((sum, w) => sum + w.distance, 0);
    const totalDuration = currentWeekWorkouts.reduce((sum, w) => sum + w.duration, 0);
    
    const percent = Math.min(100, Math.round((totalDist / target) * 100));
    
    const progressBar = document.getElementById("goal-progress-bar");
    const progressPercent = document.getElementById("goal-progress-percent");
    const progressStatus = document.getElementById("goal-progress-status");

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressPercent) progressPercent.innerText = `${percent}%`;
    
    if (progressStatus) {
        if (percent >= 100) {
            progressStatus.innerHTML = `<span style="color:var(--green-correct)">★ Meta de ${target} km atingida! Parabéns!</span>`;
        } else {
            progressStatus.innerText = `${totalDist.toFixed(1)} km de ${target} km acumulados nesta semana`;
        }
    }

    // Update Dashboard Grid items
    const elDist = document.getElementById("dash-weekly-dist");
    const elSpeed = document.getElementById("dash-weekly-speed");
    const elCadence = document.getElementById("dash-weekly-cadence");
    const elCount = document.getElementById("dash-weekly-count");
    const elTime = document.getElementById("dash-weekly-time");

    if (elDist) elDist.innerText = `${totalDist.toFixed(1)} km`;
    if (elCount) elCount.innerText = currentWeekWorkouts.length;
    
    if (currentWeekWorkouts.length > 0) {
        const avgSpd = currentWeekWorkouts.reduce((sum, w) => sum + w.avgSpeed, 0) / currentWeekWorkouts.length;
        const avgCad = currentWeekWorkouts.reduce((sum, w) => sum + w.avgCadence, 0) / currentWeekWorkouts.length;
        if (elSpeed) elSpeed.innerText = `${avgSpd.toFixed(1)} km/h`;
        if (elCadence) elCadence.innerText = `${Math.round(avgCad)} ppm`;
    } else {
        if (elSpeed) elSpeed.innerText = `0.0 km/h`;
        if (elCadence) elCadence.innerText = `0 ppm`;
    }

    // Time calculations
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    if (elTime) elTime.innerText = `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

// Render base dashboard metrics
function renderDashboard() {
    updateGoalProgress();
    
    const container = document.getElementById("recent-workouts-list");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Sort and grab 3 most recent workouts
    const recent = [...workouts].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    
    if (recent.length === 0) {
        container.innerHTML = `<div class="no-data-placeholder">Nenhum treino cadastrado.</div>`;
        return;
    }

    recent.forEach(w => {
        const wDate = new Date(w.date);
        const dateStr = wDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
        const timeStr = wDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        
        const card = document.createElement("div");
        card.className = "workout-item";
        card.onclick = () => {
            // Navigate to workouts tab and select this workout
            openTab("tab-workouts");
            showWorkoutDetail(w.id);
        };

        card.innerHTML = `
            <div class="workout-item-left">
                <span class="workout-item-title">${w.name}</span>
                <span class="workout-item-meta">${dateStr} às ${timeStr} • ${w.boatType}</span>
            </div>
            <div class="workout-item-right">
                <span class="workout-item-dist">${w.distance.toFixed(1)} km</span>
                <span class="workout-item-speed">${w.avgSpeed.toFixed(1)} km/h</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Open specific section tab
function openTab(tabId) {
    // Remove active state from navigation bar buttons
    document.querySelectorAll(".tab-item").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Hide all panels and display requested one
    document.querySelectorAll(".tab-content").forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add("active");
        } else {
            pane.classList.remove("active");
        }
    });

    // Reset detailed view to list view inside workouts tab
    if (tabId === "tab-workouts") {
        document.getElementById("workout-list-view").classList.add("active");
        document.getElementById("workout-detail-view").classList.remove("active");
        renderWorkoutList();
    }

    // Refresh charts if needed
    if (tabId === "tab-dashboard") {
        renderDashboard();
    } else if (tabId === "tab-referencial") {
        setTimeout(renderReferencialTab, 50);
    } else if (tabId === "tab-thibaux") {
        setTimeout(renderThibauxTab, 50);
    } else if (tabId === "tab-gamification") {
        if (typeof initGamification === "function") {
            setTimeout(initGamification, 50);
        }
    }
}

// Render List of Workouts inside Remadas panel
function renderWorkoutList() {
    const container = document.getElementById("workout-select-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (workouts.length === 0) {
        container.innerHTML = `<div class="no-data-placeholder">Nenhum treino Garmin carregado. Envie um arquivo GPX/TCX.</div>`;
        return;
    }

    // Sort workouts chronologically
    const sorted = [...workouts].sort((a,b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(w => {
        const wDate = new Date(w.date);
        const dateStr = wDate.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
        
        const card = document.createElement("div");
        card.className = "workout-item";
        card.style.marginBottom = "10px";
        card.onclick = () => showWorkoutDetail(w.id);

        card.innerHTML = `
            <div class="workout-item-left">
                <span class="workout-item-title">${w.name}</span>
                <span class="workout-item-meta">${dateStr} • ${w.boatType} (${w.boatWeight}kg)</span>
            </div>
            <div class="workout-item-right">
                <span class="workout-item-dist">${w.distance.toFixed(1)} km</span>
                <span class="workout-item-speed">${w.avgSpeed.toFixed(1)} km/h</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Show specific Workout detail View inside Remadas panel
function showWorkoutDetail(workoutId) {
    const w = workouts.find(x => x.id === workoutId);
    if (!w) return;

    // Toggle views
    document.getElementById("workout-list-view").classList.remove("active");
    document.getElementById("workout-detail-view").classList.add("active");

    // Populate metadata
    document.getElementById("workout-detail-name").innerText = w.name;
    
    const wDate = new Date(w.date);
    document.getElementById("workout-detail-date").innerText = wDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
    document.getElementById("workout-detail-dist").innerText = `${w.distance.toFixed(1)} km`;
    
    const hours = Math.floor(w.duration / 3600);
    const minutes = Math.floor((w.duration % 3600) / 60);
    const secs = Math.floor(w.duration % 60);
    const timeStr = hours > 0 
        ? `${hours}h ${minutes}m ${secs}s` 
        : `${minutes}m ${secs}s`;
    document.getElementById("workout-detail-duration").innerText = timeStr;

    // Numerical stats
    document.getElementById("workout-detail-avg-speed").innerHTML = `${w.avgSpeed.toFixed(1)} <span class="unit">km/h</span>`;
    document.getElementById("workout-detail-max-speed").innerHTML = `${w.maxSpeed.toFixed(1)} <span class="unit">km/h</span>`;
    document.getElementById("workout-detail-avg-cadence").innerHTML = `${w.avgCadence} <span class="unit">ppm</span>`;
    document.getElementById("workout-detail-avg-hr").innerHTML = w.avgHR > 0 ? `${w.avgHR} <span class="unit">bpm</span>` : `-`;

    // Technical Evaluation
    const evalData = evaluations[workoutId] || { phase1: 0, phase2: 0, phase3: 0, phase4: 0, comments: "Sem avaliação gravada para este treino.", errors: [] };
    
    document.getElementById("eval-score-p1").innerText = evalData.phase1 > 0 ? `${evalData.phase1.toFixed(1)} / 5.0` : "-";
    document.getElementById("eval-score-p2").innerText = evalData.phase2 > 0 ? `${evalData.phase2.toFixed(1)} / 5.0` : "-";
    document.getElementById("eval-score-p3").innerText = evalData.phase3 > 0 ? `${evalData.phase3.toFixed(1)} / 5.0` : "-";
    document.getElementById("eval-score-p4").innerText = evalData.phase4 > 0 ? `${evalData.phase4.toFixed(1)} / 5.0` : "-";
    document.getElementById("eval-comments").innerText = evalData.comments;

    // Badge status score average
    const avgScore = (evalData.phase1 + evalData.phase2 + evalData.phase3 + evalData.phase4) / 4;
    const badge = document.getElementById("eval-status-badge");
    if (badge) {
        badge.className = "eval-badge";
        if (avgScore >= 4.2) {
            badge.innerText = "Excelente";
            badge.classList.add("excelente");
        } else if (avgScore >= 3.5) {
            badge.innerText = "Bom";
            badge.classList.add("bom");
        } else if (avgScore >= 2.5) {
            badge.innerText = "Regular";
            badge.classList.add("regular");
        } else {
            badge.innerText = "Atenção";
            badge.classList.add("atencao");
        }
    }

    // Leaflet map drawing
    setTimeout(() => {
        initLeafletMap(w);
        renderWorkoutCharts(w);
    }, 100);
}

// Leaflet Map Initialization
function initLeafletMap(workout) {
    if (!workout.trackpoints || workout.trackpoints.length === 0) return;

    const coords = workout.trackpoints.map(p => [p.lat, p.lon]);

    // Clear old map instance
    if (activeMap) {
        activeMap.remove();
        activeMap = null;
    }

    // Recreate map container
    activeMap = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(coords[0], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
    }).addTo(activeMap);

    // Draw route line
    mapPolyline = L.polyline(coords, {
        color: '#ff003c',
        weight: 3,
        opacity: 0.85
    }).addTo(activeMap);

    activeMap.fitBounds(mapPolyline.getBounds(), { padding: [15, 15] });

    // Custom circle markers for Start, End and Max Speed
    const startIcon = L.divIcon({ className: 'map-marker-start', html: '🏁', iconSize: [20, 20] });
    L.marker(coords[0], { icon: startIcon }).addTo(activeMap);

    const endIcon = L.divIcon({ className: 'map-marker-end', html: '🛑', iconSize: [20, 20] });
    L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(activeMap);
    
    // Force sizing update
    activeMap.invalidateSize();
}

// Render Charts
function renderWorkoutCharts(workout) {
    const tps = workout.trackpoints || [];
    if (tps.length === 0) return;

    const labels = tps.map((_, i) => i);
    const speedData = tps.map(p => p.speed);
    const cadenceData = tps.map(p => p.cadence || 0);
    const hrData = tps.map(p => p.hr || 0);

    // Destroy old charts
    if (chartSpeed) chartSpeed.destroy();
    if (chartCadence) chartCadence.destroy();
    if (chartHR) chartHR.destroy();

    // Chart.js default options
    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false },
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a0aec0', font: { size: 10 } } }
        }
    };

    // Speed chart
    const ctxSpeed = document.getElementById("chart-detail-speed");
    if (ctxSpeed) {
        chartSpeed = new Chart(ctxSpeed, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: speedData,
                    borderColor: '#00b4d8',
                    backgroundColor: 'rgba(0, 180, 216, 0.1)',
                    fill: true,
                    borderWidth: 1.5,
                    pointRadius: 0
                }]
            },
            options: defaultOptions
        });
    }

    // Cadence chart
    const ctxCadence = document.getElementById("chart-detail-cadence");
    if (ctxCadence) {
        chartCadence = new Chart(ctxCadence, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: cadenceData,
                    borderColor: '#ffb703',
                    backgroundColor: 'rgba(255, 183, 3, 0.1)',
                    fill: true,
                    borderWidth: 1.5,
                    pointRadius: 0
                }]
            },
            options: defaultOptions
        });
    }

    // HR chart
    const ctxHR = document.getElementById("chart-detail-hr");
    if (ctxHR) {
        chartHR = new Chart(ctxHR, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: hrData,
                    borderColor: '#ff003c',
                    backgroundColor: 'rgba(255, 0, 60, 0.1)',
                    fill: true,
                    borderWidth: 1.5,
                    pointRadius: 0
                }]
            },
            options: defaultOptions
        });
    }
}

// Render comparative radar chart in Técnica tab
function initRadarChart() {
    const ctx = document.getElementById("chart-referencial-radar");
    if (!ctx) return;

    const data = {
        labels: [
            "Trava (Catch)", 
            "Verticalidade", 
            "Biela Rígida", 
            "Uso do Ombro", 
            "Rotação Torácica", 
            "Bloqueio Quadril", 
            "Pitch Progressivo", 
            "Glide (Deslize)"
        ],
        datasets: [
            {
                label: "Método Drill",
                data: [4.8, 4.5, 5.0, 4.2, 4.5, 5.0, 4.8, 4.2],
                borderColor: '#ff003c',
                backgroundColor: 'rgba(255, 0, 60, 0.05)',
                borderWidth: 2,
                pointRadius: 2
            },
            {
                label: "David Tepava",
                data: [4.7, 4.8, 3.8, 5.0, 4.7, 3.5, 3.5, 4.8],
                borderColor: '#ffb703',
                backgroundColor: 'rgba(255, 183, 3, 0.05)',
                borderWidth: 2,
                pointRadius: 2
            },
            {
                label: "Travis Grant",
                data: [4.9, 4.0, 3.5, 4.8, 4.5, 4.0, 3.0, 3.0],
                borderColor: '#06d6a0',
                backgroundColor: 'rgba(6, 214, 160, 0.05)',
                borderWidth: 2,
                pointRadius: 2
            },
            {
                label: "John Puakea",
                data: [4.8, 4.5, 4.8, 4.5, 4.8, 4.0, 3.5, 4.5],
                borderColor: '#00b4d8',
                backgroundColor: 'rgba(0, 180, 216, 0.05)',
                borderWidth: 2,
                pointRadius: 2
            },
            {
                label: "Raphael Thibaux",
                data: [4.2, 4.3, 4.0, 4.0, 4.2, 3.8, 3.8, 5.0],
                borderColor: '#9d4edd',
                backgroundColor: 'rgba(157, 78, 221, 0.05)',
                borderWidth: 2,
                pointRadius: 2
            }
        ]
    };

    chartRadar = new Chart(ctx, {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#a0aec0', font: { size: 9, weight: 'bold' } },
                    ticks: { display: false },
                    min: 0,
                    max: 5
                }
            }
        }
    });
}

function renderReferencialTab() {
    if (chartRadar) chartRadar.update();
}

function toggleLegendDataset(index) {
    if (!chartRadar) return;
    const meta = chartRadar.getDatasetMeta(index);
    const checkbox = document.getElementById(`toggle-ds-${index}`);
    
    meta.hidden = meta.hidden === null ? !chartRadar.data.datasets[index].hidden : null;
    if (checkbox) checkbox.checked = !meta.hidden;
    chartRadar.update();
}

// Collapsible accordion triggers for Técnica tab
function toggleTechnique(header) {
    const card = header.closest(".ref-technique-card");
    const isCollapsed = card.classList.contains("collapsed");
    
    if (isCollapsed) {
        card.classList.remove("collapsed");
    } else {
        card.classList.add("collapsed");
    }
}

function expandAllTechniques() {
    document.querySelectorAll(".ref-technique-card").forEach(c => c.classList.remove("collapsed"));
}

function collapseAllTechniques() {
    document.querySelectorAll(".ref-technique-card").forEach(c => c.classList.add("collapsed"));
}

// Collapsible accordion triggers for Simulador tab
function toggleSimAccordion(header) {
    const card = header.closest(".sim-accordion-card");
    const content = card.querySelector(".sim-accordion-content");
    const isActive = content.classList.contains("active");

    if (isActive) {
        content.classList.remove("active");
        card.classList.add("collapsed");
    } else {
        content.classList.add("active");
        card.classList.remove("collapsed");
    }
}

// Populate Simulator widgets
function renderThibauxTab() {
    // Prefill parameters from profile
    const inputWeight = document.getElementById("slider-sim-ath-weight");
    const inputHeight = document.getElementById("slider-sim-ath-height");
    
    if (athleteProfile) {
        if (inputWeight) inputWeight.value = athleteProfile.weight || 78;
        if (inputHeight) inputHeight.value = athleteProfile.height || 1.80;
    }

    // Populate weather dropdown with workouts
    const selectWeather = document.getElementById("sim-weather-select");
    if (selectWeather) {
        selectWeather.innerHTML = `<option value="" selected>Clima Manual (Sem Treino)</option>`;
        workouts.forEach(w => {
            const wDate = new Date(w.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
            const opt = document.createElement("option");
            opt.value = w.id;
            opt.innerText = `${wDate} - ${w.name}`;
            
            // Set dynamic attributes
            const evalD = evaluations[w.id] || { phase1: 3, phase2: 3, phase3: 3, phase4: 3 };
            opt.dataset.cadence = w.avgCadence;
            opt.dataset.p1 = evalD.phase1;
            opt.dataset.p2 = evalD.phase2;
            opt.dataset.p3 = evalD.phase3;
            opt.dataset.p4 = evalD.phase4;
            opt.dataset.boat = w.boatType;
            opt.dataset.boatW = w.boatWeight;
            
            selectWeather.appendChild(opt);
        });
    }

    updateUnifiedSimulation();
}

// Unified physics mathematical calculation engine
function updateUnifiedSimulation() {
    // Inputs
    const pitchAngle = parseInt(document.getElementById("slider-flow-angle").value);
    const pullPower = parseInt(document.getElementById("slider-flow-power").value);
    const rotAngle = parseInt(document.getElementById("slider-rot-angle").value);
    const hipLock = parseInt(document.getElementById("slider-hip-lock").value);
    const canoeType = document.getElementById("select-canoe-type").value;
    const canoeWeight = parseFloat(document.getElementById("slider-canoe-weight").value);
    const cadence = parseInt(document.getElementById("slider-calc-cadence").value);

    const athWeight = parseFloat(document.getElementById("slider-sim-ath-weight").value);
    const athHeight = parseFloat(document.getElementById("slider-sim-ath-height").value);
    const bladeArea = parseInt(document.getElementById("slider-sim-blade-area").value);
    const windDir = document.getElementById("select-wind-dir").value;
    const swellDir = document.getElementById("select-swell-dir").value;

    // Update texts labels
    document.getElementById("val-canoe-weight").innerText = `${canoeWeight.toFixed(1)} kg`;
    document.getElementById("val-calc-cadence").innerText = `${cadence} ppm`;
    document.getElementById("val-sim-ath-weight").innerText = `${athWeight} kg`;
    document.getElementById("val-sim-ath-height").innerText = `${athHeight.toFixed(2)} m`;
    document.getElementById("val-sim-blade-area").innerText = `${bladeArea} sq in`;
    document.getElementById("val-flow-angle").innerText = `${pitchAngle}°`;
    document.getElementById("val-flow-power").innerText = `${pullPower}%`;
    document.getElementById("val-rot-angle").innerText = `${rotAngle}°`;
    document.getElementById("val-hip-lock").innerText = `${hipLock}%`;

    // SVG Rotation top-down visual
    const torsoGroup = document.getElementById("sim-torso-group");
    const hipGroup = document.getElementById("sim-hip-group");
    if (torsoGroup) torsoGroup.setAttribute("transform", `rotate(${-rotAngle}, 150, 100)`);
    if (hipGroup) {
        const hipAngle = -rotAngle * (1 - hipLock / 100);
        hipGroup.setAttribute("transform", `rotate(${hipAngle}, 150, 100)`);
    }

    // Maths Calculations
    const expYears = Math.max(1, 2026 - (athleteProfile.since || 2022));
    const pBase = 120 + athWeight + (expYears * 4);
    
    // Reach and blade efficiency
    const fRot = 1.0 + Math.sin(rotAngle * Math.PI / 180) * 0.22;
    const strokeLength = athHeight * 0.82 * fRot;
    
    const radPitch = pitchAngle * Math.PI / 180;
    const bladeEfficiency = Math.cos(radPitch) * (1.0 - Math.abs(pitchAngle) / 100);
    
    const pRaw = pBase * (pullPower / 100) * (1.0 + (rotAngle / 90) * 0.2);
    const transEfficiency = 0.35 + (hipLock / 100) * 0.60;
    
    const fBladeArea = bladeArea / 95;
    const pEffective = pRaw * transEfficiency * bladeEfficiency * fBladeArea;

    // Torque
    const forceMultiplier = 1.0 + (rotAngle / 90) * 0.8;
    const force = 220 * forceMultiplier * (pullPower / 100);
    const leverArm = 0.35 + 0.15 * Math.sin(rotAngle * Math.PI / 180);
    const torque = force * leverArm * bladeEfficiency;

    // Drag and resistance
    const totalWeight = athWeight + canoeWeight;
    const cDrag = canoeType === "V1" ? 0.082 : 0.090;
    const kMass = 4.63 * (cDrag / 0.082) * Math.pow(totalWeight / 93, 1.15);

    // Weather factors (mock wind speed 15 km/h, wave 0.8m if active weather)
    let windSpeedVal = 15;
    let waveHeightVal = 0.8;
    
    let rWind = 0.02 * windSpeedVal;
    if (windDir === "favor") rWind = -0.015 * windSpeedVal;
    else if (windDir === "lateral") rWind = 0.008 * windSpeedVal;

    let rWave = 0.6 * waveHeightVal;
    if (swellDir === "favor") rWave = -0.45 * waveHeightVal;
    else if (swellDir === "lateral") rWave = 0.25 * waveHeightVal;

    const rEnv = rWind + rWave;
    const kTotal = Math.max(0.5, kMass + rEnv);

    // Cadence & active timing
    const tCycle = 60 / cadence;
    const tActive = 0.45;
    const tPassive = Math.max(0.05, tCycle - tActive);
    const dutyCycle = tActive / tCycle;
    const pEffectiveAvg = pEffective * dutyCycle;

    // Speed
    const vAvgMs = Math.max(0.5, Math.pow(Math.max(0.01, pEffectiveAvg) / Math.max(0.01, kTotal), 1/3));
    const speedResult = vAvgMs * 3.6;

    // Glide
    const gActive = vAvgMs * tActive;
    const gPassive = vAvgMs * tPassive;
    const glideTotal = gActive + gPassive;

    // Bind outputs to DOM
    document.getElementById("final-speed").innerHTML = `${speedResult.toFixed(1)} <span class="unit">km/h</span>`;
    document.getElementById("final-glide").innerHTML = `${glideTotal.toFixed(2)} <span class="unit">m</span>`;

    const fSpeedDesc = document.getElementById("final-speed-desc");
    const fGlideDesc = document.getElementById("final-glide-desc");

    if (fSpeedDesc) {
        fSpeedDesc.className = "badge-feedback";
        if (speedResult >= 10.0) {
            fSpeedDesc.innerText = "Elite";
            fSpeedDesc.classList.add("green");
        } else if (speedResult >= 8.2) {
            fSpeedDesc.innerText = "Cruzeiro";
            fSpeedDesc.classList.add("blue");
        } else {
            fSpeedDesc.innerText = "Técnico";
            fSpeedDesc.classList.add("orange");
        }
    }

    if (fGlideDesc) {
        fGlideDesc.className = "badge-feedback";
        if (glideTotal >= 2.5) {
            fGlideDesc.innerText = "Glide Top";
            fGlideDesc.classList.add("green");
        } else if (glideTotal >= 1.8) {
            fGlideDesc.innerText = "Glide Bom";
            fGlideDesc.classList.add("blue");
        } else {
            fGlideDesc.innerText = "Arrasto Alto";
            fGlideDesc.classList.add("orange");
        }
    }

    // Cards displays
    document.getElementById("res-torque-val").innerHTML = `${torque.toFixed(1)} <span class="unit">N.m</span>`;
    document.getElementById("res-power-raw").innerHTML = `${Math.round(pRaw)} <span class="unit">W</span>`;
    document.getElementById("res-torque-eff").innerText = `${Math.round(transEfficiency * 100)}%`;
    document.getElementById("res-power-eff").innerHTML = `${Math.round(pEffective)} <span class="unit">W</span>`;

    // Feedback
    const elFeedback = document.getElementById("torque-feedback");
    if (elFeedback) {
        let fb = "";
        if (rotAngle < 15) fb = "<strong>Rotação Baixa:</strong> Use mais as costas, não force apenas bíceps.";
        else if (hipLock < 40) fb = "<strong>Fuga de Força:</strong> Quadril frouxo desperdiça torque no banco.";
        else if (rotAngle >= 60 && hipLock >= 80) fb = "<strong>Sweet Spot Polinésio!</strong> Torque máximo transferido.";
        else fb = "<strong>Mecânica consistente.</strong> Bom uso da cadeia cinética.";
        elFeedback.innerHTML = fb;
    }

    // Maths Memory page
    document.getElementById("calc-ath-weight").innerText = athWeight;
    document.getElementById("calc-ath-height").innerText = athHeight.toFixed(2);
    document.getElementById("calc-ath-exp").innerText = expYears;
    document.getElementById("calc-pbase-val").innerText = pBase.toFixed(0);
    document.getElementById("calc-pbruta-val").innerText = `${pRaw.toFixed(0)}W (Rot: ${rotAngle}°)`;
    document.getElementById("calc-pitch-deg").innerText = pitchAngle;
    document.getElementById("calc-blade-eff").innerText = Math.round(bladeEfficiency * 100);
    document.getElementById("calc-hiplock-val").innerText = hipLock;
    document.getElementById("calc-trans-eff").innerText = Math.round(transEfficiency * 100);
    document.getElementById("calc-peff-val").innerText = `${pEffective.toFixed(0)}W (Ciclo: ${pEffectiveAvg.toFixed(0)}W)`;
    document.getElementById("calc-canoe-type").innerText = canoeType;
    document.getElementById("calc-canoe-weight-lbl").innerText = canoeWeight.toFixed(1);
    document.getElementById("calc-mtotal").innerText = totalWeight;
    document.getElementById("calc-rtotal-val").innerText = kMass.toFixed(2);
    document.getElementById("calc-renv-val").innerText = rEnv.toFixed(2);
    document.getElementById("calc-ktotal-val").innerText = kTotal.toFixed(2);
    document.getElementById("calc-speed-formula-val").innerText = `(${pEffectiveAvg.toFixed(0)}W / ${kTotal.toFixed(2)})^(1/3)`;
    document.getElementById("calc-speed-val").innerText = speedResult.toFixed(1);
    document.getElementById("calc-gactive-val").innerText = gActive.toFixed(2);
    document.getElementById("calc-gpassive-val").innerText = gPassive.toFixed(2);
    document.getElementById("calc-gtotal-val").innerText = glideTotal.toFixed(2);
}

// Save profile fields from mobile form
window.saveMobileProfile = function() {
    if (!athleteProfile) return;

    athleteProfile.name = document.getElementById("edit-athlete-name").value || "Remador";
    athleteProfile.weight = parseFloat(document.getElementById("edit-athlete-weight").value) || 78;
    athleteProfile.height = parseFloat(document.getElementById("edit-athlete-height").value) || 1.80;
    athleteProfile.age = parseInt(document.getElementById("edit-athlete-age").value) || 47;
    athleteProfile.since = parseInt(document.getElementById("edit-athlete-since").value) || 2022;
    athleteProfile.watch = document.getElementById("edit-athlete-watch").value || "Garmin";
    athleteProfile.paddle = document.getElementById("edit-athlete-paddle").value || "Remo";
    
    if (!athleteProfile.goal) athleteProfile.goal = {};
    athleteProfile.goal.target = parseFloat(document.getElementById("edit-goal-target").value) || 30;

    localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
    
    updateProfileUI();
    renderDashboard();
    
    // Display visual feedback alert
    alert("Perfil do atleta atualizado com sucesso!");
};

// UI Interactions
function setupEventListeners() {
    // Navigation items
    document.querySelectorAll(".tab-item").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.id === "tab-btn-more") {
                openBottomSheet();
            } else {
                const tabId = btn.getAttribute("data-tab");
                openTab(tabId);
            }
        });
    });

    // Back to workouts list view
    const backBtn = document.getElementById("btn-back-to-list");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            document.getElementById("workout-detail-view").classList.remove("active");
            document.getElementById("workout-list-view").classList.add("active");
        });
    }

    // Secondary items inside Bottom Sheet grid
    document.querySelectorAll(".sheet-item").forEach(item => {
        item.addEventListener("click", () => {
            const tabId = item.getAttribute("data-tab");
            closeBottomSheet();
            openTab(tabId);
        });
    });

    // Close bottom sheet on backdrop click
    const sheetOverlay = document.getElementById("bottom-sheet-overlay");
    if (sheetOverlay) {
        sheetOverlay.addEventListener("click", closeBottomSheet);
    }

    // Garmin Drop-zone click
    const dropZone = document.getElementById("drop-zone");
    if (dropZone) {
        dropZone.addEventListener("click", () => {
            document.getElementById("input-garmin-file").click();
        });
    }

    const fileInput = document.getElementById("input-garmin-file");
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            handleGarminUpload(e.target.files);
        });
    }

    // Simulator input sliders
    const simSliders = [
        "slider-canoe-weight", "slider-sim-ath-weight", "slider-sim-ath-height", "slider-sim-blade-area",
        "slider-calc-cadence", "slider-flow-angle", "slider-flow-power", "slider-rot-angle", "slider-hip-lock"
    ];
    simSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = updateUnifiedSimulation;
    });

    const simSelects = ["select-canoe-type", "select-wind-dir", "select-swell-dir"];
    simSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onchange = updateUnifiedSimulation;
    });

    // Simulator weather loader
    const selectWeather = document.getElementById("sim-weather-select");
    if (selectWeather) {
        selectWeather.addEventListener("change", () => {
            if (selectWeather.selectedIndex > 0) {
                const opt = selectWeather.options[selectWeather.selectedIndex];
                
                // Pre-fill sliders from workout GPX and evaluations
                document.getElementById("slider-calc-cadence").value = opt.dataset.cadence || 60;
                document.getElementById("select-canoe-type").value = opt.dataset.boat || "V1";
                document.getElementById("slider-canoe-weight").value = opt.dataset.boatW || 13.5;
                
                // Prefill technical evaluations
                const p1 = parseFloat(opt.dataset.p1) || 3.0;
                const p2 = parseFloat(opt.dataset.p2) || 3.0;
                const p3 = parseFloat(opt.dataset.p3) || 3.0;
                const p4 = parseFloat(opt.dataset.p4) || 3.0;
                
                // Map evaluation score back to slider ranges (force 100%, lock/rotation matched to scores)
                document.getElementById("slider-flow-power").value = 100;
                document.getElementById("slider-rot-angle").value = Math.round(p2 * 15); // max 75
                document.getElementById("slider-hip-lock").value = Math.round(p3 * 20); // max 100
                document.getElementById("slider-flow-angle").value = Math.round((5 - p1) * 3); // lower pitch offset is better
            }
            updateUnifiedSimulation();
        });
    }
}

// Bottom Sheet animations helper
function openBottomSheet() {
    const sheet = document.getElementById("bottom-sheet");
    const overlay = document.getElementById("bottom-sheet-overlay");
    if (sheet && overlay) {
        overlay.classList.add("active");
        sheet.classList.add("active");
    }
}

function closeBottomSheet() {
    const sheet = document.getElementById("bottom-sheet");
    const overlay = document.getElementById("bottom-sheet-overlay");
    if (sheet && overlay) {
        sheet.classList.remove("active");
        overlay.classList.remove("active");
    }
}

// Handle Garmin file uploads
function handleGarminUpload(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const xmlText = e.target.result;
        try {
            const workout = parseGarminFile(xmlText, file.name);
            if (workout) {
                workouts.push(workout);
                workouts.sort((a,b) => new Date(b.date) - new Date(a.date));
                saveToLocalStorage();
                alert(`Treino '${file.name}' importado com sucesso!`);
                renderDashboard();
            } else {
                alert("Erro ao ler dados do treino. Formato inválido.");
            }
        } catch (err) {
            console.error(err);
            alert("Falha ao analisar o arquivo Garmin.");
        }
    };
    reader.readAsText(file);
}
