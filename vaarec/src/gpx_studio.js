/**
 * src/gpx_studio.js
 * VAAREC GPX Skills Studio Controller Engine
 * 
 * Gerencia o estado completo do GPX Studio:
 * - Ingestão multi-formato (GPX, Garmin JSON/TXT, JSON, FIT)
 * - Composição de camadas de tracks (cores, visibilidade, solo/mute)
 * - Gráficos multidimensionais sincronizados (Velocidade, FC, Altimetria, Cadência, Duelo, Splits, Dispersão)
 * - Seleção interativa por range brush com ferramentas de Trim, Nova Série e Zoom
 * - Sincronização em tempo real entre Gráficos, Mapa Leaflet e HUD
 * - Decupagem dimensional (Tabela de Splits) e Matriz de Eventos de Combate/Interferência
 * - Exportação para Contrato VAAREC, GPX limpo, CSV e Viewers
 */

import {
  haversineM,
  bearingDeg,
  calculateTrackSummary,
  segmentTrackByDistance,
  trimTrackByRange,
  extractSeriesFromRange,
  smoothTrackSpeed,
  calculateEfficiencyMetrics,
  autoDetectIntervalSeries,
  multiTrackInterference,
  calculateBaselineEnvelope,
  detectSegmentAnomalies,
  calculateTwoCanoesApproachProfile,
  detectOvertakingEvents,
  calculateSpeedAndHRBins,
  removeTrackInterval,
  filterTrackByThresholds,
  cropTrackByAbsoluteTime,
  autoDetectIntervalSeriesAdaptive,
  autoDetectAllRaceEvents
} from './gpx_skills.js';

export class GPXStudioController {
  constructor(options = {}) {
    this.tracks = []; // Array de { id, name, color, originalPoints, points, visible, summary, efficiency, segments }
    this.activeTrackIdx = 0;
    this.rangeSelection = null; // { startM, endM, startT, endT, startIdx, endIdx, mode: 'distance' }
    this.activeChartTab = 'speed'; // 'speed' | 'hr' | 'ele' | 'heading' | 'temp' | 'duel' | 'splits' | 'baseline' | 'proximity' | 'bins' | 'efficiency' | 'scatter'
    this.chartLayoutMode = 'single'; // 'single' | 'dual' | 'stacked'
    this.splitIntervalM = 500;
    this.interferenceThresholdM = 5.0;
    this.historyStack = []; // Undo stack for trimming
    this.customEvents = []; // Eventos manuais e automáticos cadastrados
    
    // Zoom State nos Gráficos (Sincronizado e com suporte a Wheel / Brush)
    this.chartZoom = {
      minFrac: 0.0,
      maxFrac: 1.0,
      isZoomed: false
    };

    // Engine de Reprodução e Playhead (Timeline DAW / CapCut)
    this.playback = {
      isPlaying: false,
      currentTimeMs: 0,
      speedMultiplier: 1.0,
      loop: false,
      timerId: null,
      lastTickTime: 0
    };

    this.map = null;
    this.mapLayers = {
      tracks: new Map(),
      canoeMarkers: new Map(),
      eventMarkers: new Map(),
      selectionHighlight: null,
      marker: null,
      courseElements: null
    };

    this.chartInstances = {};
    this.onStateChangeCallbacks = [];
  }

  /* ------------------------------------------------------------------
   * Inicialização e Bind com UI & Mapa
   * ------------------------------------------------------------------ */

  initMap(mapElementId = 'studio-map') {
    if (typeof L === 'undefined') return;
    const el = document.getElementById(mapElementId);
    if (!el) return;

    if (this.map) {
      try { this.map.remove(); } catch(e) {}
    }

    this.map = L.map(mapElementId, { zoomControl: false, attributionControl: true })
      .setView([-27.43, -48.48], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: '© Esri'
    }).addTo(this.map);

    this.mapLayers.courseElements = L.featureGroup().addTo(this.map);
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.onStateChangeCallbacks.push(callback);
    }
  }

  _notify(changeType = 'update') {
    this.onStateChangeCallbacks.forEach(cb => cb(changeType, this));
  }

  /* ------------------------------------------------------------------
   * Ingestão e Gerenciamento de Trilhas
   * ------------------------------------------------------------------ */

  addTrack(name, rawPoints, color = null, fileName = '') {
    if (!rawPoints || rawPoints.length < 2) return null;

    const STUDIO_COLORS = ['#00F2FE', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#F43F5E', '#3B82F6', '#EC4899'];
    const trackColor = color || STUDIO_COLORS[this.tracks.length % STUDIO_COLORS.length];
    const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // Normalizar pontos com distâncias e rumos
    const points = this._normalizePoints(rawPoints);
    const summary = calculateTrackSummary(points, name, fileName);
    const efficiency = calculateEfficiencyMetrics(points);
    const segments = segmentTrackByDistance(points, this.splitIntervalM, id);

    const trackObj = {
      id,
      name,
      fileName,
      color: trackColor,
      originalPoints: [...points],
      points: [...points],
      visible: true,
      summary,
      efficiency,
      segments
    };

    this.tracks.push(trackObj);
    this.activeTrackIdx = this.tracks.length - 1;

    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('track-added');

    return trackObj;
  }

  removeTrack(idx) {
    if (idx >= 0 && idx < this.tracks.length) {
      const removed = this.tracks.splice(idx, 1)[0];
      if (this.mapLayers.tracks.has(removed.id)) {
        this.map.removeLayer(this.mapLayers.tracks.get(removed.id));
        this.mapLayers.tracks.delete(removed.id);
      }
      this.activeTrackIdx = Math.max(0, Math.min(this.activeTrackIdx, this.tracks.length - 1));
      this._updateMapTrackLayers();
      this._notify('track-removed');
    }
  }

  setActiveTrack(idx) {
    if (idx >= 0 && idx < this.tracks.length) {
      this.activeTrackIdx = idx;
      this.clearRangeSelection();
      this._notify('active-track-changed');
    }
  }

  toggleTrackVisibility(idx) {
    if (this.tracks[idx]) {
      this.tracks[idx].visible = !this.tracks[idx].visible;
      this._updateMapTrackLayers();
      this._notify('track-visibility-changed');
    }
  }

  setTrackColor(idx, color) {
    if (this.tracks[idx]) {
      this.tracks[idx].color = color;
      this._updateMapTrackLayers();
      this._notify('track-color-changed');
    }
  }

  getActiveTrack() {
    return this.tracks[this.activeTrackIdx] || null;
  }

  /* ------------------------------------------------------------------
   * Ferramentas de Seleção de Range & Trimming nos Gráficos
   * ------------------------------------------------------------------ */

  setRangeSelection(startM, endM) {
    const track = this.getActiveTrack();
    if (!track || !track.points.length) return;

    const minM = Math.max(0, Math.min(startM, endM));
    const maxM = Math.min(track.summary.distanceM, Math.max(startM, endM));

    if (maxM - minM < 5) {
      this.clearRangeSelection();
      return;
    }

    // Achar índices e tempos correspondentes
    let startIdx = 0, endIdx = track.points.length - 1;
    let startT = 0, endT = 0;

    let accum = 0;
    for (let i = 0; i < track.points.length; i++) {
      if (i > 0) {
        const prev = track.points[i - 1];
        accum += haversineM(prev.lat, prev.lon ?? prev.lng, track.points[i].lat, track.points[i].lon ?? track.points[i].lng);
      }
      if (accum <= minM) {
        startIdx = i;
        startT = track.points[i].t;
      }
      if (accum <= maxM) {
        endIdx = i;
        endT = track.points[i].t;
      }
    }

    this.rangeSelection = {
      startM: Math.round(minM),
      endM: Math.round(maxM),
      startT,
      endT,
      startIdx,
      endIdx,
      mode: 'distance'
    };

    this._updateMapRangeHighlight();
    this._notify('range-selection-changed');
  }

  clearRangeSelection() {
    this.rangeSelection = null;
    if (this.mapLayers.selectionHighlight) {
      this.map.removeLayer(this.mapLayers.selectionHighlight);
      this.mapLayers.selectionHighlight = null;
    }
    this._notify('range-selection-cleared');
  }

  applyTrimToSelection() {
    const track = this.getActiveTrack();
    if (!track || !this.rangeSelection) return false;

    // Salvar estado atual no histórico de Undo
    this.historyStack.push({
      trackId: track.id,
      points: [...track.points]
    });

    const trimmed = trimTrackByRange(track.points, this.rangeSelection.startM, this.rangeSelection.endM, 'distance');
    track.points = this._normalizePoints(trimmed);
    track.summary = calculateTrackSummary(track.points, track.name, track.fileName);
    track.efficiency = calculateEfficiencyMetrics(track.points);
    track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);

    this.clearRangeSelection();
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('track-trimmed');
    return true;
  }

  extractNewSeriesFromSelection(seriesName = null) {
    const track = this.getActiveTrack();
    if (!track || !this.rangeSelection) return null;

    const defaultName = seriesName || `${track.name} (Série ${this.tracks.length + 1})`;
    const trimmed = trimTrackByRange(track.points, this.rangeSelection.startM, this.rangeSelection.endM, 'distance');
    
    return this.addTrack(defaultName, trimmed, null, track.fileName);
  }

  resetTrackToOriginal(idx = this.activeTrackIdx) {
    const track = this.tracks[idx];
    if (!track) return;

    track.points = [...track.originalPoints];
    track.summary = calculateTrackSummary(track.points, track.name, track.fileName);
    track.efficiency = calculateEfficiencyMetrics(track.points);
    track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);

    this.clearRangeSelection();
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('track-reset');
  }

  applySmoothing(idx = this.activeTrackIdx, windowSize = 7, smoothHR = false, allTracks = false) {
    const targetTracks = allTracks ? this.tracks : [this.tracks[idx]].filter(Boolean);
    if (!targetTracks.length) return;

    targetTracks.forEach(track => {
      this.historyStack.push({
        trackId: track.id,
        points: [...track.points]
      });

      track.points = smoothTrackSpeed(track.points, windowSize, smoothHR);
      track.summary = calculateTrackSummary(track.points, track.name, track.fileName);
      track.efficiency = calculateEfficiencyMetrics(track.points);
      track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);
    });

    this._updateMapTrackLayers();
    this._notify('track-smoothed');
  }

  /* ------------------------------------------------------------------
   * Definição de Largada & Chegada Oficial (Race Timing)
   * ------------------------------------------------------------------ */

  setRaceStartByTime(hms, allTracks = true) {
    const targetTracks = allTracks ? this.tracks : [this.getActiveTrack()].filter(Boolean);
    if (!targetTracks.length) return;

    targetTracks.forEach(t => {
      this.historyStack.push({ trackId: t.id, points: [...t.points] });
      t.points = cropTrackByAbsoluteTime(t.points, hms, null);
      t.summary = calculateTrackSummary(t.points, t.name, t.fileName);
      t.efficiency = calculateEfficiencyMetrics(t.points);
      t.segments = segmentTrackByDistance(t.points, this.splitIntervalM, t.id);
    });

    this.clearRangeSelection();
    this.seekTimeMs(0);
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('race-start-set');
  }

  setRaceStartAtPlayhead(allTracks = true) {
    const targetTracks = allTracks ? this.tracks : [this.getActiveTrack()].filter(Boolean);
    if (!targetTracks.length) return;

    const playheadMs = this.playback.currentTimeMs;
    targetTracks.forEach(t => {
      this.historyStack.push({ trackId: t.id, points: [...t.points] });
      const pts = t.points;
      const isMs = (pts[pts.length - 1].t - pts[0].t) > 100000;
      const targetT = isMs ? playheadMs : (playheadMs / 1000);
      
      let sIdx = 0;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].t >= targetT) { sIdx = i; break; }
      }
      const cropped = pts.slice(sIdx);
      t.points = this._normalizePoints(cropped);
      t.summary = calculateTrackSummary(t.points, t.name, t.fileName);
      t.efficiency = calculateEfficiencyMetrics(t.points);
      t.segments = segmentTrackByDistance(t.points, this.splitIntervalM, t.id);
    });

    this.clearRangeSelection();
    this.seekTimeMs(0);
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('race-start-set');
  }

  setRaceFinishByDuration(durationS, allTracks = true) {
    const targetTracks = allTracks ? this.tracks : [this.getActiveTrack()].filter(Boolean);
    if (!targetTracks.length) return;

    targetTracks.forEach(t => {
      this.historyStack.push({ trackId: t.id, points: [...t.points] });
      t.points = cropTrackByAbsoluteTime(t.points, null, durationS);
      t.summary = calculateTrackSummary(t.points, t.name, t.fileName);
      t.efficiency = calculateEfficiencyMetrics(t.points);
      t.segments = segmentTrackByDistance(t.points, this.splitIntervalM, t.id);
    });

    this.clearRangeSelection();
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('race-finish-set');
  }

  setRaceFinishAtPlayhead(allTracks = true) {
    const targetTracks = allTracks ? this.tracks : [this.getActiveTrack()].filter(Boolean);
    if (!targetTracks.length) return;

    const playheadMs = this.playback.currentTimeMs;
    targetTracks.forEach(t => {
      this.historyStack.push({ trackId: t.id, points: [...t.points] });
      const pts = t.points;
      const isMs = (pts[pts.length - 1].t - pts[0].t) > 100000;
      const targetT = isMs ? playheadMs : (playheadMs / 1000);
      
      let eIdx = pts.length - 1;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].t >= targetT) { eIdx = i; break; }
      }
      const cropped = pts.slice(0, eIdx + 1);
      t.points = this._normalizePoints(cropped);
      t.summary = calculateTrackSummary(t.points, t.name, t.fileName);
      t.efficiency = calculateEfficiencyMetrics(t.points);
      t.segments = segmentTrackByDistance(t.points, this.splitIntervalM, t.id);
    });

    this.clearRangeSelection();
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('race-finish-set');
  }

  /* ------------------------------------------------------------------
   * Eliminação de Trechos & Linhas de Corte por Limiar
   * ------------------------------------------------------------------ */

  removeSelectedInterval() {
    const track = this.getActiveTrack();
    if (!track || !this.rangeSelection) return false;

    this.historyStack.push({ trackId: track.id, points: [...track.points] });
    track.points = removeTrackInterval(track.points, this.rangeSelection.startM, this.rangeSelection.endM, 'distance');
    track.summary = calculateTrackSummary(track.points, track.name, track.fileName);
    track.efficiency = calculateEfficiencyMetrics(track.points);
    track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);

    this.clearRangeSelection();
    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('track-range-removed');
    return true;
  }

  filterByThresholds(minSpeedKmh = null, minHr = null) {
    const track = this.getActiveTrack();
    if (!track) return false;

    this.historyStack.push({ trackId: track.id, points: [...track.points] });
    track.points = filterTrackByThresholds(track.points, { minSpeedKmh, minHr });
    track.summary = calculateTrackSummary(track.points, track.name, track.fileName);
    track.efficiency = calculateEfficiencyMetrics(track.points);
    track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);

    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('track-filtered');
    return true;
  }

  /* ------------------------------------------------------------------
   * Auto-Séries Adaptativo
   * ------------------------------------------------------------------ */

  autoDetectSeriesAdaptive(config = {}) {
    const track = this.getActiveTrack();
    if (!track) return [];

    const detected = autoDetectIntervalSeriesAdaptive(track.points, config);
    if (!detected.length) {
      alert("Nenhum intervalo detectado com os parâmetros informados. Tente ajustar o limiar de velocidade ou usar fatiamento por distância/tempo.");
      return [];
    }

    detected.forEach((ser) => {
      this.addTrack(`${track.name} - ${ser.name}`, ser.points, null, track.fileName);
    });

    this._notify('auto-series-created');
    return detected;
  }

  /* ------------------------------------------------------------------
   * Eventos Manuais e Auto-Detecção Completa
   * ------------------------------------------------------------------ */

  addCustomEvent(evtObj) {
    const eventId = evtObj.id || `evt-usr-${Date.now()}`;
    const newEvt = {
      id: eventId,
      type: evtObj.type || 'NOTE',
      typeLabel: evtObj.typeLabel || 'Nota / Marcador',
      icon: evtObj.icon || 'fa-tag',
      color: evtObj.color || '#00F2FE',
      name: evtObj.name || 'Evento Marcado',
      details: evtObj.details || '',
      timeMs: evtObj.timeMs ?? this.playback.currentTimeMs,
      distanceM: evtObj.distanceM ?? (this.getActiveTrack()?.summary.distanceM * (this.playback.currentTimeMs / this.getMaxDurationMs())),
      lat: evtObj.lat,
      lon: evtObj.lon
    };

    this.customEvents.push(newEvt);
    this._updateMapEventMarkers();
    this._notify('event-added');
    return newEvt;
  }

  removeCustomEvent(eventId) {
    this.customEvents = this.customEvents.filter(e => e.id !== eventId);
    this._updateMapEventMarkers();
    this._notify('event-removed');
  }

  autoDetectAllEvents() {
    const autoEvents = autoDetectAllRaceEvents(this.tracks, {
      interferenceThresholdM: this.interferenceThresholdM
    });

    // Mesclar mantendo eventos manuais
    const manualOnly = this.customEvents.filter(e => e.id.startsWith('evt-usr-'));
    this.customEvents = [...autoEvents, ...manualOnly];

    this._updateMapEventMarkers();
    this._notify('events-detected');
    return this.customEvents;
  }

  _updateMapEventMarkers() {
    if (!this.map) return;
    this.mapLayers.eventMarkers.forEach(m => this.map.removeLayer(m));
    this.mapLayers.eventMarkers.clear();

    this.customEvents.forEach(evt => {
      if (evt.lat && evt.lon) {
        const icon = L.divIcon({
          className: 'event-map-icon',
          html: `
            <div style="width:24px; height:24px; background:${evt.color}; border:2px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px ${evt.color}; cursor:pointer;" title="${evt.name}">
              <i class="fa-solid ${evt.icon || 'fa-tag'}" style="color:#000; font-size:11px;"></i>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        const m = L.marker([evt.lat, evt.lon], { icon }).addTo(this.map);
        m.bindPopup(`<strong>${evt.name}</strong><br><span style="font-size:11px; color:#94A3B8;">${evt.details || evt.typeLabel}</span>`);
        this.mapLayers.eventMarkers.set(evt.id, m);
      }
    });
  }

  /* ------------------------------------------------------------------
   * Zoom nos Gráficos (Sincronizado e com MouseWheel / Brush)
   * ------------------------------------------------------------------ */

  zoomChart(factor, centerFrac = 0.5) {
    const currentSpan = this.chartZoom.maxFrac - this.chartZoom.minFrac;
    const newSpan = Math.max(0.05, Math.min(1.0, currentSpan * factor));

    const currentCenter = this.chartZoom.minFrac + (currentSpan * centerFrac);
    let newMin = currentCenter - (newSpan * centerFrac);
    let newMax = currentCenter + (newSpan * (1 - centerFrac));

    if (newMin < 0) {
      newMax = Math.min(1.0, newMax - newMin);
      newMin = 0;
    }
    if (newMax > 1.0) {
      newMin = Math.max(0, newMin - (newMax - 1.0));
      newMax = 1.0;
    }

    this.chartZoom.minFrac = newMin;
    this.chartZoom.maxFrac = newMax;
    this.chartZoom.isZoomed = (newMin > 0 || newMax < 1.0);

    this._notify('chart-zoom-changed');
  }

  resetChartZoom() {
    this.chartZoom.minFrac = 0.0;
    this.chartZoom.maxFrac = 1.0;
    this.chartZoom.isZoomed = false;
    this._notify('chart-zoom-changed');
  }

  undoLastTrim() {
    if (!this.historyStack.length) return false;
    const last = this.historyStack.pop();
    const track = this.tracks.find(t => t.id === last.trackId);
    if (track) {
      track.points = [...last.points];
      track.summary = calculateTrackSummary(track.points, track.name, track.fileName);
      track.efficiency = calculateEfficiencyMetrics(track.points);
      track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);

      this.clearRangeSelection();
      this._updateMapTrackLayers();
      this._fitMapBounds();
      this._notify('track-undo');
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------
   * Engine de Reprodução e Timeline DAW / CapCut
   * ------------------------------------------------------------------ */

  getMaxDurationMs() {
    let maxMs = 0;
    this.tracks.forEach(t => {
      if (t.points.length > 1) {
        const span = t.points[t.points.length - 1].t - t.points[0].t;
        if (span > maxMs) maxMs = span;
      }
    });
    return maxMs || 1000;
  }

  play() {
    if (this.playback.isPlaying) return;
    this.playback.isPlaying = true;
    this.playback.lastTickTime = performance.now();
    
    const maxDur = this.getMaxDurationMs();
    if (this.playback.currentTimeMs >= maxDur) {
      this.playback.currentTimeMs = 0;
    }

    const tick = () => {
      if (!this.playback.isPlaying) return;
      const now = performance.now();
      const dtReal = now - this.playback.lastTickTime;
      this.playback.lastTickTime = now;

      const dtSim = dtReal * this.playback.speedMultiplier;
      this.playback.currentTimeMs += dtSim;

      const maxD = this.getMaxDurationMs();
      if (this.playback.currentTimeMs >= maxD) {
        if (this.playback.loop) {
          this.playback.currentTimeMs = 0;
        } else {
          this.playback.currentTimeMs = maxD;
          this.pause();
          return;
        }
      }

      this._syncPlayheadPosition();
      this.playback.timerId = requestAnimationFrame(tick);
    };

    this.playback.timerId = requestAnimationFrame(tick);
    this._notify('playback-play');
  }

  pause() {
    if (!this.playback.isPlaying) return;
    this.playback.isPlaying = false;
    if (this.playback.timerId) {
      cancelAnimationFrame(this.playback.timerId);
      this.playback.timerId = null;
    }
    this._notify('playback-pause');
  }

  togglePlay() {
    if (this.playback.isPlaying) this.pause();
    else this.play();
  }

  seekTimeMs(timeMs) {
    const maxD = this.getMaxDurationMs();
    this.playback.currentTimeMs = Math.max(0, Math.min(maxD, timeMs));
    this._syncPlayheadPosition();
    this._notify('playback-seek');
  }

  setPlaybackSpeed(multiplier) {
    this.playback.speedMultiplier = Math.max(0.25, Math.min(64.0, multiplier));
    this._notify('playback-speed-changed');
  }

  splitTrackAtPlayhead(idx = this.activeTrackIdx) {
    const track = this.tracks[idx];
    if (!track || track.points.length < 4) return false;

    const playheadT = this.playback.currentTimeMs;
    const pts = track.points;
    const isMs = (pts[pts.length - 1].t - pts[0].t) > 100000;
    const t0 = pts[0].t;
    const targetAbsT = isMs ? (t0 + playheadT) : (t0 + (playheadT / 1000));

    let splitIdx = -1;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].t >= targetAbsT) {
        splitIdx = i;
        break;
      }
    }

    if (splitIdx <= 2 || splitIdx >= pts.length - 2) {
      alert("A agulha deve estar dentro do corpo da trilha para realizar o corte (Razor Cut).");
      return false;
    }

    // Salvar no histórico de Undo
    this.historyStack.push({
      trackId: track.id,
      points: [...track.points]
    });

    const ptsA = pts.slice(0, splitIdx + 1);
    const ptsB = pts.slice(splitIdx);

    // Ajustar a trilha original como Parte A
    track.points = this._normalizePoints(ptsA);
    track.summary = calculateTrackSummary(track.points, `${track.name} (Pt 1)`, track.fileName);
    track.efficiency = calculateEfficiencyMetrics(track.points);
    track.segments = segmentTrackByDistance(track.points, this.splitIntervalM, track.id);
    track.name = `${track.name} [A]`;

    // Criar a nova trilha como Parte B
    this.addTrack(`${track.name.replace(' [A]', '')} [B]`, ptsB, null, track.fileName);

    this._updateMapTrackLayers();
    this._fitMapBounds();
    this._notify('track-split');
    return true;
  }

  _syncPlayheadPosition() {
    if (!this.map) return;
    const playheadT = this.playback.currentTimeMs;

    this.tracks.forEach((track) => {
      if (!track.visible || !track.points.length) {
        if (this.mapLayers.canoeMarkers.has(track.id)) {
          this.map.removeLayer(this.mapLayers.canoeMarkers.get(track.id));
          this.mapLayers.canoeMarkers.delete(track.id);
        }
        return;
      }
      const pts = track.points;
      const isMs = (pts[pts.length - 1].t - pts[0].t) > 100000;
      const t0 = pts[0].t;
      const targetAbsT = isMs ? (t0 + playheadT) : (t0 + (playheadT / 1000));

      let p = null;
      if (targetAbsT <= pts[0].t) p = pts[0];
      else if (targetAbsT >= pts[pts.length - 1].t) p = pts[pts.length - 1];
      else {
        for (let i = 1; i < pts.length; i++) {
          if (pts[i].t >= targetAbsT) {
            const prev = pts[i - 1];
            const cur = pts[i];
            const f = (cur.t - prev.t) > 0 ? (targetAbsT - prev.t) / (cur.t - prev.t) : 0;
            p = {
              lat: prev.lat + (cur.lat - prev.lat) * f,
              lon: prev.lon + (cur.lon - prev.lon) * f,
              spdKmh: prev.spdKmh != null ? prev.spdKmh + ((cur.spdKmh || prev.spdKmh) - prev.spdKmh) * f : null,
              hr: prev.hr,
              heading: cur.heading || prev.heading
            };
            break;
          }
        }
      }

      if (p) {
        if (!this.mapLayers.canoeMarkers.has(track.id)) {
          const customIcon = L.divIcon({
            className: 'canoe-live-marker',
            html: `
              <div style="width:26px; height:26px; background:${track.color}; border:2px solid #fff; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px ${track.color}; transform:rotate(${(p.heading || 0) - 90}deg);">
                <i class="fa-solid fa-location-arrow" style="color:#000; font-size:13px;"></i>
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          const marker = L.marker([p.lat, p.lon], { icon: customIcon }).addTo(this.map);
          this.mapLayers.canoeMarkers.set(track.id, marker);
        } else {
          const marker = this.mapLayers.canoeMarkers.get(track.id);
          marker.setLatLng([p.lat, p.lon]);
          const el = marker.getElement();
          if (el) {
            const inner = el.querySelector('div');
            if (inner) inner.style.transform = `rotate(${(p.heading || 0) - 90}deg)`;
          }
        }
      }
    });

    this._notify('playhead-tick');
  }

  hoverPointAtDistance(distM) {
    const track = this.getActiveTrack();
    if (!track || !track.points.length || !this.map) return;

    let accum = 0;
    let targetP = track.points[0];

    for (let i = 0; i < track.points.length; i++) {
      if (i > 0) {
        const prev = track.points[i - 1];
        accum += haversineM(prev.lat, prev.lon ?? prev.lng, track.points[i].lat, track.points[i].lon ?? track.points[i].lng);
      }
      if (accum >= distM) {
        targetP = track.points[i];
        break;
      }
    }

    this._updateMapHoverMarker(targetP, track);
  }

  _updateMapHoverMarker(p, track) {
    if (!p || !this.map) return;

    if (!this.mapLayers.marker) {
      const icon = L.divIcon({
        className: 'studio-cursor-icon',
        html: `<div style="position:relative; width:24px; height:24px;">
          <div style="width:14px; height:14px; border-radius:50%; background:${track.color}; border:2px solid #fff; box-shadow:0 0 12px ${track.color}; position:absolute; top:5px; left:5px;"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      this.mapLayers.marker = L.marker([p.lat, p.lon ?? p.lng], { icon, zIndexOffset: 2000 }).addTo(this.map);
    } else {
      this.mapLayers.marker.setLatLng([p.lat, p.lon ?? p.lng]);
    }
  }

  /* ------------------------------------------------------------------
   * Atualização de Camadas no Mapa Leaflet
   * ------------------------------------------------------------------ */

  _updateMapTrackLayers() {
    if (!this.map) return;

    // Remover camadas desativadas
    this.mapLayers.tracks.forEach((layer, id) => {
      if (!this.tracks.find(t => t.id === id && t.visible)) {
        this.map.removeLayer(layer);
        this.mapLayers.tracks.delete(id);
      }
    });

    // Atualizar ou criar camadas ativas
    this.tracks.forEach((track, idx) => {
      if (!track.visible) return;

      const latLngs = track.points.map(p => [p.lat, p.lon ?? p.lng]);
      const isSelected = (idx === this.activeTrackIdx);

      if (this.mapLayers.tracks.has(track.id)) {
        const layer = this.mapLayers.tracks.get(track.id);
        layer.setLatLngs(latLngs);
        layer.setStyle({
          color: track.color,
          weight: isSelected ? 4 : 2,
          opacity: isSelected ? 0.9 : 0.4
        });
      } else {
        const layer = L.polyline(latLngs, {
          color: track.color,
          weight: isSelected ? 4 : 2,
          opacity: isSelected ? 0.9 : 0.4
        }).addTo(this.map);
        this.mapLayers.tracks.set(track.id, layer);
      }
    });

    this._updateMapRangeHighlight();
  }

  _updateMapRangeHighlight() {
    if (!this.map) return;

    if (this.mapLayers.selectionHighlight) {
      this.map.removeLayer(this.mapLayers.selectionHighlight);
      this.mapLayers.selectionHighlight = null;
    }

    const track = this.getActiveTrack();
    if (!track || !this.rangeSelection) return;

    const slice = track.points.slice(this.rangeSelection.startIdx, this.rangeSelection.endIdx + 1);
    if (slice.length >= 2) {
      const latLngs = slice.map(p => [p.lat, p.lon ?? p.lng]);
      this.mapLayers.selectionHighlight = L.polyline(latLngs, {
        color: '#FFFFFF',
        weight: 6,
        opacity: 0.9,
        dashArray: '6 6'
      }).addTo(this.map);
    }
  }

  _fitMapBounds() {
    if (!this.map) return;
    const allCoords = [];
    this.tracks.filter(t => t.visible).forEach(t => {
      t.points.forEach(p => allCoords.push([p.lat, p.lon ?? p.lng]));
    });
    if (allCoords.length) {
      this.map.fitBounds(allCoords, { padding: [30, 30] });
    }
  }

  /* ------------------------------------------------------------------
   * Exportação e Composição de Contratos
   * ------------------------------------------------------------------ */

  generateVAARECContract(contractName = 'Sessão GPX Studio') {
    const tracksExport = this.tracks.map((t, i) => ({
      id: t.id || `canoe_${i + 1}`,
      name: t.name,
      color: t.color,
      fileName: t.fileName,
      points: t.points,
      summary: t.summary,
      segments: t.segments
    }));

    const interferenceEvents = multiTrackInterference(this.tracks.map(t => ({
      name: t.name,
      points: t.points
    })), this.interferenceThresholdM, 4.0);

    return {
      version: '2.0',
      generator: 'VAAREC GPX Skills Studio',
      name: contractName,
      date: new Date().toLocaleDateString('pt-BR'),
      createdAt: new Date().toISOString(),
      sportPackage: {
        tracks: tracksExport
      },
      events: {
        interference: interferenceEvents,
        custom: this.customEvents,
        all: [...interferenceEvents, ...this.customEvents]
      }
    };
  }

  exportCSVData(trackIdx = this.activeTrackIdx) {
    const track = this.tracks[trackIdx];
    if (!track || !track.segments.length) return '';

    const headers = ['Segmento', 'Dist_Inicio_m', 'Dist_Fim_m', 'Duracao_s', 'Distancia_m', 'Vel_Media_kmh', 'Pace', 'FC_Media', 'FC_Max'];
    const rows = track.segments.map(s => [
      s.segmentId,
      s.startM,
      s.endM,
      s.durationS,
      s.distanceM,
      s.speedAvgKmh,
      s.paceStr || '',
      s.hrAvg || '',
      s.hrMax || ''
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  generateComparisonJSON() {
    return calculateBaselineEnvelope(this.tracks.map(t => ({
      name: t.name,
      fileName: t.fileName,
      points: t.points
    })), this.splitIntervalM);
  }

  generateEventsJSON() {
    const interference = multiTrackInterference(this.tracks.map(t => ({
      name: t.name,
      points: t.points
    })), this.interferenceThresholdM, 4.0);

    let overtakes = [];
    let approach = [];
    if (this.tracks.length >= 2) {
      overtakes = detectOvertakingEvents(this.tracks[0].points, this.tracks[1].points, this.tracks[0].name, this.tracks[1].name);
      approach = calculateTwoCanoesApproachProfile(this.tracks[0].points, this.tracks[1].points, 3.0);
    }

    return {
      interference,
      overtakes,
      approachSummary: {
        totalSamples: approach.length,
        criticalProximitySamples: approach.filter(a => a.trend === 'critical_proximity').length,
        minDistanceM: approach.length ? Math.min(...approach.map(a => a.distanceM)) : null
      }
    };
  }

  exportGPXXML(trackIdx = this.activeTrackIdx) {
    const track = this.tracks[trackIdx];
    if (!track || !track.points.length) return '';

    const pts = track.points;
    const baseTime = pts[0].absT || Date.now();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<gpx version="1.1" creator="VAAREC GPX Skills Studio" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">\n`;
    xml += `  <metadata><name>${track.name}</name><time>${new Date(baseTime).toISOString()}</time></metadata>\n`;
    xml += `  <trk><name>${track.name}</name><trkseg>\n`;

    pts.forEach(p => {
      const timeIso = new Date(p.absT || (baseTime + p.t)).toISOString();
      xml += `    <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">`;
      if (p.ele != null) xml += `<ele>${p.ele.toFixed(2)}</ele>`;
      xml += `<time>${timeIso}</time>`;
      if (p.hr != null || p.spdKmh != null || p.cadence != null) {
        xml += `<extensions><gpxtpx:TrackPointExtension>`;
        if (p.hr != null) xml += `<gpxtpx:hr>${p.hr}</gpxtpx:hr>`;
        if (p.spdKmh != null) xml += `<gpxtpx:speed>${(p.spdKmh / 3.6).toFixed(2)}</gpxtpx:speed>`;
        if (p.cadence != null) xml += `<gpxtpx:cad>${p.cadence}</gpxtpx:cad>`;
        xml += `</gpxtpx:TrackPointExtension></extensions>`;
      }
      xml += `</trkpt>\n`;
    });

    xml += `  </trkseg></trk>\n</gpx>`;
    return xml;
  }

  /* ------------------------------------------------------------------
   * Utilitários Internos
   * ------------------------------------------------------------------ */

  _normalizePoints(pts) {
    if (!pts || !pts.length) return [];
    const t0 = Number(pts[0].t ?? pts[0].timestamp ?? 0);
    const tEnd = Number(pts[pts.length - 1].t ?? pts[pts.length - 1].timestamp ?? 0);
    const isMs = (tEnd - t0) > 100000 || t0 > 1000000000;

    const rawNorm = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const lat = Number(p.lat ?? p.latitude);
      const lon = Number(p.lon ?? p.lng ?? p.longitude);
      const absT = Number(p.t ?? p.timestamp ?? 0);
      const t = isMs ? (absT - t0) : ((absT - t0) * 1000);
      
      let spdKmh = p.spdKmh != null ? Number(p.spdKmh) : (p.speedKmh != null ? Number(p.speedKmh) : null);
      
      // Se não veio velocidade explícita no arquivo ou veio zerada, calcula da distância / tempo
      if (spdKmh == null || isNaN(spdKmh) || (spdKmh === 0 && i > 0)) {
        if (i > 0) {
          const prev = rawNorm[i - 1];
          const dist = haversineM(prev.lat, prev.lon, lat, lon);
          const dtS = isMs ? (absT - prev.absT) / 1000 : (absT - prev.absT);
          spdKmh = (dtS > 0 && dtS < 120) ? (dist / dtS) * 3.6 : 0;
          if (spdKmh > 55) spdKmh = prev.spdKmh; // Filtro de glitch de teletransporte de GPS
        } else {
          spdKmh = 0;
        }
      }

      const hr = p.hr != null ? Number(p.hr) : (p.heartRate != null ? Number(p.heartRate) : null);
      const ele = p.ele != null ? Number(p.ele) : (p.altitude != null ? Number(p.altitude) : null);
      const cadence = p.cadence != null ? Number(p.cadence) : null;

      rawNorm.push({ lat, lon, t, absT, spdKmh: Number(spdKmh.toFixed(2)), hr, ele, cadence });
    }

    // Suavização leve (janela de 3 pontos) para remover jitter de discretização de 1s do GPS
    const smoothed = rawNorm.map((p, i) => {
      if (i === 0 || i === rawNorm.length - 1) return p;
      const prev = rawNorm[i - 1];
      const next = rawNorm[i + 1];
      const avgSpd = (prev.spdKmh * 0.25) + (p.spdKmh * 0.5) + (next.spdKmh * 0.25);
      return { ...p, spdKmh: Number(avgSpd.toFixed(2)) };
    });

    // Calcular headings
    for (let j = 0; j < smoothed.length; j++) {
      let lookAhead = smoothed[Math.min(j + 3, smoothed.length - 1)];
      let dist = haversineM(smoothed[j].lat, smoothed[j].lon, lookAhead.lat, lookAhead.lon);
      if (dist < 0.2 && j < smoothed.length - 1) {
        lookAhead = smoothed[j + 1];
        dist = haversineM(smoothed[j].lat, smoothed[j].lon, lookAhead.lat, lookAhead.lon);
      }
      if (dist >= 0.2) {
        smoothed[j].heading = bearingDeg(smoothed[j].lat, smoothed[j].lon, lookAhead.lat, lookAhead.lon);
      } else if (j > 0) {
        smoothed[j].heading = smoothed[j - 1].heading;
      } else {
        smoothed[j].heading = 0;
      }
    }

    return smoothed;
  }
}
