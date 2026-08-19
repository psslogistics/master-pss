import type { AdminState } from "@/lib/admin-domain";
import { seedState } from "@/lib/admin-domain";
import type { AuthIdentity } from "@/lib/auth-identity";

export interface AdminRepository {
  load(): AdminState;
  save(state: AdminState): void;
  reset(): AdminState;
}

const STORAGE_KEY = "pss_super_admin_demo_v2";

function cloneSeed(): AdminState {
  return JSON.parse(JSON.stringify(seedState)) as AdminState;
}

function isValidState(value: unknown): value is AdminState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<AdminState>;
  return Array.isArray(state.employees) && Array.isArray(state.roles) && Array.isArray(state.clients) && Array.isArray(state.auditEvents) && Boolean(state.workspace && typeof state.workspace === "object");
}

export const localAdminRepository: AdminRepository = {
  load() {
    try {
      const persisted = window.localStorage.getItem(STORAGE_KEY);
      if (!persisted) return cloneSeed();
      const parsed: unknown = JSON.parse(persisted);
      return isValidState(parsed) ? parsed : cloneSeed();
    } catch {
      return cloneSeed();
    }
  },
  save(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  reset() {
    const state = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  },
};

export const demoSessionStorage = {
  key: "pss_super_admin_demo_session_v1",
  load() {
    return window.sessionStorage.getItem(this.key);
  },
  create(identity?: AuthIdentity) {
    window.sessionStorage.setItem(this.key, JSON.stringify({ employeeId: "emp-admin", email: identity?.email ?? "admin@psslogistics.in", username: identity?.username ?? "admin", signedInAt: identity?.signedInAt ?? new Date().toISOString() }));
  },
  clear() {
    window.sessionStorage.removeItem(this.key);
  },
};
