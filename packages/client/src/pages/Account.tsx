import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Activity } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { homeFor, useAuth, type User } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";

function Shell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-sm px-4 sm:mt-24">
      <div className="mb-4 flex items-center gap-2 font-semibold"><Activity className="h-5 w-5 text-primary" /> TPC Performance OS</div>
      <Card><CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
        <CardContent className="space-y-3">{children}</CardContent></Card>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user)} replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const u = await login(email, password); nav(homeFor(u), { replace: true }); } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <Shell title="Sign in" description="Clinicians and athletes use the same sign-in.">
      <form onSubmit={submit} className="space-y-3">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <Alert tone="danger">{err}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>Sign in</Button>
      </form>
    </Shell>
  );
}

export function InvitePage() {
  const { token } = useParams();
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  useEffect(() => { api<{ athleteName: string }>(`/invites/${token}`).then((r) => setName(r.athleteName)).catch((e) => setErr(e.message)); }, [token]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (pw !== pw2) return setErr("Passwords do not match.");
    try { const u = await api<User>(`/invites/${token}/accept`, { method: "POST", body: { email, password: pw } }); setUser(u); nav("/me", { replace: true }); }
    catch (x) { setErr((x as Error).message); }
  }
  if (!name) return <Shell title="Join TPC Performance">{err ? <Alert tone="danger">{err}</Alert> : <p className="text-sm text-muted-foreground">Checking your invite...</p>}</Shell>;
  return (
    <Shell title={`Welcome, ${name}`} description="Create your account to see your program and log your training.">
      <form onSubmit={submit} className="space-y-3">
        <div><Label htmlFor="e">Email</Label><Input id="e" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="p1">Password (10+ characters)</Label><Input id="p1" type="password" autoComplete="new-password" required minLength={10} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><Label htmlFor="p2">Repeat password</Label><Input id="p2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        {err && <Alert tone="danger">{err}</Alert>}
        <Button type="submit" className="w-full">Create account</Button>
      </form>
    </Shell>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await api("/auth/change-password", { method: "POST", body: { current, next } }); setMsg({ tone: "ok", text: "Password changed. Other devices were signed out." }); setCurrent(""); setNext(""); }
    catch (x) { setMsg({ tone: "danger", text: (x as Error).message }); }
  }
  return (
    <Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent><form onSubmit={submit} className="grid max-w-sm gap-3">
        <div><Label>Current password</Label><Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div><Label>New password (10+ characters)</Label><Input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} /></div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit">Change password</Button>
      </form></CardContent></Card>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const { data, reload } = useApi<any[]>("/admin/users");
  const [f, setF] = useState({ name: "", email: "", role: "clinician", password: "" });
  const [err, setErr] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await api("/admin/users", { method: "POST", body: f }); setF({ name: "", email: "", role: "clinician", password: "" }); reload(); } catch (x) { setErr((x as Error).message); }
  }
  async function patch(id: string, body: object) { setErr(""); try { await api(`/admin/users/${id}`, { method: "PATCH", body }); reload(); } catch (x) { setErr((x as Error).message); } }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Team accounts</h1>
      <Card><CardHeader><CardTitle>Add clinician</CardTitle><CardDescription>Share the temporary password securely; they can change it under Account.</CardDescription></CardHeader>
        <CardContent><form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><Label>Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Role</Label><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="clinician">Clinician</option><option value="admin">Admin</option></Select></div>
          <div><Label>Temporary password</Label><Input type="password" required minLength={10} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="flex items-end"><Button type="submit">Add</Button></div>
        </form>{err && <Alert tone="danger" className="mt-3">{err}</Alert>}</CardContent></Card>
      <Card><CardContent className="space-y-2 pt-4">
        {data?.filter((u) => u.role !== "athlete").map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-0">
            <b>{u.name}</b><span className="text-muted-foreground">{u.email}</span><Badge variant="outline">{u.role}</Badge>
            {u.disabled && <Badge variant="danger">disabled</Badge>}
            <span className="text-xs text-muted-foreground">last login {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "never"}</span>
            {u.id !== user?.id && (
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => patch(u.id, { disabled: !u.disabled })}>{u.disabled ? "Enable" : "Disable"}</Button>
                <Button size="sm" variant="outline" onClick={() => { const p = prompt("New temporary password (10+ characters)"); if (p) void patch(u.id, { password: p }); }}>Reset password</Button>
              </span>
            )}
          </div>
        ))}
      </CardContent></Card>
      <ChangePassword />
    </div>
  );
}
