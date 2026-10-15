import { createApp } from "./app";
import { openDb } from "./db";
import { seedIfEmpty } from "./seed";

const { db } = await openDb();
if (process.env.SEED_DEMO !== "false" && !process.env.DATABASE_URL) await seedIfEmpty(db);
const port = Number(process.env.PORT ?? 3001);
createApp(db).listen(port, () => {
  console.log(`TPC Performance OS API on http://localhost:${port} (${process.env.DATABASE_URL ? "PostgreSQL" : "embedded PGlite"})`);
});
