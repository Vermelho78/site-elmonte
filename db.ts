import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, vessels, positionHistory, Vessel, PositionHistory } from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

// In-memory storage fallback when database is not connected
const memVessels = new Map<number, Vessel>();
const memHistory = new Map<number, PositionHistory[]>();
let memVesselAutoId = 1;
let memHistoryAutoId = 1;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    return {
      id: 1,
      openId,
      name: "Organizador Master",
      email: "organizador@vaa.com",
      loginMethod: "oauth",
      role: "organizer" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Vessel queries
export async function getVesselByNumber(vesselNumber: string): Promise<Vessel | undefined> {
  const db = await getDb();
  if (!db) {
    return Array.from(memVessels.values()).find((v) => v.vesselNumber === vesselNumber);
  }

  const result = await db
    .select()
    .from(vessels)
    .where(eq(vessels.vesselNumber, vesselNumber))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getVesselById(vesselId: number): Promise<Vessel | undefined> {
  const db = await getDb();
  if (!db) {
    return memVessels.get(vesselId);
  }

  const result = await db
    .select()
    .from(vessels)
    .where(eq(vessels.id, vesselId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllActiveVessels(): Promise<Vessel[]> {
  const db = await getDb();
  if (!db) {
    return Array.from(memVessels.values()).filter((v) => v.status === "active");
  }

  return db.select().from(vessels).where(eq(vessels.status, "active"));
}

export async function getVesselPositionHistory(vesselId: number, limit: number = 100): Promise<PositionHistory[]> {
  const db = await getDb();
  if (!db) {
    const history = memHistory.get(vesselId) || [];
    return history.slice(-limit);
  }

  return db
    .select()
    .from(positionHistory)
    .where(eq(positionHistory.vesselId, vesselId))
    .orderBy(positionHistory.recordedAt)
    .limit(limit);
}

export async function createVessel(vesselNumber: string, competitorName: string, sessionToken: string): Promise<number> {
  const db = await getDb();
  if (!db) {
    const id = memVesselAutoId++;
    const newVessel: Vessel = {
      id,
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
    memVessels.set(id, newVessel);
    return id;
  }

  const result = await db.insert(vessels).values({
    vesselNumber,
    competitorName,
    sessionToken,
    status: "active",
  });

  return (result as any).insertId || 0;
}

export async function updateVesselPosition(
  vesselId: number,
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const vessel = memVessels.get(vesselId);
    if (vessel) {
      vessel.lastLatitude = latitude.toString() as any;
      vessel.lastLongitude = longitude.toString() as any;
      vessel.lastUpdateAt = new Date();
      vessel.updatedAt = new Date();
      vessel.status = "active";
    }

    const historyItem: PositionHistory = {
      id: memHistoryAutoId++,
      vesselId,
      latitude: latitude.toString() as any,
      longitude: longitude.toString() as any,
      accuracy: accuracy ? (accuracy.toString() as any) : null,
      recordedAt: new Date(),
    };

    const currentHistory = memHistory.get(vesselId) || [];
    currentHistory.push(historyItem);
    memHistory.set(vesselId, currentHistory);
    return;
  }

  await db
    .update(vessels)
    .set({
      lastLatitude: latitude.toString() as any,
      lastLongitude: longitude.toString() as any,
      lastUpdateAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vessels.id, vesselId));

  await db.insert(positionHistory).values({
    vesselId,
    latitude: latitude.toString() as any,
    longitude: longitude.toString() as any,
    accuracy: accuracy ? (accuracy.toString() as any) : null,
  });
}

export async function markVesselInactive(vesselId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    const vessel = memVessels.get(vesselId);
    if (vessel) {
      vessel.status = "inactive";
      vessel.updatedAt = new Date();
    }
    return;
  }

  await db
    .update(vessels)
    .set({
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(eq(vessels.id, vesselId));
}
