"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { MobileNav } from "./MobileNav";
import { NOTIFICATIONS_READ_EVENT } from "@/components/notifications/NotificationList";

export function Topbar({ role, userName }: { role: Role; userName: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Re-fetches on every route change — the server is authoritative for
  // unread state (Batch E), so navigating away from the notifications page
  // after reading something is enough to keep this in sync, with no polling.
  const unread = useApi(() => api.unreadNotificationCount(), [pathname]);
  const hasUnread = (unread.data?.count ?? 0) > 0;

  // Also refresh as soon as a notification is opened/read on this page.
  const reloadUnread = unread.reload;
  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_READ_EVENT, reloadUnread);
    return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, reloadUnread);
  }, [reloadUnread]);

  const displayName = user?.name ?? userName;

  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  };

  return (
    <>
      <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg border border-line bg-paper p-2 text-ink/60 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <p className="hidden text-sm font-medium text-ink/70 sm:block">{ROLE_LABEL[role]}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${role}/notifications`}
            className="relative rounded-lg border border-line bg-paper p-2 text-ink/60 hover:border-pine/40 hover:text-pine-dark"
            aria-label="Notifications"
          >
            <Bell size={17} />
            {hasUnread && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-clay" />}
          </Link>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1.5 hover:bg-panel/60"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine-dark text-[11px] font-semibold text-white">
                {initials}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-left text-[13px] font-medium text-ink">{displayName}</p>
                <p className="text-left text-[11px] text-ink/45">{ROLE_LABEL[role]}</p>
              </div>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-paper shadow-lg">
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-sm font-semibold text-ink">{displayName}</p>
                    <p className="text-xs text-ink/50">{ROLE_LABEL[role]}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-ink/70 transition-colors hover:bg-clay-tint hover:text-clay"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <MobileNav role={role} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
