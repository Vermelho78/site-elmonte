import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Server as SocketIOServer } from "socket.io";
import { appRouter } from "./routers";
import { setupSocketIO, getActiveVessels, updateActiveVessel, approveVesselInState, removeVesselFromState } from "./socketio";
import { recordPositionToHistory, getAllHistory, getVesselHistory, clearAllHistory } from "./historyStore";
import { generateSingleGPX, generateMultiGPX } from "./lib/gpxGenerator";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS middleware for Express
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-session-token");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize Socket.io for real-time communication
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Setup Socket.io event handlers
  setupSocketIO(io);

  // Health check endpoints
  app.get("/health", (req, res) => {
    res.json({ status: "online", service: "VaaTracker Realtime Backend", timestamp: Date.now() });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "online", service: "VaaTracker Realtime Backend", timestamp: Date.now() });
  });

  app.get("/api/vessels", (req, res) => {
    res.json({ success: true, count: getActiveVessels().length, data: getActiveVessels() });
  });

  // REST Fallback for HTTP position updates from 4G/5G mobile phones
  app.post("/api/position", (req, res) => {
    const { vesselId, vesselNumber, competitorName, latitude, longitude, accuracy, timestamp, isSos, modality, category, club, largadaTitle, approvalStatus } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Missing latitude or longitude" });
    }

    const payload = {
      vesselId: vesselId || vesselNumber || "1",
      vesselNumber: vesselNumber || "VAA-001",
      competitorName: competitorName || "Competidor",
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy) || 5,
      timestamp: Number(timestamp) || Date.now(),
      status: "active",
      approvalStatus: approvalStatus || "pending",
      isSos: Boolean(isSos),
      modality,
      category,
      club,
      largadaTitle,
    };

    updateActiveVessel(payload as any);
    recordPositionToHistory(payload);
    io.emit("position:updated", payload);
    const updatedV = getActiveVessels().find((v) => v.vesselNumber.toLowerCase() === (vesselNumber || "").toLowerCase());
    res.json({ success: true, timestamp: payload.timestamp, approvalStatus: updatedV?.approvalStatus || payload.approvalStatus });
  });

  // REST Approval
  app.post("/api/vessel/approve", (req, res) => {
    const { vesselId, vesselNumber, approveAll } = req.body;
    approveVesselInState(vesselNumber || vesselId, approveAll);
    if (approveAll) {
      io.emit("vessel:approved", { approveAll: true, approvedAt: Date.now() });
      return res.json({ success: true, approveAll: true });
    }
    io.emit("vessel:approved", { vesselId, vesselNumber, approvedAt: Date.now() });
    res.json({ success: true, vesselNumber, approvalStatus: "approved" });
  });

  app.post("/api/vessel/reject", (req, res) => {
    const { vesselId, vesselNumber } = req.body;
    removeVesselFromState(vesselNumber || vesselId);
    io.emit("vessel:rejected", { vesselId, vesselNumber });
    res.json({ success: true });
  });

  app.post("/api/vessel/remove", (req, res) => {
    const { vesselId, vesselNumber, clearAll } = req.body;
    removeVesselFromState(vesselNumber || vesselId, clearAll);
    io.emit("vessel:removed", { vesselId, vesselNumber, clearAll });
    res.json({ success: true });
  });

  // Report endpoints
  app.get("/api/report/data", (req, res) => {
    try {
      const history = getAllHistory();
      res.json({ success: true, count: history.length, data: history });
    } catch (err) {
      res.status(500).json({ error: "Erro ao carregar dados do relatório" });
    }
  });

  app.get("/api/report/gpx/:vesselNumber", (req, res) => {
    try {
      const vessel = getVesselHistory(req.params.vesselNumber);
      if (!vessel || !vessel.points || vessel.points.length === 0) {
        return res.status(404).send("Histórico de pontos não encontrado para esta canoa");
      }
      const gpxContent = generateSingleGPX({
        vesselNumber: vessel.vesselNumber,
        competitorName: vessel.competitorName,
        modality: vessel.modality,
        category: vessel.category,
        club: vessel.club,
        largadaTitle: vessel.largadaTitle,
        points: vessel.points,
      });
      const filename = `canoa_${vessel.vesselNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.gpx`;
      res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(gpxContent);
    } catch (err) {
      res.status(500).send("Erro ao gerar arquivo GPX");
    }
  });

  app.get("/api/report/gpx", (req, res) => {
    try {
      const allHistory = getAllHistory();
      const tracks = allHistory.map((v) => ({
        vesselNumber: v.vesselNumber,
        competitorName: v.competitorName,
        modality: v.modality,
        category: v.category,
        club: v.club,
        largadaTitle: v.largadaTitle,
        points: v.points,
      }));
      const gpxContent = generateMultiGPX(tracks, "VaaTracker - Relatorio Geral da Prova");
      res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="vaatracker_todas_canoas.gpx"`);
      res.send(gpxContent);
    } catch (err) {
      res.status(500).send("Erro ao gerar arquivo GPX geral");
    }
  });

  app.post("/api/report/sync", (req, res) => {
    try {
      const { items } = req.body;
      if (Array.isArray(items)) {
        for (const item of items) {
          recordPositionToHistory(item);
        }
      }
      res.json({ success: true, count: items?.length || 0 });
    } catch (err) {
      res.status(500).json({ error: "Erro ao sincronizar pontos do relatório" });
    }
  });

  app.post("/api/sos", (req, res) => {
    const { vesselId, vesselNumber, competitorName, latitude, longitude, message } = req.body;
    const sosPayload = {
      vesselId: vesselId || vesselNumber || "1",
      vesselNumber: vesselNumber || "VAA-001",
      competitorName: competitorName || "Competidor",
      latitude: Number(latitude),
      longitude: Number(longitude),
      sosMessage: message || `EMERGÊNCIA SOS! Canoa ${vesselNumber} precisa de ajuda!`,
      sosTimestamp: Date.now(),
    };

    io.emit("vessel:sos_alert", sosPayload);
    res.json({ success: true, timestamp: sosPayload.sosTimestamp });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({ user: { id: 1, name: "Organizador Master", role: "organizer" } }),
    })
  );

  // Serve static dist folder if built
  const fs = await import("fs");
  const path = await import("path");
  const distPath = path.resolve(process.cwd(), "dist");

  if (fs.existsSync(distPath)) {
    console.log(`[Express] Servindo arquivos estáticos de produção de ${distPath}`);
    app.use(express.static(distPath));
    app.use("/vaatracker", express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`=================================================`);
    console.log(`🚀 Sistema PWA de Rastreamento ativo!`);
    console.log(`📱 Acesso pelo Celular (Wi-Fi): http://192.168.0.229:${port}/competitor`);
    console.log(`🖥️ Painel Organizador (Notebook): http://localhost:${port}/monitor`);
    console.log(`=================================================`);
  });
}

startServer().catch(console.error);
