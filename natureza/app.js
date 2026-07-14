// =========================================================
// LOGICA E ESTADO - CENTRAL ORGANIZACIONAL VIBE NATUREZA 2026
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("CentralVibe: app.js DOMContentLoaded starting...");
        
        const weeksList = [
            { id: 'week-1', label: '15/Jun a 21/Jun' },
            { id: 'week-2', label: '22/Jun a 28/Jun (1º Treino 28/Jun)' },
            { id: 'week-3', label: '29/Jun a 05/Jul' },
            { id: 'week-4', label: '06/Jul a 12/Jul' },
            { id: 'week-5', label: '13/Jul a 19/Jul' },
            { id: 'week-6', label: '20/Jul a 26/Jul' },
            { id: 'week-7', label: '27/Jul a 02/Ago' },
            { id: 'week-8', label: '03/Ago a 09/Ago' },
            { id: 'week-9', label: '10/Ago a 16/Ago' },
            { id: 'week-10', label: '17/Ago a 23/Ago' },
            { id: 'week-11', label: '24/Ago a 30/Ago' },
            { id: 'week-12', label: '31/Ago a 06/Set' },
            { id: 'week-13', label: '07/Set a 13/Set' },
            { id: 'week-14', label: '14/Set a 20/Set' },
            { id: 'week-15', label: '21/Set a 27/Set' },
            { id: 'week-16', label: '28/Set a 04/Out' },
            { id: 'week-17', label: '05/Out a 11/Out' },
            { id: 'week-18', label: '12/Out a 18/Out' },
            { id: 'week-19', label: '19/Out a 25/Out' },
            { id: 'week-20', label: '26/Out a 01/Nov' },
            { id: 'week-21', label: '02/Nov a 08/Nov' },
            { id: 'week-22', label: '09/Nov a 15/Nov' },
            { id: 'week-23', label: '16/Nov a 22/Nov' },
            { id: 'week-24', label: '23/Nov a 29/Nov' },
            { id: 'week-25', label: '30/Nov a 06/Dez (Prova VIBE)' }
        ];

        const calendarEvents = [
            { date: '28/Jun/2026', type: 'training', title: '1º Treino Oficial OC6', desc: 'Ajuste de sincronia e alinhamento básico do time da base Natureza.' },
            { date: '04/Jul/2026', type: 'race', title: 'Prova de V1 (V1SP) São Paulo', desc: 'Campeonato nacional individual sem leme.' },
            { date: '12/Jul/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Simulado de largada e sustentação de frequência.' },
            { date: '25/Jul/2026', type: 'race', title: 'Campeonato Estadual SC - OC6', desc: 'Regata de canoas coletivas no litoral catarinense.' },
            { date: '26/Jul/2026', type: 'race', title: 'Campeonato Estadual SC - OC6', desc: 'Regata de canoas coletivas no litoral catarinense.' },
            { date: '09/Ago/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Simulado de revezamento de remadores (entrada e saída).' },
            { date: '23/Ago/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Prática de sustentação de potência nas posições 3 e 4.' },
            { date: '13/Set/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Longão de resistência de 30km em mar aberto.' },
            { date: '27/Set/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Trabalho de manobras de leme sob condições adversas.' },
            { date: '11/Out/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Simulado oficial de longa distância visando a VIBE.' },
            { date: '17/Out/2026', type: 'race', title: 'Prova de V1 (V1RJ) Rio de Janeiro', desc: 'Maratona nacional de canoas V1 (Individual).' },
            { date: '25/Out/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Treinamento de velocidade, tiros curtos e giros de boia.' },
            { date: '31/Out/2026', type: 'race', title: 'Porto Belo OC6 (VIVA\'A) SC', desc: 'Competição estadual de longa distância.' },
            { date: '01/Nov/2026', type: 'race', title: 'Porto Belo OC6 (VIVA\'A) SC', desc: 'Competição estadual de longa distância.' },
            { date: '02/Nov/2026', type: 'race', title: 'Porto Belo OC6 (VIVA\'A) SC', desc: 'Competição estadual de longa distância.' },
            { date: '15/Nov/2026', type: 'training', title: 'Treino Coletivo OC6', desc: 'Último longão preparatório de 40km (teste físico de exaustão).' },
            { date: '22/Nov/2026', type: 'training', title: 'Treino de Polimento', desc: 'Remada leve de alinhamento e sincronia final das pás.' },
            { date: '03/Dez/2026', type: 'training', title: '🚐 Viagem e Chegada em Ilhabela', desc: 'Deslocamento da equipe e acomodação no alojamento.' },
            { date: '04/Dez/2026', type: 'target', title: '🏆 Volta a Ilhabela - VIBE 2026 (SP)', desc: '90km de revezamento no mar aberto. Nosso foco principal.' },
            { date: '05/Dez/2026', type: 'target', title: '🏆 Volta a Ilhabela - VIBE 2026 (SP)', desc: '90km de revezamento no mar aberto. Nosso foco principal.' },
            { date: '06/Dez/2026', type: 'training', title: '🚐 Retorno para Florianópolis', desc: 'Viagem de volta após o encerramento oficial.' }
        ];

        const seatRoles = {
            1: { name: 'Voga (Pacer)', desc: 'Dita o ritmo e a cadência da remada pela esquerda.' },
            2: { name: 'Contra-Voga', desc: 'Replica a frequência do Voga no lado direito da canoa.' },
            3: { name: 'Power / Pote', desc: 'Motor central esquerdo da canoa. Força pura.' },
            4: { name: 'Power / Pote', desc: 'Motor central direito da canoa. Monitora entrada de água.' },
            5: { name: 'Apoio Leme', desc: 'Sustenta o rumo junto ao leme em condições severas.' },
            6: { name: 'Leme (Steersman)', desc: 'Direciona, coordena e capitaneia a embarcação.' }
        };

        const availableSizes = ["P", "M", "G", "GG", "XG", "XXG"];

        // -----------------------------------------------------
    // 1. DADOS PADRÃO E ESTADO INICIAL
    // -----------------------------------------------------
    const defaultState = {
        athletes: [
            // Categoria Pró (12 remadores oficiais)
            { id: 'pro-noe', name: 'Noé', category: 'pro', weight: 80 },
            { id: 'pro-jean', name: 'Jean', category: 'pro', weight: 80 },
            { id: 'pro-fernando', name: 'Fernando', category: 'pro', weight: 80 },
            { id: 'pro-luiz', name: 'Luiz', category: 'pro', weight: 80 },
            { id: 'pro-deividy', name: 'Deividy', category: 'pro', weight: 80 },
            { id: 'pro-esdras', name: 'Esdras', category: 'pro', weight: 80 },
            { id: 'pro-guga', name: 'Guga', category: 'pro', weight: 80 },
            { id: 'pro-valtinho', name: 'Valtinho', category: 'pro', weight: 80 },
            { id: 'pro-will', name: 'Will', category: 'pro', weight: 80 },
            { id: 'pro-chileno', name: 'Chileno', category: 'pro', weight: 80 },
            { id: 'pro-adiel', name: 'Adiel', category: 'pro', weight: 80 },
            { id: 'pro-diego', name: 'Diego', category: 'pro', weight: 80 },

            // Categoria Amador (4 suplentes/apoio)
            { id: 'ama-renan', name: 'Renan', category: 'amador', weight: 80 },
            { id: 'ama-daniel', name: 'Daniel', category: 'amador', weight: 80 },
            { id: 'ama-pedro', name: 'Pedro', category: 'amador', weight: 80 },
            { id: 'ama-sebastian', name: 'Sebastian', category: 'amador', weight: 80 },

            // Categoria Feminina (9 remadoras)
            { id: 'fem-lucimara', name: 'Lucimara', category: 'feminino', weight: 60 },
            { id: 'fem-fernanda', name: 'Fernanda', category: 'feminino', weight: 60 },
            { id: 'fem-kendra', name: 'Kendra', category: 'feminino', weight: 60 },
            { id: 'fem-nay', name: 'Nay', category: 'feminino', weight: 60 },
            { id: 'fem-marina', name: 'Marina', category: 'feminino', weight: 60 },
            { id: 'fem-carol', name: 'Carol', category: 'feminino', weight: 60 },
            { id: 'fem-sandrinha', name: 'Sandrinha', category: 'feminino', weight: 60 },
            { id: 'fem-anac', name: 'Ana C.', category: 'feminino', weight: 60 },
            { id: 'fem-maeve', name: 'Maeve', category: 'feminino', weight: 60 },

            // Equipe de Apoio / Coordenadores (2 pessoas)
            { id: 'sup-elmonte', name: 'Coord. elmonte.dev.br', category: 'apoio', weight: 80 },
            { id: 'sup-apoio', name: 'Apoio Técnico Vibe', category: 'apoio', weight: 80 }
        ],

        // Treinos: check-in semanal de 40km individual por semana
        weeklyMileage: {
            'week-1': [], 'week-2': [], 'week-3': [], 'week-4': [], 'week-5': [],
            'week-6': [], 'week-7': [], 'week-8': [], 'week-9': [], 'week-10': [],
            'week-11': [], 'week-12': [], 'week-13': [], 'week-14': [], 'week-15': [],
            'week-16': [], 'week-17': [], 'week-18': [], 'week-19': [], 'week-20': [],
            'week-21': [], 'week-22': [], 'week-23': [], 'week-24': []
        },

        // Escalação de assentos da canoa OC6
        crew: {
            1: null, 2: null, 3: null, 4: null, 5: null, 6: null
        },

        // Financeiro
        financials: {
            vakinhaCollected: 12500,
            boatTotalCost: 5000,
            registrationCostPerAthlete: 350,
            vakinhaLink: "https://www.vakinha.com.br/vaquinha/vibe-natureza-2026",
            payments: {}
        },

        // Estadia (Acomodações na casa alugada)
        accommodation: {
            name: "Casa de Temporada Ilhabela (Mata Atlântica)",
            address: "Av. Governador Mario Covas Junior, nº 1400 - Ilhabela, SP",
            rooms: [
                { id: "room-1", name: "Suíte Master (2 vagas)", capacity: 2, occupants: [] },
                { id: "room-2", name: "Quarto Principal (4 vagas)", capacity: 4, occupants: [] },
                { id: "room-3", name: "Quarto Mezanino (4 vagas)", capacity: 4, occupants: [] },
                { id: "room-4", name: "Alojamento Apoio (4 vagas)", capacity: 4, occupants: [] }
            ]
        },

        // Translado (Divisão de veículos)
        transport: {
            freightText: "Carregadora de canoas contratada. Saída do reboque programada para 02/Dez/2026.",
            vehicles: [
                { id: "vehicle-1", name: "Van Oficial (8 vagas)", capacity: 8, occupants: [] },
                { id: "vehicle-2", name: "Carro Fernando (4 vagas)", capacity: 4, occupants: [] },
                { id: "vehicle-3", name: "Carro Noé (4 vagas)", capacity: 4, occupants: [] }
            ]
        },

        // Uniformes por atleta/apoio (14 pessoas do contingente)
        uniforms: {},

        adminMode: false
    };

    let state = {};

    // -----------------------------------------------------
    // 2. SISTEMA DE SALVAMENTO E CARREGAMENTO (LOCAL STORAGE)
    // -----------------------------------------------------
    function saveState() {
        localStorage.setItem('vibe_natureza_state', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('vibe_natureza_state');
        let parsed = null;
        if (saved) {
            try {
                parsed = JSON.parse(saved);
            } catch (e) {
                console.error("Erro ao fazer parse do estado salvo:", e);
            }
        }

        // Se não houver dados válidos salvos, inicializa com o estado padrão completo
        if (!parsed || !parsed.athletes || parsed.athletes.length === 0) {
            state = JSON.parse(JSON.stringify(defaultState));
            state.athletes.forEach(ath => {
                if (!state.financials.payments) state.financials.payments = {};
                state.financials.payments[ath.id] = { boatPaid: false, regPaid: false };
                if (!state.uniforms) state.uniforms = {};
                state.uniforms[ath.id] = { shirtSize: "G", shortsSize: "M" };
            });
            saveState();
            return;
        }

        // Se houver dados salvos, vamos curar e mesclar chaves faltantes
        state = parsed;
        
        if (!state.athletes || state.athletes.length === 0) {
            state.athletes = JSON.parse(JSON.stringify(defaultState.athletes));
        }

        if (!state.weeklyMileage) {
            state.weeklyMileage = JSON.parse(JSON.stringify(defaultState.weeklyMileage));
        }
        for (let weekId in defaultState.weeklyMileage) {
            if (!state.weeklyMileage[weekId]) {
                state.weeklyMileage[weekId] = [];
            }
        }

        if (!state.crew) {
            state.crew = JSON.parse(JSON.stringify(defaultState.crew));
        }
        for (let seat = 1; seat <= 6; seat++) {
            if (state.crew[seat] === undefined) {
                state.crew[seat] = null;
            }
        }

        if (!state.financials) {
            state.financials = JSON.parse(JSON.stringify(defaultState.financials));
        }
        if (state.financials.vakinhaCollected === undefined) state.financials.vakinhaCollected = defaultState.financials.vakinhaCollected;
        if (state.financials.boatTotalCost === undefined) state.financials.boatTotalCost = defaultState.financials.boatTotalCost;
        if (state.financials.registrationCostPerAthlete === undefined) state.financials.registrationCostPerAthlete = defaultState.financials.registrationCostPerAthlete;
        if (state.financials.vakinhaLink === undefined) state.financials.vakinhaLink = defaultState.financials.vakinhaLink;
        if (!state.financials.payments) {
            state.financials.payments = {};
        }

        if (!state.accommodation) {
            state.accommodation = JSON.parse(JSON.stringify(defaultState.accommodation));
        }
        if (!state.accommodation.rooms || state.accommodation.rooms.length === 0) {
            state.accommodation.rooms = JSON.parse(JSON.stringify(defaultState.accommodation.rooms));
        }

        if (!state.transport) {
            state.transport = JSON.parse(JSON.stringify(defaultState.transport));
        }
        if (!state.transport.vehicles || state.transport.vehicles.length === 0) {
            state.transport.vehicles = JSON.parse(JSON.stringify(defaultState.transport.vehicles));
        }
        if (state.transport.freightText === undefined) {
            state.transport.freightText = defaultState.transport.freightText;
        }

        if (!state.uniforms) {
            state.uniforms = {};
        }

        // Garantir registros para todos os atletas ativos
        state.athletes.forEach(ath => {
            if (!state.financials.payments[ath.id]) {
                state.financials.payments[ath.id] = { boatPaid: false, regPaid: false };
            }
            if (!state.uniforms[ath.id]) {
                state.uniforms[ath.id] = { shirtSize: "G", shortsSize: "M" };
            }
        });
        
        saveState();
    }

    loadState();

    // -----------------------------------------------------
    // 3. NAVEGAÇÃO DE ABAS
    // -----------------------------------------------------
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            navButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // Renderizar dados atualizados da aba ativa
            renderActiveTabContent(tabId);
        });
    });

    // -----------------------------------------------------
    // 4. MODO ADMINISTRADOR (EDIÇÃO vs LEITURA)
    // -----------------------------------------------------
    const adminCheckbox = document.getElementById('admin-mode-checkbox');
    const adminStatusText = document.querySelector('.admin-status-text');
    const adminBackupTools = document.getElementById('admin-backup-tools');

    adminCheckbox.checked = state.adminMode || false;
    toggleAdminUI(adminCheckbox.checked);

    adminCheckbox.addEventListener('change', (e) => {
        state.adminMode = e.target.checked;
        saveState();
        toggleAdminUI(state.adminMode);
    });

    function toggleAdminUI(isActive) {
        if (isActive) {
            document.body.classList.add('admin-active-mode');
            adminStatusText.innerHTML = '<i class="fa-solid fa-lock-open text-warning"></i> Modo Edição';
            adminStatusText.classList.add('admin-active');
            adminBackupTools.style.display = 'flex';
        } else {
            document.body.classList.remove('admin-active-mode');
            adminStatusText.innerHTML = '<i class="fa-solid fa-lock"></i> Modo Leitura';
            adminStatusText.classList.remove('admin-active');
            adminBackupTools.style.display = 'none';
        }
        
        // Atualiza a visualização da aba ativa para habilitar/desabilitar botões
        const activeBtn = document.querySelector('.nav-btn.active');
        if (activeBtn) {
            renderActiveTabContent(activeBtn.getAttribute('data-tab'));
        }
    }

    // -----------------------------------------------------
    // 5. NÚCLEO DOS CONTROLES DE COMPONENTES INTERATIVOS
    // -----------------------------------------------------
    
    // Seleção ativa de atletas (usada nos painéis de Alocação de Canoa, Quartos e Veículos)
    let selectedRowerId = null;
    let selectedRoomRowerId = null;
    let selectedCarpoolRowerId = null;

    // (Weeks list and calendar events moved to the top of DOMContentLoaded to resolve ReferenceErrors)

    function renderActiveTabContent(tabId) {
        switch (tabId) {
            case 'treinos':
                renderTreinosPanel();
                break;
            case 'escalacao':
                renderEscalacaoPanel();
                break;
            case 'financeiro':
                renderFinanceiroPanel();
                break;
            case 'estadia':
                renderEstadiaPanel();
                break;
            case 'translado':
                renderTransladoPanel();
                break;
            case 'uniformes':
                renderUniformesPanel();
                break;
            case 'whatsapp':
                renderWhatsappPanel();
                break;
        }
    }

    // -----------------------------------------------------
    // 5.1 ABAS: DETALHAMENTO DE TREINOS (PAINEL 1)
    // -----------------------------------------------------
    function renderTreinosPanel() {
        // Render Timeline
        const timelineList = document.getElementById('calendar-timeline-list');
        timelineList.innerHTML = '';

        calendarEvents.forEach(evt => {
            let classType = '';
            let icon = 'fa-calendar';
            if (evt.type === 'training') {
                classType = 'training-day';
                icon = 'fa-circle-chevron-right';
            } else if (evt.type === 'race') {
                classType = 'race-day';
                icon = 'fa-flag-checkered';
            } else if (evt.type === 'target') {
                classType = 'target-day';
                icon = 'fa-trophy';
            }

            const item = document.createElement('div');
            item.className = `timeline-card ${classType}`;
            item.innerHTML = `
                <div class="timeline-info">
                    <h4><i class="fa-solid ${icon}"></i> ${evt.title}</h4>
                    <div class="timeline-date">${evt.date}</div>
                    <p style="font-size: 11px; margin-top: 3px; color: var(--text-secondary);">${evt.desc}</p>
                </div>
                <div class="timeline-meta">
                    ${evt.type === 'training' ? 'Treino' : evt.type === 'race' ? 'Prova' : 'Meta Principal'}
                </div>
            `;
            timelineList.appendChild(item);
        });

        // Initialize Week Selector
        const weekSelect = document.getElementById('training-week-select');
        const selectedVal = weekSelect.value;
        weekSelect.innerHTML = '';
        
        weeksList.forEach(wk => {
            const opt = document.createElement('option');
            opt.value = wk.id;
            opt.textContent = wk.label;
            weekSelect.appendChild(opt);
        });

        if (selectedVal && weeksList.some(w => w.id === selectedVal)) {
            weekSelect.value = selectedVal;
        } else {
            weekSelect.value = 'week-2'; // Default: week of first practice
        }

        renderWeeklyMileageChecklist(weekSelect.value);

        weekSelect.onchange = (e) => {
            renderWeeklyMileageChecklist(e.target.value);
        };
    }

    function renderWeeklyMileageChecklist(weekId) {
        const checklistContainer = document.getElementById('athlete-mileage-checklist');
        checklistContainer.innerHTML = '';

        // Obter remadores Pro (12 remadores da meta principal)
        const proAthletes = state.athletes.filter(a => a.category === 'pro');
        
        // Garantir que a semana existe no estado
        if (!state.weeklyMileage[weekId]) {
            state.weeklyMileage[weekId] = [];
        }

        const checkedList = state.weeklyMileage[weekId];

        proAthletes.forEach(ath => {
            const isChecked = checkedList.includes(ath.id);
            const card = document.createElement('div');
            card.className = `checklist-item ${isChecked ? 'checked' : ''}`;
            card.innerHTML = `
                <span class="checklist-rower-name">${ath.name}</span>
                <span class="checklist-status-icon"><i class="fa-solid fa-check"></i></span>
            `;

            card.onclick = () => {
                if (!state.adminMode) return; // Apenas modo admin pode alterar

                const index = checkedList.indexOf(ath.id);
                if (index > -1) {
                    checkedList.splice(index, 1);
                } else {
                    checkedList.push(ath.id);
                }
                saveState();
                renderWeeklyMileageChecklist(weekId);
            };

            checklistContainer.appendChild(card);
        });

        // Atualiza a quilometragem coletiva
        const checkedCount = checkedList.length;
        const totalMileage = checkedCount * 40;
        document.getElementById('team-mileage-progress').textContent = `Volume da Equipe: ${totalMileage}km (${checkedCount}/12 bateram)`;
    }

    // -----------------------------------------------------
    // 5.2 ABAS: SIMULADOR DE ESCALAÇÃO OC6 (PAINEL 2)
    // -----------------------------------------------------
    // (Seat roles configuration moved to the top of DOMContentLoaded)

    function renderEscalacaoPanel() {
        const athletesList = document.getElementById('escalacao-athletes-list');
        athletesList.innerHTML = '';

        // Exibir atletas da categoria Pró (e os Amadores que podem atuar como suplentes)
        const eligibleAthletes = state.athletes.filter(a => a.category === 'pro' || a.category === 'amador');

        eligibleAthletes.forEach(ath => {
            const isAllocated = Object.values(state.crew).includes(ath.id);
            const isSelected = selectedRowerId === ath.id;

            const card = document.createElement('div');
            card.className = `selection-node ${isSelected ? 'selected' : ''} ${isAllocated ? 'allocated' : ''}`;
            card.innerHTML = `
                <span class="selection-name">${ath.name}</span>
                <span class="selection-weight">${ath.weight}kg | ${ath.category.toUpperCase()}</span>
            `;

            card.onclick = () => {
                if (!state.adminMode) return; // Apenas admin altera

                if (selectedRowerId === ath.id) {
                    selectedRowerId = null;
                } else {
                    selectedRowerId = ath.id;
                }
                updateRowerSelectionUI();
                renderEscalacaoPanel();
            };

            athletesList.appendChild(card);
        });

        updateRowerSelectionUI();
        renderCanoeSimulationGraphics();
        renderCanoeSeatsList();
    }

    function updateRowerSelectionUI() {
        const indicator = document.getElementById('selected-rower-indicator');
        if (selectedRowerId) {
            const ath = state.athletes.find(a => a.id === selectedRowerId);
            indicator.textContent = `Selecionado: ${ath.name} (${ath.weight}kg). Clique em um assento na canoa abaixo.`;
            indicator.style.color = 'var(--color-accent-gold)';

            // Adicionar animações pulsantes para os nós de assento SVG livres
            document.querySelectorAll('.canoe-seat-node').forEach(node => {
                node.classList.add('active-target');
            });
        } else {
            indicator.textContent = state.adminMode 
                ? 'Nenhum remador selecionado. Clique em um remador para começar.'
                : 'Modo Leitura. Ative o "Modo Edição" no topo para alterar assentos.';
            indicator.style.color = 'var(--text-muted)';
            
            document.querySelectorAll('.canoe-seat-node').forEach(node => {
                node.classList.remove('active-target');
            });
        }
    }

    function renderCanoeSimulationGraphics() {
        let totalWeight = 0;
        let oddWeight = 0; // Seats 1, 3, 5
        let evenWeight = 0; // Seats 2, 4, 6

        for (let seat = 1; seat <= 6; seat++) {
            const rowerId = state.crew[seat];
            const node = document.querySelector(`.canoe-seat-node[data-seat="${seat}"]`);
            
            if (rowerId) {
                const rower = state.athletes.find(a => a.id === rowerId);
                totalWeight += rower.weight;
                if (seat % 2 === 1) {
                    oddWeight += rower.weight;
                } else {
                    evenWeight += rower.weight;
                }

                if (node) {
                    node.classList.add('occupied');
                    node.setAttribute('fill', 'var(--color-primary)');
                }
            } else {
                if (node) {
                    node.classList.remove('occupied');
                    node.setAttribute('fill', '#0c1a23');
                }
            }
        }

        // Atualizar Métricas
        document.getElementById('balance-total-weight').textContent = `${totalWeight} kg`;
        document.getElementById('balance-odd-weight').textContent = `${oddWeight} kg`;
        document.getElementById('balance-even-weight').textContent = `${evenWeight} kg`;
        
        const diff = Math.abs(oddWeight - evenWeight);
        const diffText = `${diff} kg`;
        document.getElementById('balance-lateral-diff').textContent = diffText;

        const symmetryIndicator = document.getElementById('balance-symmetry-indicator');
        if (totalWeight === 0) {
            symmetryIndicator.className = 'balance-metric';
            document.getElementById('balance-lateral-diff').textContent = '0 kg';
        } else if (diff > 10) {
            symmetryIndicator.className = 'balance-metric unbalanced';
            document.getElementById('balance-lateral-diff').innerHTML = `${diffText} <i class="fa-solid fa-triangle-exclamation"></i>`;
        } else {
            symmetryIndicator.className = 'balance-metric balanced';
            document.getElementById('balance-lateral-diff').innerHTML = `${diffText} <i class="fa-solid fa-circle-check"></i>`;
        }
    }

    function renderCanoeSeatsList() {
        const container = document.getElementById('canoe-seats-rows-container');
        container.innerHTML = '';

        for (let seat = 1; seat <= 6; seat++) {
            const rowerId = state.crew[seat];
            const hasRower = !!rowerId;
            const rower = hasRower ? state.athletes.find(a => a.id === rowerId) : null;

            const row = document.createElement('div');
            row.className = `seat-row ${hasRower ? 'row-occupied' : ''}`;
            row.innerHTML = `
                <div class="seat-number-badge">${seat}</div>
                <div class="seat-meta-info">
                    <h5>${seatRoles[seat].name}</h5>
                    <p>${seatRoles[seat].desc}</p>
                </div>
                <div class="seat-assigned-rower">
                    ${hasRower ? `${rower.name} (${rower.weight}kg)` : 'VAGO'}
                </div>
                ${hasRower ? `<button class="seat-action-btn" data-seat="${seat}"><i class="fa-solid fa-xmark"></i></button>` : ''}
            `;

            // Clique na linha do assento para alocar o atleta selecionado
            row.onclick = (e) => {
                if (!state.adminMode) return; // Apenas admin altera
                if (e.target.closest('.seat-action-btn')) return; // ignorar se clicou no botão "x"

                allocateRowerToSeat(seat);
            };

            const removeBtn = row.querySelector('.seat-action-btn');
            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (!state.adminMode) return;
                    removeRowerFromSeat(seat);
                };
            }

            container.appendChild(row);
        }
    }

    function allocateRowerToSeat(seatNumber) {
        if (!selectedRowerId) return;

        // Limpar o atleta da sua posição anterior se ele já estiver em outro assento
        for (let s in state.crew) {
            if (state.crew[s] === selectedRowerId) {
                state.crew[s] = null;
            }
        }

        // Alocar no novo assento
        state.crew[seatNumber] = selectedRowerId;
        selectedRowerId = null;

        saveState();
        renderEscalacaoPanel();
    }

    function removeRowerFromSeat(seatNumber) {
        state.crew[seatNumber] = null;
        saveState();
        renderEscalacaoPanel();
    }

    // Configurar botões de ação do painel de escalação
    document.getElementById('btn-clear-escalacao').onclick = () => {
        if (!state.adminMode) return;
        if (confirm("Deseja realmente limpar toda a escalação da canoa?")) {
            state.crew = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
            saveState();
            renderEscalacaoPanel();
        }
    };

    // Cliques diretos nas esferas de assento do SVG
    document.querySelectorAll('.canoe-seat-node').forEach(node => {
        node.onclick = (e) => {
            if (!state.adminMode) return;
            const seat = parseInt(node.getAttribute('data-seat'));
            allocateRowerToSeat(seat);
        };
    });


    // -----------------------------------------------------
    // 5.3 ABAS: FINANCEIRO & VAKINHA (PAINEL 3)
    // -----------------------------------------------------
    function renderFinanceiroPanel() {
        const collected = state.financials.vakinhaCollected;
        const target = 30000;
        const percent = Math.min(Math.round((collected / target) * 100), 100);

        // Atualizar Thermometer
        document.getElementById('thermometer-current-val').textContent = `R$ ${collected.toLocaleString('pt-BR', {minimumFractionDigits: 2})} arrecadados`;
        document.getElementById('thermometer-percent-val').textContent = `${percent}%`;
        document.getElementById('thermometer-fill-bar').style.width = `${percent}%`;

        // Seção Vakinha status
        document.getElementById('vakinha-total-status').textContent = `Meta: R$ ${target.toLocaleString('pt-BR')} | Captação: ${percent}%`;

        // Inputs Admin
        document.getElementById('input-vakinha-collected').value = state.financials.vakinhaCollected;
        document.getElementById('input-boat-total-cost').value = state.financials.boatTotalCost;
        document.getElementById('input-registration-cost').value = state.financials.registrationCostPerAthlete;
        document.getElementById('input-vakinha-link').value = state.financials.vakinhaLink;

        // Vakinha Button CTA Link
        document.getElementById('btn-go-to-vakinha').href = state.financials.vakinhaLink;

        // Renderizar Tabela de Pagamentos dos Remadores Pró (12 atletas do rateio)
        const proAthletes = state.athletes.filter(a => a.category === 'pro');
        const paymentsContainer = document.getElementById('athlete-payment-status-rows');
        paymentsContainer.innerHTML = '';

        let boatPaidCount = 0;
        let regPaidCount = 0;

        // Calcular custo individual de barco
        const boatCostPerPerson = Math.round(state.financials.boatTotalCost / 12);

        proAthletes.forEach(ath => {
            // Inicializar dados de pagamento se não existirem
            if (!state.financials.payments[ath.id]) {
                state.financials.payments[ath.id] = { boatPaid: false, regPaid: false };
            }

            const record = state.financials.payments[ath.id];
            if (record.boatPaid) boatPaidCount++;
            if (record.regPaid) regPaidCount++;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${ath.name}</td>
                <td class="payment-checkbox-cell">
                    <button class="btn-toggle-payment ${record.regPaid ? 'paid' : ''}" data-type="reg" data-id="${ath.id}">
                        ${record.regPaid ? 'PAGO' : 'PENDENTE'}
                    </button>
                </td>
                <td class="payment-checkbox-cell">
                    <button class="btn-toggle-payment ${record.boatPaid ? 'paid' : ''}" data-type="boat" data-id="${ath.id}">
                        ${record.boatPaid ? 'PAGO' : 'PENDENTE'}
                    </button>
                </td>
                <td>
                    <span class="badge ${record.regPaid && record.boatPaid ? 'badge-success' : record.regPaid || record.boatPaid ? 'badge-warning' : 'badge-danger'}">
                        ${record.regPaid && record.boatPaid ? 'Quitado' : record.regPaid || record.boatPaid ? 'Pendente Metade' : 'Sem Pagamento'}
                    </span>
                </td>
            `;

            // Configurar os cliques nos botões de pagamento
            tr.querySelectorAll('.btn-toggle-payment').forEach(btn => {
                btn.onclick = () => {
                    if (!state.adminMode) return; // Apenas admin pode editar

                    const id = btn.getAttribute('data-id');
                    const type = btn.getAttribute('data-type');
                    
                    if (type === 'reg') {
                        state.financials.payments[id].regPaid = !state.financials.payments[id].regPaid;
                    } else {
                        state.financials.payments[id].boatPaid = !state.financials.payments[id].boatPaid;
                    }

                    saveState();
                    renderFinanceiroPanel();
                };
            });

            paymentsContainer.appendChild(tr);
        });

        // Sumário geral de taxas coletadas
        const totalPaymentsExpected = (state.financials.registrationCostPerAthlete + boatCostPerPerson) * 12;
        const totalPaymentsCollected = (regPaidCount * state.financials.registrationCostPerAthlete) + (boatPaidCount * boatCostPerPerson);
        document.getElementById('finance-rates-summary').textContent = `Coletado: R$ ${totalPaymentsCollected} / R$ ${totalPaymentsExpected}`;
    }

    // Configurar inputs de alteração do Financeiro
    const setupFinancialInput = (inputId, stateField) => {
        const input = document.getElementById(inputId);
        input.onchange = (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0;
            state.financials[stateField] = val;
            saveState();
            renderFinanceiroPanel();
        };
    };

    setupFinancialInput('input-vakinha-collected', 'vakinhaCollected');
    setupFinancialInput('input-boat-total-cost', 'boatTotalCost');
    setupFinancialInput('input-registration-cost', 'registrationCostPerAthlete');
    
    document.getElementById('input-vakinha-link').onchange = (e) => {
        state.financials.vakinhaLink = e.target.value.trim();
        saveState();
        renderFinanceiroPanel();
    };


    // -----------------------------------------------------
    // 5.4 ABAS: ESTADIA & ALOJAMENTO (PAINEL 4)
    // -----------------------------------------------------
    function renderEstadiaPanel() {
        document.getElementById('lodge-name-display').textContent = state.accommodation.name;
        document.getElementById('lodge-address-display').textContent = state.accommodation.address;
        
        document.getElementById('input-lodge-name').value = state.accommodation.name;
        document.getElementById('input-lodge-address').value = state.accommodation.address;

        // Lista de pessoas disponíveis para alocação no quarto (12 Pró + 2 Apoio)
        const activeCrew = state.athletes.filter(a => a.category === 'pro' || a.category === 'apoio');
        const roomAthletesList = document.getElementById('room-athletes-list');
        roomAthletesList.innerHTML = '';

        // Juntar ocupantes de todos os quartos no estado
        let allocatedIds = [];
        state.accommodation.rooms.forEach(rm => {
            allocatedIds = allocatedIds.concat(rm.occupants);
        });

        activeCrew.forEach(ath => {
            const isAllocated = allocatedIds.includes(ath.id);
            const isSelected = selectedRoomRowerId === ath.id;

            const card = document.createElement('div');
            card.className = `selection-node ${isSelected ? 'selected' : ''} ${isAllocated ? 'allocated' : ''}`;
            card.innerHTML = `
                <span class="selection-name">${ath.name}</span>
            `;

            card.onclick = () => {
                if (!state.adminMode) return;
                
                if (selectedRoomRowerId === ath.id) {
                    selectedRoomRowerId = null;
                } else {
                    selectedRoomRowerId = ath.id;
                }
                updateRoomSelectionUI();
                renderEstadiaPanel();
            };

            roomAthletesList.appendChild(card);
        });

        updateRoomSelectionUI();
        renderRoomsGrid(allocatedIds.length);
    }

    function updateRoomSelectionUI() {
        const indicator = document.getElementById('selected-room-athlete-indicator');
        if (selectedRoomRowerId) {
            const ath = state.athletes.find(a => a.id === selectedRoomRowerId);
            indicator.textContent = `Selecionado: ${ath.name}. Clique em uma vaga livre nos quartos abaixo.`;
            indicator.style.color = 'var(--color-accent-gold)';
        } else {
            indicator.textContent = state.adminMode
                ? 'Nenhum integrante selecionado. Clique em alguém para alocar.'
                : 'Modo Leitura. Ative o "Modo Edição" para definir os quartos.';
            indicator.style.color = 'var(--text-muted)';
        }
    }

    function renderRoomsGrid(totalAllocated) {
        const container = document.getElementById('rooms-grid-container');
        container.innerHTML = '';

        document.getElementById('room-allocation-count').textContent = `${totalAllocated}/14 Alocados`;

        state.accommodation.rooms.forEach((room, roomIdx) => {
            const roomBox = document.createElement('div');
            roomBox.className = 'room-box';
            
            let occupantsHtml = '';
            
            for (let i = 0; i < room.capacity; i++) {
                const occupantId = room.occupants[i];
                if (occupantId) {
                    const occupant = state.athletes.find(a => a.id === occupantId);
                    occupantsHtml += `
                        <div class="occupant-row">
                            <span class="occupant-row-name"><i class="fa-solid fa-user-tag" style="color:var(--color-primary);"></i> ${occupant.name}</span>
                            <button class="occupant-remove-btn" data-room-idx="${roomIdx}" data-slot-idx="${i}"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    `;
                } else {
                    occupantsHtml += `
                        <div class="occupant-row slot-empty" data-room-idx="${roomIdx}">
                            <span>Vaga Livre</span>
                        </div>
                    `;
                }
            }

            roomBox.innerHTML = `
                <div class="room-box-header">
                    <h4><i class="fa-solid fa-door-closed"></i> ${room.name}</h4>
                    <span class="badge badge-info">${room.occupants.length}/${room.capacity}</span>
                </div>
                <div class="room-occupants-list">
                    ${occupantsHtml}
                </div>
            `;

            // Configurar clique para preencher vaga livre
            roomBox.querySelectorAll('.slot-empty').forEach(slot => {
                slot.onclick = () => {
                    if (!state.adminMode || !selectedRoomRowerId) return;

                    // Remover a pessoa de outros quartos se já estiver alocada
                    state.accommodation.rooms.forEach(rm => {
                        const idx = rm.occupants.indexOf(selectedRoomRowerId);
                        if (idx > -1) {
                            rm.occupants.splice(idx, 1);
                        }
                    });

                    // Adicionar ao quarto atual
                    room.occupants.push(selectedRoomRowerId);
                    selectedRoomRowerId = null;

                    saveState();
                    renderEstadiaPanel();
                };
            });

            // Configurar clique para remover ocupante
            roomBox.querySelectorAll('.occupant-remove-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (!state.adminMode) return;
                    
                    const slotIdx = parseInt(btn.getAttribute('data-slot-idx'));
                    room.occupants.splice(slotIdx, 1);
                    
                    saveState();
                    renderEstadiaPanel();
                };
            });

            container.appendChild(roomBox);
        });
    }

    // Configurar campos de inputs de Estadia
    document.getElementById('input-lodge-name').onchange = (e) => {
        state.accommodation.name = e.target.value.trim();
        saveState();
        renderEstadiaPanel();
    };
    
    document.getElementById('input-lodge-address').onchange = (e) => {
        state.accommodation.address = e.target.value.trim();
        saveState();
        renderEstadiaPanel();
    };


    // -----------------------------------------------------
    // 5.5 ABAS: TRANSLADO & TRANSPORTE (PAINEL 5)
    // -----------------------------------------------------
    function renderTransladoPanel() {
        document.getElementById('canoe-freight-status').textContent = state.transport.freightText;
        document.getElementById('input-freight-text').value = state.transport.freightText;

        // Lista de pessoas disponíveis para o Translado (14 pessoas do contingente)
        const activeCrew = state.athletes.filter(a => a.category === 'pro' || a.category === 'apoio');
        const carpoolAthletesList = document.getElementById('carpool-athletes-list');
        carpoolAthletesList.innerHTML = '';

        // Juntar ocupantes de todos os veículos
        let allocatedIds = [];
        state.transport.vehicles.forEach(vh => {
            allocatedIds = allocatedIds.concat(vh.occupants);
        });

        activeCrew.forEach(ath => {
            const isAllocated = allocatedIds.includes(ath.id);
            const isSelected = selectedCarpoolRowerId === ath.id;

            const card = document.createElement('div');
            card.className = `selection-node ${isSelected ? 'selected' : ''} ${isAllocated ? 'allocated' : ''}`;
            card.innerHTML = `
                <span class="selection-name">${ath.name}</span>
            `;

            card.onclick = () => {
                if (!state.adminMode) return;

                if (selectedCarpoolRowerId === ath.id) {
                    selectedCarpoolRowerId = null;
                } else {
                    selectedCarpoolRowerId = ath.id;
                }
                updateCarpoolSelectionUI();
                renderTransladoPanel();
            };

            carpoolAthletesList.appendChild(card);
        });

        updateCarpoolSelectionUI();
        renderVehiclesGrid();
    }

    function updateCarpoolSelectionUI() {
        const indicator = document.getElementById('selected-carpool-athlete-indicator');
        if (selectedCarpoolRowerId) {
            const ath = state.athletes.find(a => a.id === selectedCarpoolRowerId);
            indicator.textContent = `Selecionado: ${ath.name}. Clique em uma vaga livre em um veículo abaixo.`;
            indicator.style.color = 'var(--color-accent-gold)';
        } else {
            indicator.textContent = state.adminMode
                ? 'Nenhum integrante selecionado. Clique em alguém para alocar.'
                : 'Modo Leitura. Ative o "Modo Edição" para definir as caronas.';
            indicator.style.color = 'var(--text-muted)';
        }
    }

    function renderVehiclesGrid() {
        const container = document.getElementById('vehicles-grid-container');
        container.innerHTML = '';

        state.transport.vehicles.forEach((vehicle, vehicleIdx) => {
            const vehicleBox = document.createElement('div');
            vehicleBox.className = 'vehicle-box';
            
            let occupantsHtml = '';
            
            for (let i = 0; i < vehicle.capacity; i++) {
                const occupantId = vehicle.occupants[i];
                if (occupantId) {
                    const occupant = state.athletes.find(a => a.id === occupantId);
                    occupantsHtml += `
                        <div class="occupant-row">
                            <span class="occupant-row-name"><i class="fa-solid fa-person-circle-check" style="color:var(--color-primary);"></i> ${occupant.name}</span>
                            <button class="occupant-remove-btn" data-vehicle-idx="${vehicleIdx}" data-slot-idx="${i}"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    `;
                } else {
                    occupantsHtml += `
                        <div class="occupant-row slot-empty" data-vehicle-idx="${vehicleIdx}">
                            <span>Vaga Livre</span>
                        </div>
                    `;
                }
            }

            vehicleBox.innerHTML = `
                <div class="vehicle-box-header">
                    <h4><i class="fa-solid fa-car"></i> ${vehicle.name}</h4>
                    <span class="badge badge-info">${vehicle.occupants.length}/${vehicle.capacity}</span>
                </div>
                <div class="vehicle-occupants-list">
                    ${occupantsHtml}
                </div>
            `;

            // Configurar clique para preencher vaga livre
            vehicleBox.querySelectorAll('.slot-empty').forEach(slot => {
                slot.onclick = () => {
                    if (!state.adminMode || !selectedCarpoolRowerId) return;

                    // Remover a pessoa de outros veículos se já estiver alocada
                    state.transport.vehicles.forEach(vh => {
                        const idx = vh.occupants.indexOf(selectedCarpoolRowerId);
                        if (idx > -1) {
                            vh.occupants.splice(idx, 1);
                        }
                    });

                    // Adicionar ao veículo atual
                    vehicle.occupants.push(selectedCarpoolRowerId);
                    selectedCarpoolRowerId = null;

                    saveState();
                    renderTransladoPanel();
                };
            });

            // Configurar clique para remover ocupante
            vehicleBox.querySelectorAll('.occupant-remove-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (!state.adminMode) return;
                    
                    const slotIdx = parseInt(btn.getAttribute('data-slot-idx'));
                    vehicle.occupants.splice(slotIdx, 1);
                    
                    saveState();
                    renderTransladoPanel();
                };
            });

            container.appendChild(vehicleBox);
        });
    }

    // Adicionar novo veículo
    document.getElementById('btn-add-vehicle').onclick = () => {
        if (!state.adminMode) return;
        const name = prompt("Digite o nome/responsável do veículo (Ex: Carro Guga, Carro Jean):");
        if (name && name.trim()) {
            state.transport.vehicles.push({
                id: `vehicle-${Date.now()}`,
                name: `${name.trim()} (4 vagas)`,
                capacity: 4,
                occupants: []
            });
            saveState();
            renderTransladoPanel();
        }
    };

    // Configurar alteração de texto do frete da canoa
    document.getElementById('input-freight-text').onchange = (e) => {
        state.transport.freightText = e.target.value.trim();
        saveState();
        renderTransladoPanel();
    };


    // -----------------------------------------------------
    // 5.6 ABAS: UNIFORMES (PAINEL 6)
    // -----------------------------------------------------
    // (Available sizes list moved to the top of DOMContentLoaded)

    function renderUniformesPanel() {
        // Obter todas as 14 pessoas ativas do time (12 remadores pró + 2 apoio)
        const activeCrew = state.athletes.filter(a => a.category === 'pro' || a.category === 'apoio');
        const container = document.getElementById('athlete-uniform-sizes-rows');
        container.innerHTML = '';

        activeCrew.forEach(ath => {
            // Inicializar dados de uniforme se não existirem
            if (!state.uniforms[ath.id]) {
                state.uniforms[ath.id] = { shirtSize: "G", shortsSize: "G" };
            }

            const record = state.uniforms[ath.id];
            
            // Gerar opções de seleção para camiseta
            let shirtOptions = '';
            availableSizes.forEach(size => {
                shirtOptions += `<option value="${size}" ${record.shirtSize === size ? 'selected' : ''}>${size}</option>`;
            });

            // Gerar opções de seleção para bermuda
            let shortsOptions = '';
            availableSizes.forEach(size => {
                shortsOptions += `<option value="${size}" ${record.shortsSize === size ? 'selected' : ''}>${size}</option>`;
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${ath.name}</td>
                <td>
                    <select class="shirt-select" data-id="${ath.id}" ${state.adminMode ? '' : 'disabled'}>
                        ${shirtOptions}
                    </select>
                </td>
                <td>
                    <select class="shorts-select" data-id="${ath.id}" ${state.adminMode ? '' : 'disabled'}>
                        ${shortsOptions}
                    </select>
                </td>
            `;

            // Configurar listeners de mudança nos selectores
            tr.querySelector('.shirt-select').onchange = (e) => {
                state.uniforms[ath.id].shirtSize = e.target.value;
                saveState();
                calculateUniformsSummaries();
            };

            tr.querySelector('.shorts-select').onchange = (e) => {
                state.uniforms[ath.id].shortsSize = e.target.value;
                saveState();
                calculateUniformsSummaries();
            };

            container.appendChild(tr);
        });

        calculateUniformsSummaries();
    }

    function calculateUniformsSummaries() {
        const activeCrew = state.athletes.filter(a => a.category === 'pro' || a.category === 'apoio');
        
        const shirtCounts = {};
        const shortsCounts = {};

        availableSizes.forEach(size => {
            shirtCounts[size] = 0;
            shortsCounts[size] = 0;
        });

        activeCrew.forEach(ath => {
            const record = state.uniforms[ath.id] || { shirtSize: "G", shortsSize: "G" };
            if (shirtCounts[record.shirtSize] !== undefined) shirtCounts[record.shirtSize]++;
            if (shortsCounts[record.shortsSize] !== undefined) shortsCounts[record.shortsSize]++;
        });

        // Renderizar sumário de camisetas
        const shirtList = document.getElementById('shirt-summary-list');
        shirtList.innerHTML = '';
        
        for (let size in shirtCounts) {
            if (shirtCounts[size] > 0) {
                const li = document.createElement('li');
                li.textContent = `${size}: ${shirtCounts[size]}`;
                shirtList.appendChild(li);
            }
        }
        if (shirtList.children.length === 0) {
            shirtList.innerHTML = '<li style="font-style:italic; font-weight:normal; background:transparent; padding:0; color:var(--text-muted);">Nenhum selecionado</li>';
        }

        // Renderizar sumário de bermudas
        const shortsList = document.getElementById('shorts-summary-list');
        shortsList.innerHTML = '';
        
        for (let size in shortsCounts) {
            if (shortsCounts[size] > 0) {
                const li = document.createElement('li');
                li.textContent = `${size}: ${shortsCounts[size]}`;
                shortsList.appendChild(li);
            }
        }
        if (shortsList.children.length === 0) {
            shortsList.innerHTML = '<li style="font-style:italic; font-weight:normal; background:transparent; padding:0; color:var(--text-muted);">Nenhum selecionado</li>';
        }
    }


    // -----------------------------------------------------
    // 5.7 ABAS: WHATSAPP E AVISOS (PAINEL 7)
    // -----------------------------------------------------
    function renderWhatsappPanel() {
        // Descritivo do grupo whatsapp
        const descPreview = document.getElementById('whatsapp-group-desc-preview');
        descPreview.textContent = `GRUPO: VIBE NATUREZA 2026 🌊
===================================
Este grupo foi criado para organizar a participação do time NATUREZA VA'A na prova VIBE 2026 (Volta a Ilhabela - SP), marcada para 04/12/2026.

Regras e Alinhamentos:
1. CANAL DE COMUNICADOS: Apenas o administrador posta informações estruturadas. Evite mensagens paralelas para não diluir os prazos importantes.
2. INTERAÇÕES: Utilize reações rápidas (👍, ❤️, 🛶) para acusar leitura e participe ativamente votando nas enquetes de treino.
3. COMPROMISSO DE DISTÂNCIA: Carga individual obrigatória de 40km semanais de remada complementar. Registre seu volume semanal na Central Organizacional.
4. FINANCEIRO: Rateio do barco de apoio e das inscrições deve ser quitado de acordo com os cronogramas avisados.
===================================`;

        // Ativar o gerador de mensagens baseadas no modelo selecionado
        const templateSelect = document.getElementById('message-template-select');
        
        generateWhatsappTemplateText(templateSelect.value);

        templateSelect.onchange = (e) => {
            generateWhatsappTemplateText(e.target.value);
        };
    }

    function generateWhatsappTemplateText(templateId) {
        const previewText = document.getElementById('generated-message-preview-text');
        const proAthletes = state.athletes.filter(a => a.category === 'pro');
        
        let msg = '';

        switch (templateId) {
            case 'weekly-mileage':
                // Listar quem bateu a meta da semana atual
                const weekSelect = document.getElementById('training-week-select');
                const weekId = weekSelect ? weekSelect.value : 'week-2';
                const weekLabel = weeksList.find(w => w.id === weekId)?.label || 'Semana';
                const checkedAthletes = state.weeklyMileage[weekId] || [];

                msg = `🚨 *RELATÓRIO DE METAS SEMANAIS - NATUREZA VA'A* 🛶\n`;
                msg += `📅 Semana: *${weekLabel}*\n`;
                msg += `🎯 Carga complementar individual: *40km*\n\n`;
                msg += `Veja quem já registrou a meta batida na Central:\n`;
                
                proAthletes.forEach(ath => {
                    const ok = checkedAthletes.includes(ath.id);
                    msg += `${ok ? '✅' : '⬜'} *${ath.name}*: ${ok ? 'Meta Batida! 🌊' : 'Pendente'}\n`;
                });

                const batidos = checkedAthletes.length;
                msg += `\n📊 Progresso do Grupo: *${batidos}/12 remadores* concluíram.\n`;
                msg += `Quem treinou essa semana, por favor registre o check-in na Central Organizacional: *https://elmonte.dev.br/vibe2026* ! 💪`;
                break;

            case 'training-call':
                msg = `🛶 *CONVOCATÓRIA: TREINO OFICIAL OC6* 🛶\n`;
                msg += `🌊 Base Natureza Va'a - Sambaqui/SC\n\n`;
                msg += `Fala time! Próximo Domingo teremos nosso treino de entrosamento na OC6.\n`;
                msg += `📅 *Data:* Próximo Domingo\n`;
                msg += `⏰ *Horário:* 07:30 (Canoa na água pontualmente)\n`;
                msg += `📍 *Foco:* Alinhamento de remada, sincronia de voga e transições.\n\n`;
                msg += `⚠️ *Aviso Importante:* A presença dos 12 remadores pró é essencial para ajustarmos o arranjo de peso e balanço. Confirme sua presença reagindo com 🛶 neste post!\n\n`;
                msg += `Tamo junto! Rumo à VIBE 2026! 🏆`;
                break;

            case 'payment-reminder':
                const boatCostPerPerson = Math.round(state.financials.boatTotalCost / 12);
                msg = `💳 *Lembrete de Cobrança: Rateio Operacional VIBE* 💳\n\n`;
                msg += `Pessoal, precisamos fechar os repasses dos custos obrigatórios para garantir a nossa estrutura logísticas da prova:\n\n`;
                msg += `💰 *Valores por Atleta:* \n`;
                msg += `- Rateio Barco Apoio: *R$ ${boatCostPerPerson},00*\n`;
                msg += `- Taxa Inscrição Prova: *R$ ${state.financials.registrationCostPerAthlete},00*\n`;
                msg += `- *Total da Cota Individual: R$ ${boatCostPerPerson + state.financials.registrationCostPerAthlete},00*\n\n`;
                msg += `📌 *Dados para Pix:* Pix do Coordenador (disponível na Central).\n`;
                msg += `📅 *Data Limite de Envio:* 15/Out/2026\n\n`;
                msg += `Consulte o painel financeiro atualizado para ver seus recebidos e pendências: *https://elmonte.dev.br/vibe2026* ! 🛶`;
                break;

            case 'uniform-size-collect':
                msg = `👕 *COLETA DE TAMANHOS: UNIFORME OFICIAL VIBE* 👕\n\n`;
                msg += `Galera, estamos enviando a grade de uniformes para a confecção produzir nossos kits oficiais!\n\n`;
                msg += `Por favor, verifiquem se o seu tamanho de Camiseta e Bermuda/Saia está correto na Central Organizacional.\n`;
                msg += `🔗 Acesse a aba *Uniformes* em *https://elmonte.dev.br/vibe2026*\n\n`;
                msg += `Precisamos fechar a tabela até o final da semana para não haver atraso nas entregas. Obrigado! 🛶💪`;
                break;

            case 'final-roster':
                msg = `🏆 *ESCALAÇÃO OFICIAL DEFINIDA - OC6 VIBE 2026* 🛶\n\n`;
                msg += `Comissão técnica definiu o arranjo estratégico de assentos para as nossas remadas oficiais. Veja a distribuição de assentos:\n\n`;
                
                for (let seat = 1; seat <= 6; seat++) {
                    const rowerId = state.crew[seat];
                    const rowerName = rowerId ? state.athletes.find(a => a.id === rowerId).name : 'VAGO';
                    msg += `Banco *${seat}* [${seatRoles[seat].name}]: *${rowerName}*\n`;
                }

                msg += `\n📊 Balanço e peso da canoa calculados e salvos no painel da Central: *https://elmonte.dev.br/vibe2026*\n`;
                msg += `Qualquer dúvida técnica, me chamem no privado. Vamo com tudo! 🥇`;
                break;
        }

        previewText.textContent = msg;
    }

    // Copiar comunicado gerado para o clipboard
    document.getElementById('btn-copy-generated-message').onclick = () => {
        const text = document.getElementById('generated-message-preview-text').textContent;
        navigator.clipboard.writeText(text).then(() => {
            alert("Mensagem copiada para a área de transferência! Cole diretamente no seu grupo de WhatsApp.");
        }).catch(err => {
            console.error("Erro ao copiar texto:", err);
        });
    };


    // -----------------------------------------------------
    // 6. BACKUP DE DADOS (EXPORTAR/IMPORTAR/RESETAR)
    // -----------------------------------------------------
    document.getElementById('btn-export-data').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "vibe_natureza_backup.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    document.getElementById('btn-import-data').onclick = () => {
        document.getElementById('import-file-input').click();
    };

    document.getElementById('import-file-input').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const importedState = JSON.parse(evt.target.result);
                if (importedState.athletes && importedState.crew) {
                    state = importedState;
                    // Garantir sincronia do modo admin
                    adminCheckbox.checked = state.adminMode || false;
                    saveState();
                    toggleAdminUI(state.adminMode);
                    alert("Dados importados e salvos com sucesso!");
                } else {
                    alert("Arquivo de backup inválido. Chaves principais faltando.");
                }
            } catch (err) {
                alert("Erro ao ler o arquivo. Certifique-se de carregar um arquivo JSON válido.");
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    document.getElementById('btn-reset-data').onclick = () => {
        if (confirm("ATENÇÃO: Isso apagará todas as edições personalizadas de escalação, pagamentos, tamanhos de uniformes e check-ins semanais, restaurando as configurações iniciais do projeto. Deseja prosseguir?")) {
            localStorage.removeItem('vibe_natureza_state');
            loadState();
            adminCheckbox.checked = state.adminMode || false;
            toggleAdminUI(state.adminMode);
            alert("Central Organizacional restaurada para as premissas padrão.");
        }
    };


    // -----------------------------------------------------
    // 7. INICIALIZAÇÃO DE TODOS OS PAINÉIS
    // -----------------------------------------------------
    renderTreinosPanel();
    renderEscalacaoPanel();
    renderFinanceiroPanel();
    renderEstadiaPanel();
    renderTransladoPanel();
    renderUniformesPanel();
    renderWhatsappPanel();
    
    console.log("CentralVibe: app.js DOMContentLoaded completed successfully.");
    } catch (error) {
        console.error("CentralVibe ERROR in DOMContentLoaded:", error);
        alert("Erro na inicialização da Central: " + error.message + "\nTente recarregar a página com Ctrl+F5 ou clique em 'Limpar' se ativo.");
    }
});
