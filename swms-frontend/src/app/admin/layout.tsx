import { RoleShell } from "@/components/layout/RoleShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="admin">{children}</RoleShell>;
}
