"use client";

import { createContext, useContext } from "react";

const SuperAdminContext = createContext(false);

export function SuperAdminProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  return <SuperAdminContext.Provider value={enabled}>{children}</SuperAdminContext.Provider>;
}

export function useIsSuperAdmin() {
  return useContext(SuperAdminContext);
}
