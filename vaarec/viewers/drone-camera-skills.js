/**
 * drone-camera-skills.js — VAAREC Generalized Cinematic Drone Camera Director
 * Motor de Câmera Virtual Drone com Damping Gimbal Ultra-Suave, Fila de Empilhamento (MasterShots),
 * Transições 100% Fluidas (Zero Piscar/Flicker de Tiles) e Cadência Adaptativa Invariante à Velocidade (1x a 30x).
 */

(function (global) {
  'use strict';

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function validPoint(lat, lon) {
    return lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon)) && isFinite(Number(lat)) && isFinite(Number(lon));
  }

  function computeLookAhead(lat, lon, headingDeg, meters) {
    if (!validPoint(lat, lon)) return null;
    const nLat = Number(lat);
    const nLon = Number(lon);
    const h = Number(headingDeg) || 0;
    const rad = (h * Math.PI) / 180;
    const dLat = (Number(meters) * Math.cos(rad)) / 111320;
    const cosLat = Math.cos((nLat * Math.PI) / 180) || 1;
    const dLon = (Number(meters) * Math.sin(rad)) / (111320 * cosLat);
    return [nLat + dLat, nLon + dLon];
  }

  function computeCentroid(points) {
    const valid = points.filter(p => p && validPoint(p[0], p[1]));
    if (!valid.length) return null;
    const lat = valid.reduce((sum, p) => sum + Number(p[0]), 0) / valid.length;
    const lon = valid.reduce((sum, p) => sum + Number(p[1]), 0) / valid.length;
    return [lat, lon];
  }

  function haversineDistM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  class DroneCameraSkills {
    constructor(options = {}) {
      if (!options.map) {
        throw new Error('DroneCameraSkills: informe a instância Leaflet em options.map');
      }

      this.map = options.map;
      this.getEntities = options.getEntities || (() => []);
      this.getContract = options.getContract || (() => global.CONTRACT || {});

      this.config = {
        defaultDuration: 1000,
        followZoom: 18.5, // Padrão Cinemático
        detailZoom: 19.5,
        twoCanoesZoom: 17.5,
        packZoom: 16.5,
        minZoom: 13,
        maxZoom: 20.5,
        padding: [40, 40],
        futureMeters: 18,
        zoomOffset: 0,
        altitudePreset: 'close', // 'close' (~30m), 'normal' (~60m), 'panoramic' (~150m)
        easing: easeInOutCubic,
        damping: 0.075, // Fator de amortecimento contínuo de voo (Gimbal Smoothing)
        zoomDamping: 0.045, // Transição de zoom ultra-suave sem flashes
        ...options.config
      };

      this.state = {
        mode: options.mode || 'auto', // 'auto', 'follow-leader', 'follow-canoe', 'follow-all', 'manual', 'overview', 'focustrack', 'quickshot', 'queue'
        targetCanoeIdx: 0,
        running: false,
        lastSimTime: 0,
        userInteracting: false,
        userInteractTimeout: null
      };

      // Gimbal Smoothing Filter (Estado físico contínuo do Drone)
      this._smoothDrone = {
        currentLat: null,
        currentLon: null,
        currentZoom: null,
        initialized: false
      };

      // Auto Director com cadência baseada em tempo real (Wall-Clock Time)
      const nowReal = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this._autoDirector = {
        phase: 'LEADER_LOOKAHEAD',
        phaseStartRealTime: nowReal,
        phaseDurationRealMs: 12000,
        flybyIdx: 0,
        lastFlybySwitchRealTime: nowReal,
        isTransitioning: false
      };

      // QuickShots Engine
      this._djiQuickShot = {
        active: false,
        type: null,
        targetCanoeIdx: 0,
        startRealTime: nowReal,
        durationRealMs: 8000,
        initialZoom: 18.5,
        initialHeading: 0,
        previousMode: 'auto',
        progress: 0
      };

      // FocusTrack Engine
      this._djiFocusTrack = {
        active: false,
        mode: 'activetrack',
        subMode: 'trace',
        orbitAngle: 0,
        orbitRadiusM: 45,
        orbitSpeedDegPerSec: 25,
        targetCanoeIdx: 0,
        lastRealTimeMs: nowReal
      };

      // Fila de Empilhamento (MasterShots Storyboard Queue)
      this._shotQueue = {
        active: false,
        items: [],
        currentIndex: 0,
        itemStartRealTime: nowReal,
        loop: false,
        initialZoom: 18.5
      };

      // Inter-Shot / Inter-Phase Smooth Transition Blender (Anti-Flicker & Zero Screen Blinking)
      this._shotTransition = {
        active: false,
        fromLat: null,
        fromLon: null,
        fromZoom: null,
        startRealTime: nowReal,
        durationMs: 1200
      };

      this._loadDefaultQueue();
      this._isProgrammaticMovement = false;
      this._bindUserInteractionEvents();
    }

    _loadDefaultQueue() {
      this._shotQueue.items = [
        { id: 'shot-1', type: 'quickshot', subType: 'dronie', name: 'Dronie (Abertura)', icon: '🚀', durationMs: 7500, targetCanoeIdx: 0 },
        { id: 'shot-2', type: 'focustrack', subType: 'activetrack', subMode: 'parallel', name: 'ActiveTrack Lateral', icon: '↔️', durationMs: 9000, targetCanoeIdx: 0 },
        { id: 'shot-3', type: 'quickshot', subType: 'helix', name: 'Helix (Espiral)', icon: '🌀', durationMs: 10000, targetCanoeIdx: 0 },
        { id: 'shot-4', type: 'director', subType: 'follow-leader', name: 'Look-Ahead Líder', icon: '👑', durationMs: 8000, targetCanoeIdx: 0 },
        { id: 'shot-5', type: 'quickshot', subType: 'asteroid', name: 'Asteroid (Clímax)', icon: '🪐', durationMs: 10500, targetCanoeIdx: 0 }
      ];
    }

    _bindUserInteractionEvents() {
      const container = this.map.getContainer();
      if (!container) return;

      const onUserInteraction = () => {
        if (this._isProgrammaticMovement) return;
        this.state.userInteracting = true;
        if (this.state.userInteractTimeout) clearTimeout(this.state.userInteractTimeout);
        this.state.userInteractTimeout = setTimeout(() => {
          this.state.userInteracting = false;
        }, 3500);
      };

      container.addEventListener('mousedown', onUserInteraction, { passive: true });
      container.addEventListener('touchstart', onUserInteraction, { passive: true });
      container.addEventListener('wheel', onUserInteraction, { passive: true });
    }

    // ==========================================
    // ALTITUDE E CONTROLE DE ZOOM
    // ==========================================

    
    _startShotTransition(durationMs = 1200) {
      if (!this._smoothDrone.initialized || this._smoothDrone.currentLat == null) return;
      const nowReal = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this._shotTransition = {
        active: true,
        fromLat: this._smoothDrone.currentLat,
        fromLon: this._smoothDrone.currentLon,
        fromZoom: this._smoothDrone.currentZoom,
        startRealTime: nowReal,
        durationMs: Math.max(400, Number(durationMs) || 1200)
      };
    }

    setAltitudePreset(preset) {
      this.state.userInteracting = false;
      if (preset === 'close') {
        this.config.altitudePreset = 'close';
        this.config.followZoom = 18.5;
        this.config.detailZoom = 19.5;
        this.config.twoCanoesZoom = 17.5;
        this.config.packZoom = 16.5;
        this.config.futureMeters = 16;
      } else if (preset === 'normal') {
        this.config.altitudePreset = 'normal';
        this.config.followZoom = 17.5;
        this.config.detailZoom = 18.5;
        this.config.twoCanoesZoom = 16.5;
        this.config.packZoom = 15.5;
        this.config.futureMeters = 24;
      } else if (preset === 'panoramic') {
        this.config.altitudePreset = 'panoramic';
        this.config.followZoom = 15.5;
        this.config.detailZoom = 16.5;
        this.config.twoCanoesZoom = 14.5;
        this.config.packZoom = 13.5;
        this.config.futureMeters = 38;
      }
      if (typeof this.config.onAltitudePresetChange === 'function') {
        this.config.onAltitudePresetChange(preset, this.config.followZoom);
      }
    }

    adjustZoomOffset(delta) {
      this.state.userInteracting = false;
      this.config.zoomOffset = clamp((this.config.zoomOffset || 0) + delta, -4, 4);
    }

    // ==========================================
    // QUICKSHOTS & FOCUSTRACK
    // ==========================================

    triggerQuickShot(type, params = {}) {
      this.state.userInteracting = false;
      this._shotQueue.active = false;
      const entities = this.getEntities();
      if (!entities.length) return false;

      const targetIdx = params.canoeIdx != null ? params.canoeIdx : (this.state.mode === 'follow-canoe' ? this.state.targetCanoeIdx : this._findLeaderIdx(entities));
      const target = entities[targetIdx] || entities[0];
      const tHeading = Number(target.heading ?? target.currentHeading ?? target._currentHeading ?? 0);
      const nowReal = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const durations = {
        dronie: 7500,
        rocket: 6500,
        circle: 8500,
        helix: 10500,
        boomerang: 9500,
        asteroid: 11000
      };

      this._djiQuickShot = {
        active: true,
        type: type,
        targetCanoeIdx: targetIdx,
        startRealTime: nowReal,
        durationRealMs: params.duration || durations[type] || 8000,
        initialZoom: this._smoothDrone.currentZoom || this.config.followZoom,
        initialHeading: tHeading,
        previousMode: (this.state.mode === 'quickshot' || this.state.mode === 'queue') ? 'auto' : this.state.mode,
        progress: 0
      };

      this._startShotTransition(1000);
      this.state.mode = 'quickshot';
      if (typeof this.config.onQuickShotStart === 'function') {
        this.config.onQuickShotStart(type, this._djiQuickShot);
      }
      return true;
    }

    cancelQuickShot() {
      if (this._djiQuickShot.active) {
        this._djiQuickShot.active = false;
        this._startShotTransition(800);
        const prev = this._djiQuickShot.previousMode || 'auto';
        this.setMode(prev);
      }
    }

    setFocusTrack(mode = 'activetrack', subMode = 'trace', params = {}) {
      this.state.userInteracting = false;
      this._djiQuickShot.active = false;
      this._shotQueue.active = false;
      const entities = this.getEntities();

      const targetIdx = params.canoeIdx != null ? params.canoeIdx : (this.state.mode === 'follow-canoe' ? this.state.targetCanoeIdx : this._findLeaderIdx(entities));
      const target = entities[targetIdx] || entities[0];
      const tHeading = Number(target.heading ?? target.currentHeading ?? target._currentHeading ?? 0);
      const nowReal = typeof performance !== 'undefined' ? performance.now() : Date.now();

      this._djiFocusTrack = {
        active: true,
        mode: mode,
        subMode: subMode || 'trace',
        orbitAngle: tHeading,
        orbitRadiusM: params.radiusM || 42,
        orbitSpeedDegPerSec: params.speedDeg || 28,
        targetCanoeIdx: targetIdx,
        lastRealTimeMs: nowReal
      };

      this._startShotTransition(1000);
      this.state.mode = 'focustrack';
      this.state.targetCanoeIdx = targetIdx;

      if (typeof this.config.onFocusTrackChange === 'function') {
        this.config.onFocusTrackChange(mode, subMode, this._djiFocusTrack);
      }
      return true;
    }

    // ==========================================
    // EMPILHAMENTO DE MOVIMENTOS (MASTERSHOTS STORYBOARD QUEUE)
    // ==========================================

    getQueue() {
      return this._shotQueue.items;
    }

    addShotToQueue(shot) {
      const id = 'shot-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const newShot = {
        id,
        type: shot.type || 'quickshot',
        subType: shot.subType || shot.type || 'dronie',
        subMode: shot.subMode || null,
        name: shot.name || 'Movimento',
        icon: shot.icon || '🎥',
        durationMs: Number(shot.durationMs) || 8000,
        targetCanoeIdx: Number(shot.targetCanoeIdx) || 0
      };
      this._shotQueue.items.push(newShot);
      if (typeof this.config.onQueueUpdate === 'function') {
        this.config.onQueueUpdate(this._shotQueue);
      }
      return newShot;
    }

    removeShotFromQueue(index) {
      if (index >= 0 && index < this._shotQueue.items.length) {
        this._shotQueue.items.splice(index, 1);
        if (typeof this.config.onQueueUpdate === 'function') {
          this.config.onQueueUpdate(this._shotQueue);
        }
      }
    }

    clearQueue() {
      this._shotQueue.items = [];
      this._shotQueue.active = false;
      if (typeof this.config.onQueueUpdate === 'function') {
        this.config.onQueueUpdate(this._shotQueue);
      }
    }

    moveQueueItem(fromIdx, toIdx) {
      if (fromIdx < 0 || fromIdx >= this._shotQueue.items.length || toIdx < 0 || toIdx >= this._shotQueue.items.length) return;
      const item = this._shotQueue.items.splice(fromIdx, 1)[0];
      this._shotQueue.items.splice(toIdx, 0, item);
      if (typeof this.config.onQueueUpdate === 'function') {
        this.config.onQueueUpdate(this._shotQueue);
      }
    }

    loadPresetQueue(presetName) {
      this._shotQueue.active = false;
      if (presetName === 'epic_mastershot' || presetName === 'epico') {
        this._shotQueue.items = [
          { id: 'm1', type: 'quickshot', subType: 'dronie', name: 'Dronie (Abertura)', icon: '🚀', durationMs: 7500, targetCanoeIdx: 0 },
          { id: 'm2', type: 'focustrack', subType: 'activetrack', subMode: 'parallel', name: 'ActiveTrack Lateral', icon: '↔️', durationMs: 9000, targetCanoeIdx: 0 },
          { id: 'm3', type: 'quickshot', subType: 'helix', name: 'Helix (Espiral)', icon: '🌀', durationMs: 10000, targetCanoeIdx: 0 },
          { id: 'm4', type: 'director', subType: 'follow-leader', name: 'Look-Ahead Líder', icon: '👑', durationMs: 8000, targetCanoeIdx: 0 },
          { id: 'm5', type: 'quickshot', subType: 'asteroid', name: 'Asteroid (Clímax)', icon: '🪐', durationMs: 10500, targetCanoeIdx: 0 }
        ];
      } else if (presetName === 'duel_combat' || presetName === 'duelo') {
        this._shotQueue.items = [
          { id: 'd1', type: 'director', subType: 'follow-leader', name: 'Líder na Proa', icon: '👑', durationMs: 8000, targetCanoeIdx: 0 },
          { id: 'd2', type: 'focustrack', subType: 'activetrack', subMode: 'parallel', name: 'Viga Lateral', icon: '↔️', durationMs: 8000, targetCanoeIdx: 0 },
          { id: 'd3', type: 'director', subType: 'chaser', name: 'Close Perseguidor 2º', icon: '⚔️', durationMs: 9000, targetCanoeIdx: 1 },
          { id: 'd4', type: 'quickshot', subType: 'boomerang', name: 'Boomerang Rasante', icon: '🪃', durationMs: 9000, targetCanoeIdx: 0 }
        ];
      } else if (presetName === 'start_tour' || presetName === 'largada') {
        this._shotQueue.items = [
          { id: 's1', type: 'quickshot', subType: 'rocket', name: 'Rocket Zenital 90°', icon: '⚡', durationMs: 7000, targetCanoeIdx: 0 },
          { id: 's2', type: 'focustrack', subType: 'poi', name: 'POI Órbita 360°', icon: '🔄', durationMs: 9000, targetCanoeIdx: 0 },
          { id: 's3', type: 'director', subType: 'follow-all', name: 'Pelotão Geral', icon: '👁️', durationMs: 8500, targetCanoeIdx: 0 },
          { id: 's4', type: 'focustrack', subType: 'activetrack', subMode: 'lead', name: 'Enquadramento Frontal', icon: '⬆️', durationMs: 8500, targetCanoeIdx: 0 }
        ];
      }
      if (typeof this.config.onQueueUpdate === 'function') {
        this.config.onQueueUpdate(this._shotQueue);
      }
    }

    startQueue(startIndex = 0) {
      if (!this._shotQueue.items.length) {
        this._loadDefaultQueue();
      }
      this.state.userInteracting = false;
      this._djiQuickShot.active = false;
      this._djiFocusTrack.active = false;

      const nowReal = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this._shotQueue.active = true;
      this._shotQueue.currentIndex = clamp(startIndex, 0, this._shotQueue.items.length - 1);
      this._shotQueue.itemStartRealTime = nowReal;
      this._shotQueue.initialZoom = this._smoothDrone.currentZoom || this.config.followZoom;

      this._startShotTransition(1000);
      this.state.mode = 'queue';

      if (typeof this.config.onQueueStart === 'function') {
        this.config.onQueueStart(this._shotQueue);
      }
      return true;
    }

    stopQueue() {
      this._shotQueue.active = false;
      this.setMode('auto');
      if (typeof this.config.onQueueEnd === 'function') {
        this.config.onQueueEnd();
      }
    }

    // ==========================================
    // CONTROLE DE MODOS & COMANDOS
    // ==========================================

    setMode(mode, params = {}) {
      this._djiQuickShot.active = false;
      this._djiFocusTrack.active = false;
      this._shotQueue.active = false;
      this._startShotTransition(1000);
      this.state.mode = mode;
      this.state.userInteracting = false;
      if (params.canoeIdx != null) this.state.targetCanoeIdx = params.canoeIdx;
      if (params.canoe != null) this.state.targetCanoeIdx = params.canoe;

      const nowReal = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (mode === 'auto' || mode === 'smart') {
        this.state.mode = 'auto';
        this._autoDirector.phase = 'LEADER_LOOKAHEAD';
        this._autoDirector.phaseStartRealTime = nowReal;
        this._autoDirector.phaseDurationRealMs = 12000;
        this._autoDirector.isTransitioning = false;
      }
    }

    stop() {
      this.state.running = false;
    }

    // ==========================================
    // REPLAY ENGINE UPDATE (CHAMADO A CADA FRAME)
    // ==========================================

    update(currentTimeMs, force = false) {
      this.state.lastSimTime = currentTimeMs;
      if (this.state.userInteracting && !force) return;
      if (this.state.mode === 'manual') return;

      const entities = this.getEntities();
      if (!entities.length) return;

      const realNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let targetCenter = null;
      let targetZoom = null;

      // ==========================================
      // 1. FILA DE EMPILHAMENTO (MASTERSHOTS STORYBOARD QUEUE)
      // ==========================================
      if (this.state.mode === 'queue' && this._shotQueue.active && this._shotQueue.items.length) {
        const queue = this._shotQueue;
        const currentShot = queue.items[queue.currentIndex];
        const realElapsed = realNow - queue.itemStartRealTime;
        const u = clamp(realElapsed / currentShot.durationMs, 0, 1);

        const targetIdx = currentShot.targetCanoeIdx != null ? currentShot.targetCanoeIdx : this._findLeaderIdx(entities);
        const target = entities[targetIdx] || entities[0];
        const tLat = Number(target.lat ?? target.latitude ?? target.currentPos?.lat);
        const tLon = Number(target.lon ?? target.lng ?? target.longitude ?? target.currentPos?.lon);
        const tHeading = Number(target.heading ?? target.currentHeading ?? target._currentHeading ?? 0);
        const cosLat = Math.cos((tLat * Math.PI) / 180) || 1;
        const baseZ = queue.initialZoom || this.config.followZoom;

        const shotKind = currentShot.subType || currentShot.type;

        if (shotKind === 'dronie') {
          const backDist = -(12 + 95 * u);
          targetCenter = computeLookAhead(tLat, tLon, tHeading, backDist) || [tLat, tLon];
          targetZoom = baseZ - 2.8 * u;
        } else if (shotKind === 'rocket') {
          targetCenter = [tLat, tLon];
          targetZoom = baseZ - 3.8 * Math.sin(u * Math.PI * 0.5);
        } else if (shotKind === 'circle') {
          const angleDeg = tHeading + 360 * u;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 42;
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = baseZ;
        } else if (shotKind === 'helix') {
          const angleDeg = tHeading + 540 * u;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 25 + 90 * u;
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = baseZ - 2.6 * u;
        } else if (shotKind === 'boomerang') {
          const angleDeg = tHeading + 360 * u;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 30 + 80 * Math.sin(u * Math.PI);
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = baseZ - 2.0 * Math.sin(u * Math.PI);
        } else if (shotKind === 'asteroid') {
          if (u < 0.6) {
            const f = u / 0.6;
            targetCenter = computeLookAhead(tLat, tLon, tHeading, -(15 + 120 * f)) || [tLat, tLon];
            targetZoom = baseZ - 3.8 * f;
          } else {
            const f = (u - 0.6) / 0.4;
            targetCenter = computeLookAhead(tLat, tLon, tHeading, -135 * (1 - f)) || [tLat, tLon];
            targetZoom = (baseZ - 3.8) + 3.8 * f;
          }
        } else if (shotKind === 'spotlight') {
          targetCenter = computeLookAhead(tLat, tLon, tHeading, 10) || [tLat, tLon];
          targetZoom = baseZ;
        } else if (shotKind === 'poi') {
          const angleDeg = (tHeading + (realElapsed / 1000) * 28) % 360;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 45;
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = baseZ;
        } else if (shotKind === 'activetrack') {
          const subM = currentShot.subMode || 'trace';
          if (subM === 'parallel') targetCenter = computeLookAhead(tLat, tLon, (tHeading + 90) % 360, 32) || [tLat, tLon];
          else if (subM === 'lead') targetCenter = computeLookAhead(tLat, tLon, tHeading, 35) || [tLat, tLon];
          else targetCenter = computeLookAhead(tLat, tLon, tHeading, -25) || [tLat, tLon];
          targetZoom = baseZ;
        } else if (shotKind === 'chaser') {
          const sorted = [...entities].sort((a, b) => (b.accDist ?? 0) - (a.accDist ?? 0));
          const chaser = sorted[1] || sorted[0];
          const cLat = Number(chaser.lat ?? chaser.currentPos?.lat);
          const cLon = Number(chaser.lon ?? chaser.currentPos?.lon);
          const cH = Number(chaser.heading ?? chaser.currentHeading ?? 0);
          targetCenter = computeLookAhead(cLat, cLon, cH, 12) || [cLat, cLon];
          targetZoom = baseZ;
        } else if (shotKind === 'follow-all') {
          const pts = entities.map(e => [e.lat ?? e.currentPos?.lat, e.lon ?? e.currentPos?.lon]).filter(p => validPoint(p[0], p[1]));
          targetCenter = computeCentroid(pts) || [tLat, tLon];
          targetZoom = this._calculateGroupZoom(pts);
        } else {
          targetCenter = computeLookAhead(tLat, tLon, tHeading, this.config.futureMeters || 16) || [tLat, tLon];
          targetZoom = baseZ;
        }

        if (typeof this.config.onQueueProgress === 'function') {
          this.config.onQueueProgress(queue.currentIndex, queue.items.length, u, currentShot);
        }

        if (u >= 1) {
          queue.currentIndex++;
          queue.itemStartRealTime = realNow;
          this._startShotTransition(1200);
          if (queue.currentIndex >= queue.items.length) {
            if (queue.loop) {
              queue.currentIndex = 0;
            } else {
              this.stopQueue();
              return;
            }
          }
          if (typeof this.config.onQueueNextShot === 'function') {
            this.config.onQueueNextShot(queue.currentIndex, queue.items[queue.currentIndex]);
          }
        }
      }

      // ==========================================
      // 2. QUICKSHOTS EXECUTION ENGINE (INDIVIDUAL)
      // ==========================================
      else if (this.state.mode === 'quickshot' && this._djiQuickShot.active) {
        const qs = this._djiQuickShot;
        const realElapsed = realNow - qs.startRealTime;
        const u = clamp(realElapsed / qs.durationRealMs, 0, 1);
        qs.progress = u;

        const target = entities[qs.targetCanoeIdx] || entities[0];
        const tLat = Number(target.lat ?? target.latitude ?? target.currentPos?.lat);
        const tLon = Number(target.lon ?? target.lng ?? target.longitude ?? target.currentPos?.lon);
        const tHeading = Number(target.heading ?? target.currentHeading ?? target._currentHeading ?? 0);
        const cosLat = Math.cos((tLat * Math.PI) / 180) || 1;

        if (qs.type === 'dronie') {
          const backDist = -(12 + 100 * u);
          targetCenter = computeLookAhead(tLat, tLon, tHeading, backDist) || [tLat, tLon];
          targetZoom = qs.initialZoom - 3.0 * u;
        } else if (qs.type === 'rocket') {
          targetCenter = [tLat, tLon];
          targetZoom = qs.initialZoom - 4.0 * Math.sin(u * Math.PI * 0.5);
        } else if (qs.type === 'circle') {
          const angleDeg = qs.initialHeading + 360 * u;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 42;
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = qs.initialZoom;
        } else if (qs.type === 'helix') {
          const angleDeg = qs.initialHeading + 540 * u;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 25 + 95 * u;
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = qs.initialZoom - 2.8 * u;
        } else if (qs.type === 'boomerang') {
          const angleDeg = qs.initialHeading + 360 * u;
          const rad = (angleDeg * Math.PI) / 180;
          const R = 30 + 85 * Math.sin(u * Math.PI);
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = qs.initialZoom - 2.2 * Math.sin(u * Math.PI);
        } else if (qs.type === 'asteroid') {
          if (u < 0.6) {
            const f = u / 0.6;
            targetCenter = computeLookAhead(tLat, tLon, tHeading, -(15 + 130 * f)) || [tLat, tLon];
            targetZoom = qs.initialZoom - 4.0 * f;
          } else if (u < 0.8) {
            const f = (u - 0.6) / 0.2;
            const angleDeg = (tHeading + 180) + 180 * f;
            const rad = (angleDeg * Math.PI) / 180;
            const R = 145;
            targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
            targetZoom = qs.initialZoom - 4.0;
          } else {
            const f = (u - 0.8) / 0.2;
            targetCenter = computeLookAhead(tLat, tLon, tHeading, -145 * (1 - f)) || [tLat, tLon];
            targetZoom = (qs.initialZoom - 4.0) + 4.0 * f;
          }
        }

        if (typeof this.config.onQuickShotProgress === 'function') {
          this.config.onQuickShotProgress(qs.type, u);
        }

        if (u >= 1) {
          qs.active = false;
          if (typeof this.config.onQuickShotEnd === 'function') {
            this.config.onQuickShotEnd(qs.type);
          }
          this.setMode(qs.previousMode || 'auto');
          return;
        }
      }

      // ==========================================
      // 3. FOCUSTRACK EXECUTION ENGINE
      // ==========================================
      else if (this.state.mode === 'focustrack' && this._djiFocusTrack.active) {
        const ft = this._djiFocusTrack;
        const target = entities[ft.targetCanoeIdx] || entities[0];
        const tLat = Number(target.lat ?? target.latitude ?? target.currentPos?.lat);
        const tLon = Number(target.lon ?? target.lng ?? target.longitude ?? target.currentPos?.lon);
        const tHeading = Number(target.heading ?? target.currentHeading ?? target._currentHeading ?? 0);
        const cosLat = Math.cos((tLat * Math.PI) / 180) || 1;

        if (ft.mode === 'spotlight') {
          targetCenter = computeLookAhead(tLat, tLon, tHeading, 10) || [tLat, tLon];
          targetZoom = this.config.followZoom;
        } else if (ft.mode === 'poi') {
          const dtSec = Math.max(0, (realNow - (ft.lastRealTimeMs || realNow)) / 1000);
          ft.orbitAngle = (ft.orbitAngle + ft.orbitSpeedDegPerSec * dtSec) % 360;
          ft.lastRealTimeMs = realNow;

          const rad = (ft.orbitAngle * Math.PI) / 180;
          const R = ft.orbitRadiusM || 45;
          targetCenter = [tLat + (R * Math.cos(rad)) / 111320, tLon + (R * Math.sin(rad)) / (111320 * cosLat)];
          targetZoom = this.config.followZoom;
        } else if (ft.mode === 'activetrack') {
          if (ft.subMode === 'parallel') {
            targetCenter = computeLookAhead(tLat, tLon, (tHeading + 90) % 360, 32) || [tLat, tLon];
          } else if (ft.subMode === 'lead') {
            targetCenter = computeLookAhead(tLat, tLon, tHeading, 35) || [tLat, tLon];
          } else {
            targetCenter = computeLookAhead(tLat, tLon, tHeading, -25) || [tLat, tLon];
          }
          targetZoom = this.config.followZoom;
        }
      }

      // ==========================================
      // 4. AUTO CINEMÁTICO ADAPTADO A QUALQUER VELOCIDADE
      // ==========================================
      else if (this.state.mode === 'auto' || this.state.mode === 'smart') {
        const pts = entities
          .map(e => [e.lat ?? e.latitude ?? e.currentPos?.lat, e.lon ?? e.lng ?? e.longitude ?? e.currentPos?.lon])
          .filter(p => validPoint(p[0], p[1]))
          .map(p => [Number(p[0]), Number(p[1])]);

        const leaderIdx = this._findLeaderIdx(entities);
        const leader = entities[leaderIdx];
        const dir = this._autoDirector;
        const realElapsed = realNow - dir.phaseStartRealTime;

        if (realElapsed > dir.phaseDurationRealMs && !dir.isTransitioning) {
          dir.phaseStartRealTime = realNow;
          this._startShotTransition(1400);
          if (dir.phase === 'LEADER_LOOKAHEAD') {
            dir.phase = pts.length > 1 ? 'PELOTAO' : 'SCOUT_BOIA';
            dir.phaseDurationRealMs = 10000;
          } else if (dir.phase === 'PELOTAO') {
            dir.phase = 'SCOUT_BOIA';
            dir.phaseDurationRealMs = 8000;
          } else if (dir.phase === 'SCOUT_BOIA') {
            dir.phase = 'FLYBY_RETURN';
            dir.phaseDurationRealMs = Math.max(10000, entities.length * 3500);
            dir.flybyIdx = 0;
            dir.lastFlybySwitchRealTime = realNow;
          } else if (dir.phase === 'FLYBY_RETURN') {
            dir.phase = (entities.length > 1) ? 'CHASER_DUEL' : 'LEADER_LOOKAHEAD';
            dir.phaseDurationRealMs = 9000;
          } else {
            dir.phase = 'LEADER_LOOKAHEAD';
            dir.phaseDurationRealMs = 12000;
          }
        }

        const currentTarget = this._getAutoPhaseTarget(dir.phase, entities, leader, pts, realNow);
        if (currentTarget) {
          targetCenter = currentTarget.center;
          targetZoom = currentTarget.zoom;
        }
      }

      // 5. SEGUIR LÍDER
      else if (this.state.mode === 'follow-leader' || this.state.mode === 'leader') {
        const leaderIdx = this._findLeaderIdx(entities);
        targetCenter = this._getEntityLookAhead(entities[leaderIdx]);
        targetZoom = this.config.followZoom;
      }

      // 6. SEGUIR CANOA ESPECÍFICA
      else if (this.state.mode === 'follow-canoe' || this.state.mode === 'canoe') {
        const idx = clamp(this.state.targetCanoeIdx, 0, entities.length - 1);
        targetCenter = this._getEntityLookAhead(entities[idx]);
        targetZoom = this.config.followZoom;
      }

      // 7. SEGUIR TODAS AS CANOAS (PELOTÃO)
      else if (this.state.mode === 'follow-all' || this.state.mode === 'all') {
        const pts = entities
          .map(e => [e.lat ?? e.latitude ?? e.currentPos?.lat, e.lon ?? e.lng ?? e.longitude ?? e.currentPos?.lon])
          .filter(p => validPoint(p[0], p[1]))
          .map(p => [Number(p[0]), Number(p[1])]);

        if (pts.length > 1) {
          targetCenter = computeCentroid(pts);
          targetZoom = this._calculateGroupZoom(pts);
        } else if (pts.length === 1) {
          targetCenter = this._getEntityLookAhead(entities[0]);
          targetZoom = this.config.followZoom;
        }
      }

      // 8. VISÃO GERAL (OVERVIEW)
      else if (this.state.mode === 'overview') {
        const contract = this.getContract();
        if (contract?.viewport20km?.bounds) {
          const b = contract.viewport20km.bounds;
          targetCenter = [(Number(b.south) + Number(b.north)) / 2, (Number(b.west) + Number(b.east)) / 2];
          targetZoom = 13.5;
        } else {
          const pts = entities
            .map(e => [e.lat ?? e.latitude ?? e.currentPos?.lat, e.lon ?? e.lng ?? e.longitude ?? e.currentPos?.lon])
            .filter(p => validPoint(p[0], p[1]))
            .map(p => [Number(p[0]), Number(p[1])]);
          targetCenter = computeCentroid(pts) || [-27.43, -48.48];
          targetZoom = 14;
        }
      }

      
      // ==========================================
      // INTER-SHOT SMOOTH TRANSITION BLENDER (ANTI-BLINKING)
      // ==========================================
      if (targetCenter && validPoint(targetCenter[0], targetCenter[1]) && this._shotTransition.active && validPoint(this._shotTransition.fromLat, this._shotTransition.fromLon)) {
        const tElapsed = realNow - this._shotTransition.startRealTime;
        const tFrac = clamp(tElapsed / this._shotTransition.durationMs, 0, 1);
        const blend = easeInOutCubic(tFrac);

        targetCenter = [
          this._shotTransition.fromLat + (targetCenter[0] - this._shotTransition.fromLat) * blend,
          this._shotTransition.fromLon + (targetCenter[1] - this._shotTransition.fromLon) * blend
        ];
        if (this._shotTransition.fromZoom != null && targetZoom != null) {
          targetZoom = this._shotTransition.fromZoom + (targetZoom - this._shotTransition.fromZoom) * blend;
        }

        if (tFrac >= 1) {
          this._shotTransition.active = false;
        }
      }

    setPlaybackSpeed(speed) {
      this.speedMultiplier = Math.max(1, Number(speed) || 1);
    }

    _isPortraitMode() {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const h = typeof window !== 'undefined' ? window.innerHeight : 800;
      return w < h || w < 650;
    }

    // ==========================================
    // GIMBAL DAMPING INTERPOLATOR (ZERO FLICKER / ZERO BLACK TILES)
    // ==========================================
    if (targetCenter && validPoint(targetCenter[0], targetCenter[1])) {
      const isPortrait = this._isPortraitMode();
      const portraitZoomOffset = isPortrait ? -0.8 : 0;
      const finalZoom = clamp((targetZoom || this.config.followZoom) + portraitZoomOffset + (this.config.zoomOffset || 0), this.config.minZoom, this.config.maxZoom);

      if (force || !this._smoothDrone.initialized) {
        this._smoothDrone.currentLat = targetCenter[0];
        this._smoothDrone.currentLon = targetCenter[1];
        this._smoothDrone.currentZoom = finalZoom;
        this._smoothDrone.initialized = true;
        this._isProgrammaticMovement = true;
        this.map.setView(targetCenter, finalZoom, { animate: false });
        setTimeout(() => { this._isProgrammaticMovement = false; }, 40);
      } else {
        const s = this.speedMultiplier || 1;

        // Escala o damping de aproximação proporcional à velocidade de reprodução (1x, 5x, 10x, 30x)
        let dmpPos = clamp((this.config.damping || 0.08) * Math.pow(s, 0.8), 0.10, 0.98);
        let dmpZoom = clamp((this.config.zoomDamping || 0.045) * Math.pow(s, 0.5), 0.045, 0.50);

        if (isPortrait) {
          // No celular em formato em pé (portrait), maior responsividade para manter a canoa centralizada
          dmpPos = clamp(dmpPos * 1.5, 0.20, 1.0);
        }

        const latDiff = targetCenter[0] - this._smoothDrone.currentLat;
        const lonDiff = targetCenter[1] - this._smoothDrone.currentLon;
        const lagDistM = haversineDistM(this._smoothDrone.currentLat, this._smoothDrone.currentLon, targetCenter[0], targetCenter[1]);

        // Velocidade de deslocamento do drone = o dobro da velocidade das canoas:
        // A 30x ou se o atraso passar do limite de enquadramento do celular, o drone alcança a canoa imediatamente
        const maxSafeLagM = isPortrait ? (s >= 10 ? 6 : 10) : (s >= 10 ? 12 : 20);
        if (lagDistM > maxSafeLagM || s >= 30) {
          dmpPos = 1.0;
        }

        this._smoothDrone.currentLat += latDiff * dmpPos;
        this._smoothDrone.currentLon += lonDiff * dmpPos;
        this._smoothDrone.currentZoom += (finalZoom - this._smoothDrone.currentZoom) * dmpZoom;

        this._isProgrammaticMovement = true;
        this.map.setView(
          [this._smoothDrone.currentLat, this._smoothDrone.currentLon],
          this._smoothDrone.currentZoom,
          { animate: false }
        );
        this._isProgrammaticMovement = false;
        if (typeof this.config.onZoomUpdate === 'function') {
          this.config.onZoomUpdate(this._smoothDrone.currentZoom);
        }
      }
    }
  }

  _getAutoPhaseTarget(phase, entities, leader, pts, realNow) {
    if (!leader) return null;
    const isPortrait = this._isPortraitMode();
    const lLat = leader.lat ?? leader.latitude ?? leader.currentPos?.lat;
    const lLon = leader.lon ?? leader.lng ?? leader.longitude ?? leader.currentPos?.lon;
    const lHeading = leader.heading ?? leader.currentHeading ?? leader._currentHeading ?? 0;
    const lookAheadM = isPortrait ? Math.min(10, (this.config.futureMeters || 16) * 0.5) : (this.config.futureMeters || 16);

    if (phase === 'LEADER_LOOKAHEAD') {
      return {
        center: computeLookAhead(lLat, lLon, lHeading, lookAheadM) || [Number(lLat), Number(lLon)],
        zoom: this.config.followZoom
      };
    }

      if (phase === 'PELOTAO') {
        if (pts.length > 1) {
          return {
            center: computeCentroid(pts),
            zoom: this._calculateGroupZoom(pts)
          };
        }
        return {
          center: computeLookAhead(lLat, lLon, lHeading, 20) || [Number(lLat), Number(lLon)],
          zoom: this.config.followZoom - 0.8
        };
      }

      if (phase === 'SCOUT_BOIA') {
        const nextBuoyPos = this._findNextBuoyAhead(lLat, lLon, lHeading);
        const scoutTarget = nextBuoyPos || computeLookAhead(lLat, lLon, lHeading, 60) || [Number(lLat), Number(lLon)];
        return {
          center: scoutTarget,
          zoom: this.config.followZoom - 0.6
        };
      }

      if (phase === 'FLYBY_RETURN') {
        const dir = this._autoDirector;
        const subInterval = Math.max(2600, Math.floor(dir.phaseDurationRealMs / Math.max(1, entities.length)));
        const flybyElapsed = realNow - dir.lastFlybySwitchRealTime;

        if (flybyElapsed > subInterval) {
          dir.flybyIdx = (dir.flybyIdx + 1) % entities.length;
          dir.lastFlybySwitchRealTime = realNow;
        }

        const sortedEntities = [...entities].sort((a, b) => {
          const dA = a.accDist ?? a.currentDist ?? a.currentProg ?? 0;
          const dB = b.accDist ?? b.currentDist ?? b.currentProg ?? 0;
          return dB - dA;
        });

        const targetEnt = sortedEntities[dir.flybyIdx] || leader;
        const eLat = targetEnt.lat ?? targetEnt.latitude ?? targetEnt.currentPos?.lat;
        const eLon = targetEnt.lon ?? targetEnt.lng ?? targetEnt.longitude ?? targetEnt.currentPos?.lon;
        const eH = targetEnt.heading ?? targetEnt.currentHeading ?? targetEnt._currentHeading ?? 0;

        return {
          center: computeLookAhead(eLat, eLon, eH, 10) || [Number(eLat), Number(eLon)],
          zoom: this.config.followZoom - 0.3
        };
      }

      if (phase === 'CHASER_DUEL') {
        if (entities.length > 1) {
          const sorted = [...entities].sort((a, b) => {
            const dA = a.accDist ?? a.currentDist ?? a.currentProg ?? 0;
            const dB = b.accDist ?? b.currentDist ?? b.currentProg ?? 0;
            return dB - dA;
          });
          const chaser = sorted[1] || sorted[0];
          const cLat = chaser.lat ?? chaser.latitude ?? chaser.currentPos?.lat;
          const cLon = chaser.lon ?? chaser.lng ?? chaser.longitude ?? chaser.currentPos?.lon;
          const cH = chaser.heading ?? chaser.currentHeading ?? chaser._currentHeading ?? 0;
          return {
            center: computeLookAhead(cLat, cLon, cH, 12) || [Number(cLat), Number(cLon)],
            zoom: this.config.followZoom
          };
        }
        return {
          center: computeLookAhead(lLat, lLon, lHeading, this.config.futureMeters || 16) || [Number(lLat), Number(lLon)],
          zoom: this.config.followZoom
        };
      }

      return {
        center: [Number(lLat), Number(lLon)],
        zoom: this.config.followZoom
      };
    }

    _findNextBuoyAhead(lat, lon, headingDeg) {
      const contract = this.getContract();
      const buoys = contract.buoys || contract.sportPackage?.buoys || [];
      if (!buoys.length) return null;

      let bestBuoy = null;
      let minAheadDist = Infinity;
      const h = Number(headingDeg) || 0;

      buoys.forEach(b => {
        const bLat = b.lat ?? b.latitude;
        const bLon = b.lon ?? b.lng ?? b.longitude;
        if (!validPoint(bLat, bLon)) return;

        const d = haversineDistM(lat, lon, bLat, bLon);
        if (d >= 40 && d <= 350) {
          const bearing = (Math.atan2(
            (Number(bLon) - Number(lon)) * Math.cos(Number(lat) * Math.PI / 180),
            Number(bLat) - Number(lat)
          ) * 180 / Math.PI + 360) % 360;
          let diff = Math.abs(h - bearing) % 360;
          if (diff > 180) diff = 360 - diff;
          if (diff <= 65 && d < minAheadDist) {
            minAheadDist = d;
            bestBuoy = [Number(bLat), Number(bLon)];
          }
        }
      });

      return bestBuoy;
    }

    _getEntityLookAhead(entity, futureM = null) {
      if (!entity) return null;
      const lat = entity.lat ?? entity.latitude ?? entity.currentPos?.lat;
      const lon = entity.lon ?? entity.lng ?? entity.longitude ?? entity.currentPos?.lon;
      const h = entity.heading ?? entity.currentHeading ?? entity._currentHeading ?? 0;
      const m = futureM ?? this.config.futureMeters ?? 18;
      return computeLookAhead(lat, lon, h, m) || (validPoint(lat, lon) ? [Number(lat), Number(lon)] : null);
    }

    _findLeaderIdx(entities) {
      if (!entities || !entities.length) return 0;
      const rank1Idx = entities.findIndex(e => e.rank === 1);
      if (rank1Idx !== -1) return rank1Idx;

      let maxDist = -1;
      let leaderIdx = 0;
      entities.forEach((e, idx) => {
        const dist = e.projectedProgressM ?? e.accDist ?? e.currentDist ?? e.currentProg ?? e.prog ?? 0;
        if (dist > maxDist) {
          maxDist = dist;
          leaderIdx = idx;
        }
      });
      return leaderIdx;
    }

    _calculateGroupZoom(points) {
      if (points.length < 2) return this.config.followZoom;
      const bounds = L.latLngBounds(points);
      const dist = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
      if (dist < 40) return this.config.detailZoom;
      if (dist < 100) return this.config.followZoom;
      if (dist < 220) return this.config.twoCanoesZoom;
      if (dist < 450) return this.config.packZoom;
      return this.config.packZoom - 0.8;
    }
  }

  global.DroneCameraSkills = DroneCameraSkills;
})(typeof window !== 'undefined' ? window : this);
