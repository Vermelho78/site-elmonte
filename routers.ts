import { z } from "zod";
import { initTRPC, TRPCError } from "@trpc/server";
import {
  getVesselByNumber,
  getVesselById,
  getAllActiveVessels,
  getVesselPositionHistory,
  createVessel,
  updateVesselPosition,
  markVesselInactive,
} from "./db";
import { nanoid } from "nanoid";

const t = initTRPC.context<any>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const user = ctx.user || { id: 1, name: "Organizador Master", role: "organizer" };
  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

export const appRouter = router({
  system: router({
    ping: publicProcedure.query(() => "pong"),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user || { id: 1, name: "Organizador Master", role: "organizer" }),
    logout: publicProcedure.mutation(() => ({ success: true })),
  }),

  // Vessel/Competitor APIs
  vessel: router({
    register: publicProcedure
      .input(
        z.object({
          vesselNumber: z.string().min(1).max(50),
          competitorName: z.string().min(1).max(255),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const { vesselNumber, competitorName } = input;
          const existing = await getVesselByNumber(vesselNumber);
          if (existing) {
            return {
              vesselId: existing.id,
              sessionToken: existing.sessionToken,
              message: "Vessel already registered",
            };
          }

          const sessionToken = nanoid(32);
          const vesselId = await createVessel(vesselNumber, competitorName, sessionToken);

          return {
            vesselId,
            sessionToken,
            message: "Vessel registered successfully",
          };
        } catch (error) {
          console.error("[tRPC] Error registering vessel:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to register vessel",
          });
        }
      }),

    listActive: publicProcedure.query(async () => {
      try {
        const activeVessels = await getAllActiveVessels();
        return activeVessels.map((v) => ({
          id: v.id,
          vesselNumber: v.vesselNumber,
          competitorName: v.competitorName,
          latitude: v.lastLatitude ? parseFloat(v.lastLatitude as any) : null,
          longitude: v.lastLongitude ? parseFloat(v.lastLongitude as any) : null,
          lastUpdateAt: v.lastUpdateAt,
          status: v.status,
        }));
      } catch (error) {
        console.error("[tRPC] Error listing active vessels:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list vessels",
        });
      }
    }),

    getHistory: publicProcedure
      .input(
        z.object({
          vesselId: z.number(),
          limit: z.number().max(1000).default(100),
        })
      )
      .query(async ({ input }) => {
        try {
          const { vesselId, limit } = input;
          const history = await getVesselPositionHistory(vesselId, limit);
          return history.map((h) => ({
            latitude: parseFloat(h.latitude as any),
            longitude: parseFloat(h.longitude as any),
            accuracy: h.accuracy ? parseFloat(h.accuracy as any) : null,
            recordedAt: h.recordedAt,
          }));
        } catch (error) {
          console.error("[tRPC] Error fetching history:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch position history",
          });
        }
      }),
  }),

  // Monitor/Organizer APIs
  monitor: router({
    checkAccess: protectedProcedure.query(({ ctx }) => {
      return {
        isAuthorized: true,
        userRole: ctx.user?.role || "organizer",
      };
    }),

    getVessels: protectedProcedure.query(async () => {
      try {
        const activeVessels = await getAllActiveVessels();
        return activeVessels.map((v) => ({
          id: v.id,
          vesselNumber: v.vesselNumber,
          competitorName: v.competitorName,
          latitude: v.lastLatitude ? parseFloat(v.lastLatitude as any) : null,
          longitude: v.lastLongitude ? parseFloat(v.lastLongitude as any) : null,
          lastUpdateAt: v.lastUpdateAt,
          status: v.status,
        }));
      } catch (error) {
        console.error("[tRPC] Error fetching vessels for monitor:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch vessels",
        });
      }
    }),

    getTrail: protectedProcedure
      .input(
        z.object({
          vesselId: z.number(),
          limit: z.number().max(5000).default(500),
        })
      )
      .query(async ({ input }) => {
        try {
          const { vesselId, limit } = input;
          const history = await getVesselPositionHistory(vesselId, limit);
          return history.map((h) => ({
            latitude: parseFloat(h.latitude as any),
            longitude: parseFloat(h.longitude as any),
            accuracy: h.accuracy ? parseFloat(h.accuracy as any) : null,
            recordedAt: h.recordedAt,
          }));
        } catch (error) {
          console.error("[tRPC] Error fetching trail:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch vessel trail",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
