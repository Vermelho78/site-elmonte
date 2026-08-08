import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "organizer"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Vessels table - stores information about each competing vessel
 */
export const vessels = mysqlTable("vessels", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique identifier for the vessel during the race */
  vesselNumber: varchar("vesselNumber", { length: 50 }).notNull().unique(),
  /** Competitor name */
  competitorName: varchar("competitorName", { length: 255 }).notNull(),
  /** Session token to identify this vessel's updates */
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  /** Current status: active, inactive, finished */
  status: mysqlEnum("status", ["active", "inactive", "finished"]).default("active").notNull(),
  /** Last known latitude */
  lastLatitude: decimal("lastLatitude", { precision: 10, scale: 8 }),
  /** Last known longitude */
  lastLongitude: decimal("lastLongitude", { precision: 11, scale: 8 }),
  /** Timestamp of last position update */
  lastUpdateAt: timestamp("lastUpdateAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vessel = typeof vessels.$inferSelect;
export type InsertVessel = typeof vessels.$inferInsert;

/**
 * Position history - stores all GPS positions for each vessel throughout the race
 */
export const positionHistory = mysqlTable("positionHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to vessel */
  vesselId: int("vesselId").notNull(),
  /** Latitude coordinate */
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  /** Longitude coordinate */
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  /** Accuracy in meters (from Geolocation API) */
  accuracy: decimal("accuracy", { precision: 8, scale: 2 }),
  /** Timestamp when position was recorded */
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PositionHistory = typeof positionHistory.$inferSelect;
export type InsertPositionHistory = typeof positionHistory.$inferInsert;

/**
 * Organizers table - stores authentication tokens for race organizers/monitors
 */
export const organizers = mysqlTable("organizers", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to user */
  userId: int("userId").notNull(),
  /** Authentication token for monitor access */
  accessToken: varchar("accessToken", { length: 255 }).notNull().unique(),
  /** Whether this organizer is currently active */
  isActive: varchar("isActive", { length: 1 }).default("1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organizer = typeof organizers.$inferSelect;
export type InsertOrganizer = typeof organizers.$inferInsert;