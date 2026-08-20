/**
 * Cloudflare Worker Backend for VaaTracker
 * Handles:
 * 1. REST API (/api/...) for cross-device position updates, approvals, reports, GPX export
 * 2. Cross-isolate persistence via caches.default
 * 3. Real-time WebSockets & Socket.IO handshake (/ws & /socket.io/)
 * 4. Static Assets serving via env.ASSETS
 */

const CACHE_VESSELS_URL = "https://elmonte.dev.br/__store_vessels_cache_v1__";
const CACHE_HISTORY_URL = "https://elmonte.dev.br/__store_history_cache_v1__";

const inMemoryVessels = new Map();
const inMemoryHistory = new Map();
const wsClients = new Set();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-token",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function broadcast(event, payload) {
  const message = JSON.stringify({ type: event, event, payload, data: payload });
  for (const client of wsClients) {
    try {
      if (client.readyState === 1 /* OPEN */) {
        client.send(message);
      }
    } catch (err) {
      wsClients.delete(client);
    }
  }
}

async function getPersistedVessels() {
  const map = new Map(inMemoryVessels);
  try {
    const cache = caches.default;
    const res = await cache.match(new Request(CACHE_VESSELS_URL));
    if (res) {
      const arr = await res.json();
      if (Array.isArray(arr)) {
        arr.forEach((v) => {
          if (v && v.vesselNumber) {
            const k = v.vesselNumber.trim().toLowerCase();
            const existing = map.get(k);
            if (!existing || (v.timestamp && v.timestamp >= (existing.timestamp || 0))) {
              map.set(k, v);
            }
          }
        });
      }
    }
  } catch (e) {}
  return map;
}

async function savePersistedVessels(map) {
  try {
    const arr = Array.from(map.values());
    const cache = caches.default;
    const res = new Response(JSON.stringify(arr), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
    await cache.put(new Request(CACHE_VESSELS_URL), res);
  } catch (e) {}
}

async function getPersistedHistory() {
  const map = new Map(inMemoryHistory);
  try {
    const cache = caches.default;
    const res = await cache.match(new Request(CACHE_HISTORY_URL));
    if (res) {
      const arr = await res.json();
      if (Array.isArray(arr)) {
        arr.forEach((h) => {
          if (h && h.vesselNumber) {
            const k = h.vesselNumber.trim().toLowerCase();
            const existing = map.get(k);
            if (!existing) {
              map.set(k, h);
            } else {
              // Merge points
              const ptMap = new Map();
              (existing.points || []).forEach((p) => ptMap.set(`${p.latitude},${p.longitude}`, p));
              (h.points || []).forEach((p) => ptMap.set(`${p.latitude},${p.longitude}`, p));
              existing.points = Array.from(ptMap.values()).sort((a, b) => a.timestamp - b.timestamp);
              existing.pointsCount = existing.points.length;
              existing.lastSeenAt = Math.max(existing.lastSeenAt || 0, h.lastSeenAt || 0);
            }
          }
        });
      }
    }
  } catch (e) {}
  return map;
}

async function savePersistedHistory(map) {
  try {
    const arr = Array.from(map.values());
    const cache = caches.default;
    const res = new Response(JSON.stringify(arr), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
    await cache.put(new Request(CACHE_HISTORY_URL), res);
  } catch (e) {}
}

function generateGPX(record) {
  const name = record.vesselNumber || "VAA";
  const desc = `${record.competitorName || "Competidor"} - ${record.modality || ""} ${record.category || ""}`.trim();
  const time = new Date(record.firstSeenAt || Date.now()).toISOString();

  let trkpts = "";
  if (Array.isArray(record.points)) {
    record.points.forEach((pt) => {
      const iso = new Date(pt.timestamp).toISOString();
      trkpts += `      <trkpt lat="${Number(pt.latitude).toFixed(6)}" lon="${Number(pt.longitude).toFixed(6)}">
        <time>${iso}</time>
      </trkpt>\n`;
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VaaTracker - https://elmonte.dev.br/vaatracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Trajetoria ${name}</name>
    <desc>${desc}</desc>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>${name} - ${desc}</name>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // 2. Health check
    if (pathname === "/health" || pathname === "/api/health") {
      return jsonResponse({ status: "online", service: "VaaTracker Cloudflare Backend", timestamp: Date.now() });
    }

    // 3. GET /api/vessels
    if (pathname === "/api/vessels" && request.method === "GET") {
      const vesselsMap = await getPersistedVessels();
      const list = Array.from(vesselsMap.values());
      return jsonResponse({ success: true, count: list.length, data: list });
    }

    // 4. POST /api/position
    if (pathname === "/api/position" && request.method === "POST") {
      try {
        const body = await request.json();
        const { latitude, longitude, vesselNumber, competitorName, vesselId } = body || {};

        if (latitude === undefined || longitude === undefined || !vesselNumber) {
          return jsonResponse({ error: "Missing required fields" }, 400);
        }

        const numKey = vesselNumber.toString().trim().toLowerCase();
        const vesselsMap = await getPersistedVessels();
        const historyMap = await getPersistedHistory();

        const existing = vesselsMap.get(numKey);
        const approvalStatus = body.approvalStatus || existing?.approvalStatus || "pending";
        const isHidden = body.isHidden !== undefined ? body.isHidden : (existing?.isHidden || false);
        const isSos = body.isSos !== undefined ? body.isSos : (existing?.isSos || false);

        const vesselData = {
          vesselId: vesselId || existing?.vesselId || vesselNumber,
          vesselNumber: vesselNumber.toString().trim(),
          competitorName: competitorName || existing?.competitorName || "Competidor",
          latitude: Number(latitude),
          longitude: Number(longitude),
          accuracy: body.accuracy ? Number(body.accuracy) : undefined,
          timestamp: body.timestamp || Date.now(),
          status: "active",
          approvalStatus,
          isHidden,
          modality: body.modality || existing?.modality,
          category: body.category || existing?.category,
          club: body.club || existing?.club,
          largadaTitle: body.largadaTitle || existing?.largadaTitle,
          isSos,
          sosMessage: body.sosMessage || existing?.sosMessage,
        };

        vesselsMap.set(numKey, vesselData);
        inMemoryVessels.set(numKey, vesselData);

        // Update history
        if (!historyMap.has(numKey)) {
          historyMap.set(numKey, {
            vesselId: vesselData.vesselId,
            vesselNumber: vesselData.vesselNumber,
            competitorName: vesselData.competitorName,
            modality: vesselData.modality,
            category: vesselData.category,
            club: vesselData.club,
            largadaTitle: vesselData.largadaTitle,
            firstSeenAt: vesselData.timestamp,
            lastSeenAt: vesselData.timestamp,
            pointsCount: 0,
            points: [],
          });
        }

        const hist = historyMap.get(numKey);
        hist.lastSeenAt = vesselData.timestamp;
        if (vesselData.competitorName && vesselData.competitorName !== "Competidor") hist.competitorName = vesselData.competitorName;
        if (vesselData.modality) hist.modality = vesselData.modality;
        if (vesselData.category) hist.category = vesselData.category;
        if (vesselData.club) hist.club = vesselData.club;
        if (vesselData.largadaTitle) hist.largadaTitle = vesselData.largadaTitle;

        // Add point
        hist.points.push({
          latitude: vesselData.latitude,
          longitude: vesselData.longitude,
          accuracy: vesselData.accuracy,
          timestamp: vesselData.timestamp,
        });

        // If batch points were provided in request, merge them
        if (Array.isArray(body.points) && body.points.length > 0) {
          body.points.forEach((p) => {
            if (p && typeof p.latitude === "number" && typeof p.longitude === "number") {
              hist.points.push({
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
                accuracy: p.accuracy ? Number(p.accuracy) : undefined,
                timestamp: p.timestamp || Date.now(),
              });
            }
          });
        }

        // Deduplicate and sort points
        const ptMap = new Map();
        hist.points.forEach((p) => ptMap.set(`${Number(p.latitude).toFixed(6)},${Number(p.longitude).toFixed(6)}`, p));
        hist.points = Array.from(ptMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        hist.pointsCount = hist.points.length;

        inMemoryHistory.set(numKey, hist);

        // Async save to Cloudflare Cache
        await savePersistedVessels(vesselsMap);
        await savePersistedHistory(historyMap);

        // Broadcast to WebSocket clients
        broadcast("position:updated", vesselData);

        return jsonResponse({
          success: true,
          approvalStatus: vesselData.approvalStatus,
          timestamp: vesselData.timestamp,
        });
      } catch (err) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
    }

    // 5. POST /api/vessel/approve
    if ((pathname === "/api/vessel/approve" || pathname === "/api/vessel/approved") && request.method === "POST") {
      try {
        const body = await request.json();
        const { vesselId, vesselNumber, approveAll } = body || {};
        const vesselsMap = await getPersistedVessels();

        if (approveAll) {
          for (const [k, v] of vesselsMap) {
            v.approvalStatus = "approved";
            inMemoryVessels.set(k, v);
          }
          await savePersistedVessels(vesselsMap);
          broadcast("vessel:approved", { approveAll: true });
          return jsonResponse({ success: true, approveAll: true });
        }

        const key = (vesselNumber || "").toString().trim().toLowerCase();
        for (const [k, v] of vesselsMap) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            v.approvalStatus = "approved";
            inMemoryVessels.set(k, v);
          }
        }

        await savePersistedVessels(vesselsMap);
        broadcast("vessel:approved", { vesselId, vesselNumber });
        return jsonResponse({ success: true, vesselNumber, approvalStatus: "approved" });
      } catch (e) {
        return jsonResponse({ error: "Error approving vessel" }, 500);
      }
    }

    // 6. POST /api/vessel/reject or /api/vessel/remove
    if ((pathname === "/api/vessel/reject" || pathname === "/api/vessel/remove") && request.method === "POST") {
      try {
        const body = await request.json();
        const { vesselId, vesselNumber, clearAll } = body || {};
        const vesselsMap = await getPersistedVessels();

        if (clearAll) {
          vesselsMap.clear();
          inMemoryVessels.clear();
          await savePersistedVessels(vesselsMap);
          broadcast("vessel:removed", { clearAll: true });
          return jsonResponse({ success: true, clearAll: true });
        }

        const key = (vesselNumber || "").toString().trim().toLowerCase();
        for (const [k, v] of vesselsMap) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            vesselsMap.delete(k);
            inMemoryVessels.delete(k);
          }
        }

        await savePersistedVessels(vesselsMap);
        broadcast("vessel:removed", { vesselId, vesselNumber });
        return jsonResponse({ success: true });
      } catch (e) {
        return jsonResponse({ error: "Error removing vessel" }, 500);
      }
    }

    // 7. POST /api/vessel/sos
    if (pathname === "/api/vessel/sos" && request.method === "POST") {
      try {
        const body = await request.json();
        const { vesselNumber, vesselId, message } = body || {};
        const key = (vesselNumber || "").toString().trim().toLowerCase();
        const vesselsMap = await getPersistedVessels();

        for (const [k, v] of vesselsMap) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            v.isSos = true;
            v.sosMessage = message || "EMERGÊNCIA ACIONADA!";
            inMemoryVessels.set(k, v);
            broadcast("vessel:sos_alert", v);
          }
        }
        await savePersistedVessels(vesselsMap);
        return jsonResponse({ success: true, isSos: true });
      } catch (e) {
        return jsonResponse({ error: "SOS error" }, 500);
      }
    }

    // 8. POST /api/vessel/sos_resolve
    if (pathname === "/api/vessel/sos_resolve" && request.method === "POST") {
      try {
        const body = await request.json();
        const { vesselNumber, vesselId } = body || {};
        const key = (vesselNumber || "").toString().trim().toLowerCase();
        const vesselsMap = await getPersistedVessels();

        for (const [k, v] of vesselsMap) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            v.isSos = false;
            v.sosMessage = undefined;
            inMemoryVessels.set(k, v);
            broadcast("vessel:sos_resolved", { vesselId, vesselNumber });
          }
        }
        await savePersistedVessels(vesselsMap);
        return jsonResponse({ success: true });
      } catch (e) {
        return jsonResponse({ error: "SOS resolve error" }, 500);
      }
    }

    // 9. GET /api/report/all-history or /api/report/data
    if (pathname === "/api/report/all-history" || pathname === "/api/report/data") {
      const historyMap = await getPersistedHistory();
      const vesselsMap = await getPersistedVessels();

      // If history is empty but vessels exist, backfill
      if (historyMap.size === 0 && vesselsMap.size > 0) {
        for (const [k, v] of vesselsMap) {
          historyMap.set(k, {
            vesselId: v.vesselId,
            vesselNumber: v.vesselNumber,
            competitorName: v.competitorName,
            modality: v.modality,
            category: v.category,
            club: v.club,
            largadaTitle: v.largadaTitle,
            firstSeenAt: v.timestamp,
            lastSeenAt: v.timestamp,
            pointsCount: 1,
            points: [{ latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy, timestamp: v.timestamp }],
          });
        }
      }

      const records = Array.from(historyMap.values());
      return jsonResponse({ success: true, count: records.length, data: records });
    }

    // 10. POST /api/report/clear
    if (pathname === "/api/report/clear" && request.method === "POST") {
      inMemoryHistory.clear();
      inMemoryVessels.clear();
      await savePersistedVessels(new Map());
      await savePersistedHistory(new Map());
      broadcast("vessel:removed", { clearAll: true });
      return jsonResponse({ success: true, message: "History cleared" });
    }

    // 11. GET /api/report/gpx/:vesselId
    if (pathname.startsWith("/api/report/gpx/")) {
      const param = decodeURIComponent(pathname.replace("/api/report/gpx/", "")).trim().toLowerCase();
      const historyMap = await getPersistedHistory();
      let foundRecord = null;

      for (const [k, record] of historyMap) {
        if (k === param || String(record.vesselId).toLowerCase() === param || record.vesselNumber.toLowerCase() === param) {
          foundRecord = record;
          break;
        }
      }

      if (!foundRecord) {
        return jsonResponse({ error: "Vessel not found in history" }, 404);
      }

      const gpxXml = generateGPX(foundRecord);
      const safeName = (foundRecord.vesselNumber || "canoa").replace(/[^a-zA-Z0-9_-]/g, "_");
      return new Response(gpxXml, {
        headers: {
          "Content-Type": "application/gpx+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="vaatracker_${safeName}.gpx"`,
          ...corsHeaders(),
        },
      });
    }

    // 12. Socket.IO Handshake / Polling / WebSocket
    if (pathname.startsWith("/socket.io/")) {
      const transport = url.searchParams.get("transport");
      if (transport === "polling") {
        const sid = "vaa_" + Math.random().toString(36).substring(2, 9);
        return new Response(`0{"sid":"${sid}","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}`, {
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
            ...corsHeaders(),
          },
        });
      }
    }

    // 13. WebSocket Upgrade Handler (/ws or Upgrade: websocket)
    if (request.headers.get("Upgrade") === "websocket" || pathname === "/ws" || pathname.startsWith("/socket.io/")) {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      wsClients.add(server);

      // Send initial positions
      getPersistedVessels().then((map) => {
        const list = Array.from(map.values());
        try {
          server.send(JSON.stringify({ type: "monitor:positions", payload: list, data: list }));
        } catch (e) {}
      });

      server.addEventListener("message", async (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type || msg.event;
          const payload = msg.payload || msg.data;

          if (type === "monitor:request-positions") {
            const map = await getPersistedVessels();
            const currentList = Array.from(map.values());
            server.send(JSON.stringify({ type: "monitor:positions", payload: currentList, data: currentList }));
          } else if (type === "vessel:register" && payload) {
            const key = (payload.vesselNumber || "").toString().trim().toLowerCase();
            const map = await getPersistedVessels();
            const existing = map.get(key);
            const v = {
              vesselId: payload.vesselId || payload.vesselNumber,
              vesselNumber: payload.vesselNumber,
              competitorName: payload.competitorName || "Competidor",
              latitude: existing?.latitude || -27.1472,
              longitude: existing?.longitude || -48.4891,
              timestamp: Date.now(),
              status: "active",
              approvalStatus: existing?.approvalStatus || "pending",
              modality: payload.modality,
              category: payload.category,
              club: payload.club,
              largadaTitle: payload.largadaTitle,
            };
            map.set(key, v);
            inMemoryVessels.set(key, v);
            await savePersistedVessels(map);
            broadcast("vessel:registered", v);
            server.send(JSON.stringify({ type: "vessel:registered", payload: v }));
          } else if (type === "position:update" && payload) {
            const key = (payload.vesselNumber || "").toString().trim().toLowerCase();
            const map = await getPersistedVessels();
            const existing = map.get(key);
            const v = {
              vesselId: payload.vesselId || existing?.vesselId || payload.vesselNumber,
              vesselNumber: payload.vesselNumber,
              competitorName: payload.competitorName || existing?.competitorName || "Competidor",
              latitude: Number(payload.latitude),
              longitude: Number(payload.longitude),
              accuracy: payload.accuracy,
              timestamp: payload.timestamp || Date.now(),
              status: "active",
              approvalStatus: payload.approvalStatus || existing?.approvalStatus || "pending",
              modality: payload.modality || existing?.modality,
              category: payload.category || existing?.category,
              club: payload.club || existing?.club,
              largadaTitle: payload.largadaTitle || existing?.largadaTitle,
              isSos: payload.isSos !== undefined ? payload.isSos : (existing?.isSos || false),
            };
            map.set(key, v);
            inMemoryVessels.set(key, v);
            await savePersistedVessels(map);
            broadcast("position:updated", v);
          } else if (type === "vessel:approved" && payload) {
            const key = (payload.vesselNumber || "").toString().trim().toLowerCase();
            const map = await getPersistedVessels();
            for (const [k, v] of map) {
              if (payload.approveAll || k === key || (payload.vesselId && String(v.vesselId) === String(payload.vesselId))) {
                v.approvalStatus = "approved";
                inMemoryVessels.set(k, v);
              }
            }
            await savePersistedVessels(map);
            broadcast("vessel:approved", payload);
          }
        } catch (e) {}
      });

      server.addEventListener("close", () => {
        wsClients.delete(server);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // 14. Fallback to static assets
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
