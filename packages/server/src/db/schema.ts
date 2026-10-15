import { bigserial, boolean, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const athletes = pgTable("athletes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  moduleId: text("module_id").notNull().default("running"),
  /** Secret link code for the athlete interface. Replace with real auth before real patient data. */
  accessCode: text("access_code").notNull().unique(),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: createdAt(),
});

export const assessments = pgTable("assessments", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  kind: text("kind").notNull(), // baseline | reassessment
  data: jsonb("data").notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engineReports = pgTable("engine_reports", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  assessmentId: text("assessment_id").notNull().references(() => assessments.id),
  report: jsonb("report").notNull(),
  createdAt: createdAt(),
});

export const ptInterpretations = pgTable("pt_interpretations", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  assessmentId: text("assessment_id").notNull().references(() => assessments.id),
  clinician: text("clinician").notNull(),
  data: jsonb("data").notNull(),
  comparison: jsonb("comparison"),
  createdAt: createdAt(),
});

export const programs = pgTable("programs", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  assessmentId: text("assessment_id").notNull().references(() => assessments.id),
  status: text("status").notNull(), // draft | approved | archived
  data: jsonb("data").notNull(),
  version: integer("version").notNull().default(1),
  screeningReviewed: boolean("screening_reviewed").notNull().default(false),
  clearanceNote: text("clearance_note"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionLogs = pgTable("session_logs", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  programId: text("program_id").notNull().references(() => programs.id),
  week: integer("week").notNull(),
  day: integer("day").notNull(),
  data: jsonb("data").notNull(),
  proposals: jsonb("proposals").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const weeklyLogs = pgTable("weekly_logs", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  weekStart: text("week_start").notNull(),
  runKm: real("run_km").notNull(),
  painModifiedTraining: boolean("pain_modified_training").notNull().default(false),
  notes: text("notes"),
  volumeFlag: jsonb("volume_flag"),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  athleteId: text("athlete_id"),
  detail: jsonb("detail"),
});
