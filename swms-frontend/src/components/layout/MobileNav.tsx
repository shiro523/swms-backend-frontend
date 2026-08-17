"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { LogOut, Recycle, X } from "lucide-react";
import { Role } from "@/lib/types";
import { NAV_BY_ROLE, ROLE_LABEL } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";

export function MobileNav({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const items = NAV_BY_ROLE[role];

  if (!open) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.replace("/login");
  };

  return (
    <div className="fixed inset-0 z-30 lg:hidden">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="absolute left-0 top-0 h-full w-72 bg-paper p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pine text-white">
              <Recycle size={16} />
            </span>
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold">
              Basura Watch
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-ink/50" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-0.5">
          {items.map((item) => {
            // Exclude the role root (e.g. /admin) from prefix matching, otherwise
            // the Dashboard link stays highlighted on every sub-page.
            const active =
              pathname === item.href ||
              (item.href !== `/${role}` && pathname.startsWith(item.href + "/"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium",
                  active ? "bg-pine-tint text-pine-dark" : "text-ink/60"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-4 bottom-4 border-t border-line pt-3">
          <p className="stamp px-3 pb-2 text-[10px] text-ink/40">{ROLE_LABEL[role]}</p>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink/60 transition-colors hover:bg-clay-tint hover:text-clay"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}
