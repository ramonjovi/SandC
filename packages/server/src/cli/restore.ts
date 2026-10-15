import fs from "node:fs";
import path from "node:path";
import { APP_URL, BACKUP_DIR, DATA_DIR, appIsRunning, stamp } from "./common";

const name = process.argv[2];
const backups = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((n) => /^tpc-\d{8}-\d{6}$/.test(n)).sort().reverse() : [];

if (!name) {
  console.log(backups.length ? "Available backups (newest first):\n  " + backups.join("\n  ") + "\n\nRestore one with:  npm run restore -- <name>" : "No backups found.");
  process.exit(0);
}
if (!backups.includes(name)) { console.log(`No backup named ${name}.`); process.exit(1); }
if (await appIsRunning()) { console.log(`TPC is running at ${APP_URL}. Stop it first.`); process.exit(3); }

if (fs.existsSync(DATA_DIR)) {
  const safe = `${DATA_DIR}.before-restore-${stamp()}`;
  fs.renameSync(DATA_DIR, safe);
  console.log(`Current data kept at ${path.basename(safe)} in case you need it.`);
}
fs.cpSync(path.join(BACKUP_DIR, name), DATA_DIR, { recursive: true });
console.log(`Restored ${name}. Start the app as usual.`);
