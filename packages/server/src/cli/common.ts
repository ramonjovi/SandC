import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(here, "../..");
export const DATA_DIR = process.env.TPC_DATA_DIR ?? path.join(SERVER_DIR, ".pglite");
export const BACKUP_DIR = process.env.TPC_BACKUP_DIR ?? path.resolve(SERVER_DIR, "../../backups");
export const APP_URL = `http://localhost:${process.env.PORT ?? 3001}`;

/** True if the app is answering on its port. The embedded database allows only one process, so tools must not run alongside it. */
export async function appIsRunning(): Promise<boolean> {
  try {
    const r = await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(800) });
    return r.ok;
  } catch { return false; }
}

let rl: readline.Interface | null = null;
let muted = false;
const waiting: Array<(line: string) => void> = [];
const buffered: string[] = [];

function input(): readline.Interface {
  if (rl) return rl;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  // While a password is typed, swallow the echo so it is not shown.
  (rl as any)._writeToOutput = (s: string) => { if (!muted) process.stdout.write(s); };
  rl.on("line", (l) => { const w = waiting.shift(); if (w) w(l); else buffered.push(l); });
  rl.on("close", () => { while (waiting.length) waiting.shift()!(""); });
  return rl;
}

/** Ask one question on the terminal. With hidden: true the typed text is not shown. Call closeInput() when finished asking. */
export function ask(question: string, opts: { hidden?: boolean } = {}): Promise<string> {
  input();
  process.stdout.write(question);
  muted = Boolean(opts.hidden && process.stdin.isTTY);
  return new Promise((resolve) => {
    const done = (line: string) => {
      muted = false;
      if (opts.hidden && process.stdin.isTTY) process.stdout.write("\n");
      resolve(line);
    };
    const queued = buffered.shift();
    if (queued !== undefined) done(queued); else waiting.push(done);
  });
}
export function closeInput() { rl?.close(); rl = null; }

export const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
