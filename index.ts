import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Server as SocketIOServer } from "socket.io";
import { appRouter } from "./routers";
import { setupSocketIO } from "./socketio";

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

  // REST Fallback for HTTP position updates from 4G/5G mobile phones
  app.post("/api/position", (req, res) => {
    const { vesselId, vesselNumber, competitorName, latitude, longitude, accuracy, timestamp, isSos } = req.body;
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
      isSos: Boolean(isSos),
    };

    io.emit("position:updated", payload);
    res.json({ success: true, timestamp: payload.timestamp });
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
