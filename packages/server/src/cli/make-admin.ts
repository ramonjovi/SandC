import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword, passwordProblem } from "../auth";
import { openDb, schema } from "../db";
import { APP_URL, appIsRunning, ask, closeInput } from "./common";

/** Creates (or, for an existing email, resets the password of) a sign-in account. You type the password; it is never shown or stored in plain text. */
if (await appIsRunning()) { console.log(`TPC is running at ${APP_URL}. Close it first, then run this again.`); process.exit(3); }

console.log("Create a TPC account for yourself.\n");
const email = (await ask("Email: ")).trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.log("That does not look like an email address."); process.exit(1); }
const name = (await ask("Your name (shown in the audit history): ")).trim();
if (!name) { console.log("A name is required."); process.exit(1); }
const roleAnswer = (await ask("Role - type 'admin' (manages accounts) or 'clinician' [admin]: ")).trim().toLowerCase();
const role = roleAnswer === "clinician" ? "clinician" : "admin";
const pw = await ask("Password (10+ characters): ", { hidden: true });
const problem = passwordProblem(pw);
if (problem) { console.log(problem); process.exit(1); }
if ((await ask("Repeat password: ", { hidden: true })) !== pw) { console.log("The passwords do not match."); process.exit(1); }

closeInput();
const { db, close } = await openDb();
const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
const passwordHash = await hashPassword(pw);
if (existing) {
  await db.update(schema.users).set({ passwordHash, name, role, disabled: false }).where(eq(schema.users.id, existing.id));
  console.log(`\nUpdated the existing account ${email} (${role}).`);
} else {
  await db.insert(schema.users).values({ id: randomUUID(), email, name, role, passwordHash });
  console.log(`\nCreated ${role} account ${email}.`);
}
await db.insert(schema.auditLog).values({ actor: name, action: existing ? "reset-account" : "create-account", entity: "user", entityId: email, athleteId: null, detail: { role, via: "command line" } });
await close();
console.log("Start the app and sign in with it.");
