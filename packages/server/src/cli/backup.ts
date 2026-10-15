import fs from "node:fs";
import path from "node:path";
import { APP_URL, BACKUP_DIR, DATA_DIR, appIsRunning, stamp } from "./common";

/**
 * Copies the whole database folder to backups/tpc-<date>/ and keeps the newest 14.
 * Exit codes: 0 done (or nothing to back up), 3 the app is running (stop it first), 1 failure.
 */
const KEEP = 14;

if (await appIsRunning()) {
  console.log(`TPC is running at ${APP_URL}. Stop it before taking a backup (a copy of a running database can be unusable).`);
  process.exit(3);
}
if (!fs.existsSync(DATA_DIR)) {
  console.log("No database yet, nothing to back up.");
  process.exit(0);
}
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const dest = path.join(BACKUP_DIR, `tpc-${stamp()}`);
fs.cpSync(DATA_DIR, dest, { recursive: true });
const all = fs.readdirSync(BACKUP_DIR).filter((n) => /^tpc-\d{8}-\d{6}$/.test(n)).sort();
for (const old of all.slice(0, Math.max(0, all.length - KEEP))) fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
console.log(`Backup saved: ${dest}`);
console.log("Tip: also copy the backups folder to a USB drive or cloud drive. A backup on the same computer does not protect you if the computer is lost.");
