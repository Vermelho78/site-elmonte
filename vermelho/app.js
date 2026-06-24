// Vaa Vermelho Dashboard - Core Logic

// Chave padrão da API World Tides (pode ser sobrescrita pela interface)
const DEFAULT_WORLDTIDES_KEY = "ec08afb8-eaef-4adb-8a83-f8313f86912f";

// Metadados das Técnicas de Referência
const TECHNIQUE_METADATA = {
    nula: {
        name: "Técnica Nula (Geral)",
        phases: [
            "Fase 1: Catch (Entrada)",
            "Fase 2: Puxada (Drive)",
            "Fase 3: Saída (Exit)",
            "Fase 4: Recuperação (Recovery)"
        ],
        isDrill: false
    },
    drill: {
        name: "Método Drill",
        phases: [
            "Fase 1: A Trava (Catch)",
            "Fase 2: Pivô do Núcleo (Power)",
            "Fase 3: Binário Progressivo (Pitch)",
            "Fase 4: Saída Limpa (Snap)"
        ],
        isDrill: true
    },
    tepava: {
        name: "Técnica Tepava",
        phases: [
            "Fase 1: Postura e Alinhamento",
            "Fase 2: Ombro como Motor",
            "Fase 3: Catch Profundo",
            "Fase 4: Leveza e Conexão"
        ],
        isDrill: false
    },
    travis: {
        name: "Técnica Travis Grant",
        phases: [
            "Fase 1: Engrenagem Corporal",
            "Fase 2: Lançamento do Machado",
            "Fase 3: Cadência Agressiva",
            "Fase 4: Saída Antecipada"
        ],
        isDrill: false
    },
    puakea: {
        name: "Técnica John Puakea",
        phases: [
            "Fase 1: Trava de Água",
            "Fase 2: Alavanca do Tronco",
            "Fase 3: Janela do Joelho",
            "Fase 4: Saída sem Freio"
        ],
        isDrill: false
    },
    thibaux: {
        name: "Técnica Raphael Thibaux",
        phases: [
            "Fase 1: Feel the Flow",
            "Fase 2: O Glide Sagrado",
            "Fase 3: Respiração Sincronizada",
            "Fase 4: Calma e Intenção"
        ],
        isDrill: false
    }
};

const DRILL_ERRORS = [
    { value: "Falsa Trava na Entrada", label: "Falsa Trava (entrada batendo/plana)" },
    { value: "Colapso da Biela", label: "Colapso da Biela (dobrar braço inferior)" },
    { value: "Rotação de Quadril em Bloco", label: "Girar Quadril (falta tensão oblíquos)" },
    { value: "Binário Brusco/Tardio", label: "Binário Brusco ou Tardio" },
    { value: "Saída com Levantamento de Água", label: "Saída com Levantamento de Água" }
];

const DRILL_DRILLS = [
    { value: "Catch e Congela", label: "Drill 'Catch e Congela' (Fase 1)" },
    { value: "Biela de Aço", label: "Drill 'Biela de Aço' (Fase 2)" },
    { value: "Acelerador de Moto", label: "Drill 'Acelerador de Moto' (Fase 3)" },
    { value: "A Espada na Bainha", label: "Drill 'A Espada na Bainha' (Fase 4)" },
    { value: "Escada de Cadência", label: "Drill 'Escada de Cadência' (Integração)" }
];

const GENERAL_ERRORS = [
    { value: "Entrada Lenta / Atrasada", label: "Entrada Lenta / Atrasada (perda de curso)" },
    { value: "Puxada Curta / Sem Core", label: "Puxada Curta (remar só com braço)" },
    { value: "Saída com Arrasto / Freio", label: "Saída com Arrasto / Freio (remo na água)" },
    { value: "Oscilação Lateral Excessiva", label: "Oscilação Lateral Excessiva (desvio de rumo)" },
    { value: "Falta de Glide / Deslize", label: "Falta de Glide / Deslize (ritmo apressado)" }
];

const GENERAL_DRILLS = [
    { value: "Pausa no Catch", label: "Drill 'Pausa no Catch' (Foco no mergulho)" },
    { value: "Olho no Horizonte", label: "Drill 'Olho no Horizonte' (Foco na postura)" },
    { value: "Remada sem Mãos", label: "Drill 'Remada sem Mãos' (Foco no core)" },
    { value: "Fatia da Lâmina", label: "Drill 'Fatia da Lâmina' (Foco na saída limpa)" },
    { value: "Pirâmide de Frequência", label: "Drill 'Pirâmide de Frequência' (Foco no ritmo)" }
];

// Estado global da aplicação
let workouts = [];
let evaluations = {};
let activeWorkoutId = null;
let athleteProfile = null;

// Referências de instâncias de gráficos e mapas
let mapInstance = null;
let mapLayers = [];
let chartSpeedEvolution = null;
let chartCorrelation = null;
let chartErrorsFrequency = null;
let chartDetailSpeed = null;
let chartDetailCadence = null;
let chartDetailHR = null;

// Inicialização da Página
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
    // Processa os dados locais compilados
    loadLocalData();
    updateProfileUI();
    renderDashboard();
});

// Inicializa o app e carrega dados
function initApp() {
    // Carrega do LocalStorage ou inicia com Mock Data se vazio
    const storedWorkouts = localStorage.getItem("vaa_workouts");
    const storedEvals = localStorage.getItem("vaa_evaluations");

    // Inicializa o Perfil do Atleta
    const storedProfile = localStorage.getItem("vaa_athlete_profile");
    if (storedProfile) {
        athleteProfile = JSON.parse(storedProfile);
        // Migração forçada para meta de quilometragem semanal
        if (athleteProfile.goal) {
            athleteProfile.goal.type = "distance";
            athleteProfile.goal.baseline = 0;
            if (athleteProfile.goal.target === 11.0 || !athleteProfile.goal.target) {
                athleteProfile.goal.target = 30;
            }
        }
    } else {
        // Tenta buscar do backup do dados_remada.js se houver
        if (window.dadosRemadaLocais && window.dadosRemadaLocais.latestBackup && window.dadosRemadaLocais.latestBackup.profile) {
            athleteProfile = window.dadosRemadaLocais.latestBackup.profile;
        } else {
            // Inicializa com dados padrão
            athleteProfile = {
                name: "Remador",
                height: 1.80,
                weight: 78,
                age: 47,
                since: 2022,
                watch: "Garmin 165 Music",
                paddle: "Remo Crespo C118",
                photo: "",
                goal: {
                    type: "distance",
                    baseline: 0,
                    target: 30
                }
            };
        }
    }
    if (athleteProfile) {
        if (!athleteProfile.goal) athleteProfile.goal = {};
        athleteProfile.goal.type = "distance";
        athleteProfile.goal.baseline = 0;
        if (!athleteProfile.goal.target) athleteProfile.goal.target = 30;
        localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
    }

    if (storedWorkouts && storedEvals) {
        workouts = JSON.parse(storedWorkouts);
        evaluations = JSON.parse(storedEvals);
    } else {
        // Se o LocalStorage estiver vazio, verifica se há dados reais compilados em dados_remada.js
        const hasLocalData = window.dadosRemadaLocais && 
            ((window.dadosRemadaLocais.latestBackup && window.dadosRemadaLocais.latestBackup.workouts && window.dadosRemadaLocais.latestBackup.workouts.length > 0) || 
             (window.dadosRemadaLocais.gpxFiles && Object.keys(window.dadosRemadaLocais.gpxFiles).length > 0));
             
        if (hasLocalData) {
            console.log("Dados locais reais detectados em dados_remada.js. Ignorando Mock Data.");
            workouts = [];
            evaluations = {};
        } else {
            console.log("Nenhum dado local real. Carregando treinos de demonstração.");
            generateMockData();
        }
    }

    // Carrega a chave API World Tides do LocalStorage (ou usa a padrão embutida)
    const savedKey = localStorage.getItem("vaa_worldtides_key");
    const effectiveKey = savedKey || DEFAULT_WORLDTIDES_KEY;
    const keyInput = document.getElementById("eval-worldtides-key");
    if (keyInput) {
        keyInput.value = effectiveKey;
        // Salva no localStorage se ainda não estava lá
        if (!savedKey) {
            localStorage.setItem("vaa_worldtides_key", DEFAULT_WORLDTIDES_KEY);
        }
    }
}

// Processa os dados estáticos injetados por dados_remada.js (amigável para file:///)
function loadLocalData() {
    if (!window.dadosRemadaLocais) {
        console.log("Nenhum dado local consolidado encontrado (dados_remada.js não carregado).");
        return;
    }
    
    console.log("Processando dados de dados_remada.js...");
    let hasChanged = false;
    let newWorkoutsCount = 0;
    
    // 1. Processar backup do usuário (avaliações e treinos manuais)
    if (window.dadosRemadaLocais.latestBackup) {
        const backup = window.dadosRemadaLocais.latestBackup;
        if (backup.profile) {
            athleteProfile = backup.profile;
            localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
            hasChanged = true;
        }
        if (backup.evaluations) {
            Object.entries(backup.evaluations).forEach(([wId, ev]) => {
                // Mescla ou atualiza avaliações
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
                    // Atualiza o treino com os dados do backup para manter consistência
                    workouts[index] = bw;
                    hasChanged = true;
                }
            });
        }
    }
    
    // 2. Processar arquivos GPX/TCX compilados da pasta registros
    if (window.dadosRemadaLocais.gpxFiles) {
        Object.entries(window.dadosRemadaLocais.gpxFiles).forEach(([filename, xmlText]) => {
            const extension = filename.split(".").pop().toLowerCase();
            
            // Verifica se o arquivo já foi importado por nome
            const existsByFilename = workouts.some(w => w.filename === filename);
            if (existsByFilename) {
                return;
            }
            
            try {
                const workout = parseGarminFile(xmlText, filename, extension);
                if (workout) {
                    const existsById = workouts.some(w => w.id === workout.id);
                    if (!existsById) {
                        workouts.push(workout);
                        console.log(`Treino local importado automaticamente: ${filename}`);
                        hasChanged = true;
                        newWorkoutsCount++;
                    }
                }
            } catch (err) {
                console.error(`Erro ao processar arquivo local ${filename}:`, err);
            }
        });
    }
    
    if (hasChanged) {
        workouts.sort((a,b) => new Date(b.date) - new Date(a.date));
        saveToLocalStorage();
        
        if (newWorkoutsCount > 0) {
            // Exibe um aviso visual na tela
            const banner = document.createElement("div");
            banner.className = "auto-import-banner";
            banner.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> ${newWorkoutsCount} novo(s) treino(s) carregado(s) de registros/ automaticamente!`;
            document.body.appendChild(banner);
            setTimeout(() => {
                banner.classList.add("fade-out");
                setTimeout(() => banner.remove(), 500);
            }, 4000);
        }
    }
}


// Cria dados simulados de alta fidelidade para o primeiro uso
function generateMockData() {
    workouts = [];
    evaluations = {};

    const baseCoords = { lat: -22.9556, lon: -43.1654 }; // Baía de Guanabara / Urca, Rio
    const numWorkouts = 6;
    const baseDate = new Date();
    
    // Configurações dos treinos de simulação (velocidade subindo gradualmente com a técnica)
    const mockConfigs = [
        { dayOffset: 15, boat: "OC1", dist: 10.2, avgSpeed: 8.8, maxSpeed: 10.5, avgCad: 58, avgHr: 142, techScore: 42, errors: ["Colapso da Biela", "Saída com Levantamento de Água"], drills: ["Catch e Congela"] },
        { dayOffset: 12, boat: "V1",  dist: 9.8,  avgSpeed: 9.0, maxSpeed: 10.8, avgCad: 60, avgHr: 145, techScore: 50, errors: ["Colapso da Biela", "Falsa Trava na Entrada"], drills: ["Biela de Aço"] },
        { dayOffset: 9,  boat: "OC1", dist: 10.5, avgSpeed: 9.2, maxSpeed: 11.0, avgCad: 61, avgHr: 147, techScore: 62, errors: ["Saída com Levantamento de Água"], drills: ["Biela de Aço", "A Espada na Bainha"] },
        { dayOffset: 6,  boat: "V1",  dist: 10.1, avgSpeed: 9.5, maxSpeed: 11.2, avgCad: 62, avgHr: 148, techScore: 70, errors: ["Binário Brusco/Tardio"], drills: ["Acelerador de Moto"] },
        { dayOffset: 3,  boat: "OC1", dist: 10.8, avgSpeed: 9.7, maxSpeed: 11.5, avgCad: 63, avgHr: 150, techScore: 78, errors: ["Falsa Trava na Entrada"], drills: ["Catch e Congela", "Biela de Aço"] },
        { dayOffset: 0,  boat: "V1",  dist: 10.0, avgSpeed: 10.1, maxSpeed: 12.0, avgCad: 64, avgHr: 152, techScore: 88, errors: [], drills: ["Biela de Aço", "Acelerador de Moto", "Escada de Cadência"] }
    ];

    mockConfigs.forEach((cfg, idx) => {
        const id = "mock_workout_" + idx;
        const wDate = new Date(baseDate.getTime() - cfg.dayOffset * 24 * 60 * 60 * 1000);
        
        // Gerar trackpoints simulando um circuito de 10km na Urca
        const points = [];
        const numPoints = 150;
        const speedNoise = 0.5;
        let elapsedSeconds = 0;
        let currentDist = 0;

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const r = 0.015 * (1 + 0.3 * Math.sin(angle * 2)); // Elipse distorcida
            const lat = baseCoords.lat + r * Math.sin(angle) + (Math.random() - 0.5) * 0.0001;
            const lon = baseCoords.lon + r * 1.5 * Math.cos(angle) + (Math.random() - 0.5) * 0.0001;
            
            // Fator de velocidade instantânea
            const factor = Math.sin(angle * 3) * 0.4 + 1.0;
            const speed = cfg.avgSpeed * factor + (Math.random() - 0.5) * speedNoise;
            
            elapsedSeconds += 20; // 20s entre pontos
            currentDist += (speed / 3.6) * 20 / 1000; // km

            const hr = cfg.avgHr + Math.sin(angle) * 10 + (Math.random() - 0.5) * 3;
            const cadence = cfg.avgCad + Math.cos(angle * 2) * 5 + (Math.random() - 0.5) * 2;

            points.push({
                lat: lat,
                lon: lon,
                ele: 0.0,
                time: new Date(wDate.getTime() + elapsedSeconds * 1000).toISOString(),
                dist: currentDist,
                speed: parseFloat(speed.toFixed(2)),
                hr: Math.round(hr),
                cadence: Math.round(cadence)
            });
        }

        const durationSeconds = elapsedSeconds;

        workouts.push({
            id: id,
            date: wDate.toISOString().split("T")[0],
            name: `Treino de Remada ${cfg.boat} - ${cfg.dist}km`,
            boat: cfg.boat,
            distance: cfg.dist,
            duration: durationSeconds,
            avgSpeed: cfg.avgSpeed,
            maxSpeed: cfg.maxSpeed,
            avgCadence: cfg.avgCad,
            avgHR: cfg.avgHr,
            trackpoints: points,
            hasEval: true
        });

        // Cria a autoavaliação correspondente
        evaluations[id] = {
            phase1: cfg.techScore + (Math.random() - 0.5) * 10,
            phase2: cfg.techScore + (Math.random() - 0.5) * 8,
            phase3: cfg.techScore + (Math.random() - 0.5) * 12,
            phase4: cfg.techScore + (Math.random() - 0.5) * 6,
            errors: cfg.errors,
            drills: cfg.drills,
            notes: `Simulado. Treino com sensação boa de glide. Foco principal nas fases e drills de remada.`
        };
    });

    saveToLocalStorage();
}

// Persiste dados no LocalStorage
function saveToLocalStorage() {
    localStorage.setItem("vaa_workouts", JSON.stringify(workouts));
    localStorage.setItem("vaa_evaluations", JSON.stringify(evaluations));
}

// Configura os ouvintes de eventos da interface
function setupEventListeners() {
    // Alternância de Abas da Sidebar
    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
            
            button.classList.add("active");
            const tabId = button.getAttribute("data-tab");
            document.getElementById(tabId).classList.add("active");

            // Recarregar gráficos ao abrir abas específicas
            if (tabId === "tab-dashboard") {
                renderDashboard();
            } else if (tabId === "tab-workouts") {
                renderWorkoutList();
            } else if (tabId === "tab-drills") {
                renderDrillsTab();
            } else if (tabId === "tab-planning") {
                renderPlanningTab();
            } else if (tabId === "tab-gamification") {
                if (typeof initGamification === "function") {
                    setTimeout(initGamification, 50);
                }
            } else if (tabId === "tab-referencial") {
                setTimeout(renderReferencialTab, 50);
            } else if (tabId === "tab-thibaux") {
                setTimeout(renderThibauxTab, 50);
            } else if (tabId === "tab-profile") {
                setTimeout(renderProfileTab, 50);
            }
        });
    });

    // Sub-abas de gráficos detalhados do treino
    document.querySelectorAll(".details-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".details-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".detail-chart-wrapper").forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const wrapperId = btn.getAttribute("data-detail-chart");
            document.getElementById(wrapperId).classList.add("active");
        });
    });

    // Zona de Drag and Drop para upload do Garmin
    const dropZone = document.getElementById("drop-zone");
    
    dropZone.addEventListener("click", () => {
        document.getElementById("input-garmin-file").click();
    });

    document.getElementById("input-garmin-file").addEventListener("change", (e) => {
        handleGarminFiles(e.target.files);
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    ["dragleave", "dragend"].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove("drag-over");
        });
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) {
            handleGarminFiles(e.dataTransfer.files);
        }
    });

    // (O botão de inserir dados demonstrativos foi removido para uso com dados reais)

    // Formulário de Autoavaliação
    document.getElementById("eval-workout-select").addEventListener("change", (e) => {
        loadEvaluationForm(e.target.value);
    });

    const techniqueSelect = document.getElementById("eval-technique-select");
    if (techniqueSelect) {
        techniqueSelect.addEventListener("change", (e) => {
            updateEvaluationLabels(e.target.value);
        });
    }

    document.getElementById("btn-save-evaluation").addEventListener("click", () => {
        saveEvaluation();
    });

    // Redirecionamento da avaliação de treino
    document.getElementById("btn-link-evaluation-redirect").addEventListener("click", () => {
        if (!activeWorkoutId) return;
        document.getElementById("btn-drills").click();
        document.getElementById("eval-workout-select").value = activeWorkoutId;
        loadEvaluationForm(activeWorkoutId);
    });

    // Excluir Treino
    document.getElementById("btn-delete-workout").addEventListener("click", () => {
        if (confirm("Tem certeza que deseja excluir permanentemente este treino e a avaliação associada?")) {
            deleteWorkout(activeWorkoutId);
        }
    });

    // Backup
    document.getElementById("btn-export-backup").addEventListener("click", () => {
        exportBackup();
    });

    document.getElementById("btn-trigger-import").addEventListener("click", () => {
        document.getElementById("input-import-backup").click();
    });

    document.getElementById("input-import-backup").addEventListener("change", (e) => {
        importBackup(e.target.files[0]);
    });

    // Buscar Clima Online Manualmente
    document.getElementById("btn-fetch-weather").addEventListener("click", () => {
        const workoutId = document.getElementById("eval-workout-select").value;
        if (!workoutId) {
            showToast("Selecione um treino primeiro para buscar as condições climáticas online!", "warning");
            return;
        }
        fetchOnlineWeatherForWorkout(workoutId, true);
    });

    // Salvar Chave API World Tides ao alterar
    document.getElementById("eval-worldtides-key").addEventListener("change", (e) => {
        localStorage.setItem("vaa_worldtides_key", e.target.value.trim());
        showToast("Chave API World Tides salva localmente!", "success");
    });

    // Eventos do Perfil
    const profilePhotoInput = document.getElementById("input-profile-photo");
    if (profilePhotoInput) {
        profilePhotoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 2 * 1024 * 1024) {
                    showToast("A imagem é muito grande! Escolha uma foto menor que 2MB.", "error");
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(evt) {
                    athleteProfile.photo = evt.target.result;
                    localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
                    updateProfileUI();
                    showToast("Foto de perfil atualizada!", "success");
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const saveProfileBtn = document.getElementById("btn-save-profile");
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", () => {
            saveAthleteProfile();
        });
    }
}

// ----------------------------------------------------
// ABA 1: DASHBOARD - RENDERIZAÇÃO E CÁLCULOS
// ----------------------------------------------------
function renderDashboard() {
    if (workouts.length === 0) {
        document.getElementById("dash-avg-speed").innerHTML = `0.0 <span class="unit">km/h</span>`;
        document.getElementById("dash-max-speed").innerHTML = `0.0 <span class="unit">km/h</span>`;
        document.getElementById("dash-total-distance").innerHTML = `0.0 <span class="unit">km</span>`;
        document.getElementById("dash-drill-score").innerHTML = `0 <span class="unit">%</span>`;
        const dashWeeklyTime = document.getElementById("dash-weekly-time");
        if (dashWeeklyTime) dashWeeklyTime.innerHTML = `0h 00m`;
        return;
    }

    // Cálculos globais
    let totalDist = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    
    // Separação por barco
    let oc1Count = 0, oc1Dist = 0, oc1SpeedSum = 0;
    let v1Count = 0, v1Dist = 0, v1SpeedSum = 0;

    workouts.forEach(w => {
        totalDist += w.distance;
        speedSum += w.avgSpeed;
        if (w.maxSpeed > maxSpeed) maxSpeed = w.maxSpeed;

        if (w.boat === "OC1") {
            oc1Count++;
            oc1Dist += w.distance;
            oc1SpeedSum += w.avgSpeed;
        } else if (w.boat === "V1") {
            v1Count++;
            v1Dist += w.distance;
            v1SpeedSum += w.avgSpeed;
        }
    });

    const globalAvgSpeed = speedSum / workouts.length;
    const oc1AvgSpeed = oc1Count > 0 ? (oc1SpeedSum / oc1Count) : 0;
    const v1AvgSpeed = v1Count > 0 ? (v1SpeedSum / v1Count) : 0;

    // Cálculo da média de pontuação do Drill (Média das 4 fases)
    let totalEvalScore = 0;
    let evalCount = 0;
    Object.values(evaluations).forEach(ev => {
        const score = (ev.phase1 + ev.phase2 + ev.phase3 + ev.phase4) / 4;
        totalEvalScore += score;
        evalCount++;
    });
    const avgDrillScore = evalCount > 0 ? (totalEvalScore / evalCount) : 0;

    // Renderiza nos cards do Dashboard
    document.getElementById("dash-avg-speed").innerHTML = `${globalAvgSpeed.toFixed(1)} <span class="unit">km/h</span>`;
    document.getElementById("dash-max-speed").innerHTML = `${maxSpeed.toFixed(1)} <span class="unit">km/h</span>`;
    document.getElementById("dash-total-distance").innerHTML = `${totalDist.toFixed(1)} <span class="unit">km</span>`;
    document.getElementById("dash-drill-score").innerHTML = `${Math.round(avgDrillScore)} <span class="unit">%</span>`;

    // Renderiza dados de barcos
    document.getElementById("oc1-count").innerText = `${oc1Count} ${oc1Count === 1 ? 'treino' : 'treinos'}`;
    document.getElementById("oc1-dist").innerText = `${oc1Dist.toFixed(1)} km`;
    document.getElementById("oc1-avg-speed").innerText = `${oc1AvgSpeed.toFixed(1)} km/h`;

    document.getElementById("v1-count").innerText = `${v1Count} ${v1Count === 1 ? 'treino' : 'treinos'}`;
    document.getElementById("v1-dist").innerText = `${v1Dist.toFixed(1)} km`;
    document.getElementById("v1-avg-speed").innerText = `${v1AvgSpeed.toFixed(1)} km/h`;

    // Progresso da Meta
    updateGoalProgress();
    renderWeeklyHistoryTable();

    // Renderiza Gráfico Histórico de Evolução de Velocidade
    renderSpeedEvolutionChart();
}

function renderSpeedEvolutionChart() {
    const canvas = document.getElementById("chart-speed-evolution");
    if (!canvas) return;

    if (chartSpeedEvolution) {
        chartSpeedEvolution.destroy();
    }

    // Ordena treinos por data
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedWorkouts.map(w => {
        const [year, month, day] = w.date.split("-");
        return `${day}/${month}`;
    });

    const oc1Speeds = sortedWorkouts.map(w => w.boat === "OC1" ? w.avgSpeed : null);
    const v1Speeds = sortedWorkouts.map(w => w.boat === "V1" ? w.avgSpeed : null);

    chartSpeedEvolution = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "OC1",
                    data: oc1Speeds,
                    borderColor: "#e63946",
                    backgroundColor: "rgba(230, 57, 70, 0.05)",
                    borderWidth: 2,
                    pointBackgroundColor: "#e63946",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    spanGaps: true,
                    tension: 0.2
                },
                {
                    label: "V1",
                    data: v1Speeds,
                    borderColor: "#9d4edd",
                    backgroundColor: "rgba(157, 78, 221, 0.05)",
                    borderWidth: 2,
                    pointBackgroundColor: "#9d4edd",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    spanGaps: true,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#ced4da", font: { family: "Outfit", weight: "500" } }
                },
                tooltip: {
                    callbacks: {
                        title: function(items) {
                            return items[0] ? `Data: ${items[0].label}` : '';
                        },
                        label: function(context) {
                            return `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(1)} km/h`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#ced4da" },
                    suggestedMin: 8.0,
                    suggestedMax: 12.0
                },
                x: {
                    grid: { display: false },
                    ticks: { color: "#ced4da" }
                }
            }
        }
    });
}

// ----------------------------------------------------
// ABA 2: HISTÓRICO & GARMIN (IMPORTADORES E LISTA)
// ----------------------------------------------------
function handleGarminFiles(files) {
    if (files.length === 0) return;
    
    let processedCount = 0;
    let completedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        const extension = file.name.split(".").pop().toLowerCase();
        
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                const workout = parseGarminFile(text, file.name, extension);
                if (workout) {
                    // Evita duplicatas com base no ID único de data/hora
                    const exists = workouts.some(w => w.id === workout.id);
                    if (!exists) {
                        workouts.push(workout);
                        processedCount++;
                    }
                }
            } catch (err) {
                console.error("Erro ao ler/processar arquivo " + file.name + ":", err);
            }

            completedCount++;
            if (completedCount === files.length) {
                if (processedCount > 0) {
                    workouts.sort((a,b) => new Date(b.date) - new Date(a.date));
                    saveToLocalStorage();
                    renderWorkoutList();
                    renderDashboard();
                    showToast(`${processedCount} treino(s) importado(s) com sucesso!`, "success");
                } else {
                    showToast("Nenhum treino novo importado. Verifique se os arquivos são válidos ou se já foram importados.", "warning");
                }
            }
        };
        
        reader.readAsText(file);
    }
}

// Parser XML para arquivos Garmin (GPX / TCX)
function parseGarminFile(xmlText, fileName, extension) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    if (xmlDoc.getElementsByTagNameNS("*", "parsererror").length > 0) {
        throw new Error("Erro de parser XML");
    }

    const trackpoints = [];
    let startTimestamp = null;
    let distanceValue = 0;
    let durationSeconds = 0;
    let hrSum = 0, hrCount = 0, maxHR = 0;
    let cadSum = 0, cadCount = 0;
    let lastTime = null;

    if (extension === "gpx") {
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
            
            const isValidTime = time && !isNaN(new Date(time).getTime());
            if (!isValidTime) continue;

            if (startTimestamp === null) startTimestamp = time;

            // Extrair Extensões (Heart Rate e Cadence)
            let hr = null;
            let cadence = null;
            
            // Frequência Cardíaca
            const hrNodes = pt.getElementsByTagNameNS("*", "hr");
            if (hrNodes.length > 0) {
                hr = parseInt(hrNodes[0].textContent);
            }

            // Cadência
            const cadNodes = pt.getElementsByTagNameNS("*", "cad");
            if (cadNodes.length > 0) {
                cadence = parseInt(cadNodes[0].textContent);
            } else {
                const cadenceNodes = pt.getElementsByTagNameNS("*", "cadence");
                if (cadenceNodes.length > 0) cadence = parseInt(cadenceNodes[0].textContent);
            }

            // Estatísticas
            if (hr && !isNaN(hr)) {
                hrSum += hr;
                hrCount++;
                if (hr > maxHR) maxHR = hr;
            }
            if (cadence && !isNaN(cadence)) {
                cadSum += cadence;
                cadCount++;
            }

            // Calcular Distância Acumulada
            let pointDist = 0;
            if (trackpoints.length > 0) {
                const prevPt = trackpoints[trackpoints.length - 1];
                const d = haversineDistance(prevPt.lat, prevPt.lon, lat, lon);
                distanceValue += d;
                pointDist = distanceValue;
            }

            // Calcula velocidade instantânea (m/s convertida para km/h)
            let speed = 0;
            if (trackpoints.length > 0 && lastTime) {
                const seconds = (new Date(time) - new Date(lastTime)) / 1000;
                if (seconds > 0) {
                    const distDiff = (distanceValue - trackpoints[trackpoints.length - 1].dist) * 1000; // metros
                    speed = (distDiff / seconds) * 3.6; // km/h
                    if (speed > 25) speed = trackpoints[trackpoints.length - 1].speed; // filtro de spike
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

        if (trackpoints.length > 0) {
            const first = new Date(trackpoints[0].time);
            const last = new Date(trackpoints[trackpoints.length - 1].time);
            durationSeconds = (last - first) / 1000;
        }

    } else if (extension === "tcx") {
        const pts = xmlDoc.getElementsByTagNameNS("*", "Trackpoint");
        if (pts.length === 0) return null;

        for (let i = 0; i < pts.length; i++) {
            const pt = pts[i];
            
            const pos = pt.getElementsByTagNameNS("*", "Position")[0];
            if (!pos) continue;
            
            const latNode = pos.getElementsByTagNameNS("*", "LatitudeDegrees")[0];
            const lonNode = pos.getElementsByTagNameNS("*", "LongitudeDegrees")[0];
            if (!latNode || !lonNode) continue;

            const lat = parseFloat(latNode.textContent);
            const lon = parseFloat(lonNode.textContent);
            
            if (isNaN(lat) || isNaN(lon)) continue;
            
            const eleNode = pt.getElementsByTagNameNS("*", "AltitudeMeters")[0];
            const ele = eleNode ? parseFloat(eleNode.textContent) : 0;
            
            const timeNode = pt.getElementsByTagNameNS("*", "Time")[0];
            const time = timeNode ? timeNode.textContent : "";
            
            const isValidTime = time && !isNaN(new Date(time).getTime());
            if (!isValidTime) continue;

            if (startTimestamp === null) startTimestamp = time;

            const distNode = pt.getElementsByTagNameNS("*", "DistanceMeters")[0];
            const dist = distNode ? (parseFloat(distNode.textContent) / 1000) : 0; // km
            
            // Frequência Cardíaca
            let hr = null;
            const hrNode = pt.getElementsByTagNameNS("*", "HeartRateBpm")[0];
            if (hrNode) {
                const valNode = hrNode.getElementsByTagNameNS("*", "Value")[0];
                if (valNode) {
                    hr = parseInt(valNode.textContent);
                }
            }

            // Cadência
            let cadence = null;
            const cadNode = pt.getElementsByTagNameNS("*", "Cadence")[0];
            if (cadNode) {
                cadence = parseInt(cadNode.textContent);
            }

            // Estatísticas
            if (hr && !isNaN(hr)) {
                hrSum += hr;
                hrCount++;
                if (hr > maxHR) maxHR = hr;
            }
            if (cadence && !isNaN(cadence)) {
                cadSum += cadence;
                cadCount++;
            }

            // Calcula velocidade
            let speed = 0;
            if (trackpoints.length > 0 && lastTime) {
                const seconds = (new Date(time) - new Date(lastTime)) / 1000;
                if (seconds > 0) {
                    const distDiff = (dist - distanceValue) * 1000; // metros
                    speed = (distDiff / seconds) * 3.6; // km/h
                    if (speed > 25) speed = trackpoints[trackpoints.length - 1].speed;
                }
            }
            distanceValue = dist;

            trackpoints.push({
                lat: lat,
                lon: lon,
                ele: ele,
                time: time,
                dist: dist,
                speed: parseFloat(speed.toFixed(2)),
                hr: hr,
                cadence: cadence
            });
            
            lastTime = time;
        }

        const durationNode = xmlDoc.getElementsByTagNameNS("*", "TotalTimeSeconds")[0];
        durationSeconds = durationNode ? parseFloat(durationNode.textContent) : 0;
    }

    if (trackpoints.length === 0) return null;

    // Calcula o tempo em movimento (moving time)
    let movingDurationSeconds = 0;
    for (let i = 0; i < trackpoints.length - 1; i++) {
        const pt1 = trackpoints[i];
        const pt2 = trackpoints[i + 1];
        const dt = (new Date(pt2.time) - new Date(pt1.time)) / 1000; // segundos
        if (dt > 0 && dt <= 20) {
            const segmentDist = pt2.dist - pt1.dist; // km
            const segmentSpeed = (segmentDist * 1000 / dt) * 3.6; // km/h
            if (segmentSpeed >= 1.5) {
                movingDurationSeconds += dt;
            }
        }
    }
    if (movingDurationSeconds === 0 && trackpoints.length > 0) {
        const first = new Date(trackpoints[0].time);
        const last = new Date(trackpoints[trackpoints.length - 1].time);
        movingDurationSeconds = (last - first) / 1000;
    }
    durationSeconds = movingDurationSeconds;

    // Dedução das médias finais
    const avgSpeed = durationSeconds > 0 ? (distanceValue / (durationSeconds / 3600)) : 9.0;
    const maxSpeedCalculated = trackpoints.reduce((max, pt) => pt.speed > max ? pt.speed : max, 0);

    // Identificação inteligente do barco com base no nome do arquivo ou padrão
    let boat = "OC1"; 
    if (fileName.toLowerCase().includes("v1") || fileName.toLowerCase().includes("timi")) {
        boat = "V1";
    }

    const id = "garmin_" + new Date(startTimestamp).getTime();
    const formattedDate = startTimestamp ? startTimestamp.split("T")[0] : new Date().toISOString().split("T")[0];

    return {
        id: id,
        date: formattedDate,
        name: `Treino Garmin ${boat} - ${distanceValue.toFixed(1)}km`,
        boat: boat,
        distance: parseFloat(distanceValue.toFixed(2)),
        duration: durationSeconds,
        avgSpeed: parseFloat(avgSpeed.toFixed(2)),
        maxSpeed: parseFloat(maxSpeedCalculated.toFixed(2)),
        avgCadence: cadCount > 0 ? Math.round(cadSum / cadCount) : null,
        avgHR: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
        trackpoints: trackpoints,
        hasEval: false,
        filename: fileName
    };
}



// Distância Haversine entre duas coordenadas em km
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Popula a lista de treinos
function renderWorkoutList() {
    const listEl = document.getElementById("workout-list");
    const countEl = document.getElementById("workout-list-count");

    if (workouts.length === 0) {
        listEl.innerHTML = `<div class="empty-list-msg">Nenhum treino cadastrado. Faça upload de arquivos GPX/TCX do Garmin ou carregue dados de demonstração.</div>`;
        countEl.innerText = "0 treinos";
        document.getElementById("workout-details-container").style.display = "none";
        return;
    }

    countEl.innerText = `${workouts.length} treino(s)`;
    listEl.innerHTML = "";

    // Agrupa os treinos por semana civil
    const weeks = getWorkoutsByWeek();
    const sortedWeeksKeys = Object.keys(weeks).sort((a, b) => weeks[b].monday - weeks[a].monday);

    sortedWeeksKeys.forEach(weekKey => {
        const weekData = weeks[weekKey];
        
        // Criar cabeçalho da semana
        const weekHeader = document.createElement("div");
        weekHeader.className = "workout-week-group-header";
        weekHeader.innerHTML = `<i class="fa-solid fa-calendar-week"></i> Semana de ${weekKey}`;
        listEl.appendChild(weekHeader);

        // Ordena os treinos da semana por data decrescente
        const sortedWeekWorkouts = [...weekData.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedWeekWorkouts.forEach(w => {
            const item = document.createElement("div");
            item.className = `workout-item ${w.id === activeWorkoutId ? 'active' : ''}`;
            item.setAttribute("data-workout-id", w.id);
            
            const [year, month, day] = w.date.split("-");
            const formattedDate = `${day}/${month}/${year}`;

            // Determinar badge de barco
            const boatBadge = w.boat === "OC1" 
                ? `<span class="badge">OC1</span>` 
                : `<span class="badge v1-badge">V1</span>`;

            item.innerHTML = `
                <div class="workout-item-info">
                    <h4>${w.name}</h4>
                    <p>${formattedDate} • ${boatBadge} ${w.hasEval ? '• <i class="fa-solid fa-square-check" style="color:var(--green-correct)"></i> Técnica' : ''}</p>
                </div>
                <div class="workout-item-meta">
                    <span class="dist">${w.distance.toFixed(1)} km</span>
                    <span class="speed">${w.avgSpeed.toFixed(1)} km/h</span>
                </div>
            `;

            item.addEventListener("click", () => {
                selectWorkout(w.id);
            });

            listEl.appendChild(item);
        });
    });

    // Mantém o primeiro treino selecionado se nenhum estiver selecionado
    if (!activeWorkoutId && workouts.length > 0) {
        selectWorkout(workouts[0].id);
    }
}

// Seleciona um treino para exibição de detalhes
function selectWorkout(id) {
    activeWorkoutId = id;
    
    // Atualiza a seleção visual na lista
    document.querySelectorAll(".workout-item").forEach(el => {
        const workoutId = el.getAttribute("data-workout-id");
        if (workoutId === id) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });

    const w = workouts.find(x => x.id === id);
    if (!w) return;

    // Mostra container de detalhes
    document.getElementById("workout-details-container").style.display = "block";

    // Preenche dados do cabeçalho e estatísticas rápidas
    const [year, month, day] = w.date.split("-");
    document.getElementById("detail-title").innerText = w.name;
    
    let timeRangeStr = "";
    if (w.trackpoints && w.trackpoints.length > 0) {
        const firstTime = new Date(w.trackpoints[0].time);
        const lastTime = new Date(w.trackpoints[w.trackpoints.length - 1].time);
        const formatOptions = { hour: '2-digit', minute: '2-digit' };
        const startStr = firstTime.toLocaleTimeString('pt-BR', formatOptions);
        const endStr = lastTime.toLocaleTimeString('pt-BR', formatOptions);
        timeRangeStr = ` • ${startStr} às ${endStr}`;
    }
    document.getElementById("detail-date").innerText = `${day}/${month}/${year}${timeRangeStr}`;
    
    const badge = document.getElementById("detail-boat-badge");
    badge.innerText = w.boatWeight ? `${w.boat} (${w.boatWeight} kg)` : w.boat;
    if (w.boat === "OC1") {
        badge.className = "badge";
    } else {
        badge.className = "badge v1-badge";
    }

    document.getElementById("detail-distance").innerText = `${w.distance.toFixed(1)} km`;
    document.getElementById("detail-duration").innerText = formatDuration(w.duration);
    document.getElementById("detail-avg-speed").innerText = `${w.avgSpeed.toFixed(1)} km/h`;
    document.getElementById("detail-max-speed").innerText = `${w.maxSpeed.toFixed(1)} km/h`;
    
    document.getElementById("detail-avg-cadence").innerText = w.avgCadence ? `${w.avgCadence} spm` : "-- spm";
    document.getElementById("detail-avg-hr").innerText = w.avgHR ? `${w.avgHR} bpm` : "-- bpm";

    // Gerenciamento de abas dos gráficos (Cadência e HR podem ser desabilitadas se não houver dados)
    const btnCad = document.getElementById("detail-tab-cadence");
    const btnHR = document.getElementById("detail-tab-hr");

    if (w.avgCadence) {
        btnCad.style.display = "block";
    } else {
        btnCad.style.display = "none";
        btnCad.classList.remove("active");
        document.getElementById("chart-cadence-wrapper").classList.remove("active");
    }

    if (w.avgHR) {
        btnHR.style.display = "block";
    } else {
        btnHR.style.display = "none";
        btnHR.classList.remove("active");
        document.getElementById("chart-hr-wrapper").classList.remove("active");
    }

    // Se a aba de Cadência ou HR estava ativa e sumiu, força a aba de Velocidade
    const anyActiveDetailTab = document.querySelector(".details-tab-btn.active");
    if (!anyActiveDetailTab || anyActiveDetailTab.style.display === "none") {
        document.querySelectorAll(".details-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".detail-chart-wrapper").forEach(c => c.classList.remove("active"));
        document.querySelector(".details-tab-btn[data-detail-chart='chart-speed-wrapper']").classList.add("active");
        document.getElementById("chart-speed-wrapper").classList.add("active");
    }

    // Renderiza o mapa Leaflet
    renderWorkoutMap(w);

    // Renderiza os gráficos de série temporal do treino
    renderWorkoutDetailCharts(w);

    // Verifica e exibe autoavaliação acoplada
    renderLinkedEvaluation(w.id);
}

// Formata segundos para HH:MM:SS
function formatDuration(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Renderização do Mapa com gradiente de velocidade
function renderWorkoutMap(workout) {
    if (!workout.trackpoints || workout.trackpoints.length === 0) return;

    // Destrói camadas antigas
    mapLayers.forEach(layer => {
        if (mapInstance) mapInstance.removeLayer(layer);
    });
    mapLayers = [];

    // Inicializa o mapa caso não exista
    if (!mapInstance) {
        mapInstance = L.map("map", {
            zoomControl: true,
            scrollWheelZoom: false
        });
        
        // Tile layer escuro para combinar com a estética da aplicação
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(mapInstance);
    }

    // Coleta coordenadas e velocidades dos trackpoints
    const points = workout.trackpoints;
    const latsLons = points.map(pt => [pt.lat, pt.lon]);

    // Ajusta o zoom do mapa para englobar toda a rota
    mapInstance.fitBounds(L.latLngBounds(latsLons), { padding: [20, 20] });

    // Configura o botão centralizar rota
    document.getElementById("btn-center-map").onclick = () => {
        if (mapInstance && latsLons.length > 0) {
            mapInstance.fitBounds(L.latLngBounds(latsLons), { padding: [20, 20] });
        }
    };

    // Adiciona marcador de início (verde) e de fim (vermelho/carmesim)
    const startIcon = L.divIcon({ className: 'map-marker-start', html: '<i class="fa-solid fa-circle-play" style="color:var(--green-correct); font-size: 20px;"></i>', iconSize: [20, 20], iconAnchor: [10, 10] });
    const endIcon = L.divIcon({ className: 'map-marker-end', html: '<i class="fa-solid fa-circle-stop" style="color:var(--accent-neon); font-size: 20px;"></i>', iconSize: [20, 20], iconAnchor: [10, 10] });

    const mStart = L.marker(latsLons[0], { icon: startIcon }).addTo(mapInstance);
    const mEnd = L.marker(latsLons[latsLons.length - 1], { icon: endIcon }).addTo(mapInstance);
    mapLayers.push(mStart, mEnd);

    // Adiciona marcadores circulares de quilometragem
    let nextKm = 1;
    points.forEach(pt => {
        if (pt.dist >= nextKm) {
            const kmIcon = L.divIcon({
                className: 'map-marker-km',
                html: `<span>${nextKm}</span>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            const mKm = L.marker([pt.lat, pt.lon], { icon: kmIcon })
                .bindTooltip(`Quilômetro ${nextKm}`, { permanent: false, direction: 'top' })
                .addTo(mapInstance);
            mapLayers.push(mKm);
            nextKm++;
        }
    });

    // Encontra e plota o ponto de velocidade máxima
    let maxSpeedPt = points[0];
    points.forEach(pt => {
        if (pt.speed > maxSpeedPt.speed) maxSpeedPt = pt;
    });

    if (maxSpeedPt) {
        const maxSpeedIcon = L.divIcon({
            className: 'map-marker-max-speed',
            html: '<i class="fa-solid fa-bolt" style="color:var(--orange-warn); font-size: 24px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        const mMaxSpeed = L.marker([maxSpeedPt.lat, maxSpeedPt.lon], { icon: maxSpeedIcon })
            .bindTooltip(`Velocidade Máxima: ${maxSpeedPt.speed.toFixed(1)} km/h`, { permanent: false, direction: 'top' })
            .addTo(mapInstance);
        mapLayers.push(mMaxSpeed);
    }

    // Desenha polilinhas coloridas baseadas na velocidade instantânea
    for (let i = 0; i < points.length - 1; i++) {
        const pt1 = points[i];
        const pt2 = points[i + 1];
        
        let color = "#ff003c"; // Vermelho padrao
        if (pt1.speed >= 10.5) {
            color = "#06d6a0"; // Verde
        } else if (pt1.speed >= 9.5) {
            color = "#dede00"; // Amarelo
        } else if (pt1.speed >= 7.5) {
            color = "#ff9f1c"; // Laranja
        }

        const segment = L.polyline([[pt1.lat, pt1.lon], [pt2.lat, pt2.lon]], {
            color: color,
            weight: 4,
            opacity: 0.85
        }).addTo(mapInstance);

        // Tooltip simples com velocidade instantânea ao passar o mouse no segmento
        segment.bindTooltip(`Velocidade: ${pt1.speed.toFixed(1)} km/h<br>Distância: ${pt1.dist.toFixed(2)} km`, { sticky: true });
        mapLayers.push(segment);
    }
}

// Renderiza os gráficos do treino individual com suporte a zoom horizontal independente
function renderWorkoutDetailCharts(workout) {
    const points = workout.trackpoints;
    const labels = points.map(pt => pt.dist.toFixed(2) + " km");
    
    // Configurações comuns do plugin de Zoom do Chart.js
    const zoomConfig = {
        pan: {
            enabled: true,
            mode: 'x',
        },
        zoom: {
            wheel: {
                enabled: true,
            },
            pinch: {
                enabled: true,
            },
            mode: 'x',
        }
    };

    // Gráfico de Velocidade
    const ctxSpeed = document.getElementById("chart-workout-speed");
    if (chartDetailSpeed) chartDetailSpeed.destroy();
    
    chartDetailSpeed = new Chart(ctxSpeed.getContext("2d"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Velocidade Instantânea (km/h)",
                data: points.map(pt => pt.speed),
                borderColor: "#ff003c",
                backgroundColor: "rgba(255, 0, 60, 0.05)",
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(items) { 
                            return items[0] ? `Ponto do Treino (Ref: ${items[0].label})` : ''; 
                        },
                        label: function(context) { 
                            const idx = context.dataIndex;
                            const pt = points[idx];
                            const elapsed = (new Date(pt.time) - new Date(points[0].time)) / 1000;
                            const h = Math.floor(elapsed / 3600);
                            const m = Math.floor((elapsed % 3600) / 60);
                            const s = Math.floor(elapsed % 60);
                            const timeStr = h > 0 
                                ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                                : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                            
                            const avgSpeed = elapsed > 0 ? (pt.dist / (elapsed / 3600)) : pt.speed;
                            return [
                                `Velocidade Instantânea: ${pt.speed.toFixed(1).replace('.', ',')} km/h`,
                                `Distância Acumulada: ${pt.dist.toFixed(2).replace('.', ',')} km`,
                                `Tempo Transcorrido: ${timeStr}`,
                                `Velocidade Média no Ponto: ${avgSpeed.toFixed(1).replace('.', ',')} km/h`
                            ];
                        }
                    }
                },
                zoom: zoomConfig
            },
            scales: {
                y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#ced4da" }, suggestedMin: 5.0, suggestedMax: 15.0 },
                x: { grid: { display: false }, ticks: { color: "#ced4da", maxTicksLimit: 10 } }
            }
        }
    });

    // Gráfico de Cadência
    if (workout.avgCadence) {
        const ctxCad = document.getElementById("chart-workout-cadence");
        if (chartDetailCadence) chartDetailCadence.destroy();

        chartDetailCadence = new Chart(ctxCad.getContext("2d"), {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Cadência (SPM)",
                    data: points.map(pt => pt.cadence),
                    borderColor: "#ff9f1c",
                    backgroundColor: "rgba(255, 159, 28, 0.05)",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(items) { return items[0] ? `Distância: ${items[0].label}` : ''; },
                            label: function(context) { return `Cadência: ${Math.round(context.parsed.y ?? 0)} SPM`; }
                        }
                    },
                    zoom: zoomConfig
                },
                scales: {
                    y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#ced4da" }, suggestedMin: 40, suggestedMax: 90 },
                    x: { grid: { display: false }, ticks: { color: "#ced4da", maxTicksLimit: 10 } }
                }
            }
        });
    }

    // Gráfico de Batimentos Cardíacos
    if (workout.avgHR) {
        const ctxHR = document.getElementById("chart-workout-hr");
        if (chartDetailHR) chartDetailHR.destroy();

        chartDetailHR = new Chart(ctxHR.getContext("2d"), {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Frequência Cardíaca (BPM)",
                    data: points.map(pt => pt.hr),
                    borderColor: "#00b4d8",
                    backgroundColor: "rgba(0, 180, 216, 0.05)",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(items) { return items[0] ? `Distância: ${items[0].label}` : ''; },
                            label: function(context) { return `Frequência Cardíaca: ${Math.round(context.parsed.y ?? 0)} BPM`; }
                        }
                    },
                    zoom: zoomConfig
                },
                scales: {
                    y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#ced4da" }, suggestedMin: 100, suggestedMax: 190 },
                    x: { grid: { display: false }, ticks: { color: "#ced4da", maxTicksLimit: 10 } }
                }
            }
        });
    }
}

// Exibe a avaliação vinculada se houver
function renderLinkedEvaluation(workoutId) {
    const ev = evaluations[workoutId];
    const linkedContainer = document.getElementById("detail-eval-linked");
    const displayContainer = document.getElementById("detail-eval-display");
    const wthContainer = document.getElementById("detail-weather-container");

    if (ev) {
        linkedContainer.style.display = "none";
        displayContainer.style.display = "block";

        const techLabel = TECHNIQUE_METADATA[ev.technique || "nula"]?.name || "Geral";
        const techNameEl = document.getElementById("detail-eval-tech-name");
        if (techNameEl) {
            techNameEl.innerText = techLabel;
        }

        const score = Math.round((ev.phase1 + ev.phase2 + ev.phase3 + ev.phase4) / 4);
        document.getElementById("detail-eval-score-val").innerText = `${score}%`;
        document.getElementById("detail-eval-score-bar").style.width = `${score}%`;

        // Renderiza listas de tags
        const errList = document.getElementById("detail-eval-errors-list");
        errList.innerHTML = "";
        if (ev.errors && ev.errors.length > 0) {
            ev.errors.forEach(err => {
                errList.innerHTML += `<li>${err}</li>`;
            });
        } else {
            errList.innerHTML = `<li style="background:rgba(255,255,255,0.02); border-color:var(--border-color); color:var(--text-muted);">Nenhum erro registrado</li>`;
        }

        const drillList = document.getElementById("detail-eval-drills-list");
        drillList.innerHTML = "";
        if (ev.drills && ev.drills.length > 0) {
            ev.drills.forEach(dr => {
                drillList.innerHTML += `<li>${dr}</li>`;
            });
        } else {
            drillList.innerHTML = `<li style="background:rgba(255,255,255,0.02); border-color:var(--border-color); color:var(--text-muted);">Nenhum drill registrado</li>`;
        }

        // Renderiza clima/mar se estiverem preenchidos
        if (ev.weather) {
            const wth = ev.weather;
            const hasWeatherInfo = wth.temp || wth.wind || wth.swell || (wth.rain && wth.rain !== "Sem Chuva") || wth.tide;
            if (hasWeatherInfo) {
                wthContainer.style.display = "block";
                document.getElementById("detail-weather-temp").innerText = wth.temp ? `${wth.temp} °C` : "-- °C";
                document.getElementById("detail-weather-wind").innerText = wth.wind || "--";
                document.getElementById("detail-weather-rain").innerText = wth.rain || "--";
                document.getElementById("detail-weather-swell").innerText = wth.swell || "--";
                document.getElementById("detail-weather-tide").innerText = wth.tide || "--";
            } else {
                wthContainer.style.display = "none";
            }
        } else {
            wthContainer.style.display = "none";
        }
    } else {
        linkedContainer.style.display = "block";
        displayContainer.style.display = "none";
        wthContainer.style.display = "none";
    }
}

// ----------------------------------------------------
// ABA 3: TÉCNICA DRILL - AVALIAÇÕES E CORRELAÇÃO
// ----------------------------------------------------
function renderDrillsTab() {
    // Popula o select de treinos
    const select = document.getElementById("eval-workout-select");
    select.innerHTML = '<option value="">Selecione um treino...</option>';
    
    // Mostra primeiro os treinos sem avaliação
    const unassessed = workouts.filter(w => !w.hasEval);
    const assessed = workouts.filter(w => w.hasEval);

    if (unassessed.length > 0) {
        const group = document.createElement("optgroup");
        group.label = "Não avaliados";
        unassessed.forEach(w => {
            const opt = document.createElement("option");
            opt.value = w.id;
            opt.innerText = `${w.date.split("-").reverse().join("/")} - ${w.name}`;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }

    if (assessed.length > 0) {
        const group = document.createElement("optgroup");
        group.label = "Já avaliados";
        assessed.forEach(w => {
            const opt = document.createElement("option");
            opt.value = w.id;
            opt.innerText = `${w.date.split("-").reverse().join("/")} - ${w.name}`;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }

    // Carrega formulário com treino ativo ou limpo
    if (activeWorkoutId) {
        select.value = activeWorkoutId;
        loadEvaluationForm(activeWorkoutId);
    } else {
        clearEvaluationForm();
    }

    // Desenha gráfico de correlação Técnica vs. Velocidade
    renderCorrelationChart();
}

function renderChecklists(isDrill) {
    const errorsGrid = document.getElementById("eval-errors-grid");
    const drillsGrid = document.getElementById("eval-drills-grid");
    
    if (!errorsGrid || !drillsGrid) return;
    
    const errorsList = isDrill ? DRILL_ERRORS : GENERAL_ERRORS;
    const drillsList = isDrill ? DRILL_DRILLS : GENERAL_DRILLS;
    
    errorsGrid.innerHTML = errorsList.map((err, i) => `
        <label class="checkbox-container">
            <input type="checkbox" id="err-${i+1}" value="${err.value}" />
            <span class="checkmark"></span>
            ${err.label}
        </label>
    `).join("");
    
    drillsGrid.innerHTML = drillsList.map((dr, i) => `
        <label class="checkbox-container">
            <input type="checkbox" id="drill-${i+1}" value="${dr.value}" />
            <span class="checkmark"></span>
            ${dr.label}
        </label>
    `).join("");
}

function updateEvaluationLabels(technique) {
    const meta = TECHNIQUE_METADATA[technique] || TECHNIQUE_METADATA.nula;
    
    // Atualiza os labels dos sliders
    for (let i = 1; i <= 4; i++) {
        const lbl = document.getElementById(`lbl-phase-${i}`);
        if (lbl) {
            lbl.innerText = meta.phases[i - 1];
        }
    }
    
    // Redesenha as checklists
    renderChecklists(meta.isDrill);
}

function loadEvaluationForm(workoutId) {
    if (!workoutId) {
        clearEvaluationForm();
        return;
    }

    const selectTech = document.getElementById("eval-technique-select");
    const ev = evaluations[workoutId];
    if (ev) {
        // Preenche técnica
        const technique = ev.technique || "nula";
        if (selectTech) selectTech.value = technique;
        
        // Atualiza labels de fases e checklists
        updateEvaluationLabels(technique);

        // Preenche com dados existentes
        document.getElementById("slider-phase-1").value = ev.phase1;
        document.getElementById("slider-phase-2").value = ev.phase2;
        document.getElementById("slider-phase-3").value = ev.phase3;
        document.getElementById("slider-phase-4").value = ev.phase4;

        document.getElementById("val-phase-1").innerText = `${ev.phase1}%`;
        document.getElementById("val-phase-2").innerText = `${ev.phase2}%`;
        document.getElementById("val-phase-3").innerText = `${ev.phase3}%`;
        document.getElementById("val-phase-4").innerText = `${ev.phase4}%`;

        // Checkboxes de erros
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`err-${i}`);
            if (el) el.checked = ev.errors.includes(el.value);
        }

        // Checkboxes de drills
        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`drill-${i}`);
            if (el) el.checked = ev.drills.includes(el.value);
        }

        // Embarcação
        document.getElementById("eval-boat-select").value = ev.boat || "OC1";
        document.getElementById("eval-boat-weight").value = ev.boatWeight || "";

        // Clima e Mar
        const wth = ev.weather || {};
        document.getElementById("eval-weather-temp").value = wth.temp || "";
        document.getElementById("eval-weather-wind").value = wth.wind || "";
        document.getElementById("eval-weather-rain").value = wth.rain || "Sem Chuva";
        document.getElementById("eval-weather-swell").value = wth.swell || "";
        document.getElementById("eval-weather-tide").value = wth.tide || "";

        document.getElementById("eval-notes").value = ev.notes || "";

        // Se a avaliação existe mas o clima está totalmente vazio, tenta pré-preencher em background
        const hasWeatherInfo = wth.temp || wth.wind || wth.swell || (wth.rain && wth.rain !== "Sem Chuva") || wth.tide;
        if (!hasWeatherInfo) {
            fetchOnlineWeatherForWorkout(workoutId, false);
        }
    } else {
        // Reseta sliders e limpa checklists se não avaliado
        clearEvaluationForm();
        
        // Define a embarcação padrão com base no registro original do treino
        const w = workouts.find(x => x.id === workoutId);
        if (w) {
            document.getElementById("eval-boat-select").value = w.boat || "OC1";
            document.getElementById("eval-boat-weight").value = w.boatWeight || "";
        }

        // Tenta pré-preencher o clima automaticamente via API
        fetchOnlineWeatherForWorkout(workoutId, false);
    }
}

function clearEvaluationForm() {
    const selectTech = document.getElementById("eval-technique-select");
    if (selectTech) selectTech.value = "nula";
    updateEvaluationLabels("nula");

    for (let i = 1; i <= 4; i++) {
        document.getElementById(`slider-phase-${i}`).value = 50;
        document.getElementById(`val-phase-${i}`).innerText = "50%";
    }
    
    // Checkboxes agora estão renderizadas com Técnica Nula, limpamos todas
    for (let i = 1; i <= 5; i++) {
        const elErr = document.getElementById(`err-${i}`);
        if (elErr) elErr.checked = false;
        
        const elDrill = document.getElementById(`drill-${i}`);
        if (elDrill) elDrill.checked = false;
    }

    document.getElementById("eval-boat-select").value = "OC1";
    document.getElementById("eval-boat-weight").value = "";
    document.getElementById("eval-weather-temp").value = "";
    document.getElementById("eval-weather-wind").value = "";
    document.getElementById("eval-weather-rain").value = "Sem Chuva";
    document.getElementById("eval-weather-swell").value = "";
    document.getElementById("eval-weather-tide").value = "";
    document.getElementById("eval-notes").value = "";
}

// Salva autoavaliação
function saveEvaluation() {
    const workoutId = document.getElementById("eval-workout-select").value;
    if (!workoutId) {
        showToast("Por favor, selecione um treino primeiro!", "error");
        return;
    }

    const p1 = parseInt(document.getElementById("slider-phase-1").value);
    const p2 = parseInt(document.getElementById("slider-phase-2").value);
    const p3 = parseInt(document.getElementById("slider-phase-3").value);
    const p4 = parseInt(document.getElementById("slider-phase-4").value);

    // Coleta erros marcados
    const errors = [];
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`err-${i}`);
        if (el && el.checked) errors.push(el.value);
    }

    // Coleta drills praticados
    const drills = [];
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`drill-${i}`);
        if (el && el.checked) drills.push(el.value);
    }

    // Coleta dados de embarcação e clima
    const boat = document.getElementById("eval-boat-select").value;
    const boatWeightVal = document.getElementById("eval-boat-weight").value;
    const tempVal = document.getElementById("eval-weather-temp").value;
    const windVal = document.getElementById("eval-weather-wind").value;
    const rainVal = document.getElementById("eval-weather-rain").value;
    const swellVal = document.getElementById("eval-weather-swell").value;
    const tideVal = document.getElementById("eval-weather-tide").value;
    const technique = document.getElementById("eval-technique-select").value || "nula";

    const notes = document.getElementById("eval-notes").value;

    // Registra no banco local
    evaluations[workoutId] = {
        phase1: p1,
        phase2: p2,
        phase3: p3,
        phase4: p4,
        errors: errors,
        drills: drills,
        boat: boat,
        boatWeight: boatWeightVal ? parseFloat(boatWeightVal) : null,
        weather: {
            temp: tempVal ? parseInt(tempVal) : null,
            wind: windVal,
            rain: rainVal,
            swell: swellVal,
            tide: tideVal
        },
        notes: notes,
        technique: technique
    };

    // Atualiza a embarcação no treino correspondente e marca como avaliado
    const w = workouts.find(x => x.id === workoutId);
    if (w) {
        w.hasEval = true;
        w.boat = boat; // O tipo do barco agora é definido/atualizado pela autoavaliação
        w.boatWeight = boatWeightVal ? parseFloat(boatWeightVal) : null;
    }

    saveToLocalStorage();
    renderDrillsTab();
    renderWorkoutList(); // atualiza a listagem com o checkmark e embarcação corrigida
    selectWorkout(workoutId); // recarrega a visualização detalhada com novo layout
    showToast("Autoavaliação salva! Para persistir na raiz, clique em 'Exportar Backup' na barra lateral.", "success");
}

// Excluir treino
function deleteWorkout(id) {
    workouts = workouts.filter(w => w.id !== id);
    delete evaluations[id];
    activeWorkoutId = null;

    saveToLocalStorage();
    renderWorkoutList();
    renderDashboard();
}

// Gráfico de correlação técnica vs velocidade
function renderCorrelationChart() {
    const canvas = document.getElementById("chart-correlation");
    if (!canvas) return;

    if (chartCorrelation) {
        chartCorrelation.destroy();
    }

    // Gera os pontos de dados de correlação
    const dataPoints = [];
    workouts.forEach(w => {
        const ev = evaluations[w.id];
        if (ev) {
            const score = (ev.phase1 + ev.phase2 + ev.phase3 + ev.phase4) / 4;
            dataPoints.push({
                x: score,
                y: w.avgSpeed,
                boat: w.boat,
                date: w.date
            });
        }
    });

    const oc1Points = dataPoints.filter(p => p.boat === "OC1");
    const v1Points = dataPoints.filter(p => p.boat === "V1");

    chartCorrelation = new Chart(canvas.getContext("2d"), {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "OC1",
                    data: oc1Points,
                    backgroundColor: "#e63946",
                    borderColor: "#e63946",
                    pointRadius: 7,
                    pointHoverRadius: 9
                },
                {
                    label: "V1",
                    data: v1Points,
                    backgroundColor: "#9d4edd",
                    borderColor: "#9d4edd",
                    pointRadius: 7,
                    pointHoverRadius: 9
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: "#ced4da", font: { family: "Outfit", weight: "500" } }
                },
                tooltip: {
                    callbacks: {
                        title: function() { return 'Treino'; },
                        label: function(context) {
                            const p = context.raw;
                            return [
                                `Data: ${p.date.split('-').reverse().join('/')}`,
                                `Proficiência Técnica: ${Math.round(p.x)}%`,
                                `Velocidade Média: ${p.y.toFixed(1)} km/h`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Pontuação Média do Drill (%)", color: "#ced4da" },
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "#ced4da" },
                    min: 0,
                    max: 100
                },
                y: {
                    title: { display: true, text: "Velocidade Média (km/h)", color: "#ced4da" },
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "#ced4da" },
                    min: 8.0,
                    max: 12.0
                }
            }
        }
    });
}

// Accordion para o guia do Drill
function toggleAccordion(header) {
    const item = header.parentElement;
    const isActive = item.classList.contains("active");
    
    // Fecha todos
    document.querySelectorAll(".accordion-item").forEach(i => i.classList.remove("active"));
    
    // Se não estava ativo, abre
    if (!isActive) {
        item.classList.add("active");
    }
}

// Expansão e Colapso das Técnicas Referenciais
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
    document.querySelectorAll(".ref-technique-card").forEach(card => {
        card.classList.remove("collapsed");
    });
}

function collapseAllTechniques() {
    document.querySelectorAll(".ref-technique-card").forEach(card => {
        card.classList.add("collapsed");
    });
}

// ----------------------------------------------------
// ABA 4: PLANEJAMENTO E RECOMENDAÇÕES INTELEGENTES
// ----------------------------------------------------
function renderPlanningTab() {
    const loading = document.getElementById("coach-loading-msg");
    const recs = document.getElementById("coach-recommendations");

    loading.style.display = "block";
    recs.style.display = "none";

    setTimeout(() => {
        analyzeErrorsAndRecommend();
        renderErrorsFrequencyChart();
        loading.style.display = "none";
        recs.style.display = "block";
    }, 400);
}

function analyzeErrorsAndRecommend() {
    const errorCounts = {};
    let totalErrors = 0;

    // Conta a incidência de erros
    Object.values(evaluations).forEach(ev => {
        if (ev.errors && ev.errors.length > 0) {
            ev.errors.forEach(err => {
                errorCounts[err] = (errorCounts[err] || 0) + 1;
                totalErrors++;
            });
        }
    });

    const errorListEl = document.getElementById("coach-drills-list");
    errorListEl.innerHTML = "";

    if (totalErrors === 0) {
        // Sem erros frequentes registrados
        document.getElementById("coach-top-error").innerText = "Nenhum desvio detectado";
        document.getElementById("coach-error-description").innerText = "Parabéns! Suas autoavaliações mostram excelente adaptação ao método Drill. Continue praticando o glide.";
        
        // Sugere drill de integração
        errorListEl.innerHTML = `
            <div class="coach-drill-item">
                <div class="coach-drill-item-header">
                    <span class="coach-drill-title">Drill "Escada de Cadência" (Integração)</span>
                    <span class="coach-drill-badge">Sessão Geral</span>
                </div>
                <p>Consiste em blocos de 5 minutos subindo cadência (50 ppm -> 60 ppm -> 70+ ppm) mantendo a estrutura cinemática das fases perfeitamente acoplada, finalizando com foco em glide.</p>
            </div>
        `;
        return;
    }

    // Acha o erro com maior incidência
    let topError = "";
    let maxCount = 0;
    Object.entries(errorCounts).forEach(([err, count]) => {
        if (count > maxCount) {
            maxCount = count;
            topError = err;
        }
    });

    document.getElementById("coach-top-error").innerText = `${topError} (incidência de ${maxCount}x)`;

    // Configuração dos erros e drills
    const errorDatabase = {
        "Falsa Trava na Entrada": {
            desc: "Lâmina entra plana ou batendo sem rotação inicial do tronco. Desperdiça cerca de 15% do curso propulsivo e causa perda de tração.",
            drills: [
                { title: "Drill 'Catch e Congela'", badge: "Fase 1: A Trava", instruction: "Gire o tronco em 45°, insira a lâmina perfeitamente vertical na água e congele por 2 a 3 segundos antes de iniciar a fase propulsiva. Repita 3 séries de 10 puxadas." }
            ]
        },
        "Colapso da Biela": {
            desc: "Dobrar o braço inferior muito cedo na fase propulsiva. Transfere a força do core/tronco (300 N) para o bíceps/ombro (150 N), gerando cansaço precoce e perda de potência.",
            drills: [
                { title: "Drill 'Biela de Aço'", badge: "Fase 2: Pivô do Núcleo", instruction: "Mantenha o braço inferior estendido e rígido como uma biela de motor. A puxada deve ser executada desenrolando o core de 45° a 0°, puxando a canoa sobre o remo. 4 séries de 20 puxadas." }
            ]
        },
        "Rotação de Quadril em Bloco": {
            desc: "Girar o quadril juntamente com o tórax elimina a tensão elástica do abdômen oblíquo (perda do efeito 'arco tensionado'). O quadril deve permanecer firme.",
            drills: [
                { title: "Drill 'Biela de Aço' com Bloqueio", badge: "Fase 2: Pivô", instruction: "Mantenha a bacia fixa e apontando diretamente para a proa (0-15°). Foque na rotação torácica máxima de 45-50°. Pratique remada pausada focando no quadril estático." }
            ]
        },
        "Binário Brusco/Tardio": {
            desc: "Girar os punhos com violência ou esquecer o giro da lâmina no final. Causa turbulência, instabilidade lateral na canoa e washout da remada.",
            drills: [
                { title: "Drill 'Acelerador de Moto'", badge: "Fase 3: Binário Progressivo", instruction: "A partir do joelho, rotacione os punhos progressivamente (polegar da mão superior girando para baixo) de forma contínua até a saída. Realize 3 séries de 15 remadas focadas na rotação suave." }
            ]
        },
        "Saída com Levantamento de Água": {
            desc: "Puxar a lâmina para cima ou arrastar o remo atrás da linha do quadril. Cria peso morto no casco, freia a canoa e destrói o glide entre remadas.",
            drills: [
                { title: "Drill 'A Espada na Bainha'", badge: "Fase 4: Saída Limpa", instruction: "Ao atingir o quadril, a mão superior empurra com firmeza para a frente e para fora da canoa. A lâmina deve fatiar o ar paralela à superfície da água com zero respingos. 4 séries de 20 puxadas." }
            ]
        },
        "Entrada Lenta / Atrasada": {
            desc: "Inserir a pá na água de forma tardia ou com velocidade lenta. Reduz o comprimento efetivo do stroke de potência e cria arrasto hidrodinâmico.",
            drills: [
                { title: "Drill 'Pausa no Catch'", badge: "Fase 1: Entrada", instruction: "Pause por 1 segundo na máxima extensão do alcance antes de furar a água com velocidade e firmeza. 3 séries de 15 remadas." }
            ]
        },
        "Puxada Curta / Sem Core": {
            desc: "Remar flexionando os braços sem a rotação ativa do tronco. Limita o trabalho muscular a grupos menores e reduz a potência total gerada.",
            drills: [
                { title: "Drill 'Remada sem Mãos'", badge: "Fase 2: Conexão", instruction: "Simule segurar a canoa apenas com a rotação dos ombros e oblíquos (braços esticados). Sinta o core trabalhar antes dos braços." }
            ]
        },
        "Saída com Arrasto / Freio": {
            desc: "Deixar a lâmina na água após o quadril, atuando como um freio hidrodinâmico na canoa.",
            drills: [
                { title: "Drill 'Fatia da Lâmina'", badge: "Fase 3: Saída", instruction: "Fatie a lâmina para fora lateralmente quando ela atingir o joelho, gerando zero respingos para trás ou para cima." }
            ]
        },
        "Oscilação Lateral Excessiva": {
            desc: "Mover o tronco para os lados ou desviar o alinhamento da canoa durante a puxada, gerando perda de energia e instabilidade.",
            drills: [
                { title: "Drill 'Olho no Horizonte'", badge: "Postura", instruction: "Mantenha o peito voltado para a frente e os olhos fixos em um ponto no horizonte. Evite balançar lateralmente." }
            ]
        },
        "Falta de Glide / Deslize": {
            desc: "Iniciar a próxima remada imediatamente sem permitir que a canoa aproveite a inércia e deslize livremente sobre a água.",
            drills: [
                { title: "Drill 'Pirâmide de Frequência'", badge: "Cadência", instruction: "Ajuste a cadência para 45-50 ppm e conte pelo menos 1 a 1.5 segundos de deslize livre após cada saída de remo." }
            ]
        }
    };

    const config = errorDatabase[topError] || { desc: "Desvio técnico geral", drills: [] };
    document.getElementById("coach-error-description").innerText = config.desc;

    // Prioriza o drill corretivo correspondente ao maior erro
    config.drills.forEach(dr => {
        errorListEl.innerHTML += `
            <div class="coach-drill-item">
                <div class="coach-drill-item-header">
                    <span class="coach-drill-title">${dr.title}</span>
                    <span class="coach-drill-badge">${dr.badge}</span>
                </div>
                <p>${dr.instruction}</p>
            </div>
        `;
    });

    // Adiciona uma recomendação secundária genérica ou de integração
    errorListEl.innerHTML += `
        <div class="coach-drill-item">
            <div class="coach-drill-item-header">
                <span class="coach-drill-title">Drill "Escada de Cadência" (Integração)</span>
                <span class="coach-drill-badge">Sessão Geral</span>
            </div>
            <p>5 min a 50 ppm (foco nas posições de mãos) + 5 min a 60 ppm (ritmo de prova) + 5 min a 70+ ppm (ritmo de sprint) + 5 min focado na sensação de glide silencioso.</p>
        </div>
    `;
}

function renderErrorsFrequencyChart() {
    const canvas = document.getElementById("chart-errors-frequency");
    if (!canvas) return;

    if (chartErrorsFrequency) {
        chartErrorsFrequency.destroy();
    }

    // Erros possíveis e contagem
    const errorTypes = [
        "Falsa Trava na Entrada",
        "Colapso da Biela",
        "Rotação de Quadril em Bloco",
        "Binário Brusco/Tardio",
        "Saída com Levantamento de Água",
        "Entrada Lenta / Atrasada",
        "Puxada Curta / Sem Core",
        "Saída com Arrasto / Freio",
        "Oscilação Lateral Excessiva",
        "Falta de Glide / Deslize"
    ];

    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    Object.values(evaluations).forEach(ev => {
        if (ev.errors && ev.errors.length > 0) {
            ev.errors.forEach(err => {
                const idx = errorTypes.indexOf(err);
                if (idx !== -1) counts[idx]++;
            });
        }
    });

    chartErrorsFrequency = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels: ["Falsa Trava", "Colapso Biela", "Quadril Bloco", "Binário Ruim", "Saída Suja", "Entrada Lenta", "Puxada Curta", "Saída Arrasto", "Oscilação Lat", "Falta Glide"],
            datasets: [{
                label: "Incidência (vezes)",
                data: counts,
                backgroundColor: "rgba(255, 0, 60, 0.4)",
                borderColor: "#ff003c",
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(items) { return items[0]?.label || ''; },
                        label: function(context) {
                            return `Incidência: ${context.parsed.y} vez${context.parsed.y !== 1 ? 'es' : ''}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#ced4da", stepSize: 1 },
                    min: 0
                },
                x: {
                    grid: { display: false },
                    ticks: { color: "#ced4da" }
                }
            }
        }
    });
}

// ----------------------------------------------------
// EXPORTAÇÃO / IMPORTAÇÃO DE BACKUPS (JSON)
// ----------------------------------------------------
function exportBackup() {
    const dataStr = JSON.stringify({
        version: "1.0",
        workouts: workouts,
        evaluations: evaluations,
        profile: athleteProfile
    }, null, 2);

    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaa_vermelho_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Alerta o usuário como salvar definitivamente na pasta
    setTimeout(() => {
        showToast("Backup baixado! Salve-o na pasta do projeto e clique duas vezes em 'atualizar.bat' para consolidar.", "info");
    }, 500);
}

function importBackup(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.workouts && data.evaluations) {
                // Mescla substituindo os dados existentes pelos do backup
                workouts = data.workouts;
                evaluations = data.evaluations;
                if (data.profile) {
                    athleteProfile = data.profile;
                    localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
                }
                
                saveToLocalStorage();
                showToast("Backup importado com sucesso! Salve-o na raiz e execute 'atualizar.bat' para consolidá-lo.", "success");
                
                // Recarrega o Dashboard e a lista
                activeWorkoutId = null;
                updateProfileUI();
                renderDashboard();
                renderWorkoutList();
                
                // Força aba do Dashboard ativa
                document.getElementById("btn-dashboard").click();
            } else {
                showToast("Estrutura do arquivo de backup inválida.", "error");
            }
        } catch (err) {
            showToast("Erro ao decodificar o JSON: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

// Sistema de Toast Notifications (Mensagens Elegantes Flutuantes)
function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-info-circle";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-exclamation";
    if (type === "warning") icon = "fa-triangle-exclamation";
    
    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    // Ação do botão fechar
    toast.querySelector(".toast-close").addEventListener("click", () => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    });
    
    container.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.classList.add("show");
    }, 10);
    
    // Autodestruição após 6 segundos (tempo maior para ler as instruções educativas)
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }
    }, 6000);
}

// Busca clima e mar online usando a API Open-Meteo e World Tides API
async function fetchOnlineWeatherForWorkout(workoutId, force = false) {
    if (!workoutId) return;

    const w = workouts.find(x => x.id === workoutId);
    if (!w) return;

    // Se já existem dados e não estamos forçando a busca, não faz nada
    const existingEval = evaluations[workoutId];
    if (!force && existingEval && existingEval.weather && 
        (existingEval.weather.temp || existingEval.weather.wind || existingEval.weather.swell || existingEval.weather.tide)) {
        return;
    }

    if (!w.trackpoints || w.trackpoints.length === 0) {
        if (force) {
            showToast("Este treino não possui dados de geolocalização para buscar o clima online.", "warning");
        }
        return;
    }

    const startPt = w.trackpoints[0];
    const lat = startPt.lat;
    const lon = startPt.lon;
    const date = w.date; // YYYY-MM-DD
    const startTimestamp = startPt.time;

    // Coloca os campos em estado de carregamento/espera
    const tempInput = document.getElementById("eval-weather-temp");
    const windInput = document.getElementById("eval-weather-wind");
    const rainInput = document.getElementById("eval-weather-rain");
    const swellInput = document.getElementById("eval-weather-swell");
    const tideInput = document.getElementById("eval-weather-tide");
    const fetchBtn = document.getElementById("btn-fetch-weather");

    const inputs = [tempInput, windInput, rainInput, swellInput, tideInput];
    inputs.forEach(input => {
        if (input) {
            input.classList.add("loading-pulse");
            input.disabled = true;
        }
    });

    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Buscando...`;
    }

    try {
        // Determina se usa Forecast (recente) ou Hindcast (histórico) no Open-Meteo
        // Se a data for há mais de 85 dias, usamos a API Archive (Hindcast)
        const workoutDate = new Date(date + "T00:00:00");
        const today = new Date();
        const diffTime = Math.abs(today - workoutDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let weatherUrl;
        if (diffDays > 85) {
            console.log(`Usando Open-Meteo Hindcast/Archive para data de ${diffDays} dias atrás.`);
            weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=auto`;
        } else {
            console.log(`Usando Open-Meteo Forecast para data de ${diffDays} dias atrás.`);
            weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&timezone=auto`;
        }

        const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=swell_wave_height,swell_wave_direction&timezone=auto`;

        // Executa chamadas Open-Meteo em paralelo
        const [weatherRes, marineRes] = await Promise.all([
            fetch(weatherUrl).then(r => r.ok ? r.json() : Promise.reject("Erro no clima")),
            fetch(marineUrl).then(r => r.ok ? r.json() : null).catch(() => null) //ignora se for inland
        ]);

        const dateObj = new Date(startTimestamp);
        const hour = dateObj.getHours();
        const idx = Math.min(23, Math.max(0, hour));

        // 1. Processar dados de Clima (Vento e Chuva)
        if (weatherRes && weatherRes.hourly) {
            const tempVal = weatherRes.hourly.temperature_2m[idx];
            if (tempVal !== undefined && tempVal !== null) {
                tempInput.value = Math.round(tempVal);
            }

            const windSpeedKmh = weatherRes.hourly.wind_speed_10m[idx];
            const windDirDeg = weatherRes.hourly.wind_direction_10m[idx];
            if (windSpeedKmh !== undefined && windDirDeg !== undefined) {
                const windSpeedKts = Math.round(windSpeedKmh / 1.852);
                const windDirStr = getCardinalDirection(windDirDeg);
                windInput.value = `${windSpeedKts} kts ${windDirStr}`;
            }

            const precip = weatherRes.hourly.precipitation[idx];
            if (precip !== undefined && precip !== null) {
                if (precip === 0) {
                    rainInput.value = "Sem Chuva";
                } else if (precip <= 2.0) {
                    rainInput.value = "Garoa/Leve";
                } else {
                    rainInput.value = "Chuva Forte";
                }
            }
        }

        // 2. Processar dados de Ondulação (Swell)
        if (marineRes && marineRes.hourly) {
            const swellHeight = marineRes.hourly.swell_wave_height[idx];
            const swellDirDeg = marineRes.hourly.swell_wave_direction[idx];
            if (swellHeight !== undefined && swellHeight !== null && swellDirDeg !== undefined && swellDirDeg !== null) {
                const swellDirStr = getCardinalDirection(swellDirDeg);
                swellInput.value = `${swellHeight.toFixed(1)}m ${swellDirStr}`;
            } else {
                swellInput.value = "";
            }
        } else {
            swellInput.value = "";
        }

        // 3. Processar dados de Maré via World Tides API (Plano free / chave salva em LocalStorage)
        const tidesApiKey = localStorage.getItem("vaa_worldtides_key") || DEFAULT_WORLDTIDES_KEY;
        if (tidesApiKey) {
            try {
                const tidesUrl = `https://www.worldtides.info/api/v3?heights&lat=${lat}&lon=${lon}&date=${date}&key=${tidesApiKey}`;
                const tidesRes = await fetch(tidesUrl).then(r => r.ok ? r.json() : Promise.reject("Erro World Tides"));
                
                if (tidesRes && tidesRes.heights) {
                    const workoutTimeMs = new Date(startTimestamp).getTime();
                    let closestHeight = null;
                    let minDiff = Infinity;

                    tidesRes.heights.forEach(h => {
                        const hTimeMs = new Date(h.date).getTime();
                        const diff = Math.abs(workoutTimeMs - hTimeMs);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestHeight = h;
                        }
                    });

                    if (closestHeight) {
                        const closestIdx = tidesRes.heights.indexOf(closestHeight);
                        const heights = tidesRes.heights.map(h => h.height);
                        const minVal = Math.min(...heights);
                        const maxVal = Math.max(...heights);
                        const range = maxVal - minVal;
                        
                        const currentVal = closestHeight.height;
                        
                        if (range > 0.05) {
                            const threshold = range * 0.15; // 15% de tolerância
                            if (currentVal >= maxVal - threshold) {
                                tideInput.value = "Cheia";
                            } else if (currentVal <= minVal + threshold) {
                                tideInput.value = "Seca";
                            } else {
                                let nextVal = currentVal;
                                if (closestIdx < tidesRes.heights.length - 1) {
                                    nextVal = tidesRes.heights[closestIdx + 1].height;
                                } else if (closestIdx > 0) {
                                    nextVal = currentVal + (currentVal - tidesRes.heights[closestIdx - 1].height);
                                }
                                
                                if (nextVal > currentVal) {
                                    tideInput.value = "Enchendo";
                                } else {
                                    tideInput.value = "Vazando";
                                }
                            }
                        } else {
                            tideInput.value = "";
                        }
                    } else {
                        tideInput.value = "";
                    }
                }
            } catch (tideErr) {
                console.error("Erro ao buscar World Tides API:", tideErr);
                tideInput.value = "";
                if (force) {
                    showToast("Erro ao buscar maré na World Tides API. Verifique a chave.", "warning");
                }
            }
        } else {
            tideInput.value = "";
        }

        showToast("Dados climáticos e marítimos atualizados!", "success");

    } catch (err) {
        console.error("Erro ao buscar dados climáticos:", err);
        showToast("Erro ao buscar dados climáticos online. Preencha manualmente.", "warning");
    } finally {
        // Libera os inputs e restaura botão
        inputs.forEach(input => {
            if (input) {
                input.classList.remove("loading-pulse");
                input.disabled = false;
            }
        });
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = `<i class="fa-solid fa-cloud-sun"></i> Buscar Online`;
        }
    }
}

// Converte graus de vento/swell para rumos em português
function getCardinalDirection(degrees) {
    const directions = ["N", "NNE", "NE", "ENE", "L", "LSE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
    const val = Math.floor((degrees / 22.5) + 0.5);
    return directions[val % 16];
}


// ----------------------------------------------------
// ABA 6: TÉCNICAS DE REFERENCIAL — RADAR CHART
// ----------------------------------------------------
let chartReferencialRadar = null;
let datasetVisibility = [true, true, true, true, true];

window.toggleLegendDataset = function(idx) {
    const cb = document.getElementById(`toggle-ds-${idx}`);
    if (cb) {
        cb.checked = !cb.checked;
        datasetVisibility[idx] = cb.checked;
        if (chartReferencialRadar) {
            chartReferencialRadar.setDatasetVisibility(idx, cb.checked);
            chartReferencialRadar.update();
        }
        const item = cb.closest('.ref-legend-item');
        if (item) {
            if (cb.checked) {
                item.classList.remove('inactive');
            } else {
                item.classList.add('inactive');
            }
        }
    }
};

function renderReferencialTab() {
    const canvas = document.getElementById("chart-referencial-radar");
    if (!canvas) return;

    // Sincronizar estado dos checkboxes no HTML
    datasetVisibility.forEach((visible, idx) => {
        const cb = document.getElementById(`toggle-ds-${idx}`);
        if (cb) {
            cb.checked = visible;
            const item = cb.closest('.ref-legend-item');
            if (item) {
                if (visible) {
                    item.classList.remove('inactive');
                } else {
                    item.classList.add('inactive');
                }
            }
            cb.onchange = (e) => {
                datasetVisibility[idx] = cb.checked;
                if (chartReferencialRadar) {
                    chartReferencialRadar.setDatasetVisibility(idx, cb.checked);
                    chartReferencialRadar.update();
                }
                if (item) {
                    if (cb.checked) {
                        item.classList.remove('inactive');
                    } else {
                        item.classList.add('inactive');
                    }
                }
            };
        }
    });

    // Destruir instância anterior se existir
    if (chartReferencialRadar) {
        chartReferencialRadar.destroy();
        chartReferencialRadar = null;
    }

    const labels = [
        "Rotação do Tronco",
        "Uso dos Braços",
        "Ativação do Core",
        "Profundidade do Catch",
        "Cadência Recomendada",
        "Controle de Pitch",
        "Glide / Deslize",
        "Uso do Ombro"
    ];

    // Valores: escala 0–10 representando a ênfase de cada técnica em cada dimensão
    // Método Drill: grande ênfase em rotação torácica, core, pitch e biela
    const drillValues = [9, 5, 9, 8, 6, 9, 8, 5];

    // Técnica Tepava: ênfase em catch profundo, ombro como motor, leveza/glide
    const tepavaValues = [7, 4, 6, 9, 7, 6, 9, 9];

    // Travis Grant: alta cadência, catch agressivo, explosão de ombro
    const travisValues = [8, 6, 7, 8, 9, 6, 5, 9];

    // John Puakea: trava de água (Water Lock), rotação de tronco, saída rápida
    const puakeaValues = [9, 4, 8, 9, 7, 7, 8, 8];

    // Raphael Thibaux: fluidez, glide sagrado, respiração, cadência menor
    const thibauxValues = [8, 4, 8, 8, 5, 8, 9, 8];

    chartReferencialRadar = new Chart(canvas.getContext("2d"), {
        type: "radar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Método Drill",
                    data: drillValues,
                    hidden: !datasetVisibility[0],
                    backgroundColor: "rgba(255, 0, 60, 0.12)",
                    borderColor: "rgba(255, 0, 60, 0.85)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "rgba(255, 0, 60, 0.9)",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBorderWidth: 1.5,
                },
                {
                    label: "Técnica Tepava (Shell Va'a)",
                    data: tepavaValues,
                    hidden: !datasetVisibility[1],
                    backgroundColor: "rgba(240, 165, 0, 0.12)",
                    borderColor: "rgba(240, 165, 0, 0.85)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "rgba(240, 165, 0, 0.9)",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBorderWidth: 1.5,
                },
                {
                    label: "Travis Grant (Técnica Australiana)",
                    data: travisValues,
                    hidden: !datasetVisibility[2],
                    backgroundColor: "rgba(6, 214, 160, 0.12)",
                    borderColor: "rgba(6, 214, 160, 0.85)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "rgba(6, 214, 160, 0.9)",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBorderWidth: 1.5,
                },
                {
                    label: "John Puakea (Técnica Taitiana)",
                    data: puakeaValues,
                    hidden: !datasetVisibility[3],
                    backgroundColor: "rgba(0, 180, 216, 0.12)",
                    borderColor: "rgba(0, 180, 216, 0.85)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "rgba(0, 180, 216, 0.9)",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBorderWidth: 1.5,
                },
                {
                    label: "Raphael Thibaux (Escola Polinésia)",
                    data: thibauxValues,
                    hidden: !datasetVisibility[4],
                    backgroundColor: "rgba(157, 78, 221, 0.12)",
                    borderColor: "rgba(157, 78, 221, 0.85)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "rgba(157, 78, 221, 0.9)",
                    pointBorderColor: "#fff",
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBorderWidth: 1.5,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Legenda customizada no HTML
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.parsed.r}/10`;
                        }
                    },
                    backgroundColor: "rgba(18, 21, 24, 0.95)",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderWidth: 1,
                    titleFont: { family: "Outfit", weight: "600" },
                    bodyFont: { family: "Inter", size: 12 },
                    titleColor: "#f8f9fa",
                    bodyColor: "#ced4da",
                    padding: 10
                }
            },
            scales: {
                r: {
                    min: 0,
                    max: 10,
                    ticks: {
                        display: false,
                        stepSize: 2
                    },
                    pointLabels: {
                        color: "#ced4da",
                        font: {
                            family: "Inter",
                            size: 11,
                            weight: "500"
                        }
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.06)"
                    },
                    angleLines: {
                        color: "rgba(255, 255, 255, 0.08)"
                    }
                }
            },
            animation: {
                duration: 800,
                easing: "easeInOutQuart"
            }
        }
    });
}

// ----------------------------------------------------
// ABA 7: ESCOLA POLINÉSIA (RAPHAEL THIBAUX)
// ----------------------------------------------------
let flowAnimFrame = null;
let currentPhaseIdx = 0;
let isPlaying = false;
let playInterval = null;

const phases = [
    {
        title: "Fase 1: O Catch (Entrada)",
        desc: "A lâmina entra na água de forma rápida e silenciosa. O ombro inferior projeta-se à frente para obter alcance máximo, e a pá mergulha inteira antes de sofrer pressão.",
        spine: { x1: 160, y1: 92, x2: 180, y2: 140 },
        head: { cx: 155, cy: 80 },
        paddle: { x1: 140, y1: 65, x2: 125, y2: 175 }
    },
    {
        title: "Fase 2: O Drive (Acoplamento e Puxada)",
        desc: "O tronco roda de volta ao centro. A alavanca é firme, puxando a canoa sobre o remo ancorado. O braço inferior guia levemente dobrado e o ombro superior traciona.",
        spine: { x1: 175, y1: 92, x2: 180, y2: 140 },
        head: { cx: 170, cy: 80 },
        paddle: { x1: 165, y1: 70, x2: 165, y2: 190 }
    },
    {
        title: "Fase 3: O Exit (Saída Silenciosa)",
        desc: "A lâmina sai da água na altura do joelho, deslizando para fora e para o lado de forma silenciosa para não quebrar a velocidade do barco. A mão superior lidera empurrando para fora.",
        spine: { x1: 185, y1: 92, x2: 180, y2: 140 },
        head: { cx: 180, cy: 80 },
        paddle: { x1: 185, y1: 80, x2: 200, y2: 175 }
    },
    {
        title: "Fase 4: O Glide Sagrado (Recuperação)",
        desc: "O momento contemplativo de silêncio e deslize. O remo viaja pelo ar em recuperação compacta, permitindo que a inércia e o hidrofólio do casco façam a canoa deslizar livremente.",
        spine: { x1: 175, y1: 92, x2: 180, y2: 140 },
        head: { cx: 170, cy: 80 },
        paddle: { x1: 180, y1: 75, x2: 195, y2: 120 }
    }
];

function updateSVGPhase(idx) {
    const phase = phases[idx];
    const head = document.getElementById("paddler-head");
    const spine = document.getElementById("paddler-spine");
    const shaft = document.getElementById("paddle-shaft");
    const blade = document.getElementById("paddle-blade");
    const infoText = document.getElementById("phase-info-text");

    if (!head || !spine || !shaft || !blade || !infoText) return;

    head.setAttribute("cx", phase.head.cx);
    head.setAttribute("cy", phase.head.cy);

    spine.setAttribute("x1", phase.spine.x1);
    spine.setAttribute("y1", phase.spine.y1);
    spine.setAttribute("x2", phase.spine.x2);
    spine.setAttribute("y2", phase.spine.y2);

    shaft.setAttribute("x1", phase.paddle.x1);
    shaft.setAttribute("y1", phase.paddle.y1);
    shaft.setAttribute("x2", phase.paddle.x2);
    shaft.setAttribute("y2", phase.paddle.y2);

    const x2 = phase.paddle.x2;
    const y2 = phase.paddle.y2;
    let bladeD;
    if (idx === 3) { // Glide
        bladeD = `M ${x2} ${y2} L ${x2 + 30} ${y2 + 10} C ${x2 + 38} ${y2 + 12}, ${x2 + 32} ${y2 - 2}, ${x2 + 25} ${y2 - 5} Z`;
    } else {
        bladeD = `M ${x2} ${y2} L ${x2 - 8} ${y2 + 35} C ${x2 - 8} ${y2 + 45}, ${x2 + 8} ${y2 + 45}, ${x2 + 8} ${y2 + 35} Z`;
    }
    blade.setAttribute("d", bladeD);

    infoText.innerHTML = `<strong>${phase.title}:</strong> ${phase.desc}`;
    
    const ripple = document.getElementById("water-ripple");
    if (ripple) {
        if (idx === 3) {
            ripple.setAttribute("stroke", "var(--purple-long)");
            ripple.setAttribute("stroke-width", "4");
        } else {
            ripple.setAttribute("stroke", "rgba(6, 214, 160, 0.4)");
            ripple.setAttribute("stroke-width", "3");
        }
    }
}

function renderThibauxTab() {
    // Prefill from current profile
    const ap = athleteProfile || { name: "Remador", height: 1.80, weight: 78, since: 2022 };
    const sliderSimWeight = document.getElementById("slider-sim-ath-weight");
    const sliderSimHeight = document.getElementById("slider-sim-ath-height");
    if (sliderSimWeight) sliderSimWeight.value = ap.weight || 78;
    if (sliderSimHeight) sliderSimHeight.value = ap.height || 1.80;

    // 1. DADOS DE FLUXO (CANVAS)
    const canvas = document.getElementById("flow-canvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        const sliderAngle = document.getElementById("slider-flow-angle");
        const sliderPower = document.getElementById("slider-flow-power");
        const valAngle = document.getElementById("val-flow-angle");
        const valPower = document.getElementById("val-flow-power");
        const statusBadge = document.getElementById("flow-status-badge");
        const feedbackText = document.getElementById("flow-feedback-text");

        let particles = [];
        const maxParticles = 80;

        for (let i = 0; i < maxParticles; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                speed: 1.5 + Math.random() * 2.5
            });
        }

        if (flowAnimFrame) cancelAnimationFrame(flowAnimFrame);

        function animateFlow() {
            if (!document.getElementById("flow-canvas")) return; // Stop animation loop if tab changed
            
            const angle = parseInt(sliderAngle.value);
            const power = parseInt(sliderPower.value);

            valAngle.innerText = `${angle}°`;
            valPower.innerText = `${power}%`;

            const isLaminar = Math.abs(angle) <= 10 && power <= 75;

            if (isLaminar) {
                statusBadge.innerText = "Laminar";
                statusBadge.style.background = "var(--green-correct)";
                statusBadge.style.color = "#000";
                feedbackText.innerHTML = `<strong>Fluxo Laminar Ideal:</strong> Lâmina perfeitamente alinhada (${angle}°). Arrasto mínimo, turbulência nula e máximo aproveitamento de força.`;
            } else {
                statusBadge.innerText = "Turbulento";
                statusBadge.style.background = "var(--accent-neon)";
                statusBadge.style.color = "#fff";
                feedbackText.innerHTML = `<strong>Fluxo Turbulento (Arrasto):</strong> Lâmina desalinhada (${angle}°) ou força excessiva (${power}%). Formação de redemoinhos e cavitação nas costas da lâmina.`;
            }

            ctx.fillStyle = "rgba(10, 12, 14, 0.25)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw grid lines
            ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
            ctx.lineWidth = 1;
            for (let i = 25; i < canvas.width; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }

            // Draw flow particles
            ctx.lineWidth = 1.5;
            particles.forEach(p => {
                const speedFactor = 0.5 + (power / 55);
                p.x += p.speed * speedFactor;

                const dx = 280 - p.x;
                const dy = p.y - 150;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 75) {
                    const force = (75 - dist) / 75;
                    p.y += (dy >= 0 ? 1.8 : -1.8) * force;

                    if (!isLaminar && p.x > 280) {
                        p.y += Math.sin(p.x * 0.15) * 4.5 * force;
                    }
                }

                if (p.x > canvas.width) {
                    p.x = 0;
                    p.y = Math.random() * canvas.height;
                }

                ctx.beginPath();
                ctx.strokeStyle = isLaminar ? "rgba(6, 214, 160, 0.45)" : "rgba(230, 57, 70, 0.45)";
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - 7, p.y);
                ctx.stroke();
            });

            // Draw blade
            ctx.save();
            ctx.translate(280, 150);
            ctx.rotate((angle * Math.PI) / 180);

            ctx.fillStyle = isLaminar ? "rgba(6, 214, 160, 0.95)" : "rgba(230, 57, 70, 0.95)";
            ctx.fillRect(-6, -30, 12, 60);

            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.fillRect(-2, -45, 4, 15);
            ctx.restore();

            flowAnimFrame = requestAnimationFrame(animateFlow);
        }

        animateFlow();
    }

    // 2. SIMULADOR UNIFICADO E REATIVO
    const sliderFlowAngle = document.getElementById("slider-flow-angle");
    const sliderFlowPower = document.getElementById("slider-flow-power");
    const sliderRotAngle = document.getElementById("slider-rot-angle");
    const sliderHipLock = document.getElementById("slider-hip-lock");
    const selectCanoeType = document.getElementById("sim-canoe-type");
    const sliderCanoeWeight = document.getElementById("slider-canoe-weight");
    const sliderCadence = document.getElementById("slider-calc-cadence");
    const simWeatherSelect = document.getElementById("sim-weather-select");

    // New inputs
    const sliderSimAthWeight = document.getElementById("slider-sim-ath-weight");
    const sliderSimAthHeight = document.getElementById("slider-sim-ath-height");
    const sliderSimBladeArea = document.getElementById("slider-sim-blade-area");
    const selectWindDir = document.getElementById("sim-wind-dir");
    const selectSwellDir = document.getElementById("sim-swell-dir");

    // References to all outputs/labels
    const valFlowAngle = document.getElementById("val-flow-angle");
    const valFlowPower = document.getElementById("val-flow-power");
    const valRotAngle = document.getElementById("val-rot-angle");
    const valHipLock = document.getElementById("val-hip-lock");
    const valCanoeWeight = document.getElementById("val-canoe-weight");
    const valCadence = document.getElementById("val-calc-cadence");
    
    // New labels
    const valSimAthWeight = document.getElementById("val-sim-ath-weight");
    const valSimAthHeight = document.getElementById("val-sim-ath-height");
    const valSimBladeArea = document.getElementById("val-sim-blade-area");

    // Local metrics (torque/power card)
    const resTorqueVal = document.getElementById("res-torque-val");
    const resPowerRaw = document.getElementById("res-power-raw");
    const resTorqueEff = document.getElementById("res-torque-eff");
    const resPowerEff = document.getElementById("res-power-eff");
    const torqueFeedback = document.getElementById("torque-feedback-text");

    // Final result metrics
    const finalGlide = document.getElementById("final-res-glide");
    const finalSpeed = document.getElementById("final-res-speed");
    const finalGlideDesc = document.getElementById("final-glide-desc");
    const finalSpeedDesc = document.getElementById("final-speed-desc");

    // Math memory elements
    const calcAthWeight = document.getElementById("calc-athlete-weight");
    const calcAthHeight = document.getElementById("calc-athlete-height");
    const calcAthExp = document.getElementById("calc-athlete-exp");
    const calcPbaseVal = document.getElementById("calc-pbase-val");
    const calcPbrutaVal = document.getElementById("calc-pbruta-val");
    const calcPitchDeg = document.getElementById("calc-pitch-deg");
    const calcBladeEff = document.getElementById("calc-blade-eff");
    const calcHiplockVal = document.getElementById("calc-hiplock-val");
    const calcTransEff = document.getElementById("calc-trans-eff");
    const calcPeffVal = document.getElementById("calc-peff-val");
    const calcCanoeType = document.getElementById("calc-canoe-type");
    const calcCanoeWeightLbl = document.getElementById("calc-canoe-weight-lbl");
    const calcMtotal = document.getElementById("calc-mtotal");
    const calcRmassVal = document.getElementById("calc-rmass-val");
    const calcRenvVal = document.getElementById("calc-renv-val");
    const calcRtotalVal = document.getElementById("calc-rtotal-val");
    const calcGactiveVal = document.getElementById("calc-gactive-val");
    const calcGpassiveVal = document.getElementById("calc-gpassive-val");
    const calcGtotalVal = document.getElementById("calc-gtotal-val");
    const calcSpeedVal = document.getElementById("calc-speed-val");

    function updateUnifiedSimulation() {
        if (!sliderFlowAngle || !sliderFlowPower || !sliderRotAngle || !sliderHipLock || 
            !selectCanoeType || !sliderCanoeWeight || !sliderCadence) return;

        // 1. Gather all inputs
        const pitchAngle = parseInt(sliderFlowAngle.value);
        const pullPower = parseInt(sliderFlowPower.value);
        const rotAngle = parseInt(sliderRotAngle.value);
        const hipLock = parseInt(sliderHipLock.value);
        const canoeType = selectCanoeType.value;
        const canoeWeight = parseFloat(sliderCanoeWeight.value);
        const cadence = parseInt(sliderCadence.value);

        // Gather new inputs
        const ap = athleteProfile || { name: "Remador", height: 1.80, weight: 78, since: 2022 };
        const athWeight = sliderSimAthWeight ? parseFloat(sliderSimAthWeight.value) : (ap.weight || 78);
        const athHeight = sliderSimAthHeight ? parseFloat(sliderSimAthHeight.value) : (ap.height || 1.80);
        const bladeArea = sliderSimBladeArea ? parseInt(sliderSimBladeArea.value) : 95;
        const windDir = selectWindDir ? selectWindDir.value : "contra";
        const swellDir = selectSwellDir ? selectSwellDir.value : "contra";

        // Update slider label texts
        if (valFlowAngle) valFlowAngle.innerText = `${pitchAngle}°`;
        if (valFlowPower) valFlowPower.innerText = `${pullPower}%`;
        if (valRotAngle) valRotAngle.innerText = `${rotAngle}°`;
        if (valHipLock) valHipLock.innerText = `${hipLock}%`;
        if (valCanoeWeight) valCanoeWeight.innerText = `${canoeWeight.toFixed(1)} kg`;
        if (valCadence) valCadence.innerText = `${cadence} ppm`;
        if (valSimAthWeight) valSimAthWeight.innerText = `${athWeight} kg`;
        if (valSimAthHeight) valSimAthHeight.innerText = `${athHeight.toFixed(2)} m`;
        if (valSimBladeArea) valSimBladeArea.innerText = `${bladeArea} sq in`;

        // Rotate torso and hip in SVG top-down drawing
        const torsoGroup = document.getElementById("sim-torso-group");
        const hipGroup = document.getElementById("sim-hip-group");

        if (torsoGroup) {
            torsoGroup.setAttribute("transform", `rotate(${-rotAngle}, 150, 100)`);
        }

        const hipAngle = -rotAngle * (1 - hipLock / 100);
        if (hipGroup) {
            hipGroup.setAttribute("transform", `rotate(${hipAngle}, 150, 100)`);
        }

        // 2. Fetch athlete profile variables
        const athExpYears = Math.max(1, 2026 - (ap.since || 2022));

        // 3. Compute Biomechanical/Propulsion metrics
        // Base power generated by athlete muscles
        const pBase = 120 + athWeight + (athExpYears * 4);
        
        // Reach multiplier from trunk rotation: max +22% reach
        const fRot = 1.0 + Math.sin(rotAngle * Math.PI / 180) * 0.22;
        const strokeLength = athHeight * 0.82 * fRot; // Active reach in meters
        
        // Blade attack efficiency (laminar vs turbulent, based on pitch)
        const radPitch = pitchAngle * Math.PI / 180;
        // Efficiency drops as pitch moves away from 0° (both directions)
        const bladeEfficiency = Math.cos(radPitch) * (1.0 - Math.abs(pitchAngle) / 100);
        
        // Gross Power: athlete baseline * pull power % * rotation boost
        const pRaw = pBase * (pullPower / 100) * (1.0 + (rotAngle / 90) * 0.2);
        
        // Force transmission efficiency via hip lock (35% to 95%)
        const transEfficiency = 0.35 + (hipLock / 100) * 0.60;
        
        // Effective power transferred to hull during pull
        const fBladeArea = bladeArea / 95;
        const pEffective = pRaw * transEfficiency * bladeEfficiency * fBladeArea;

        // Torque calculation (biomechanical card local display)
        const forceMultiplier = 1.0 + (rotAngle / 90) * 0.8;
        const force = 220 * forceMultiplier * (pullPower / 100);
        const leverArm = 0.35 + 0.15 * Math.sin(rotAngle * Math.PI / 180);
        const torque = force * leverArm * bladeEfficiency;

        // 4. Canoe and Environmental Drag (Resistance)
        const totalWeight = athWeight + canoeWeight;
        const cDrag = canoeType === "V1" ? 0.082 : 0.090; // V1 is slicker/no rudder
        
        // Drag constant baseline calibration for the Vaa hull to match exactly 10 km/h under baseline test parameters (total weight relative to 93kg)
        const kMass = 4.63 * (cDrag / 0.082) * Math.pow(totalWeight / 93, 1.15);

        // Environmental weather drag
        let windSpeedVal = 0;
        let waveHeightVal = 0;
        if (simWeatherSelect && simWeatherSelect.selectedIndex > 0) {
            const opt = simWeatherSelect.options[simWeatherSelect.selectedIndex];
            const windStr = (opt.dataset.wind || "").toLowerCase();
            const swellStr = (opt.dataset.swell || "").toLowerCase();

            if (windStr.includes("forte") || windStr.includes("strong") || windStr.includes("25") || windStr.includes("30")) windSpeedVal = 25;
            else if (windStr.includes("moderado") || windStr.includes("moderate") || windStr.includes("15") || windStr.includes("20")) windSpeedVal = 15;
            else if (windStr.includes("fraco") || windStr.includes("light") || windStr.includes("5") || windStr.includes("10")) windSpeedVal = 5;

            if (swellStr.includes("alto") || swellStr.includes("high") || swellStr.includes("2m") || swellStr.includes("3m")) waveHeightVal = 1.8;
            else if (swellStr.includes("médio") || swellStr.includes("medium") || swellStr.includes("1m")) waveHeightVal = 0.8;
            else if (swellStr.includes("baixo") || swellStr.includes("low") || swellStr.includes("0.5m")) waveHeightVal = 0.3;
        }

        let rWind = 0.02 * windSpeedVal;
        if (windDir === "favor") {
            rWind = -0.015 * windSpeedVal;
        } else if (windDir === "lateral") {
            rWind = 0.008 * windSpeedVal;
        }

        let rWave = 0.6 * waveHeightVal;
        if (swellDir === "favor") {
            rWave = -0.45 * waveHeightVal;
        } else if (swellDir === "lateral") {
            rWave = 0.25 * waveHeightVal;
        }

        const rEnv = rWind + rWave;
        const kTotal = Math.max(0.5, kMass + rEnv);

        // 5. Cadence cycle time division (time active vs passive)
        const tCycle = 60 / cadence; // duration of one full cycle in seconds
        const tActive = 0.45; // duration of water phase in seconds (assumed constant biomechanical baseline)
        const tPassive = Math.max(0.05, tCycle - tActive); // duration of glide phase in seconds
        const dutyCycle = tActive / tCycle; // ratio of active pull time to cycle time
        
        // Average effective power spread across the entire cycle
        const pEffectiveAvg = pEffective * dutyCycle;
        
        // 6. Hull speed in m/s (based on average power and total drag factor)
        // v = (P_avg / K_total)^(1/3)
        const vAvgMs = Math.max(0.5, Math.pow(Math.max(0.01, pEffectiveAvg) / Math.max(0.01, kTotal), 1/3));
        const speedResult = vAvgMs * 3.6; // speed in km/h

        // 7. Glide length calculations
        // Active glide (meters during pull phase)
        const gActive = vAvgMs * tActive;
        // Passive glide (meters during air recovery phase)
        const gPassive = vAvgMs * tPassive;
        const glideTotal = gActive + gPassive; // should equal vAvgMs * tCycle

        // 8. Update UI Elements
        // Torque & Power Card (Card 2 local display)
        if (resTorqueVal) resTorqueVal.innerHTML = `${torque.toFixed(1)} <span class="unit">N.m</span>`;
        if (resPowerRaw) resPowerRaw.innerHTML = `${Math.round(pRaw)} <span class="unit">W</span>`;
        if (resTorqueEff) resTorqueEff.innerText = `${Math.round(transEfficiency * 100)}%`;
        if (resPowerEff) resPowerEff.innerHTML = `${Math.round(pEffective)} <span class="unit">W</span>`;

        // Local feedback in biomechanics card
        if (torqueFeedback) {
            let fb = "";
            if (rotAngle < 15) {
                fb = "<strong>Rotação Insuficiente:</strong> Remando apenas com os braços. Baixo torque gerado e fadiga de bíceps.";
            } else if (hipLock < 40) {
                fb = "<strong>Vazamento de Energia:</strong> Embora o tronco gire, a bacia solta faz a energia se dissipar no assento.";
            } else if (rotAngle >= 60 && hipLock >= 80) {
                fb = "<strong>Sweet Spot de Potência Polinésia!</strong> Rotação profunda com quadril bloqueado. Máxima transferência de torque.";
            } else {
                fb = "<strong>Boa mecânica corporal.</strong> Continue focando no engajamento dos grandes grupos das costas e core.";
            }
            if (rEnv > 0.05) {
                fb += ` <em style="color:var(--orange-warn)"> ⚠ Arrasto ambiental ativo (vento/ondas): -${((rEnv / kTotal) * speedResult).toFixed(1)} km/h.</em>`;
            }
            torqueFeedback.innerHTML = fb;
        }

        // Final consolidated results at the bottom
        if (finalGlide) finalGlide.innerHTML = `${glideTotal.toFixed(2)} <span style="font-size:1.2rem; font-weight:400;">m</span>`;
        if (finalSpeed) finalSpeed.innerHTML = `${speedResult.toFixed(1)} <span style="font-size:1.2rem; font-weight:400;">km/h</span>`;

        if (finalGlideDesc) {
            if (glideTotal >= 2.5) finalGlideDesc.innerHTML = `<span style="color:var(--green-correct)">★ Glide Excelente</span> (Alto rendimento por remada)`;
            else if (glideTotal >= 1.8) finalGlideDesc.innerHTML = `<span style="color:var(--blue-info)">★ Glide Eficiente</span> (Navegação equilibrada)`;
            else finalGlideDesc.innerHTML = `<span style="color:var(--orange-warn)">▲ Arrasto Elevado</span> (Perda de inércia entre ciclos)`;
        }

        if (finalSpeedDesc) {
            if (speedResult >= 10.0) finalSpeedDesc.innerHTML = `<span style="color:var(--green-correct)">Ritmo de Competição Elite</span>`;
            else if (speedResult >= 8.2) finalSpeedDesc.innerHTML = `<span style="color:var(--blue-info)">Ritmo de Cruzeiro Técnico</span>`;
            else finalSpeedDesc.innerHTML = `<span style="color:var(--text-muted)">Ritmo Regenerativo / Técnico Básico</span>`;
        }

        // Update Math Memory (Step by step detail)
        if (calcAthWeight) calcAthWeight.innerText = athWeight;
        if (calcAthHeight) calcAthHeight.innerText = athHeight.toFixed(2);
        if (calcAthExp) calcAthExp.innerText = athExpYears;
        if (calcPbaseVal) calcPbaseVal.innerText = pBase.toFixed(0);
        if (calcPbrutaVal) calcPbrutaVal.innerText = `${pRaw.toFixed(0)}W (Rot: ${rotAngle}°)`;
        if (calcPitchDeg) calcPitchDeg.innerText = pitchAngle;
        if (calcBladeEff) calcBladeEff.innerText = Math.round(bladeEfficiency * 100);
        if (calcHiplockVal) calcHiplockVal.innerText = hipLock;
        if (calcTransEff) calcTransEff.innerText = Math.round(transEfficiency * 100);
        if (calcPeffVal) calcPeffVal.innerText = `${pEffective.toFixed(0)}W (Média Ciclo: ${pEffectiveAvg.toFixed(0)}W)`;
        if (calcCanoeType) calcCanoeType.innerText = canoeType;
        if (calcCanoeWeightLbl) calcCanoeWeightLbl.innerText = canoeWeight.toFixed(1);
        if (calcMtotal) calcMtotal.innerText = totalWeight;
        if (calcRmassVal) calcRmassVal.innerText = kMass.toFixed(3);
        if (calcRenvVal) calcRenvVal.innerText = `${rEnv.toFixed(3)} (Vento: ${rWind.toFixed(3)} + Ondas: ${rWave.toFixed(3)})`;
        if (calcRtotalVal) calcRtotalVal.innerText = kTotal.toFixed(3);
        if (calcGactiveVal) calcGactiveVal.innerText = `${gActive.toFixed(2)} (t_atv: ${tActive}s)`;
        if (calcGpassiveVal) calcGpassiveVal.innerText = `${gPassive.toFixed(2)} (t_pas: ${tPassive.toFixed(2)}s)`;
        if (calcGtotalVal) calcGtotalVal.innerText = `${glideTotal.toFixed(2)} (t_ciclo: ${tCycle.toFixed(2)}s)`;
        if (calcSpeedVal) calcSpeedVal.innerText = `${speedResult.toFixed(1)} (v: ${vAvgMs.toFixed(2)} m/s)`;
    }

    // Preenche o select de condições climáticas dos treinos carregados
    if (simWeatherSelect) {
        const ws = typeof workouts !== 'undefined' ? workouts : [];
        const workoutsWithWeather = ws.filter(w => {
            const ev = (typeof evaluations !== 'undefined' ? evaluations : {})[w.id];
            return ev && ev.weather && (ev.weather.wind || ev.weather.swell || ev.weather.temp);
        });
        simWeatherSelect.innerHTML = '<option value="">— Nenhuma condição selecionada —</option>';
        workoutsWithWeather.forEach(w => {
            const ev = (typeof evaluations !== 'undefined' ? evaluations : {})[w.id];
            const wth = ev.weather;
            const [yr, mo, dy] = w.date.split('-');
            const label = `${dy}/${mo}/${yr} — Vento: ${wth.wind || '?'} | Ondas: ${wth.swell || '?'} | ${wth.rain || 'Sem chuva'}`;
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = label;
            opt.dataset.wind = wth.wind || '';
            opt.dataset.swell = wth.swell || '';
            opt.dataset.rain = wth.rain || '';
            opt.dataset.temp = wth.temp || '';
            opt.dataset.avgSpeed = w.avgSpeed || 0;
            simWeatherSelect.appendChild(opt);
        });

        simWeatherSelect.addEventListener('change', () => {
            const sel = simWeatherSelect.options[simWeatherSelect.selectedIndex];
            const windInfoEl = document.getElementById('sim-weather-info');
            if (sel.value && windInfoEl) {
                windInfoEl.innerHTML = `<i class="fa-solid fa-wind"></i> Vento: <strong>${sel.dataset.wind || '—'}</strong> &nbsp; <i class="fa-solid fa-water"></i> Ondas: <strong>${sel.dataset.swell || '—'}</strong> &nbsp; <i class="fa-solid fa-temperature-half"></i> Temp.: <strong>${sel.dataset.temp ? sel.dataset.temp + '°C' : '—'}</strong> &nbsp; <i class="fa-solid fa-droplet"></i> <strong>${sel.dataset.rain || '—'}</strong>`;
                
                // Auto-fill canoe type and canoe weight from workout if available!
                const matchedWorkout = ws.find(w => w.id === sel.value);
                if (matchedWorkout) {
                    if (matchedWorkout.boat && (matchedWorkout.boat === "V1" || matchedWorkout.boat === "OC1")) {
                        if (selectCanoeType) selectCanoeType.value = matchedWorkout.boat;
                    }
                    if (matchedWorkout.boatWeight && sliderCanoeWeight) {
                        sliderCanoeWeight.value = matchedWorkout.boatWeight;
                    }
                    if (matchedWorkout.avgCadence && sliderCadence) {
                        sliderCadence.value = matchedWorkout.avgCadence;
                    }
                    
                    const ev = (typeof evaluations !== 'undefined' ? evaluations : {})[matchedWorkout.id];
                    if (ev) {
                        if (sliderFlowPower) sliderFlowPower.value = ev.phase2 || 70;
                        if (sliderHipLock) sliderHipLock.value = ev.phase1 || 70;
                        if (sliderRotAngle) {
                            sliderRotAngle.value = Math.max(15, Math.round((ev.phase2 / 100) * 45));
                        }
                        if (sliderFlowAngle) {
                            const dev = Math.max(0, 100 - (ev.phase3 || 80));
                            sliderFlowAngle.value = Math.round((dev / 100) * 20);
                        }
                    } else {
                        if (sliderFlowPower) sliderFlowPower.value = 80;
                        if (sliderHipLock) sliderHipLock.value = 85;
                        if (sliderRotAngle) sliderRotAngle.value = 45;
                        if (sliderFlowAngle) sliderFlowAngle.value = 0;
                    }
                }
            } else if (windInfoEl) {
                windInfoEl.innerHTML = '';
            }
            updateUnifiedSimulation();
        });
    }

    // Register all event listeners for unified reactive simulation
    if (sliderFlowAngle) sliderFlowAngle.oninput = updateUnifiedSimulation;
    if (sliderFlowPower) sliderFlowPower.oninput = updateUnifiedSimulation;
    if (sliderRotAngle) sliderRotAngle.oninput = updateUnifiedSimulation;
    if (sliderHipLock) sliderHipLock.oninput = updateUnifiedSimulation;
    if (selectCanoeType) selectCanoeType.onchange = updateUnifiedSimulation;
    if (sliderCanoeWeight) sliderCanoeWeight.oninput = updateUnifiedSimulation;
    if (sliderCadence) sliderCadence.oninput = updateUnifiedSimulation;

    // Register new input listeners
    if (sliderSimAthWeight) sliderSimAthWeight.oninput = updateUnifiedSimulation;
    if (sliderSimAthHeight) sliderSimAthHeight.oninput = updateUnifiedSimulation;
    if (sliderSimBladeArea) sliderSimBladeArea.oninput = updateUnifiedSimulation;
    if (selectWindDir) selectWindDir.onchange = updateUnifiedSimulation;
    if (selectSwellDir) selectSwellDir.onchange = updateUnifiedSimulation;

    // Trigger initial calculation
    updateUnifiedSimulation();
}

// ----------------------------------------------------
// ABA 8: PERFIL DO ATLETA & CONFIGURAÇÃO DE METAS
// ----------------------------------------------------
function updateProfileUI() {
    if (!athleteProfile) return;

    // Foto de Perfil na Sidebar
    const sidebarImg = document.getElementById("profile-sidebar-img");
    const sidebarFallback = document.getElementById("profile-sidebar-fallback");
    if (sidebarImg && sidebarFallback) {
        if (athleteProfile.photo) {
            sidebarImg.src = athleteProfile.photo;
            sidebarImg.style.display = "block";
            sidebarFallback.style.display = "none";
        } else {
            sidebarImg.src = "";
            sidebarImg.style.display = "none";
            sidebarFallback.style.display = "block";
        }
    }

    // Dados na Sidebar
    const sideName = document.getElementById("sidebar-name");
    if (sideName) sideName.innerText = athleteProfile.name;

    const sideHeight = document.getElementById("sidebar-height");
    if (sideHeight) sideHeight.innerHTML = `<i class="fa-solid fa-arrows-up-down"></i> ${athleteProfile.height.toFixed(2).replace('.', ',')} m`;

    const sideWeight = document.getElementById("sidebar-weight");
    if (sideWeight) sideWeight.innerHTML = `<i class="fa-solid fa-weight-hanging"></i> ${athleteProfile.weight} kg`;

    const sideAge = document.getElementById("sidebar-age");
    if (sideAge) sideAge.innerHTML = `<i class="fa-solid fa-cake-candles"></i> ${athleteProfile.age} anos`;

    const sideSince = document.getElementById("sidebar-since");
    if (sideSince) sideSince.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Desde ${athleteProfile.since}`;

    const sideWatch = document.getElementById("sidebar-watch");
    if (sideWatch) sideWatch.innerHTML = `<i class="fa-solid fa-clock"></i> ${athleteProfile.watch}`;

    const sidePaddle = document.getElementById("sidebar-paddle");
    if (sidePaddle) sidePaddle.innerHTML = `<i class="fa-solid fa-square-envelope"></i> ${athleteProfile.paddle}`;

    // Foto de Perfil Grande (Aba Perfil)
    const largeImg = document.getElementById("profile-large-img");
    const largeFallback = document.getElementById("profile-large-fallback");
    if (largeImg && largeFallback) {
        if (athleteProfile.photo) {
            largeImg.src = athleteProfile.photo;
            largeImg.style.display = "block";
            largeFallback.style.display = "none";
        } else {
            largeImg.src = "";
            largeImg.style.display = "none";
            largeFallback.style.display = "block";
        }
    }

    // Detalhes do Perfil (Aba Perfil)
    const viewName = document.getElementById("view-profile-name");
    if (viewName) viewName.innerText = athleteProfile.name;

    const viewHeight = document.getElementById("view-profile-height");
    if (viewHeight) viewHeight.innerText = `${athleteProfile.height.toFixed(2).replace('.', ',')} m`;

    const viewWeight = document.getElementById("view-profile-weight");
    if (viewWeight) viewWeight.innerText = `${athleteProfile.weight} kg`;

    const viewAge = document.getElementById("view-profile-age");
    if (viewAge) viewAge.innerText = `${athleteProfile.age} anos`;

    const viewSince = document.getElementById("view-profile-since");
    if (viewSince) viewSince.innerText = athleteProfile.since;

    const viewWatch = document.getElementById("view-profile-watch");
    if (viewWatch) viewWatch.innerText = athleteProfile.watch;

    const viewPaddle = document.getElementById("view-profile-paddle");
    if (viewPaddle) viewPaddle.innerText = athleteProfile.paddle;

    // Atualiza progresso das metas
    updateGoalProgress();
}

// Retorna a data da segunda-feira e domingo correspondentes à semana de uma data dada
function getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    // Ajusta para segunda-feira (no JS, Domingo é 0, Segunda é 1, etc.)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
}

// Formata segundos em Hh Mm ou Mm Ss
function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
}

// Agrupa treinos por semana
function getWorkoutsByWeek() {
    const weeks = {};
    workouts.forEach(w => {
        const dateObj = new Date(w.date + "T12:00:00");
        const range = getWeekRange(dateObj);
        
        const mondayStr = formatDateLocal(range.monday);
        const sundayStr = formatDateLocal(range.sunday);
        const weekKey = `${mondayStr} a ${sundayStr}`;
        
        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                monday: range.monday,
                sunday: range.sunday,
                workouts: [],
                totalDistance: 0,
                totalDuration: 0,
                avgSpeedSum: 0
            };
        }
        
        weeks[weekKey].workouts.push(w);
        weeks[weekKey].totalDistance += w.distance;
        weeks[weekKey].totalDuration += w.duration;
        weeks[weekKey].avgSpeedSum += w.avgSpeed;
    });
    
    return weeks;
}

function formatDateLocal(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function renderWeeklyHistoryTable() {
    const tbody = document.getElementById("weekly-history-tbody");
    if (!tbody) return;
    
    const weeks = getWorkoutsByWeek();
    const sortedWeeksKeys = Object.keys(weeks).sort((a, b) => weeks[b].monday - weeks[a].monday);
    
    // Mostramos as semanas anteriores à semana atual
    const now = new Date();
    const currentWeekRange = getWeekRange(now);
    
    const historicalWeeksKeys = sortedWeeksKeys.filter(key => {
        return weeks[key].monday < currentWeekRange.monday;
    });
    
    if (historicalWeeksKeys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">Nenhum histórico de semanas anteriores consolidado.</td></tr>`;
        return;
    }
    
    let html = "";
    historicalWeeksKeys.forEach(key => {
        const week = weeks[key];
        const distStr = `${week.totalDistance.toFixed(1).replace('.', ',')} km`;
        
        const target = (athleteProfile && athleteProfile.goal && athleteProfile.goal.target) || 30;
        const targetStr = `${target.toFixed(1).replace('.', ',')} km`;
        
        const timeStr = formatDuration(week.totalDuration);
        const count = week.workouts.length;
        const achieved = week.totalDistance >= target;
        const statusHtml = achieved 
            ? `<span class="status-achieved"><i class="fa-solid fa-circle-check"></i> Atingida</span>`
            : `<span class="status-pending"><i class="fa-solid fa-circle-xmark"></i> Não Atingida</span>`;
            
        html += `
            <tr>
                <td><strong>Semana de ${key}</strong></td>
                <td>${distStr} / ${targetStr}</td>
                <td>${timeStr}</td>
                <td>${count} ${count === 1 ? 'remada' : 'remadas'}</td>
                <td>${statusHtml}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function updateGoalProgress() {
    if (!athleteProfile || !athleteProfile.goal) return;

    const target = athleteProfile.goal.target || 30;
    
    // Obter semana atual
    const now = new Date();
    const currentWeekRange = getWeekRange(now);
    
    // Filtrar treinos da semana atual
    const currentWeekWorkouts = workouts.filter(w => {
        const d = new Date(w.date + "T12:00:00");
        return d >= currentWeekRange.monday && d <= currentWeekRange.sunday;
    });
    
    const currentWeekDistance = currentWeekWorkouts.reduce((sum, w) => sum + w.distance, 0);
    const currentWeekDuration = currentWeekWorkouts.reduce((sum, w) => sum + w.duration, 0);

    // Calcula porcentagem
    let pct = (currentWeekDistance / target) * 100;
    pct = Math.max(0, Math.min(100, Math.round(pct)));

    const remaining = target - currentWeekDistance;
    const isCompleted = currentWeekDistance >= target;

    // Textos formatados em português
    const targetStr = target.toFixed(1).replace('.', ',') + " km";
    const currentStr = currentWeekDistance.toFixed(1).replace('.', ',') + " km";
    const timeStr = formatDuration(currentWeekDuration);
    
    const goalTitleText = `Meta da Semana Atual: ${targetStr}`;
    const remainingBadgeText = isCompleted ? "Meta Atingida! 🎉" : `Faltam ${remaining.toFixed(1).replace('.', ',')} km`;

    // Atualiza elementos no Dashboard (Base)
    const dashGoalTitle = document.getElementById("goal-title");
    if (dashGoalTitle) dashGoalTitle.innerText = goalTitleText;

    const dashRemaining = document.getElementById("goal-remaining-badge");
    if (dashRemaining) {
        dashRemaining.innerText = remainingBadgeText;
        if (isCompleted) {
            dashRemaining.style.background = "var(--green-correct)";
            dashRemaining.style.color = "#000";
        } else {
            dashRemaining.style.background = "";
            dashRemaining.style.color = "";
        }
    }

    const dashProgressFill = document.getElementById("goal-progress-bar");
    if (dashProgressFill) dashProgressFill.style.width = `${pct}%`;

    const dashProgressText = document.getElementById("goal-progress-text");
    if (dashProgressText) dashProgressText.innerText = `${pct}% da meta semanal alcançada`;

    const dashBaselineVal = document.getElementById("goal-baseline-val");
    if (dashBaselineVal) dashBaselineVal.innerText = `Acumulado: ${currentStr}`;

    const dashWeeklyTimeVal = document.getElementById("goal-weekly-time-val");
    if (dashWeeklyTimeVal) dashWeeklyTimeVal.innerText = `Tempo Total: ${timeStr}`;

    const dashWeeklyTime = document.getElementById("dash-weekly-time");
    if (dashWeeklyTime) dashWeeklyTime.innerHTML = timeStr;

    const dashTargetVal = document.getElementById("goal-target-val");
    if (dashTargetVal) dashTargetVal.innerText = `Meta: ${targetStr}`;

    // Atualiza elementos na Aba Meu Perfil
    const profileGoalTitle = document.getElementById("profile-goal-title");
    if (profileGoalTitle) profileGoalTitle.innerText = goalTitleText;

    const profileProgressFill = document.getElementById("profile-goal-progress-bar");
    if (profileProgressFill) profileProgressFill.style.width = `${pct}%`;

    const profileProgressText = document.getElementById("profile-goal-progress-text");
    if (profileProgressText) profileProgressText.innerText = `${pct}% da meta semanal alcançada`;

    const profileRemaining = document.getElementById("profile-goal-remaining-badge");
    if (profileRemaining) {
        profileRemaining.innerText = remainingBadgeText;
        if (isCompleted) {
            profileRemaining.style.background = "var(--green-correct)";
            profileRemaining.style.color = "#000";
        } else {
            profileRemaining.style.background = "";
            profileRemaining.style.color = "";
        }
    }

    const profileGoalDesc = document.getElementById("profile-goal-desc");
    if (profileGoalDesc) profileGoalDesc.innerText = `Meta Semanal: ${targetStr}`;

    const profileGoalCurrentVal = document.getElementById("profile-goal-current-val");
    if (profileGoalCurrentVal) profileGoalCurrentVal.innerText = `Acumulado na Semana: ${currentStr} (${timeStr})`;
}

function renderProfileTab() {
    if (!athleteProfile) return;

    document.getElementById("edit-profile-name").value = athleteProfile.name || "";
    document.getElementById("edit-profile-height").value = athleteProfile.height || "";
    document.getElementById("edit-profile-weight").value = athleteProfile.weight || "";
    document.getElementById("edit-profile-age").value = athleteProfile.age || "";
    document.getElementById("edit-profile-since").value = athleteProfile.since || "";
    document.getElementById("edit-profile-watch").value = athleteProfile.watch || "";
    document.getElementById("edit-profile-paddle").value = athleteProfile.paddle || "";

    if (athleteProfile.goal) {
        document.getElementById("edit-goal-type").value = athleteProfile.goal.type || "speed";
        document.getElementById("edit-goal-baseline").value = athleteProfile.goal.baseline || "";
        document.getElementById("edit-goal-target").value = athleteProfile.goal.target || "";
    }
}

function saveAthleteProfile() {
    if (!athleteProfile) athleteProfile = {};

    athleteProfile.name = document.getElementById("edit-profile-name").value.trim() || "Remador";
    athleteProfile.height = parseFloat(document.getElementById("edit-profile-height").value) || 1.80;
    athleteProfile.weight = parseFloat(document.getElementById("edit-profile-weight").value) || 78;
    athleteProfile.age = parseInt(document.getElementById("edit-profile-age").value) || 47;
    athleteProfile.since = parseInt(document.getElementById("edit-profile-since").value) || 2022;
    athleteProfile.watch = document.getElementById("edit-profile-watch").value.trim() || "Garmin 165 Music";
    athleteProfile.paddle = document.getElementById("edit-profile-paddle").value.trim() || "Remo Crespo C118";

    if (!athleteProfile.goal) athleteProfile.goal = {};
    athleteProfile.goal.type = document.getElementById("edit-goal-type").value;
    athleteProfile.goal.baseline = parseFloat(document.getElementById("edit-goal-baseline").value) || 0;
    athleteProfile.goal.target = parseFloat(document.getElementById("edit-goal-target").value) || 0;

    localStorage.setItem("vaa_athlete_profile", JSON.stringify(athleteProfile));
    
    updateProfileUI();
    showToast("Perfil do atleta atualizado com sucesso!", "success");
}

window.openProfileTab = function() {
    const btn = document.getElementById("btn-profile");
    if (btn) btn.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
