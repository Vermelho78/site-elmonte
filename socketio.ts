import { Server as SocketIOServer, Socket } from "socket.io";
import { getDb, updateVesselPosition, markVesselInactive, getVesselPositionHistory } from "./db";
import { vessels, positionHistory } from "./schema";
import { eq } from "drizzle-orm";
import { recordPositionToHistory, getAllHistory } from "./historyStore";

export interface VesselPosition {
  vesselId: number | string;
  vesselNumber: string;
  competitorName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  status: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  isHidden?: boolean;
  modality?: string;
  category?: string;
  club?: string;
  largadaTitle?: string;
  isSos?: boolean;
  sosMessage?: string;
  sosTimestamp?: number;
}

// Store active vessel connections keyed by vesselNumber (lowercase)
const activeVessels = new Map<string, VesselPosition>();

export function setupSocketIO(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    /**
     * Competitor registers and starts sending positions
     */
    socket.on("vessel:register", async (data: any) => {
      try {
        const { vesselNumber, competitorName, sessionToken, modality, category, club, largadaTitle } = data;

        if (!vesselNumber || !competitorName) {
          socket.emit("error", "Missing required fields");
          return;
        }

        const numKey = (vesselNumber || "").toString().trim().toLowerCase();
        let assignedId: string | number = Math.floor(Math.random() * 1000) + 1;

        try {
          const db = await getDb();
          if (db) {
            const existing = await db
              .select()
              .from(vessels)
              .where(eq(vessels.vesselNumber, vesselNumber))
              .limit(1);

            if (existing.length > 0) {
              const v = existing[0];
              assignedId = v.id;
              await db
                .update(vessels)
                .set({
                  sessionToken: sessionToken || v.sessionToken,
                  status: "active",
                  updatedAt: new Date(),
                })
                .where(eq(vessels.id, v.id));
            } else {
              const result = await db.insert(vessels).values({
                vesselNumber,
                competitorName,
                sessionToken: sessionToken || String(assignedId),
                status: "active",
              });
              assignedId = (result as any).insertId || (result as any)[0]?.insertId || assignedId;
            }
          }
        } catch (dbErr) {
          console.warn("[Socket.io] DB register fallback:", dbErr);
        }

        socket.data.vesselId = assignedId;
        socket.data.vesselNumber = vesselNumber;
        socket.data.competitorName = competitorName;

        socket.join(`vessel:${assignedId}`);
        socket.join(`canoe:${numKey}`);

        // Check if already approved previously or pending
        const existingActive = activeVessels.get(numKey);
        const appStatus = existingActive?.approvalStatus || "pending";

        const position: VesselPosition = {
          vesselId: assignedId,
          vesselNumber,
          competitorName,
          latitude: existingActive?.latitude || -27.1472,
          longitude: existingActive?.longitude || -48.4891,
          timestamp: Date.now(),
          status: "active",
          approvalStatus: appStatus,
          modality: modality || existingActive?.modality,
          category: category || existingActive?.category,
          club: club || existingActive?.club,
          largadaTitle: largadaTitle || existingActive?.largadaTitle,
        };

        activeVessels.set(numKey, position);

        socket.emit("vessel:registered", {
          vesselId: assignedId,
          vesselNumber,
          competitorName,
          approvalStatus: appStatus,
          message: "Registered successfully",
        });

        // Notify monitors of registered competitor
        io.emit("vessel:registered", position);
        io.emit("position:updated", position);

        console.log(`[Socket.io] Vessel registered: ${vesselNumber} (${competitorName}) - Status: ${appStatus}`);
      } catch (error) {
        console.error("[Socket.io] Error registering vessel:", error);
        socket.emit("error", "Registration failed");
      }
    });

    /**
     * Receive position update from competitor
     */
    socket.on("position:update", async (data: any) => {
      try {
        const { latitude, longitude, accuracy } = data;
        const vesselId = socket.data.vesselId || data.vesselId || 1;
        const vesselNumber = socket.data.vesselNumber || data.vesselNumber || "VAA-001";
        const competitorName = socket.data.competitorName || data.competitorName || "Competidor";
        const numKey = (vesselNumber || "").toString().trim().toLowerCase();

        if (typeof latitude !== "number" || typeof longitude !== "number") {
          socket.emit("error", "Missing position data");
          return;
        }

        try {
          if (typeof vesselId === "number") {
            await updateVesselPosition(vesselId, latitude, longitude, accuracy);
          }
        } catch (e) {}

        // Record to persistent history for Report and GPX
        recordPositionToHistory({
          vesselId,
          vesselNumber,
          competitorName,
          latitude,
          longitude,
          accuracy,
          timestamp: data.timestamp || Date.now(),
          modality: data.modality,
          category: data.category,
          club: data.club,
          largadaTitle: data.largadaTitle,
        });

        // Maintain existing SOS & approval status if active
        const existingActive = activeVessels.get(numKey);
        const isSos = data.isSos !== undefined ? Boolean(data.isSos) : (existingActive?.isSos || false);
        const sosMessage = data.sosMessage || existingActive?.sosMessage;
        const sosTimestamp = data.sosTimestamp || existingActive?.sosTimestamp;
        const approvalStatus = data.approvalStatus || existingActive?.approvalStatus || "pending";
        const isHidden = data.isHidden !== undefined ? Boolean(data.isHidden) : (existingActive?.isHidden || false);

        const position: VesselPosition = {
          vesselId,
          vesselNumber,
          competitorName,
          latitude,
          longitude,
          accuracy,
          timestamp: data.timestamp || Date.now(),
          status: "active",
          approvalStatus,
          isHidden,
          modality: data.modality || existingActive?.modality,
          category: data.category || existingActive?.category,
          club: data.club || existingActive?.club,
          largadaTitle: data.largadaTitle || existingActive?.largadaTitle,
          isSos,
          sosMessage,
          sosTimestamp,
        };

        activeVessels.set(numKey, position);

        // Broadcast position to monitors and observers
        io.emit("position:updated", position);

        socket.emit("position:ack", {
          timestamp: position.timestamp,
          message: "Position received",
        });
      } catch (error) {
        console.error("[Socket.io] Error updating position:", error);
        socket.emit("error", "Position update failed");
      }
    });

    /**
     * Competitor triggers SOS Emergency alert
     */
    socket.on("vessel:sos", (data: any) => {
      try {
        const vesselId = socket.data.vesselId || data?.vesselId || 1;
        const vesselNumber = socket.data.vesselNumber || data?.vesselNumber || "VAA-001";
        const competitorName = socket.data.competitorName || data?.competitorName || "Competidor";
        const numKey = (vesselNumber || "").toString().trim().toLowerCase();

        const current = activeVessels.get(numKey);
        const latitude = typeof data?.latitude === "number" ? data.latitude : current?.latitude || 0;
        const longitude = typeof data?.longitude === "number" ? data.longitude : current?.longitude || 0;
        const sosMessage = data?.message || "EMERGÊNCIA ACIONADA PELO COMPETIDOR!";
        const sosTimestamp = Date.now();

        const updatedPosition: VesselPosition = {
          vesselId,
          vesselNumber,
          competitorName,
          latitude,
          longitude,
          accuracy: current?.accuracy,
          timestamp: Date.now(),
          status: "active",
          approvalStatus: current?.approvalStatus || "pending",
          modality: current?.modality,
          category: current?.category,
          club: current?.club,
          largadaTitle: current?.largadaTitle,
          isSos: true,
          sosMessage,
          sosTimestamp,
        };

        activeVessels.set(numKey, updatedPosition);

        const sosPayload = {
          vesselId,
          vesselNumber,
          competitorName,
          latitude: updatedPosition.latitude,
          longitude: updatedPosition.longitude,
          sosMessage,
          sosTimestamp,
        };

        console.log(`🚨 [Socket.io] ALERTA SOS ACIONADO: Canôa ${vesselNumber} (${competitorName})`);

        io.emit("vessel:sos_alert", sosPayload);
        io.emit("position:updated", updatedPosition);

        socket.emit("vessel:sos_ack", {
          timestamp: sosTimestamp,
          message: "Alerta SOS recebido pelo servidor!",
        });
      } catch (error) {
        console.error("[Socket.io] Error handling SOS:", error);
        socket.emit("error", "SOS trigger failed");
      }
    });

    /**
     * Monitor resolves/clears an SOS alert
     */
    socket.on("vessel:sos_resolve", (data: any) => {
      try {
        const { vesselId, vesselNumber } = data || {};
        const key = (vesselNumber || "").toString().trim().toLowerCase();

        activeVessels.forEach((pos, k) => {
          if ((key && k === key) || (vesselId && String(pos.vesselId) === String(vesselId))) {
            pos.isSos = false;
            pos.sosMessage = undefined;
            pos.sosTimestamp = undefined;
            io.emit("position:updated", pos);
          }
        });

        io.emit("vessel:sos_resolved", { vesselId, vesselNumber, resolvedAt: Date.now() });
        console.log(`✅ [Socket.io] SOS Resolvido para ${vesselNumber || vesselId}`);
      } catch (error) {
        console.error("[Socket.io] Error resolving SOS:", error);
      }
    });

    /**
     * Monitor APPROVES a vessel (individual)
     */
    socket.on("vessel:approved", (data: any) => {
      try {
        const { vesselId, vesselNumber } = data || {};
        const key = (vesselNumber || "").toString().trim().toLowerCase();

        activeVessels.forEach((pos, k) => {
          if ((key && k === key) || (vesselId && String(pos.vesselId) === String(vesselId))) {
            pos.approvalStatus = "approved";
            io.emit("position:updated", pos);
          }
        });

        console.log(`✅ [Socket.io] Canoa APROVADA: ${vesselNumber} (ID: ${vesselId})`);
        io.emit("vessel:approved", { vesselId, vesselNumber, approvedAt: Date.now() });
      } catch (error) {
        console.error("[Socket.io] Error approving vessel:", error);
      }
    });

    socket.on("vessel:approve", (data: any) => {
      try {
        const { vesselId, vesselNumber } = data || {};
        const key = (vesselNumber || "").toString().trim().toLowerCase();

        activeVessels.forEach((pos, k) => {
          if ((key && k === key) || (vesselId && String(pos.vesselId) === String(vesselId))) {
            pos.approvalStatus = "approved";
            io.emit("position:updated", pos);
          }
        });

        io.emit("vessel:approved", { vesselId, vesselNumber, approvedAt: Date.now() });
      } catch (error) {
        console.error("[Socket.io] Error approving vessel:", error);
      }
    });

    /**
     * Monitor APPROVES ALL pending vessels in bulk
     */
    socket.on("vessel:approved_all", (data: any) => {
      try {
        activeVessels.forEach((pos) => {
          pos.approvalStatus = "approved";
        });
        console.log(`✅ [Socket.io] Todas as canoas foram APROVADAS em lote`);
        io.emit("vessel:approved", { approveAll: true, approvedAt: Date.now() });
        io.emit("monitor:positions", Array.from(activeVessels.values()));
      } catch (error) {
        console.error("[Socket.io] Error approving all vessels:", error);
      }
    });

    /**
     * Monitor REJECTS a vessel
     */
    socket.on("vessel:rejected", (data: any) => {
      try {
        const { vesselId, vesselNumber } = data || {};
        const key = (vesselNumber || "").toString().trim().toLowerCase();

        activeVessels.forEach((pos, k) => {
          if ((key && k === key) || (vesselId && String(pos.vesselId) === String(vesselId))) {
            pos.approvalStatus = "rejected";
            activeVessels.delete(k);
          }
        });

        io.emit("vessel:rejected", { vesselId, vesselNumber });
      } catch (error) {
        console.error("[Socket.io] Error rejecting vessel:", error);
      }
    });

    socket.on("vessel:removed", (data: any) => {
      try {
        if (data?.clearAll) {
          activeVessels.clear();
          io.emit("vessel:removed", { clearAll: true });
        } else {
          const { vesselId, vesselNumber } = data || {};
          const key = (vesselNumber || "").toString().trim().toLowerCase();
          activeVessels.forEach((pos, k) => {
            if ((key && k === key) || (vesselId && String(pos.vesselId) === String(vesselId))) {
              activeVessels.delete(k);
            }
          });
          io.emit("vessel:removed", { vesselId, vesselNumber });
        }
      } catch (error) {
        console.error("[Socket.io] Error removing vessel:", error);
      }
    });

    socket.on("admin:clear_all", () => {
      activeVessels.clear();
      io.emit("vessel:removed", { clearAll: true });
      console.log(`🧹 [Socket.io] Painel admin limpou todas as embarcações ativas.`);
    });

    /**
     * Monitor requests all active vessel positions
     */
    socket.on("monitor:request-positions", () => {
      try {
        const positions = Array.from(activeVessels.values());
        socket.emit("monitor:positions", positions);
      } catch (error) {
        console.error("[Socket.io] Error fetching positions:", error);
        socket.emit("error", "Failed to fetch positions");
      }
    });

    /**
     * Monitor requests position history for a specific vessel
     */
    socket.on("monitor:request-history", async (data: any) => {
      try {
        const { vesselId, limit = 500 } = data;
        if (!vesselId) {
          socket.emit("error", "Missing vesselId");
          return;
        }

        const history = await getVesselPositionHistory(Number(vesselId) || 1, limit);
        const trail = history.map((h) => ({
          latitude: parseFloat(h.latitude as any),
          longitude: parseFloat(h.longitude as any),
          timestamp: h.recordedAt?.getTime() || Date.now(),
        }));

        socket.emit("monitor:history", { vesselId, trail });
      } catch (error) {
        console.error("[Socket.io] Error fetching history:", error);
        socket.emit("error", "Failed to fetch history");
      }
    });

    /**
     * Report requests full history of all vessels
     */
    socket.on("report:request-all-history", () => {
      try {
        const all = getAllHistory();
        socket.emit("report:all-history", all);
      } catch (error) {
        console.error("[Socket.io] Error fetching all history for report:", error);
      }
    });

    /**
     * Handle disconnection
     */
    socket.on("disconnect", async () => {
      const vesselId = socket.data.vesselId;
      const vesselNumber = socket.data.vesselNumber;

      if (vesselId && vesselNumber) {
        const numKey = vesselNumber.toString().trim().toLowerCase();
        const pos = activeVessels.get(numKey);
        if (pos) {
          pos.status = "inactive";
        }
        try {
          if (typeof vesselId === "number") {
            await markVesselInactive(vesselId);
          }
        } catch (error) {}

        io.emit("vessel:disconnected", {
          vesselId,
          vesselNumber,
          timestamp: Date.now(),
        });
      }

      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket.io] Setup complete");
}

export function getActiveVessels(): VesselPosition[] {
  return Array.from(activeVessels.values());
}
