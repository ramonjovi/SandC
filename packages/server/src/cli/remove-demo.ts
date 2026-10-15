import { and, eq, inArray, like } from "drizzle-orm";
import { openDb, schema } from "../db";
import { purgeAthlete } from "../lifecycle";
import { APP_URL, appIsRunning, ask, closeInput } from "./common";

/**
 * Removes the demo sign-ins (*@tpc.demo) and the synthetic demo athletes with all their data. Real athletes are never touched.
 * Refuses to run unless you already have your own admin account, so you cannot lock yourself out.
 */
if (await appIsRunning()) { console.log(`TPC is running at ${APP_URL}. Close it first, then run this again.`); process.exit(3); }

const { db, close } = await openDb();
const people = await db.select().from(schema.users);
const mine = people.filter((u) => !u.email.endsWith("@tpc.demo") && !u.disabled && (u.role === "admin" || u.role === "clinician"));
if (mine.length === 0) {
  console.log("You have no account of your own yet. Run  npm run make-admin  first, then run this again.");
  await close(); process.exit(1);
}
const demoUsers = people.filter((u) => u.email.endsWith("@tpc.demo"));
const synthetic = await db.select().from(schema.athletes).where(eq(schema.athletes.isSynthetic, true));
const real = (await db.select().from(schema.athletes)).filter((a) => !a.isSynthetic);

console.log(`Will remove ${demoUsers.length} demo sign-in(s) and ${synthetic.length} synthetic athlete(s) (${synthetic.map((a) => a.name).join(", ") || "none"}).`);
console.log(`Will KEEP ${real.length} real athlete(s): ${real.map((a) => a.name).join(", ") || "none"}.`);
console.log(`Your accounts that stay: ${mine.map((u) => u.email).join(", ")}.`);
const confirmed = (await ask("\nType YES to continue: ")).trim() === "YES";
closeInput();
if (!confirmed) { console.log("Cancelled. Nothing was changed."); await close(); process.exit(0); }

for (const a of synthetic) await purgeAthlete(db, a.id);
const demoIds = demoUsers.map((u) => u.id);
if (demoIds.length) {
  await db.delete(schema.sessions).where(inArray(schema.sessions.userId, demoIds));
  await db.delete(schema.users).where(and(like(schema.users.email, "%@tpc.demo"), inArray(schema.users.id, demoIds)));
}
await db.insert(schema.auditLog).values({ actor: mine[0].name, action: "remove-demo-data", entity: "system", entityId: "demo", athleteId: null, detail: { users: demoUsers.length, athletes: synthetic.length } });
await close();
console.log("Done. The demo data will not come back: demo data is only created on a completely empty database.");
