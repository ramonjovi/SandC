import { createApp } from "./app";
import { openDb } from "./db";
import { bootstrapAdmin, seedIfEmpty, DEMO_PASSWORD, DEMO_USERS } from "./seed";

const { db } = await openDb();
const prod = Boolean(process.env.DATABASE_URL);
await bootstrapAdmin(db);
if (!prod && process.env.SEED_DEMO !== "false") {
  if (await seedIfEmpty(db)) console.log(`Demo logins (synthetic data, dev only), password "${DEMO_PASSWORD}": ${Object.values(DEMO_USERS).join(", ")}`);
}
const port = Number(process.env.PORT ?? 3001);
const app = createApp(db);
if (prod) app.set("trust proxy", 1);
app.listen(port, () => {
  console.log(`TPC Performance OS API on http://localhost:${port} (${prod ? "PostgreSQL" : "embedded PGlite"})`);
});
