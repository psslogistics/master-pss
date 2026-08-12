import type { AdminState } from "@/lib/admin-domain";
import { seedState } from "@/lib/admin-domain";

export interface AdminRepository {
  load(): AdminState;
  save(state: AdminState): void;
  reset(): AdminState;
}

const STORAGE_KEY = "pss_super_admin_demo_v1";

function cloneSeed(): AdminState {
  return JSON.parse(JSON.stringify(seedState)) as AdminState;
}

export const localAdminRepository: AdminRepository = {
  load() {
    try {
      const persisted = window.localStorage.getItem(STORAGE_KEY);
      return persisted ? (JSON.parse(persisted) as AdminState) : cloneSeed();
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
  create() {
    window.sessionStorage.setItem(this.key, JSON.stringify({ employeeId: "emp-admin", email: "admin@psslogistics.in", signedInAt: new Date().toISOString() }));
  },
  clear() {
    window.sessionStorage.removeItem(this.key);
  },
};
