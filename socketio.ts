import { Server as SocketIOServer, Socket } from "socket.io";
import { getDb, updateVesselPosition, markVesselInactive, getVesselPositionHistory } from "./db";
import { vessels, positionHistory } from "./schema";
import { eq } from "drizzle-orm";

interface VesselPosition {
  vesselId: number;
  vesselNumber: string;
  competitorName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  status: string;
  isSos?: boolean;
  sosMessage?: string;
  sosTimestamp?: number;
}

// Store active vessel connections
const activeVessels = new Map<string, VesselPosition>();

export function setupSocketIO(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    /**
     * Competitor registers and starts sending positions
     * Payload: { vesselNumber, competitorName, sessionToken }
     */
    socket.on("vessel:register", async (data: any) => {
      try {
        const { vesselNumber, competitorName, sessionToken } = data;

        if (!vesselNumber || !competitorName || !sessionToken) {
          socket.emit("error", "Missing required fields");
          return;
        }

        const db = await getDb();
        if (!db) {
          // Fallback to in-memory registration handling
          socket.data.vesselId = Math.floor(Math.random() * 1000) + 1;
          socket.data.vesselNumber = vesselNumber;
          socket.data.competitorName = competitorName;

          socket.join(`vessel:${socket.data.vesselId}`);

          socket.emit("vessel:registered", {
            vesselId: socket.data.vesselId,
            message: "Registered successfully",
          });

          io.emit("vessel:reconnected", {
            vesselId: socket.data.vesselId,
            vesselNumber,
            competitorName,
            timestamp: Date.now(),
          });

          console.log(`[Socket.io] Vessel registered (mem): ${vesselNumber} (${competitorName})`);
          return;
        }

        // Check if vessel already exists
        const existing = await db
          .select()
          .from(vessels)
          .where(eq(vessels.vesselNumber, vesselNumber))
          .limit(1);

        let vessel;
        if (existing.length > 0) {
          vessel = existing[0];
          if (vessel.sessionToken !== sessionToken && vessel.status === "active") {
            socket.emit("error", "Vessel number already in use by an active session");
            return;
          }
          await db
            .update(vessels)
            .set({
              sessionToken,
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(vessels.id, vessel.id));
        } else {
          const result = await db
            .insert(vessels)
            .values({
              vesselNumber,
              competitorName,
              sessionToken,
              status: "active",
            });

          vessel = {
            id: (result as any).insertId || (result as any)[0]?.insertId,
            vesselNumber,
            competitorName,
            sessionToken,
            status: "active",
            lastLatitude: null,
            lastLongitude: null,
            lastUpdateAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        socket.data.vesselId = vessel.id;
        socket.data.vesselNumber = vesselNumber;
        socket.data.competitorName = competitorName;

        socket.join(`vessel:${vessel.id}`);

        socket.emit("vessel:registered", {
          vesselId: vessel.id,
          message: "Registered successfully",
        });

        io.emit("vessel:reconnected", {
          vesselId: vessel.id,
          vesselNumber,
          competitorName,
          timestamp: Date.now(),
        });

        console.log(`[Socket.io] Vessel registered: ${vesselNumber} (${competitorName})`);
      } catch (error) {
        console.error("[Socket.io] Error registering vessel:", error);
        socket.emit("error", "Registration failed");
      }
    });

    /**
     * Receive position update from competitor
     * Payload: { latitude, longitude, accuracy }
     */
    socket.on("position:update", async (data: any) => {
      try {
        const { latitude, longitude, accuracy } = data;
        const vesselId = socket.data.vesselId || 1;
        const vesselNumber = socket.data.vesselNumber || "VAA-001";
        const competitorName = socket.data.competitorName || "Competidor";

        if (typeof latitude !== "number" || typeof longitude !== "number") {
          socket.emit("error", "Missing position data");
          return;
        }

        await updateVesselPosition(vesselId, latitude, longitude, accuracy);

        // Maintain existing SOS status if active
        const existingActive = activeVessels.get(`vessel:${vesselId}`);
        const isSos = existingActive?.isSos || false;
        const sosMessage = existingActive?.sosMessage;
        const sosTimestamp = existingActive?.sosTimestamp;

        const position: VesselPosition = {
          vesselId,
          vesselNumber,
          competitorName,
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now(),
          status: "active",
          isSos,
          sosMessage,
          sosTimestamp,
        };

        activeVessels.set(`vessel:${vesselId}`, position);

        // Broadcast position to monitors
        io.emit("position:updated", position);

        socket.emit("position:ack", {
          timestamp: Date.now(),
          message: "Position received",
        });
      } catch (error) {
        console.error("[Socket.io] Error updating position:", error);
        socket.emit("error", "Position update failed");
      }
    });

    /**
     * Competitor triggers SOS Emergency alert
     * Payload: { latitude, longitude, message }
     */
    socket.on("vessel:sos", (data: any) => {
      try {
        const vesselId = socket.data.vesselId || 1;
        const vesselNumber = socket.data.vesselNumber || "VAA-001";
        const competitorName = socket.data.competitorName || "Competidor";
        const latitude = typeof data?.latitude === "number" ? data.latitude : socket.data.lastLat || 0;
        const longitude = typeof data?.longitude === "number" ? data.longitude : socket.data.lastLng || 0;
        const sosMessage = data?.message || "EMERGÊNCIA ACIONADA PELO COMPETIDOR!";
        const sosTimestamp = Date.now();

        const current = activeVessels.get(`vessel:${vesselId}`);
        const updatedPosition: VesselPosition = {
          vesselId,
          vesselNumber,
          competitorName,
          latitude: current?.latitude ?? latitude,
          longitude: current?.longitude ?? longitude,
          accuracy: current?.accuracy,
          timestamp: Date.now(),
          status: "active",
          isSos: true,
          sosMessage,
          sosTimestamp,
        };

        activeVessels.set(`vessel:${vesselId}`, updatedPosition);

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

        // Broadcast SOS alert to all clients / monitors
        io.emit("vessel:sos_alert", sosPayload);
        io.emit("position:updated", updatedPosition);

        socket.emit("vessel:sos_ack", {
          timestamp: sosTimestamp,
          message: "Alerta SOS recebido pelo servidor e notificado aos monitores!",
        });
      } catch (error) {
        console.error("[Socket.io] Error handling SOS:", error);
        socket.emit("error", "SOS trigger failed");
      }
    });

    /**
     * Monitor resolves/clears an SOS alert
     * Payload: { vesselId }
     */
    socket.on("vessel:sos_resolve", (data: any) => {
      try {
        const { vesselId } = data;
        if (!vesselId) return;

        const current = activeVessels.get(`vessel:${vesselId}`);
        if (current) {
          current.isSos = false;
          current.sosMessage = undefined;
          current.sosTimestamp = undefined;
          activeVessels.set(`vessel:${vesselId}`, current);
          io.emit("position:updated", current);
        }

        io.emit("vessel:sos_resolved", { vesselId, resolvedAt: Date.now() });
        console.log(`✅ [Socket.io] ALERTA SOS ATENDIDO/RESOLVIDO para embarcação ID ${vesselId}`);
      } catch (error) {
        console.error("[Socket.io] Error resolving SOS:", error);
      }
    });

    /**
     * Monitor requests all active vessel positions
     */
    socket.on("monitor:request-positions", async () => {
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
        const { vesselId, limit = 100 } = data;
        if (!vesselId) {
          socket.emit("error", "Missing vesselId");
          return;
        }

        const history = await getVesselPositionHistory(vesselId, limit);
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
     * Handle disconnection
     */
    socket.on("disconnect", async () => {
      const vesselId = socket.data.vesselId;
      const vesselNumber = socket.data.vesselNumber;

      if (vesselId) {
        try {
          await markVesselInactive(vesselId);
          activeVessels.delete(`vessel:${vesselId}`);

          io.emit("vessel:disconnected", {
            vesselId,
            vesselNumber,
            timestamp: Date.now(),
          });

          console.log(`[Socket.io] Vessel disconnected: ${vesselNumber} (${vesselId})`);
        } catch (error) {
          console.error("[Socket.io] Error handling disconnection:", error);
        }
      }

      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[Socket.io] Setup complete");
}

export function getActiveVessels(): VesselPosition[] {
  return Array.from(activeVessels.values());
}
