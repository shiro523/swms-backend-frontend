"use client";

import { ReactNode } from "react";
import { Role } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function fallbackUserName(role: Role) {
  switch (role) {
    case "admin":
      return "Barangay Admin";
    case "purok-leader":
      // Was a hardcoded real person's name from old seed data — a signed-in
      // leader could briefly see someone else's name while /api/auth/me is
      // still loading. Neutral placeholder instead.
      return "Loading…";
    default:
      return "Household Resident";
  }
}

export function RoleShell({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  const effectiveUser = user ?? { role, name: fallbackUserName(role) };

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar role={role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar role={role} userName={effectiveUser.name} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
