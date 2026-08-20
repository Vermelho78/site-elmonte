/**
 * Cloudflare Worker Backend for VaaTracker
 * Handles:
 * 1. REST API (/api/...) for cross-device position updates, approvals, reports, GPX export
 * 2. Real-time WebSockets (/ws & /socket.io/)
 * 3. Static Assets serving via env.ASSETS
 */

const activeVessels = new Map();
const positionHistory = new Map();
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

function recordHistoryPoint(p) {
  const numKey = (p.vesselNumber || "").toString().trim().toLowerCase();
  if (!numKey) return;

  if (!positionHistory.has(numKey)) {
    positionHistory.set(numKey, {
      vesselId: p.vesselId || p.vesselNumber,
      vesselNumber: p.vesselNumber,
      competitorName: p.competitorName || "Competidor",
      modality: p.modality,
      category: p.category,
      club: p.club,
      largadaTitle: p.largadaTitle,
      firstSeenAt: p.timestamp || Date.now(),
      lastSeenAt: p.timestamp || Date.now(),
      pointsCount: 0,
      points: [],
    });
  }

  const record = positionHistory.get(numKey);
  record.lastSeenAt = p.timestamp || Date.now();
  if (p.competitorName && p.competitorName !== "Competidor") record.competitorName = p.competitorName;
  if (p.modality) record.modality = p.modality;
  if (p.category) record.category = p.category;
  if (p.club) record.club = p.club;
  if (p.largadaTitle) record.largadaTitle = p.largadaTitle;

  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  const ts = Number(p.timestamp) || Date.now();

  // Avoid duplicate points
  const isDuplicate = record.points.some(
    (existing) => Math.abs(existing.latitude - lat) < 0.000001 && Math.abs(existing.longitude - lng) < 0.000001 && Math.abs(existing.timestamp - ts) < 1000
  );

  if (!isDuplicate) {
    record.points.push({
      latitude: lat,
      longitude: lng,
      accuracy: p.accuracy ? Number(p.accuracy) : undefined,
      timestamp: ts,
    });
    record.pointsCount = record.points.length;
  }
}

function generateGPX(record) {
  const name = record.vesselNumber || "VAA";
  const desc = `${record.competitorName || "Competidor"} - ${record.modality || ""} ${record.category || ""}`.trim();
  const time = new Date(record.firstSeenAt || Date.now()).toISOString();

  let trkpts = "";
  if (Array.isArray(record.points)) {
    record.points.forEach((pt) => {
      const iso = new Date(pt.timestamp).toISOString();
      trkpts += `      <trkpt lat="${pt.latitude.toFixed(6)}" lon="${pt.longitude.toFixed(6)}">
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
      const list = Array.from(activeVessels.values());
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
        const existing = activeVessels.get(numKey);

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

        activeVessels.set(numKey, vesselData);
        recordHistoryPoint(vesselData);

        // If historical points array was provided in payload, record them too
        if (Array.isArray(body.points) && body.points.length > 0) {
          body.points.forEach((pt) => {
            if (pt && typeof pt.latitude === "number" && typeof pt.longitude === "number") {
              recordHistoryPoint({
                ...vesselData,
                latitude: pt.latitude,
                longitude: pt.longitude,
                accuracy: pt.accuracy,
                timestamp: pt.timestamp,
              });
            }
          });
        }

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

        if (approveAll) {
          for (const [k, v] of activeVessels) {
            v.approvalStatus = "approved";
          }
          broadcast("vessel:approved", { approveAll: true });
          return jsonResponse({ success: true, approveAll: true });
        }

        const key = (vesselNumber || "").toString().trim().toLowerCase();
        for (const [k, v] of activeVessels) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            v.approvalStatus = "approved";
          }
        }

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

        if (clearAll) {
          activeVessels.clear();
          broadcast("vessel:removed", { clearAll: true });
          return jsonResponse({ success: true, clearAll: true });
        }

        const key = (vesselNumber || "").toString().trim().toLowerCase();
        for (const [k, v] of activeVessels) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            activeVessels.delete(k);
          }
        }

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

        for (const [k, v] of activeVessels) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            v.isSos = true;
            v.sosMessage = message || "EMERGÊNCIA ACIONADA!";
            broadcast("vessel:sos_alert", v);
          }
        }
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

        for (const [k, v] of activeVessels) {
          if (k === key || (vesselId && String(v.vesselId) === String(vesselId))) {
            v.isSos = false;
            v.sosMessage = undefined;
            broadcast("vessel:sos_resolved", { vesselId, vesselNumber });
          }
        }
        return jsonResponse({ success: true });
      } catch (e) {
        return jsonResponse({ error: "SOS resolve error" }, 500);
      }
    }

    // 9. GET /api/report/all-history or /api/report/data
    if (pathname === "/api/report/all-history" || pathname === "/api/report/data") {
      if (positionHistory.size === 0 && activeVessels.size > 0) {
        for (const [k, v] of activeVessels) {
          recordHistoryPoint(v);
        }
      }
      const records = Array.from(positionHistory.values());
      return jsonResponse({ success: true, count: records.length, data: records });
    }

    // 10. POST /api/report/clear
    if (pathname === "/api/report/clear" && request.method === "POST") {
      positionHistory.clear();
      activeVessels.clear();
      broadcast("vessel:removed", { clearAll: true });
      return jsonResponse({ success: true, message: "History cleared" });
    }

    // 11. GET /api/report/gpx/:vesselId
    if (pathname.startsWith("/api/report/gpx/")) {
      const param = decodeURIComponent(pathname.replace("/api/report/gpx/", "")).trim().toLowerCase();
      let foundRecord = null;

      for (const [k, record] of positionHistory) {
        if (k === param || String(record.vesselId).toLowerCase() === param || record.vesselNumber.toLowerCase() === param) {
          foundRecord = record;
          break;
        }
      }

      // If not in positionHistory, try activeVessels
      if (!foundRecord && activeVessels.has(param)) {
        const v = activeVessels.get(param);
        recordHistoryPoint(v);
        foundRecord = positionHistory.get(param);
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

    // 12. WebSocket Upgrade Handler (/ws or Upgrade: websocket)
    if (request.headers.get("Upgrade") === "websocket" || pathname === "/ws") {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      wsClients.add(server);

      // Send initial positions
      const list = Array.from(activeVessels.values());
      server.send(JSON.stringify({ type: "monitor:positions", payload: list, data: list }));

      server.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type || msg.event;
          const payload = msg.payload || msg.data;

          if (type === "monitor:request-positions") {
            const currentList = Array.from(activeVessels.values());
            server.send(JSON.stringify({ type: "monitor:positions", payload: currentList, data: currentList }));
          } else if (type === "vessel:register" && payload) {
            const key = (payload.vesselNumber || "").toString().trim().toLowerCase();
            const existing = activeVessels.get(key);
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
            activeVessels.set(key, v);
            recordHistoryPoint(v);
            broadcast("vessel:registered", v);
            server.send(JSON.stringify({ type: "vessel:registered", payload: v }));
          } else if (type === "position:update" && payload) {
            const key = (payload.vesselNumber || "").toString().trim().toLowerCase();
            const existing = activeVessels.get(key);
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
            activeVessels.set(key, v);
            recordHistoryPoint(v);
            broadcast("position:updated", v);
          } else if (type === "vessel:approved" && payload) {
            const key = (payload.vesselNumber || "").toString().trim().toLowerCase();
            for (const [k, v] of activeVessels) {
              if (payload.approveAll || k === key || (payload.vesselId && String(v.vesselId) === String(payload.vesselId))) {
                v.approvalStatus = "approved";
              }
            }
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

    // 13. Fallback to static assets
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
