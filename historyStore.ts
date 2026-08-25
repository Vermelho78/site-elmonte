import fs from "fs";
import path from "path";

export interface TrackPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
  speed?: number | null;
}

export interface TrackedSessionHistory {
  sessionId: string;
  sessionIndex?: number;
  vesselId: string | number;
  vesselNumber: string;
  competitorName: string;
  modality?: string;
  category?: string;
  club?: string;
  largadaTitle?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  pointsCount: number;
  totalDistanceKm?: number;
  avgSpeedKmH?: number;
  maxSpeedKmH?: number;
  points: TrackPoint[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "race_history.json");

// In-memory cache keyed by sessionId
let sessionsCache: Record<string, TrackedSessionHistory> = {};
let isLoaded = false;
let saveTimer: NodeJS.Timeout | null = null;

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (err) {
      console.warn("[historyStore] Could not create data directory:", err);
    }
  }
}

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeSessionMetrics(session: TrackedSessionHistory) {
  if (!session.points || session.points.length < 2) {
    session.totalDistanceKm = 0;
    session.avgSpeedKmH = 0;
    session.maxSpeedKmH = 0;
    return;
  }

  let totalDistKm = 0;
  let maxSpeed = 0;

  for (let i = 1; i < session.points.length; i++) {
    const pPrev = session.points[i - 1];
    const pCurr = session.points[i];
    const d = calculateHaversineDistanceKm(pPrev.latitude, pPrev.longitude, pCurr.latitude, pCurr.longitude);
    totalDistKm += d;

    const timeHours = (pCurr.timestamp - pPrev.timestamp) / (1000 * 3600);
    if (timeHours > 0 && timeHours < 0.05) {
      const spd = d / timeHours;
      if (spd < 60 && spd > maxSpeed) {
        maxSpeed = spd;
      }
    }
  }

  const durationHours = (session.lastSeenAt - session.firstSeenAt) / (1000 * 3600);
  const avgSpeed = durationHours > 0 ? totalDistKm / durationHours : 0;

  session.totalDistanceKm = Number(totalDistKm.toFixed(3));
  session.avgSpeedKmH = Number(Math.min(avgSpeed, 50).toFixed(1));
  session.maxSpeedKmH = Number(Math.min(maxSpeed, 60).toFixed(1));
}

function loadFromDisk() {
  if (isLoaded) return;
  try {
    ensureDirectoryExists();
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // Migration from array format
        sessionsCache = {};
        parsed.forEach((item) => {
          if (item && (item.sessionId || item.vesselNumber)) {
            const sId = item.sessionId || `SESSION_${item.vesselNumber}_${item.firstSeenAt || Date.now()}`;
            sessionsCache[sId] = { ...item, sessionId: sId };
          }
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        // Direct map
        sessionsCache = parsed;
      } else {
        sessionsCache = {};
      }
      console.log(`[historyStore] Loaded ${Object.keys(sessionsCache).length} perpetual race sessions from disk.`);
    } else {
      sessionsCache = {};
    }
  } catch (err) {
    console.error("[historyStore] Error loading history from disk:", err);
    sessionsCache = {};
  }
  isLoaded = true;
}

export function flushToDiskNow() {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(sessionsCache, null, 2), "utf-8");
  } catch (err) {
    console.error("[historyStore] Error saving history to disk:", err);
  }
}

if (typeof process !== "undefined") {
  process.on("beforeExit", flushToDiskNow);
  process.on("SIGINT", () => {
    flushToDiskNow();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    flushToDiskNow();
    process.exit(0);
  });
}

function scheduleSaveToDisk() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushToDiskNow();
  }, 500);
}

export function recordPositionToHistory(payload: {
  sessionId?: string;
  vesselId?: string | number;
  vesselNumber?: string;
  competitorName?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
  speed?: number | null;
  modality?: string;
  category?: string;
  club?: string;
  largadaTitle?: string;
}) {
  loadFromDisk();

  const num = (payload.vesselNumber || "VAA-001").trim();
  const vId = payload.vesselId !== undefined && payload.vesselId !== null ? String(payload.vesselId) : num;
  const time = Number(payload.timestamp) || Date.now();
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);
  const acc = payload.accuracy !== undefined && payload.accuracy !== null ? Number(payload.accuracy) : null;
  const spd = payload.speed !== undefined && payload.speed !== null ? Number(payload.speed) : null;

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return;
  }

  // Determine or create session key
  let sId = payload.sessionId?.trim();
  if (!sId) {
    // If no sessionId sent, check if there is an active session within last 5 minutes
    const existingKeys = Object.keys(sessionsCache).filter(
      (k) => sessionsCache[k].vesselNumber.toLowerCase() === num.toLowerCase()
    );
    const lastKey = existingKeys[existingKeys.length - 1];
    if (lastKey && time - sessionsCache[lastKey].lastSeenAt < 5 * 60 * 1000) {
      sId = lastKey;
    } else {
      const sessionIndex = existingKeys.length + 1;
      sId = `SESSION_${num}_${time}_#${sessionIndex}`;
    }
  }

  if (!sessionsCache[sId]) {
    const existingSessionsForVessel = Object.values(sessionsCache).filter(
      (s) => s.vesselNumber.toLowerCase() === num.toLowerCase()
    );
    const sessionIndex = existingSessionsForVessel.length + 1;

    sessionsCache[sId] = {
      sessionId: sId,
      sessionIndex,
      vesselId: vId,
      vesselNumber: num,
      competitorName: payload.competitorName?.trim() || "Competidor",
      modality: payload.modality,
      category: payload.category,
      club: payload.club,
      largadaTitle: payload.largadaTitle,
      firstSeenAt: time,
      lastSeenAt: time,
      pointsCount: 0,
      totalDistanceKm: 0,
      avgSpeedKmH: 0,
      maxSpeedKmH: 0,
      points: [],
    };
  }

  const session = sessionsCache[sId];

  // Update metadata if richer information arrives
  if (payload.competitorName && payload.competitorName !== "Competidor") {
    session.competitorName = payload.competitorName.trim();
  }
  if (payload.modality) session.modality = payload.modality;
  if (payload.category) session.category = payload.category;
  if (payload.club) session.club = payload.club;
  if (payload.largadaTitle) session.largadaTitle = payload.largadaTitle;

  // Deduplicate points within 1 second and same coordinates
  const lastPoint = session.points[session.points.length - 1];
  const isDuplicate =
    lastPoint &&
    Math.abs(lastPoint.latitude - lat) < 0.000001 &&
    Math.abs(lastPoint.longitude - lng) < 0.000001 &&
    Math.abs(lastPoint.timestamp - time) < 2000;

  if (!isDuplicate) {
    session.points.push({
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp: time,
      speed: spd,
    });
    session.pointsCount = session.points.length;
    session.lastSeenAt = time;
    computeSessionMetrics(session);
    scheduleSaveToDisk();
  }
}

export function getAllHistory(): TrackedSessionHistory[] {
  loadFromDisk();
  return Object.values(sessionsCache).sort((a, b) => b.firstSeenAt - a.firstSeenAt);
}

export function getSessionHistory(sessionId: string): TrackedSessionHistory | undefined {
  loadFromDisk();
  return sessionsCache[sessionId];
}

export function getVesselHistory(vesselNumber: string): TrackedSessionHistory[] {
  loadFromDisk();
  const num = vesselNumber.trim().toLowerCase();
  return Object.values(sessionsCache).filter((s) => s.vesselNumber.toLowerCase() === num);
}

export function mergeVesselHistories(items: any[]) {
  loadFromDisk();
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    if (!item || !item.vesselNumber) continue;
    const num = String(item.vesselNumber).trim();
    const sId = item.sessionId || `SESSION_${num}_${item.firstSeenAt || Date.now()}`;

    if (!sessionsCache[sId]) {
      sessionsCache[sId] = {
        sessionId: sId,
        sessionIndex: item.sessionIndex || 1,
        vesselId: item.vesselId || num,
        vesselNumber: num,
        competitorName: item.competitorName?.trim() || "Competidor",
        modality: item.modality,
        category: item.category,
        club: item.club,
        largadaTitle: item.largadaTitle,
        firstSeenAt: item.firstSeenAt || Date.now(),
        lastSeenAt: item.lastSeenAt || Date.now(),
        pointsCount: 0,
        totalDistanceKm: 0,
        avgSpeedKmH: 0,
        maxSpeedKmH: 0,
        points: [],
      };
    }

    const session = sessionsCache[sId];
    if (Array.isArray(item.points)) {
      const existingPoints = session.points || [];
      const pointSet = new Set(existingPoints.map((p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)},${p.timestamp}`));

      for (const p of item.points) {
        if (!p || typeof p.latitude !== "number" || typeof p.longitude !== "number") continue;
        const pKey = `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)},${p.timestamp}`;
        if (!pointSet.has(pKey)) {
          existingPoints.push({
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            accuracy: p.accuracy !== undefined ? Number(p.accuracy) : null,
            timestamp: Number(p.timestamp) || Date.now(),
            speed: p.speed !== undefined ? Number(p.speed) : null,
          });
          pointSet.add(pKey);
        }
      }

      existingPoints.sort((a, b) => a.timestamp - b.timestamp);
      session.points = existingPoints;
      session.pointsCount = existingPoints.length;
      if (existingPoints.length > 0) {
        session.firstSeenAt = existingPoints[0].timestamp;
        session.lastSeenAt = existingPoints[existingPoints.length - 1].timestamp;
        computeSessionMetrics(session);
      }
    }
  }

  scheduleSaveToDisk();
}

export function clearAllHistory() {
  // Retained only for administrative maintenance, NEVER called during race resets
  loadFromDisk();
  sessionsCache = {};
  try {
    ensureDirectoryExists();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({}, null, 2), "utf-8");
  } catch (err) {
    console.error("[historyStore] Error clearing history:", err);
  }
}
