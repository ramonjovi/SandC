import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Activity, BookOpenCheck } from "lucide-react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Badge } from "@/components/ui";
import { api, ApiError, store, useApi } from "@/lib/api";
import { MetaContext, type Meta } from "@/lib/meta";
import { fmtDate, parseTime } from "@/lib/utils";

export function ClinicianLayout() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [needToken, setNeedToken] = useState(false);
  const [token, setToken] = useState("");
  const [actor, setActor] = useState(store.get("tpc.actor", ""));
  const [err, setErr] = useState("");

  const load = () => api<Meta>("/meta").then((m) => { setMeta(m); setNeedToken(false); }).catch((e: ApiError) => {
    if (e.status === 401) setNeedToken(true); else setErr(e.message);
  });
  useEffect(() => { void load(); }, []);

  if (needToken) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-4">
        <Card><CardHeader><CardTitle>Clinician sign-in</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label>Access token</Label>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            <Button onClick={() => { store.set("tpc.token", token); void load(); }}>Continue</Button>
          </CardContent></Card>
      </div>
    );
  }
  if (!meta) return <div className="p-8 text-sm text-muted-foreground">{err || "Loading..."}</div>;

  return (
    <MetaContext.Provider value={meta}>
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-semibold"><Activity className="h-5 w-5 text-primary" /> TPC Performance OS</Link>
          <Badge variant="outline" className="hidden sm:inline-flex">Clinician</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/rules" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><BookOpenCheck className="h-4 w-4" /> Rules</Link>
            <Input className="h-8 w-36 text-xs" placeholder="Your name" value={actor} onChange={(e) => { setActor(e.target.value); store.set("tpc.actor", e.target.value); }} aria-label="Clinician name" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5"><Outlet /></main>
    </MetaContext.Provider>
  );
}

export function Home() {
  const { data, reload } = useApi<any[]>("/athletes");
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", sex: "male", age: "30", mass: "70", event: "10k", dist: "10000", time: "", date: "", narrative: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function create() {
    setErr("");
    try {
      const r = await api("/athletes", { method: "POST", body: {
        clinician: store.get("tpc.actor", "clinician"),
        profile: { name: f.name, sex: f.sex, age: Number(f.age), bodyMassKg: Number(f.mass), heightCm: null },
        goals: { event: f.event, targetDistanceM: Number(f.dist), targetTimeSec: parseTime(f.time), raceDate: f.date || null, narrative: f.narrative },
      } });
      nav(`/c/${r.id}`);
    } catch (e) { setErr((e as Error).message); }
  }
  const presets: Record<string, string> = { "1500m": "1500", "3000m": "3000", "5k": "5000", "10k": "10000", half: "21097", marathon: "42195" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Athletes</h1>
          <p className="text-sm text-muted-foreground">Running module. Demo data is synthetic.</p>
        </div>
        <Button onClick={() => setOpen(!open)}>{open ? "Cancel" : "New runner"}</Button>
      </div>

      {open && (
        <Card><CardHeader><CardTitle>New runner profile and goals</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3"><Label>Name</Label><Input value={f.name} onChange={set("name")} /></div>
            <div><Label>Sex</Label><Select value={f.sex} onChange={set("sex")}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></div>
            <div><Label>Age</Label><Input type="number" value={f.age} onChange={set("age")} /></div>
            <div><Label>Body mass (kg)</Label><Input type="number" value={f.mass} onChange={set("mass")} /></div>
            <div><Label>Target event</Label>
              <Select value={f.event} onChange={(e) => setF({ ...f, event: e.target.value, dist: presets[e.target.value] ?? f.dist })}>
                {Object.keys(presets).map((k) => <option key={k}>{k}</option>)}
              </Select></div>
            <div><Label>Goal time (m:ss or h:mm:ss)</Label><Input placeholder="38:30" value={f.time} onChange={set("time")} /></div>
            <div><Label>Race date</Label><Input type="date" value={f.date} onChange={set("date")} /></div>
            <div className="sm:col-span-3"><Label>Goals in the athlete's words</Label><Input value={f.narrative} onChange={set("narrative")} /></div>
            {err && <Alert tone="danger" className="sm:col-span-3">{err}</Alert>}
            <div className="sm:col-span-3"><Button onClick={create} disabled={!f.name.trim()}>Create and start assessment</Button></div>
          </CardContent></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((a) => (
          <Link key={a.id} to={`/c/${a.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.name}</span>
                  {a.isSynthetic && <Badge variant="outline">synthetic</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">Added {fmtDate(a.createdAt)}</div>
                <div className="flex gap-1.5 pt-1">
                  <Badge variant={a.programStatus === "approved" ? "ok" : a.programStatus === "draft" ? "warn" : "default"}>
                    {a.programStatus === "approved" ? "Program approved" : a.programStatus === "draft" ? "Draft program" : "No program"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground">No athletes yet.</p>}
      </div>
      <button className="hidden" onClick={reload} />
    </div>
  );
}
