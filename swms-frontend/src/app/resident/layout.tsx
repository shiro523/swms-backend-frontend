import { RoleShell } from "@/components/layout/RoleShell";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell role="resident">{children}</RoleShell>;
}
