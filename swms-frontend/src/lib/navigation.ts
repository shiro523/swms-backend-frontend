import {
  LayoutDashboard,
  MapPinned,
  Home,
  ScrollText,
  Wallet,
  AlertTriangle,
  FileBarChart,
  Bell,
  Settings,
  QrCode,
  UserRound,
  ScanLine,
} from "lucide-react";
import { Role } from "./types";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Puroks", href: "/admin/puroks", icon: MapPinned },
    { label: "Households", href: "/admin/households", icon: Home },
    { label: "Trash Logs", href: "/admin/trash-logs", icon: ScrollText },
    { label: "Payments", href: "/admin/payments", icon: Wallet },
    { label: "Violations", href: "/admin/violations", icon: AlertTriangle },
    { label: "Reports", href: "/admin/reports", icon: FileBarChart },
    { label: "Notifications", href: "/admin/notifications", icon: Bell },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
  "purok-leader": [
    { label: "Dashboard", href: "/purok-leader", icon: LayoutDashboard },
    { label: "Scan QR", href: "/purok-leader/scan", icon: ScanLine },
    { label: "Households", href: "/purok-leader/households", icon: Home },
    { label: "Payments", href: "/purok-leader/payments", icon: Wallet },
    { label: "Trash Logs", href: "/purok-leader/trash-logs", icon: ScrollText },
    { label: "Violations", href: "/purok-leader/violations", icon: AlertTriangle },
    { label: "Notifications", href: "/purok-leader/notifications", icon: Bell },
  ],
  resident: [
    { label: "Dashboard", href: "/resident", icon: LayoutDashboard },
    { label: "My QR Code", href: "/resident/qr-code", icon: QrCode },
    { label: "My Trash Logs", href: "/resident/trash-logs", icon: ScrollText },
    { label: "My Payments", href: "/resident/payments", icon: Wallet },
    { label: "Violations", href: "/resident/violations", icon: AlertTriangle },
    { label: "Notifications", href: "/resident/notifications", icon: Bell },
    { label: "Profile", href: "/resident/profile", icon: UserRound },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Barangay Admin",
  "purok-leader": "Purok Leader",
  resident: "Household Resident",
};
