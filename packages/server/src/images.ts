import type { Request, RequestHandler, Response, Router } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { running } from "@tpc/engine";
import { schema, type Db } from "./db";

const { analysisImages, assessments } = schema;

const MAX_BYTES = 2_500_000; // per picture, after the browser has shrunk it
const MAX_PER_ASSESSMENT = 40;
const PHASES = new Set(running.ANALYSIS_PHASE_IDS);

type HttpErrorCtor = new (status: number, message: string) => Error;
export interface ImagesCtx {
  db: Db;
  clinician: Router;
  HttpError: HttpErrorCtor;
  h: (fn: (req: Request, res: Response) => Promise<unknown>) => RequestHandler;
  param: (req: Request, k: string) => string;
  actorOf: (req: Request) => string;
  audit: (actor: string, action: string, entity: string, entityId: string, athleteId: string | null, detail?: unknown) => Promise<unknown>;
}

/** Still frames from the video: clinician-only upload, list, edit, delete and fetch. */
export function registerImages(ctx: ImagesCtx) {
  const { db, clinician, HttpError, h, param, actorOf, audit } = ctx;
  const meta = (r: typeof analysisImages.$inferSelect) => ({
    id: r.id, assessmentId: r.assessmentId, phase: r.phase, caption: r.caption, measure: r.measure, discussion: r.discussion,
    bytes: r.bytes, createdBy: r.createdBy, createdAt: r.createdAt,
  });
  const getImage = async (id: string) => {
    const [r] = await db.select().from(analysisImages).where(eq(analysisImages.id, id));
    if (!r) throw new HttpError(404, "Image not found");
    return r;
  };

  clinician.get("/assessments/:id/images", h(async (req, res) => {
    const rows = await db.select().from(analysisImages).where(eq(analysisImages.assessmentId, param(req, "id"))).orderBy(asc(analysisImages.createdAt));
    res.json(rows.map(meta));
  }));

  clinician.post("/assessments/:id/images", h(async (req, res) => {
    const aid = param(req, "id");
    const [a] = await db.select().from(assessments).where(eq(assessments.id, aid));
    if (!a) throw new HttpError(404, "Assessment not found");
    const phase = String(req.body?.phase ?? "");
    if (!PHASES.has(phase)) throw new HttpError(400, "Unknown analysis phase.");
    const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl ?? ""));
    if (!m) throw new HttpError(400, "The picture must be a JPEG or PNG.");
    const bytes = Math.floor((m[2].length * 3) / 4);
    if (bytes > MAX_BYTES) throw new HttpError(413, "That picture is too large even after shrinking. Use a smaller frame.");
    const count = (await db.select({ id: analysisImages.id }).from(analysisImages).where(eq(analysisImages.assessmentId, aid))).length;
    if (count >= MAX_PER_ASSESSMENT) throw new HttpError(409, `At most ${MAX_PER_ASSESSMENT} pictures per assessment.`);
    const id = randomUUID();
    await db.insert(analysisImages).values({
      id, athleteId: a.athleteId, assessmentId: aid, phase,
      caption: String(req.body?.caption ?? "").slice(0, 200), measure: String(req.body?.measure ?? "").slice(0, 200), discussion: String(req.body?.discussion ?? "").slice(0, 4000),
      mime: m[1], data: m[2], bytes, createdBy: actorOf(req),
    });
    await audit(actorOf(req), "add-image", "analysis_image", id, a.athleteId, { phase, bytes });
    res.status(201).json({ id });
  }));

  clinician.put("/images/:id", h(async (req, res) => {
    const r = await getImage(param(req, "id"));
    await db.update(analysisImages).set({
      caption: String(req.body?.caption ?? r.caption).slice(0, 200),
      measure: String(req.body?.measure ?? r.measure).slice(0, 200),
      discussion: String(req.body?.discussion ?? r.discussion).slice(0, 4000),
    }).where(eq(analysisImages.id, r.id));
    await audit(actorOf(req), "edit-image", "analysis_image", r.id, r.athleteId, { phase: r.phase });
    res.json({ ok: true });
  }));

  clinician.delete("/images/:id", h(async (req, res) => {
    const r = await getImage(param(req, "id"));
    await db.delete(analysisImages).where(and(eq(analysisImages.id, r.id)));
    await audit(actorOf(req), "delete-image", "analysis_image", r.id, r.athleteId, { phase: r.phase });
    res.json({ ok: true });
  }));

  /** The picture itself (signed-in clinicians only; never cached by the browser). */
  clinician.get("/images/:id/file", h(async (req, res) => {
    const r = await getImage(param(req, "id"));
    res.setHeader("Content-Type", r.mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(r.data, "base64"));
  }));
}
