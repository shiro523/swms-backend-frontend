export type Role = "admin" | "purok-leader" | "resident";

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
  name: string;
  email?: string | null;
  householdId: string | null;
  purokId: string | null;
}

export type ComplianceStatus = "compliant" | "violation" | "missed";
export type PaymentStatus = "paid" | "unpaid";
export type ViolationType =
  | "Improper Segregation"
  | "Missed Collection"
  | "Repeat Violation";

export interface Purok {
  id: string;
  name: string;
  leader: string;
  households: number;
  complianceRate: number;
  // ISO timestamp, or null if active. Display/countdown only — the real
  // restore/delete eligibility is always re-checked server-side.
  archivedAt: string | null;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: number;
}

export interface Household {
  id: string;
  code: string; // e.g. HH-0142
  representative: string;
  address: string;
  purokId: string;
  purokName: string;
  contactNumber: string;
  members: FamilyMember[];
  registeredAt: string;
  paymentStatus: PaymentStatus;
  complianceRate: number;
  username: string | null;
  email: string | null;
  // The resident login account's own creation date, or null if the
  // household has no resident account (shouldn't normally happen, but
  // mirrors username/email's own null-safety above).
  accountCreatedAt: string | null;
  // Soft-removal (e.g. resident permanently left the barangay). Non-null
  // means the household is inactive: hidden from active lists, blocked from
  // new TrashLogs, and the resident account can no longer log in. All
  // historical records stay intact and visible to Admin regardless.
  removedAt: string | null;
  removalReason: string | null;
  removedByName: string | null;
}

export interface TrashLog {
  id: string;
  householdId: string;
  householdCode: string;
  representative: string;
  purokName: string;
  date: string;
  time: string;
  collector: string;
  status: ComplianceStatus;
  disposedBy: "owner" | "representative";
  notes?: string;
}

export type ViolationStatus = "active" | "completed";

export interface Violation {
  id: string;
  householdId: string;
  householdCode: string;
  representative: string;
  purokName: string;
  type: ViolationType;
  date: string;
  isRepeat: boolean;
  notes: string;
  status: ViolationStatus;
  resolvedAt: string | null;
  resolvedByName: string | null;
}

export interface Payment {
  id: string;
  householdId: string;
  householdCode: string;
  representative: string;
  purokName: string;
  period: string; // e.g. "July 2026"
  amount: number;
  status: PaymentStatus;
  datePaid?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "collection" | "payment" | "violation";
  date: string;
  read: boolean;
  targetPurokName: string | null;
  targetHouseholdCode: string | null;
}

export interface SystemSettings {
  barangayName: string;
  municipality: string;
  contactNumber: string;
  monthlyCollectionFee: number;
  collectionDays: string;
  collectionTime: string;
  updatedAt: string;
}
