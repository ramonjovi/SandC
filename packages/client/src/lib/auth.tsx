import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "./api";

export interface User { id: string; email: string; name: string; role: "admin" | "clinician" | "athlete"; athleteId: string | null }
interface AuthCtx { user: User | null; ready: boolean; login: (email: string, password: string) => Promise<User>; logout: () => Promise<void>; setUser: (u: User | null) => void }

const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error("AuthProvider missing"); return c; };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { api<User | null>("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setReady(true)); }, []);
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("tpc:unauthorized", onUnauthorized);
    return () => window.removeEventListener("tpc:unauthorized", onUnauthorized);
  }, []);
  const login = useCallback(async (email: string, password: string) => {
    const u = await api<User>("/auth/login", { method: "POST", body: { email, password } });
    setUser(u); return u;
  }, []);
  const logout = useCallback(async () => { await api("/auth/logout", { method: "POST" }).catch(() => undefined); setUser(null); }, []);
  return <Ctx.Provider value={{ user, ready, login, logout, setUser }}>{children}</Ctx.Provider>;
}

export const homeFor = (u: User) => (u.role === "athlete" ? "/me" : "/");

/** Route guard: requires sign-in (and optionally specific roles). */
export function RequireRole({ roles, children }: { roles: Array<User["role"]>; children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}
