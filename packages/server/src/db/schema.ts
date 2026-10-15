import { bigserial, boolean, integer, jsonb, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const athletes = pgTable("athletes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  moduleId: text("module_id").notNull().default("running"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  /** Set when archived: hidden from the list, athlete sign-in disabled. Reversible until permanently deleted. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
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
  /** "athlete" when the athlete logged it, otherwise the clinician who entered it on their behalf. */
  loggedBy: text("logged_by").notNull().default("athlete"),
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

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // admin | clinician | athlete
  passwordHash: text("password_hash").notNull(),
  /** Set for role=athlete: the single athlete record this user may access. */
  athleteId: text("athlete_id").references(() => athletes.id),
  disabled: boolean("disabled").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Server-side sessions. Only a SHA-256 hash of the cookie token is stored. */
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const invites = pgTable("invites", {
  tokenHash: text("token_hash").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Clinician overrides of rule default values. A row exists only while the value differs from the built-in default. */
export const ruleOverrides = pgTable("rule_overrides", {
  ruleId: text("rule_id").notNull(),
  key: text("key").notNull(),
  value: real("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.ruleId, t.key] })]);

/** Versioned consent / privacy form. A new version is a draft until a DIFFERENT clinician from its author(s) approves it. */
export const consentTemplates = pgTable("consent_templates", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  items: jsonb("items").notNull(), // [{ id, text, required }]
  status: text("status").notNull(), // draft | approved | retired
  createdById: text("created_by_id"), // null = created by the system (default template)
  createdByName: text("created_by_name").notNull(),
  lastEditedById: text("last_edited_by_id"),
  lastEditedByName: text("last_edited_by_name").notNull(),
  approvedById: text("approved_by_id"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One signed (or paper-attested) consent. The snapshot keeps exactly what was shown and agreed, whatever happens to the template later. */
export const consents = pgTable("consents", {
  id: text("id").primaryKey(),
  athleteId: text("athlete_id").notNull().references(() => athletes.id),
  mode: text("mode").notNull(), // in-app | paper
  templateId: text("template_id"),
  templateVersion: integer("template_version"),
  snapshot: jsonb("snapshot").notNull(),
  signerName: text("signer_name").notNull(),
  signerRole: text("signer_role").notNull(), // athlete | guardian
  signedOn: text("signed_on").notNull(), // ISO date
  signedVia: text("signed_via").notNull(), // clinic device | athlete account | paper form
  recordedBy: text("recorded_by").notNull(),
  status: text("status").notNull().default("active"), // active | withdrawn
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  withdrawnReason: text("withdrawn_reason"),
  createdAt: createdAt(),
});
