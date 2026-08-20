import fs from "fs";
import path from "path";

export interface TrackPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
}

export interface TrackedVesselHistory {
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
  points: TrackPoint[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "race_history.json");

// In-memory cache synced with disk
let historyCache: Record<string, TrackedVesselHistory> = {};
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

function loadFromDisk() {
  if (isLoaded) return;
  try {
    ensureDirectoryExists();
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
      historyCache = JSON.parse(raw);
      console.log(`[historyStore] Loaded ${Object.keys(historyCache).length} vessel histories from disk.`);
    } else {
      historyCache = {};
    }
  } catch (err) {
    console.error("[historyStore] Error loading history from disk:", err);
    historyCache = {};
  }
  isLoaded = true;
}

function scheduleSaveToDisk() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      ensureDirectoryExists();
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyCache, null, 2), "utf-8");
    } catch (err) {
      console.error("[historyStore] Error saving history to disk:", err);
    }
  }, 1000);
}

export function recordPositionToHistory(payload: {
  vesselId?: string | number;
  vesselNumber?: string;
  competitorName?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: number;
  modality?: string;
  category?: string;
  club?: string;
  largadaTitle?: string;
}) {
  loadFromDisk();

  const num = (payload.vesselNumber || "VAA-001").trim();
  const vId = payload.vesselId !== undefined && payload.vesselId !== null ? String(payload.vesselId) : num;
  const key = num.toLowerCase();

  const time = Number(payload.timestamp) || Date.now();
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);
  const acc = payload.accuracy !== undefined && payload.accuracy !== null ? Number(payload.accuracy) : null;

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return;
  }

  if (!historyCache[key]) {
    historyCache[key] = {
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
      points: [],
    };
  }

  const vessel = historyCache[key];

  // Update metadata if more specific data arrived
  if (payload.competitorName && payload.competitorName !== "Competidor") {
    vessel.competitorName = payload.competitorName.trim();
  }
  if (payload.modality) vessel.modality = payload.modality;
  if (payload.category) vessel.category = payload.category;
  if (payload.club) vessel.club = payload.club;
  if (payload.largadaTitle) vessel.largadaTitle = payload.largadaTitle;

  // Avoid recording identical consecutive points within 1 second and same coords
  const lastPoint = vessel.points[vessel.points.length - 1];
  const isDuplicate =
    lastPoint &&
    Math.abs(lastPoint.latitude - lat) < 0.000001 &&
    Math.abs(lastPoint.longitude - lng) < 0.000001 &&
    Math.abs(lastPoint.timestamp - time) < 2000;

  if (!isDuplicate) {
    vessel.points.push({
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      timestamp: time,
    });
    vessel.pointsCount = vessel.points.length;
    vessel.lastSeenAt = time;
    scheduleSaveToDisk();
  }
}

export function getAllHistory(): TrackedVesselHistory[] {
  loadFromDisk();
  return Object.values(historyCache);
}

export function getVesselHistory(keyOrNumber: string): TrackedVesselHistory | undefined {
  loadFromDisk();
  const k = keyOrNumber.trim().toLowerCase();
  return historyCache[k];
}

export function clearAllHistory() {
  loadFromDisk();
  historyCache = {};
  try {
    ensureDirectoryExists();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({}, null, 2), "utf-8");
  } catch (err) {
    console.error("[historyStore] Error clearing history:", err);
  }
}
