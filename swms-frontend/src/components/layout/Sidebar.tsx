"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { LogOut, Recycle } from "lucide-react";
import { Role } from "@/lib/types";
import { NAV_BY_ROLE, ROLE_LABEL } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const items = NAV_BY_ROLE[role];

  return (
    <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-paper lg:flex">
      <div className="flex items-center gap-2.5 border-b border-line px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-white">
          <Recycle size={18} strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold leading-tight text-ink">
            Basura Watch
          </p>
          <p className="stamp text-[10px] text-ink/45">Smart Waste Mgmt.</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== `/${role}` && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-pine-tint text-pine-dark"
                  : "text-ink/60 hover:bg-panel hover:text-ink"
              )}
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-3 py-4">
        <p className="stamp px-3 pb-2 text-[10px] text-ink/40">
          {ROLE_LABEL[role]}
        </p>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink/60 transition-colors hover:bg-clay-tint hover:text-clay"
        >
          <LogOut size={17} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
