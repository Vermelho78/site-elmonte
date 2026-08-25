/**
 * src/gpx_skills.js
 * VAAREC GPX Analysis & Pre-Processing Skills Engine (JavaScript Port)
 * 
 * Fornece decupagem dimensional de GPX:
 * - track_summary: cálculo de métricas estatísticas (distância, duração, FC média/máx, velocidade, tempos em movimento/parado)
 * - segment_track: segmentação padronizada por distância (ex: a cada 500m / 1000m)
 * - compare_two_tracks / multiTrackInterference: detecção temporal-geodésica de interferência/proximidade entre canoas
 * - trimTrackByRange / extractSeriesFromRange: corte e composição de trechos por range nos gráficos
 * - smoothTrackSpeed: filtro de suavização de velocidade e FC
 * - calculateEfficiencyMetrics: zonas de FC, ritmo (pace) e eficiência da remada
 * - autoDetectIntervalSeries: detecção automática de séries em treinos intervalados
 */

/**
 * Calcula distância geodésica entre dois pontos usando Haversine em metros
 */
export function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371008.8; // Raio médio da Terra em metros
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1.0, Math.sqrt(a)));
}

/**
 * Calcula o rumo (bearing / heading) em graus (0-360) entre dois pontos
 */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Calcula o resumo estatístico completo de uma track GPX
 * @param {Array} points - Array de pontos { lat, lon, t (ms ou s), spdKmh, hr, ele }
 * @returns {Object} Resumo com distância, durações, velocidades e FC
 */
export function calculateTrackSummary(points, name = '', source = '') {
  if (!points || !points.length) {
    return {
      name,
      source,
      pointsCount: 0,
      distanceM: 0,
      durationS: 0,
      speedAvgKmh: null,
      speedMaxKmh: null,
      movingTimeS: 0,
      stoppedTimeS: 0,
      hrAvg: null,
      hrMax: null,
      elevationMinM: null,
      elevationMaxM: null
    };
  }

  let totalDistM = 0;
  const speeds = [];
  const hrs = [];
  const elevs = [];
  let movingTimeS = 0;

  const t0 = Number(points[0].t ?? points[0].timestamp ?? 0);
  const tEnd = Number(points[points.length - 1].t ?? points[points.length - 1].timestamp ?? 0);
  const isMs = (tEnd - t0) > 100000;
  const totalDurationS = isMs ? (tEnd - t0) / 1000 : (tEnd - t0);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.spdKmh != null && !isNaN(p.spdKmh) && p.spdKmh >= 0) {
      speeds.push(Number(p.spdKmh));
    }
    if (p.hr != null && !isNaN(p.hr) && p.hr > 0) {
      hrs.push(Number(p.hr));
    }
    const ele = p.ele ?? p.elevation;
    if (ele != null && !isNaN(ele)) {
      elevs.push(Number(ele));
    }

    if (i > 0) {
      const prev = points[i - 1];
      const d = haversineM(prev.lat, prev.lon ?? prev.lng, p.lat, p.lon ?? p.lng);
      totalDistM += d;

      const pT = Number(p.t ?? p.timestamp ?? 0);
      const prevT = Number(prev.t ?? prev.timestamp ?? 0);
      const dtS = isMs ? Math.max(0, (pT - prevT) / 1000) : Math.max(0, pT - prevT);

      const spd = p.spdKmh != null ? Number(p.spdKmh) : (dtS > 0 ? (d / dtS) * 3.6 : 0);
      if (spd >= 1.0) {
        movingTimeS += dtS;
      }
    }
  }

  const fmean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    name,
    source,
    pointsCount: points.length,
    distanceM: Math.round(totalDistM),
    durationS: Math.round(totalDurationS),
    speedAvgKmh: speeds.length ? Number(fmean(speeds).toFixed(2)) : (totalDurationS > 0 ? Number(((totalDistM / totalDurationS) * 3.6).toFixed(2)) : null),
    speedMaxKmh: speeds.length ? Number(Math.max(...speeds).toFixed(2)) : null,
    movingTimeS: Math.round(movingTimeS),
    stoppedTimeS: Math.round(Math.max(0, totalDurationS - movingTimeS)),
    hrAvg: hrs.length ? Math.round(fmean(hrs)) : null,
    hrMax: hrs.length ? Math.max(...hrs) : null,
    elevationMinM: elevs.length ? Math.min(...elevs) : null,
    elevationMaxM: elevs.length ? Math.max(...elevs) : null
  };
}

/**
 * Segmenta uma track por intervalos fixos de distância (ex: a cada 500m)
 * @param {Array} points - Array de pontos
 * @param {Number} intervalM - Intervalo de segmentação em metros (padrão: 500m)
 * @returns {Array} Array de objetos Segment
 */
export function segmentTrackByDistance(points, intervalM = 500.0, trackId = 'track') {
  if (!points || points.length < 2) return [];

  const ptsWithDist = [];
  let accumM = 0;
  const isMs = (points[points.length - 1].t - points[0].t) > 100000;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      accumM += haversineM(prev.lat, prev.lon ?? prev.lng, p.lat, p.lon ?? p.lng);
    }
    const tS = isMs ? (p.t / 1000) : p.t;
    ptsWithDist.push({ ...p, distanceM: accumM, tS });
  }

  const totalDist = accumM;
  const segments = [];
  let endM = intervalM;

  while (endM <= totalDist + 1e-5) {
    const startM = endM - intervalM;
    const slice = ptsWithDist.filter(p => p.distanceM >= startM && p.distanceM <= endM);

    if (slice.length >= 2) {
      const pStart = slice[0];
      const pEnd = slice[slice.length - 1];
      const durS = pEnd.tS - pStart.tS;
      const actualDistM = pEnd.distanceM - pStart.distanceM;
      
      const speeds = slice.map(p => p.spdKmh).filter(s => s != null && !isNaN(s));
      const hrs = slice.map(p => p.hr).filter(h => h != null && !isNaN(h) && h > 0);

      const fmean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const avgSpd = speeds.length ? fmean(speeds) : (durS > 0 ? (actualDistM / durS) * 3.6 : 0);
      const paceMinKm = avgSpd > 0 ? (60 / avgSpd) : 0;
      const paceMin = Math.floor(paceMinKm);
      const paceSec = Math.round((paceMinKm - paceMin) * 60);
      const paceStr = `${paceMin}'${paceSec.toString().padStart(2, '0')}"`;

      segments.push({
        segmentId: `${Math.round(startM)}_${Math.round(endM)}`,
        trackId,
        startM: Math.round(startM),
        endM: Math.round(endM),
        durationS: Math.round(durS * 10) / 10,
        distanceM: Math.round(actualDistM),
        speedAvgKmh: Number(avgSpd.toFixed(2)),
        paceStr,
        hrAvg: hrs.length ? Math.round(fmean(hrs)) : null,
        hrMax: hrs.length ? Math.max(...hrs) : null,
        pointsCount: slice.length
      });
    }

    endM += intervalM;
  }

  return segments;
}

/**
 * Corta (Trim) uma trilha com base em uma faixa selecionada nos gráficos
 * @param {Array} points - Array de pontos
 * @param {Number} startVal - Início da faixa (em metros de distância ou tempo)
 * @param {Number} endVal - Fim da faixa
 * @param {String} mode - 'distance' | 'time' | 'index'
 * @returns {Array} Trilha cortada com t normalizado a partir de 0
 */
export function trimTrackByRange(points, startVal, endVal, mode = 'distance') {
  if (!points || points.length < 2) return points;

  let sliced = [];

  if (mode === 'index') {
    const i0 = Math.max(0, Math.min(Math.floor(startVal), points.length - 1));
    const i1 = Math.max(i0 + 1, Math.min(Math.ceil(endVal), points.length));
    sliced = points.slice(i0, i1);
  } else if (mode === 'distance') {
    // Calcular distâncias acumuladas
    let accum = 0;
    const ptsWithD = points.map((p, i) => {
      if (i > 0) {
        const prev = points[i - 1];
        accum += haversineM(prev.lat, prev.lon ?? prev.lng, p.lat, p.lon ?? p.lng);
      }
      return { ...p, _d: accum };
    });
    sliced = ptsWithD.filter(p => p._d >= startVal && p._d <= endVal);
  } else if (mode === 'time') {
    sliced = points.filter(p => {
      const t = p.t ?? p.timestamp ?? 0;
      return t >= startVal && t <= endVal;
    });
  }

  if (!sliced.length || sliced.length < 2) return points;

  // Normalizar tempos a partir de t = 0
  const t0 = sliced[0].t ?? sliced[0].timestamp ?? 0;
  return sliced.map(p => ({
    ...p,
    t: (p.t ?? p.timestamp ?? 0) - t0,
    absT: p.absT || (p.t ?? p.timestamp ?? 0)
  }));
}

/**
 * Extrai uma nova série independente a partir do trecho selecionado
 */
export function extractSeriesFromRange(points, startVal, endVal, mode = 'distance', seriesName = 'Nova Série') {
  const trimmed = trimTrackByRange(points, startVal, endVal, mode);
  return {
    name: seriesName,
    points: trimmed,
    summary: calculateTrackSummary(trimmed, seriesName)
  };
}

/**
 * Aplica filtro de suavização com ponderação triangular na velocidade e FC
 * Ideal para eliminar ruídos de movimento de braçada (relógio no pulso) e jitter de GPS
 */
export function smoothTrackSpeed(points, windowSize = 7, smoothHR = false) {
  if (!points || points.length <= 2) return points;
  const w = Math.max(3, windowSize % 2 === 0 ? windowSize + 1 : windowSize);
  const half = Math.floor(w / 2);

  // Kernel de ponderação triangular (centro com maior peso)
  const kernel = [];
  for (let k = -half; k <= half; k++) {
    kernel.push(1 - Math.abs(k) / (half + 1));
  }

  return points.map((p, i) => {
    let spdWeightSum = 0;
    let spdSum = 0;
    let hrWeightSum = 0;
    let hrSum = 0;

    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < points.length) {
        const weight = kernel[k + half];
        const pt = points[idx];
        if (pt.spdKmh != null && !isNaN(pt.spdKmh)) {
          spdSum += pt.spdKmh * weight;
          spdWeightSum += weight;
        }
        if (smoothHR && pt.hr != null && !isNaN(pt.hr)) {
          hrSum += pt.hr * weight;
          hrWeightSum += weight;
        }
      }
    }

    const smoothedSpd = spdWeightSum > 0 ? spdSum / spdWeightSum : p.spdKmh;
    const smoothedHr = (smoothHR && hrWeightSum > 0) ? Math.round(hrSum / hrWeightSum) : p.hr;

    return {
      ...p,
      spdKmh: smoothedSpd != null ? Number(smoothedSpd.toFixed(2)) : p.spdKmh,
      hr: smoothedHr
    };
  });
}

/**
 * Calcula métricas avançadas de eficiência e zonas de FC
 */
export function calculateEfficiencyMetrics(points) {
  if (!points || !points.length) return null;

  const zoneCounts = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  let hrTotal = 0;
  let hrPoints = 0;
  const correlationData = [];

  points.forEach(p => {
    if (p.hr && p.hr > 0) {
      hrTotal += p.hr;
      hrPoints++;
      if (p.hr < 110) zoneCounts.z1++;
      else if (p.hr < 130) zoneCounts.z2++;
      else if (p.hr < 150) zoneCounts.z3++;
      else if (p.hr < 165) zoneCounts.z4++;
      else zoneCounts.z5++;
    }

    if (p.spdKmh != null && p.hr != null && p.spdKmh > 2 && p.hr > 80) {
      correlationData.push({ x: Number(p.spdKmh.toFixed(1)), y: Math.round(p.hr) });
    }
  });

  const zonePcts = {};
  for (const z in zoneCounts) {
    zonePcts[z] = hrPoints > 0 ? Number(((zoneCounts[z] / hrPoints) * 100).toFixed(1)) : 0;
  }

  return {
    zoneCounts,
    zonePcts,
    hrAverage: hrPoints ? Math.round(hrTotal / hrPoints) : null,
    correlationData
  };
}

/**
 * Remove um intervalo selecionado (miolo ou trecho intermediário) e reconecta a trilha
 */
export function removeTrackInterval(points, startVal, endVal, mode = 'distance') {
  if (!points || points.length < 4) return points;

  let kept = [];
  if (mode === 'distance') {
    let accum = 0;
    const ptsWithD = points.map((p, i) => {
      if (i > 0) {
        const prev = points[i - 1];
        accum += haversineM(prev.lat, prev.lon ?? prev.lng, p.lat, p.lon ?? p.lng);
      }
      return { ...p, _d: accum };
    });
    kept = ptsWithD.filter(p => p._d < startVal || p._d > endVal);
  } else if (mode === 'time') {
    kept = points.filter(p => {
      const t = p.t ?? p.timestamp ?? 0;
      return t < startVal || t > endVal;
    });
  } else {
    const i0 = Math.floor(startVal);
    const i1 = Math.ceil(endVal);
    kept = [...points.slice(0, i0), ...points.slice(i1)];
  }

  if (kept.length < 2) return points;

  // Re-normalizar tempos relativos
  const t0 = kept[0].t ?? 0;
  return kept.map(p => ({
    ...p,
    t: Math.max(0, (p.t ?? 0) - t0),
    absT: p.absT || (p.t ?? 0)
  }));
}

/**
 * Filtra pontos por linha de corte (limiar de velocidade mínima e/ou FC mínima)
 */
export function filterTrackByThresholds(points, { minSpeedKmh = null, minHr = null }) {
  if (!points || !points.length) return points;

  const filtered = points.filter(p => {
    if (minSpeedKmh != null && (p.spdKmh || 0) < minSpeedKmh) return false;
    if (minHr != null && p.hr != null && p.hr < minHr) return false;
    return true;
  });

  if (filtered.length < 2) return points;

  const t0 = filtered[0].t ?? 0;
  return filtered.map(p => ({
    ...p,
    t: Math.max(0, (p.t ?? 0) - t0),
    absT: p.absT || (p.t ?? 0)
  }));
}

/**
 * Corta a trilha definindo largada por hora específica (HH:MM:SS) ou duração oficial de prova
 */
export function cropTrackByAbsoluteTime(points, startHms = null, durationS = null) {
  if (!points || !points.length) return points;

  let startIndex = 0;
  const isMs = (points[points.length - 1].t - points[0].t) > 100000;

  if (startHms) {
    const parts = startHms.split(':').map(Number);
    if (parts.length >= 2) {
      const targetH = parts[0] || 0;
      const targetM = parts[1] || 0;
      const targetS = parts[2] || 0;

      // Buscar se temos timestamp absoluto
      const baseAbsT = points[0].absT || (points[0].t > 1000000000 ? points[0].t : null);
      if (baseAbsT) {
        const d = new Date(baseAbsT);
        d.setHours(targetH, targetM, targetS, 0);
        const targetEpoch = d.getTime();

        for (let i = 0; i < points.length; i++) {
          const ptAbs = points[i].absT || (points[i].t > 1000000000 ? points[i].t : (baseAbsT + points[i].t));
          if (ptAbs >= targetEpoch) {
            startIndex = i;
            break;
          }
        }
      } else {
        // Modo fallback por segundos do dia
        const targetSecOfDay = targetH * 3600 + targetM * 60 + targetS;
        for (let i = 0; i < points.length; i++) {
          const sec = isMs ? (points[i].t / 1000) : points[i].t;
          if (sec >= targetSecOfDay) {
            startIndex = i;
            break;
          }
        }
      }
    }
  }

  let endIndex = points.length - 1;
  if (durationS != null && durationS > 0) {
    const startSec = isMs ? (points[startIndex].t / 1000) : points[startIndex].t;
    const targetEndSec = startSec + durationS;

    for (let i = startIndex; i < points.length; i++) {
      const sec = isMs ? (points[i].t / 1000) : points[i].t;
      if (sec >= targetEndSec) {
        endIndex = i;
        break;
      }
    }
  }

  const cropped = points.slice(startIndex, endIndex + 1);
  if (cropped.length < 2) return points;

  const t0 = cropped[0].t ?? 0;
  return cropped.map(p => ({
    ...p,
    t: Math.max(0, (p.t ?? 0) - t0),
    absT: p.absT || (p.t ?? 0)
  }));
}

/**
 * Detecta automaticamente séries de tiro/intervalos de forma adaptativa
 */
export function autoDetectIntervalSeriesAdaptive(points, config = {}) {
  if (!points || points.length < 10) return [];

  const mode = config.mode || 'speed'; // 'speed' | 'dynamic_acceleration' | 'distance' | 'time'
  const isMs = (points[points.length - 1].t - points[0].t) > 100000;
  const getSec = p => isMs ? (p.t / 1000) : p.t;

  const series = [];

  if (mode === 'distance') {
    const stepM = config.intervalM || 1000;
    let accum = 0;
    let startIdx = 0;
    let lastSplitM = 0;

    for (let i = 1; i < points.length; i++) {
      accum += haversineM(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
      if (accum - lastSplitM >= stepM || i === points.length - 1) {
        const slice = trimTrackByRange(points.slice(startIdx, i + 1), 0, (i + 1 - startIdx), 'index');
        series.push({
          seriesIndex: series.length + 1,
          name: `Série ${series.length + 1} (${Math.round(accum - lastSplitM)}m)`,
          points: slice,
          durationS: Math.round(getSec(points[i]) - getSec(points[startIdx])),
          summary: calculateTrackSummary(slice, `Série ${series.length + 1}`)
        });
        startIdx = i;
        lastSplitM = accum;
      }
    }
  } else if (mode === 'time') {
    const stepS = config.intervalS || 300; // 5 min padrão
    let startIdx = 0;

    for (let i = 1; i < points.length; i++) {
      const dt = getSec(points[i]) - getSec(points[startIdx]);
      if (dt >= stepS || i === points.length - 1) {
        const slice = trimTrackByRange(points.slice(startIdx, i + 1), 0, (i + 1 - startIdx), 'index');
        series.push({
          seriesIndex: series.length + 1,
          name: `Série ${series.length + 1} (${fmtSecondsShort(Math.round(dt))})`,
          points: slice,
          durationS: Math.round(dt),
          summary: calculateTrackSummary(slice, `Série ${series.length + 1}`)
        });
        startIdx = i;
      }
    }
  } else {
    // Modo por limiar de velocidade ou aceleração
    const minSpeedKmh = config.minSpeedKmh || 7.5;
    const minDurationS = config.minDurationS || 20;
    const minPauseS = config.minPauseS || 10;

    let inInterval = false;
    let startIdx = 0;
    let pauseCount = 0;

    for (let i = 0; i < points.length; i++) {
      const spd = points[i].spdKmh || 0;
      const isFast = spd >= minSpeedKmh;

      if (isFast) {
        if (!inInterval) {
          inInterval = true;
          startIdx = i;
        }
        pauseCount = 0;
      } else {
        if (inInterval) {
          pauseCount++;
          const dtPause = getSec(points[i]) - getSec(points[i - pauseCount]);
          if (dtPause >= minPauseS || i === points.length - 1) {
            const endIdx = i - pauseCount;
            const durS = getSec(points[endIdx]) - getSec(points[startIdx]);
            if (durS >= minDurationS && (endIdx - startIdx) >= 4) {
              const slice = trimTrackByRange(points.slice(startIdx, endIdx + 1), 0, (endIdx + 1 - startIdx), 'index');
              series.push({
                seriesIndex: series.length + 1,
                name: `Série ${series.length + 1}`,
                points: slice,
                durationS: Math.round(durS),
                summary: calculateTrackSummary(slice, `Série ${series.length + 1}`)
              });
            }
            inInterval = false;
            pauseCount = 0;
          }
        }
      }
    }
  }

  return series;
}

function fmtSecondsShort(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s ? `${s}s` : ''}`;
}

/**
 * Auto-detecta todos os tipos de eventos atléticos e táticos da prova
 */
export function autoDetectAllRaceEvents(tracks, options = {}) {
  if (!tracks || !tracks.length) return [];

  const events = [];
  let eventCounter = 0;

  // 1. Eventos de Combate/Interferência entre Pares
  if (tracks.length >= 2) {
    const interferences = multiTrackInterference(tracks, options.interferenceThresholdM || 5.0, 4.0);
    interferences.forEach(inf => {
      eventCounter++;
      events.push({
        id: `evt-${eventCounter}`,
        type: 'COMBAT',
        typeLabel: 'Combate / Proximidade',
        icon: 'fa-swords',
        color: '#EF4444',
        name: `${inf.canoeA} ⚔ ${inf.canoeB}`,
        timeMs: inf.startTimeMs,
        durationS: inf.durationS,
        distM: inf.minDistanceM,
        details: `Distância mínima: ${inf.minDistanceM}m durante ${inf.durationS}s`
      });
    });

    const overtakes = detectOvertakingEvents(tracks[0].points, tracks[1].points, tracks[0].name, tracks[1].name);
    overtakes.forEach(ov => {
      eventCounter++;
      events.push({
        id: `evt-${eventCounter}`,
        type: 'OVERTAKE',
        typeLabel: 'Ultrapassagem',
        icon: 'fa-flag-checkered',
        color: '#F59E0B',
        name: `${ov.newLeader} assumiu liderança`,
        timeMs: ov.timeMs,
        durationS: 0,
        distM: ov.distBetweenM,
        lat: ov.lat,
        lon: ov.lon,
        details: `Ultrapassagem sobre ${ov.previousLeader} com delta de ${ov.distBetweenM}m`
      });
    });
  }

  // 2. Eventos Individuais por Trilha (Sprints, Curvas de Bóia, Quedas de Ritmo, Picos Cardíacos)
  tracks.forEach((track, tIdx) => {
    const pts = track.points || [];
    if (pts.length < 10) return;

    let accum = 0;
    for (let i = 3; i < pts.length - 3; i++) {
      const prev3 = pts[i - 3];
      const cur = pts[i];
      const next3 = pts[i + 3];

      accum += haversineM(pts[i - 1].lat, pts[i - 1].lon, cur.lat, cur.lon);

      // Curva de Boia / Guinada Angular (Mudança brusca de rumo >= 45°)
      if (prev3.heading != null && next3.heading != null) {
        let diff = Math.abs(next3.heading - prev3.heading);
        if (diff > 180) diff = 360 - diff;
        if (diff >= 50) {
          eventCounter++;
          events.push({
            id: `evt-${eventCounter}`,
            type: 'BUOY_TURN',
            typeLabel: 'Curva de Boia / Guinada',
            icon: 'fa-location-arrow',
            color: '#A78BFA',
            name: `Curva de Boia (${track.name})`,
            canoeName: track.name,
            timeMs: cur.t,
            distanceM: Math.round(accum),
            lat: cur.lat,
            lon: cur.lon,
            details: `Variação de proa de ${diff.toFixed(0)}°`
          });
          i += 10; // Pular pontos adjacentes da mesma curva
          continue;
        }
      }

      // Ataque / Sprint (Aceleração sustentada)
      if (cur.spdKmh && prev3.spdKmh && (cur.spdKmh - prev3.spdKmh) >= 2.2) {
        eventCounter++;
        events.push({
          id: `evt-${eventCounter}`,
          type: 'SPRINT',
          typeLabel: 'Ataque / Sprint',
          icon: 'fa-bolt',
          color: '#00F2FE',
          name: `Ataque / Sprint (${track.name})`,
          canoeName: track.name,
          timeMs: cur.t,
          distanceM: Math.round(accum),
          lat: cur.lat,
          lon: cur.lon,
          details: `Aceleração para ${cur.spdKmh.toFixed(1)} km/h (+${(cur.spdKmh - prev3.spdKmh).toFixed(1)} km/h)`
        });
        i += 15;
        continue;
      }

      // Queda Brusca de Ritmo
      if (cur.spdKmh && prev3.spdKmh && (prev3.spdKmh - cur.spdKmh) >= 2.5 && cur.spdKmh < 9.0) {
        eventCounter++;
        events.push({
          id: `evt-${eventCounter}`,
          type: 'PACE_DROP',
          typeLabel: 'Queda de Ritmo',
          icon: 'fa-arrow-trend-down',
          color: '#F43F5E',
          name: `Queda de Ritmo (${track.name})`,
          canoeName: track.name,
          timeMs: cur.t,
          distanceM: Math.round(accum),
          lat: cur.lat,
          lon: cur.lon,
          details: `Velocidade caiu para ${cur.spdKmh.toFixed(1)} km/h (-${(prev3.spdKmh - cur.spdKmh).toFixed(1)} km/h)`
        });
        i += 15;
        continue;
      }

      // Pico Cardíaco (FC >= 178 bpm)
      if (cur.hr && cur.hr >= 178) {
        eventCounter++;
        events.push({
          id: `evt-${eventCounter}`,
          type: 'HR_SPIKE',
          typeLabel: 'Pico Cardíaco Z5',
          icon: 'fa-heart-pulse',
          color: '#EF4444',
          name: `Pico FC (${track.name})`,
          canoeName: track.name,
          timeMs: cur.t,
          distanceM: Math.round(accum),
          lat: cur.lat,
          lon: cur.lon,
          details: `Frequência cardíaca atingiu ${cur.hr} bpm`
        });
        i += 20;
        continue;
      }
    }
  });

  return events.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
}

/**
 * Backward compatibility alias para autoDetectIntervalSeries
 */
export function autoDetectIntervalSeries(points, minSpeedKmh = 8.0, minDurationS = 25, minPauseS = 15) {
  return autoDetectIntervalSeriesAdaptive(points, { mode: 'speed', minSpeedKmh, minDurationS, minPauseS });
}

/**
 * Interpolação linear de um ponto no tempo t
 */
function interpolatePointAtTime(points, t, isMs = false) {
  if (!points || !points.length) return null;
  const tField = (p) => isMs ? (p.t ?? p.timestamp ?? 0) : ((p.t ?? p.timestamp ?? 0) * (p.t > 100000 ? 1 : 1000));
  
  const tStart = tField(points[0]);
  const tEnd = tField(points[points.length - 1]);

  if (t <= tStart) return points[0];
  if (t >= tEnd) return points[points.length - 1];

  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tField(points[mid]) <= t) lo = mid;
    else hi = mid;
  }

  const pA = points[lo];
  const pB = points[hi];
  const tA = tField(pA);
  const tB = tField(pB);
  const factor = (tB === tA) ? 0 : Math.max(0, Math.min(1, (t - tA) / (tB - tA)));

  return {
    lat: pA.lat + (pB.lat - pA.lat) * factor,
    lon: (pA.lon ?? pA.lng) + ((pB.lon ?? pB.lng) - (pA.lon ?? pA.lng)) * factor,
    spdKmh: (pA.spdKmh || 0) + ((pB.spdKmh || 0) - (pA.spdKmh || 0)) * factor,
    hr: pA.hr && pB.hr ? Math.round(pA.hr + (pB.hr - pA.hr) * factor) : (pA.hr || pB.hr || null)
  };
}

/**
 * Detecta eventos de proximidade / interferência entre duas canoas ao longo do tempo
 */
export function detectInterferenceEvents(pointsA, pointsB, thresholdM = 5.0, minDurationS = 4.0, stepS = 2.0) {
  if (!pointsA || !pointsB || pointsA.length < 2 || pointsB.length < 2) return [];

  const isMsA = (pointsA[pointsA.length - 1].t - pointsA[0].t) > 100000;
  const isMsB = (pointsB[pointsB.length - 1].t - pointsB[0].t) > 100000;

  const getAbsT = (p, isMs) => isMs ? p.t : (p.t * 1000);

  const startMs = Math.max(getAbsT(pointsA[0], isMsA), getAbsT(pointsB[0], isMsB));
  const endMs = Math.min(getAbsT(pointsA[pointsA.length - 1], isMsA), getAbsT(pointsB[pointsB.length - 1], isMsB));

  if (endMs <= startMs) return [];

  const stepMs = stepS * 1000;
  const samples = [];

  for (let t = startMs; t <= endMs; t += stepMs) {
    const ptA = interpolatePointAtTime(pointsA, t, true);
    const ptB = interpolatePointAtTime(pointsB, t, true);

    if (ptA && ptB) {
      const dist = haversineM(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
      samples.push({ t, dist, ptA, ptB });
    }
  }

  const events = [];
  let inEvent = false;
  let eventStart = 0;
  let minD = Infinity;
  let count = 0;
  let eid = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const isClose = s.dist <= thresholdM;

    if (isClose) {
      if (!inEvent) {
        inEvent = true;
        eventStart = s.t;
        minD = s.dist;
        count = 1;
      } else {
        if (s.dist < minD) minD = s.dist;
        count++;
      }
    } else {
      if (inEvent) {
        const durS = (samples[i - 1].t - eventStart) / 1000;
        if (durS >= minDurationS) {
          eid++;
          events.push({
            eventId: `evt-int-${eid.toString().padStart(3, '0')}`,
            eventType: 'possible_interference',
            startTimeMs: eventStart,
            endTimeMs: samples[i - 1].t,
            durationS: Math.round(durS * 10) / 10,
            minDistanceM: Math.round(minD * 10) / 10,
            confidence: minD < 2.5 ? 0.95 : 0.75,
            details: {
              thresholdM,
              sampleCount: count
            }
          });
        }
        inEvent = false;
      }
    }
  }

  if (inEvent) {
    const lastSample = samples[samples.length - 1];
    const durS = (lastSample.t - eventStart) / 1000;
    if (durS >= minDurationS) {
      eid++;
      events.push({
        eventId: `evt-int-${eid.toString().padStart(3, '0')}`,
        eventType: 'possible_interference',
        startTimeMs: eventStart,
        endTimeMs: lastSample.t,
        durationS: Math.round(durS * 10) / 10,
        minDistanceM: Math.round(minD * 10) / 10,
        confidence: minD < 2.5 ? 0.95 : 0.75,
        details: {
          thresholdM,
          sampleCount: count
        }
      });
    }
  }

  return events;
}

/**
 * Analisa múltiplos pares de tracks para detecção de interferência
 */
export function multiTrackInterference(tracks, thresholdM = 5.0, minDurationS = 4.0) {
  if (!tracks || tracks.length < 2) return [];

  const allEvents = [];
  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const ptsA = tracks[i].points || tracks[i].pts || tracks[i].data || [];
      const ptsB = tracks[j].points || tracks[j].pts || tracks[j].data || [];

      const pairEvents = detectInterferenceEvents(ptsA, ptsB, thresholdM, minDurationS);
      pairEvents.forEach(evt => {
        allEvents.push({
          ...evt,
          canoeA: tracks[i].name || `Canoa ${i + 1}`,
          canoeB: tracks[j].name || `Canoa ${j + 1}`,
          canoeIdxA: i,
          canoeIdxB: j
        });
      });
    }
  }

  return allEvents;
}

/**
 * Calcula o Envelope Estatístico (Baseline) entre múltiplas trilhas/dias
 * @param {Array} tracks - Array de tracks com points/segments
 * @param {Number} intervalM - Intervalo em metros (padrão: 500m)
 * @returns {Object} { summaries, segments, baseline, parameters }
 */
export function calculateBaselineEnvelope(tracks, intervalM = 500.0) {
  if (!tracks || !tracks.length) return { summaries: [], segments: [], baseline: [], parameters: { intervalM } };

  const summaries = [];
  const allSegments = [];
  const segmentsBySid = new Map();

  tracks.forEach((t, tIdx) => {
    const pts = t.points || t.pts || [];
    const name = t.name || `Trilha ${tIdx + 1}`;
    const fileId = t.fileName || t.name || `track_${tIdx + 1}`;
    
    const summ = calculateTrackSummary(pts, name, fileId);
    summaries.push(summ);

    const segs = segmentTrackByDistance(pts, intervalM, fileId);
    segs.forEach(s => {
      allSegments.push(s);
      if (!segmentsBySid.has(s.segmentId)) {
        segmentsBySid.set(s.segmentId, []);
      }
      segmentsBySid.get(s.segmentId).push(s);
    });
  });

  const median = arr => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const stdev = arr => {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sqDiff = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
    return Math.sqrt(sqDiff);
  };

  const baseline = [];
  segmentsBySid.forEach((rs, sid) => {
    const getVals = key => rs.map(r => r[key]).filter(v => v != null && !isNaN(v));

    const durs = getVals('durationS');
    const spds = getVals('speedAvgKmh');
    const hrs = getVals('hrAvg');
    const hrMaxs = getVals('hrMax');

    baseline.push({
      segmentId: sid,
      nFiles: rs.length,
      duration_s_median: median(durs),
      duration_s_min: durs.length ? Math.min(...durs) : null,
      duration_s_max: durs.length ? Math.max(...durs) : null,
      duration_s_stdev: stdev(durs),
      speed_avg_kmh_median: median(spds),
      speed_avg_kmh_min: spds.length ? Math.min(...spds) : null,
      speed_avg_kmh_max: spds.length ? Math.max(...spds) : null,
      speed_avg_kmh_stdev: stdev(spds),
      hr_avg_median: median(hrs),
      hr_avg_min: hrs.length ? Math.min(...hrs) : null,
      hr_avg_max: hrs.length ? Math.max(...hrs) : null,
      hr_avg_stdev: stdev(hrs),
      hr_max_median: median(hrMaxs),
      hr_max_min: hrMaxs.length ? Math.min(...hrMaxs) : null,
      hr_max_max: hrMaxs.length ? Math.max(...hrMaxs) : null
    });
  });

  return {
    summaries,
    segments: allSegments,
    baseline,
    parameters: { intervalM }
  };
}

/**
 * Detecta anomalias de desempenho de uma trilha em relação à baseline
 */
export function detectSegmentAnomalies(trackSegments, baselineList) {
  if (!trackSegments || !baselineList) return [];
  const baseMap = new Map(baselineList.map(b => [b.segmentId, b]));
  const anomalies = [];

  trackSegments.forEach(seg => {
    const base = baseMap.get(seg.segmentId);
    if (!base || base.speed_avg_kmh_median == null) return;

    const spdMed = base.speed_avg_kmh_median;
    const spdDev = base.speed_avg_kmh_stdev || (spdMed * 0.1);
    const dropKmh = spdMed - seg.speedAvgKmh;

    if (dropKmh > Math.max(1.5, spdDev * 1.5)) {
      anomalies.push({
        segmentId: seg.segmentId,
        type: 'SPEED_DROP',
        severity: dropKmh > 3.0 ? 'CRITICAL' : 'WARNING',
        message: `Queda de velocidade no split ${seg.segmentId}: ${seg.speedAvgKmh} km/h (esperado: ${spdMed.toFixed(1)} ± ${spdDev.toFixed(1)} km/h)`,
        actualSpeed: seg.speedAvgKmh,
        expectedSpeed: spdMed,
        delta: Number((-dropKmh).toFixed(2))
      });
    }

    if (seg.hrAvg && base.hr_avg_median) {
      const hrMed = base.hr_avg_median;
      const hrDev = base.hr_avg_stdev || 8;
      const hrDiff = seg.hrAvg - hrMed;

      if (hrDiff > Math.max(12, hrDev * 1.8)) {
        anomalies.push({
          segmentId: seg.segmentId,
          type: 'HR_SPIKE',
          severity: hrDiff > 20 ? 'CRITICAL' : 'WARNING',
          message: `Pico anormal de frequência cardíaca no split ${seg.segmentId}: ${seg.hrAvg} bpm (mediana: ${hrMed.toFixed(0)} bpm)`,
          actualHr: seg.hrAvg,
          expectedHr: hrMed,
          delta: Number(hrDiff.toFixed(0))
        });
      }
    }
  });

  return anomalies;
}

/**
 * Calcula o perfil contínuo de distância relativa entre duas canoas e taxa de aproximação
 */
export function calculateTwoCanoesApproachProfile(pointsA, pointsB, stepS = 2.0) {
  if (!pointsA || !pointsB || pointsA.length < 2 || pointsB.length < 2) return [];

  const isMsA = (pointsA[pointsA.length - 1].t - pointsA[0].t) > 100000;
  const isMsB = (pointsB[pointsB.length - 1].t - pointsB[0].t) > 100000;

  const getAbsT = (p, isMs) => isMs ? p.t : (p.t * 1000);

  const startMs = Math.max(getAbsT(pointsA[0], isMsA), getAbsT(pointsB[0], isMsB));
  const endMs = Math.min(getAbsT(pointsA[pointsA.length - 1], isMsA), getAbsT(pointsB[pointsB.length - 1], isMsB));

  if (endMs <= startMs) return [];

  const stepMs = stepS * 1000;
  const profile = [];
  let prevDist = null;

  for (let t = startMs; t <= endMs; t += stepMs) {
    const ptA = interpolatePointAtTime(pointsA, t, true);
    const ptB = interpolatePointAtTime(pointsB, t, true);

    if (ptA && ptB) {
      const dist = haversineM(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
      const rateOfApproach = prevDist != null ? ((prevDist - dist) / stepS) : 0; // m/s (>0 aproximação, <0 afastamento)

      let trend = 'stable';
      if (dist <= 5.0) trend = 'critical_proximity';
      else if (rateOfApproach > 0.4) trend = 'approaching';
      else if (rateOfApproach < -0.4) trend = 'separating';

      profile.push({
        timeMs: t - startMs,
        absTimeMs: t,
        distanceM: Number(dist.toFixed(1)),
        rateOfApproach: Number(rateOfApproach.toFixed(2)),
        trend,
        latA: ptA.lat,
        lonA: ptA.lon,
        latB: ptB.lat,
        lonB: ptB.lon,
        spdA: ptA.spdKmh,
        spdB: ptB.spdKmh
      });

      prevDist = dist;
    }
  }

  return profile;
}

/**
 * Detecta eventos de ultrapassagem e inversão de liderança
 */
export function detectOvertakingEvents(pointsA, pointsB, nameA = 'Canoa A', nameB = 'Canoa B') {
  if (!pointsA || !pointsB || pointsA.length < 2 || pointsB.length < 2) return [];

  const isMsA = (pointsA[pointsA.length - 1].t - pointsA[0].t) > 100000;
  const isMsB = (pointsB[pointsB.length - 1].t - pointsB[0].t) > 100000;

  const getAbsT = (p, isMs) => isMs ? p.t : (p.t * 1000);
  const startMs = Math.max(getAbsT(pointsA[0], isMsA), getAbsT(pointsB[0], isMsB));
  const endMs = Math.min(getAbsT(pointsA[pointsA.length - 1], isMsA), getAbsT(pointsB[pointsB.length - 1], isMsB));

  if (endMs <= startMs) return [];

  const stepMs = 3000; // 3s
  const overtakes = [];
  let currentLeader = null;

  // Calcular distâncias acumuladas para A e B
  for (let t = startMs; t <= endMs; t += stepMs) {
    const ptA = interpolatePointAtTime(pointsA, t, true);
    const ptB = interpolatePointAtTime(pointsB, t, true);

    if (ptA && ptB) {
      const distBetween = haversineM(ptA.lat, ptA.lon, ptB.lat, ptB.lon);
      
      // Determinar quem está na frente baseado na projeção de avanço ou velocidade relativa
      const leader = (ptA.spdKmh || 0) >= (ptB.spdKmh || 0) ? nameA : nameB;

      if (currentLeader == null) {
        currentLeader = leader;
      } else if (leader !== currentLeader && distBetween <= 25.0) {
        overtakes.push({
          timeMs: t - startMs,
          absTimeMs: t,
          previousLeader: currentLeader,
          newLeader: leader,
          distBetweenM: Number(distBetween.toFixed(1)),
          lat: ptA.lat,
          lon: ptA.lon
        });
        currentLeader = leader;
      }
    }
  }

  return overtakes;
}

/**
 * Calcula a distribuição em Bins de Velocidade e Bins de Frequência Cardíaca
 */
export function calculateSpeedAndHRBins(points) {
  if (!points || !points.length) return null;

  const isMs = (points[points.length - 1].t - points[0].t) > 100000;

  const speedBins = {
    '0-10 km/h': { count: 0, distM: 0, timeS: 0, color: '#38BDF8' },
    '10-12 km/h': { count: 0, distM: 0, timeS: 0, color: '#10B981' },
    '12-14 km/h': { count: 0, distM: 0, timeS: 0, color: '#F59E0B' },
    '14-16 km/h': { count: 0, distM: 0, timeS: 0, color: '#F97316' },
    '16+ km/h': { count: 0, distM: 0, timeS: 0, color: '#EF4444' }
  };

  const hrBins = {
    '< 120 bpm': { count: 0, distM: 0, timeS: 0, color: '#06B6D4' },
    '120-139 bpm': { count: 0, distM: 0, timeS: 0, color: '#10B981' },
    '140-159 bpm': { count: 0, distM: 0, timeS: 0, color: '#F59E0B' },
    '160-179 bpm': { count: 0, distM: 0, timeS: 0, color: '#F97316' },
    '180+ bpm': { count: 0, distM: 0, timeS: 0, color: '#EF4444' }
  };

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dM = haversineM(prev.lat, prev.lon ?? prev.lng, cur.lat, cur.lon ?? cur.lng);
    const dtS = isMs ? ((cur.t - prev.t) / 1000) : (cur.t - prev.t);
    const spd = cur.spdKmh || 0;
    const hr = cur.hr;

    // Speed bin
    if (spd < 10) { speedBins['0-10 km/h'].count++; speedBins['0-10 km/h'].distM += dM; speedBins['0-10 km/h'].timeS += dtS; }
    else if (spd < 12) { speedBins['10-12 km/h'].count++; speedBins['10-12 km/h'].distM += dM; speedBins['10-12 km/h'].timeS += dtS; }
    else if (spd < 14) { speedBins['12-14 km/h'].count++; speedBins['12-14 km/h'].distM += dM; speedBins['12-14 km/h'].timeS += dtS; }
    else if (spd < 16) { speedBins['14-16 km/h'].count++; speedBins['14-16 km/h'].distM += dM; speedBins['14-16 km/h'].timeS += dtS; }
    else { speedBins['16+ km/h'].count++; speedBins['16+ km/h'].distM += dM; speedBins['16+ km/h'].timeS += dtS; }

    // HR bin
    if (hr) {
      if (hr < 120) { hrBins['< 120 bpm'].count++; hrBins['< 120 bpm'].distM += dM; hrBins['< 120 bpm'].timeS += dtS; }
      else if (hr < 140) { hrBins['120-139 bpm'].count++; hrBins['120-139 bpm'].distM += dM; hrBins['120-139 bpm'].timeS += dtS; }
      else if (hr < 160) { hrBins['140-159 bpm'].count++; hrBins['140-159 bpm'].distM += dM; hrBins['140-159 bpm'].timeS += dtS; }
      else if (hr < 180) { hrBins['160-179 bpm'].count++; hrBins['160-179 bpm'].distM += dM; hrBins['160-179 bpm'].timeS += dtS; }
      else { hrBins['180+ bpm'].count++; hrBins['180+ bpm'].distM += dM; hrBins['180+ bpm'].timeS += dtS; }
    }
  }

  return { speedBins, hrBins };
}
