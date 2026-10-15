import { eq } from "drizzle-orm";
import { schema, type Db } from "./db";

const { athletes, assessments, engineReports, ptInterpretations, programs, sessionLogs, weeklyLogs, auditLog, users, invites, consents } = schema;

/**
 * Erases an athlete and every record that belongs to them (irreversible). Audit rows keep who/what/when but lose their content
 * and their link to the athlete, because those rows can hold assessment snapshots.
 */
export async function purgeAthlete(db: Db, athleteId: string) {
  await db.transaction(async (tx) => {
    const accountIds = (await tx.select({ id: users.id }).from(users).where(eq(users.athleteId, athleteId))).map((u) => u.id);
    for (const uid of accountIds) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, uid));
    await tx.delete(sessionLogs).where(eq(sessionLogs.athleteId, athleteId));
    await tx.delete(weeklyLogs).where(eq(weeklyLogs.athleteId, athleteId));
    await tx.delete(programs).where(eq(programs.athleteId, athleteId));
    await tx.delete(ptInterpretations).where(eq(ptInterpretations.athleteId, athleteId));
    await tx.delete(engineReports).where(eq(engineReports.athleteId, athleteId));
    await tx.delete(assessments).where(eq(assessments.athleteId, athleteId));
    await tx.delete(invites).where(eq(invites.athleteId, athleteId));
    await tx.delete(consents).where(eq(consents.athleteId, athleteId));
    await tx.delete(users).where(eq(users.athleteId, athleteId));
    await tx.delete(athletes).where(eq(athletes.id, athleteId));
    await tx.update(auditLog).set({ detail: null, athleteId: null }).where(eq(auditLog.athleteId, athleteId));
  });
}
