import type {
  FamilyMember,
  Household,
  NotificationItem,
  Payment,
  Purok,
  Role,
  SessionUser,
  TrashLog,
  Violation,
} from "./types";

export interface MonthlyCollectionStat {
  month: string;
  compliant: number;
  violations: number;
  missed: number;
}

export interface PaymentCollectionStat {
  month: string;
  collected: number;
  target: number | null;
}

export interface Account {
  id: number;
  username: string;
  name: string;
  email: string;
  role: Role;
  householdCode: string | null;
}

export interface PurokAccounts {
  leader: Account | null;
  residents: Account[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// All requests go to the same-origin /api prefix, which Next.js proxies to the
// Express backend (see next.config.ts). The httpOnly auth cookie rides along
// automatically, so there is no token to manage in JS.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 5xx with no JSON error usually means the request reached the Next proxy
    // but the Express backend wasn't running behind it.
    const message =
      body?.error ??
      (res.status >= 500
        ? "Can't reach the API server. Make sure the backend is running (in swms-backend: npm run dev)."
        : `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }
  return body as T;
}

const qs = (householdId?: string) =>
  householdId ? `?householdId=${encodeURIComponent(householdId)}` : "";

export const api = {
  // --- auth ---
  login: (username: string, password: string) =>
    request<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: SessionUser }>("/auth/me"),
  forgotPassword: (email: string) =>
    request<{ ok: true; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  // --- data (scoped server-side by the caller's role) ---
  puroks: () => request<Purok[]>("/puroks"),
  households: () => request<Household[]>("/households"),
  household: (id: string) => request<Household>(`/households/${id}`),
  trashLogs: (householdId?: string) => request<TrashLog[]>(`/trash-logs${qs(householdId)}`),
  payments: (householdId?: string) => request<Payment[]>(`/payments${qs(householdId)}`),
  currentPaymentPeriod: () => request<{ period: string }>("/payments/current-period"),
  violations: (householdId?: string) => request<Violation[]>(`/violations${qs(householdId)}`),
  notifications: () => request<NotificationItem[]>("/notifications"),
  markNotificationRead: (id: string) =>
    request<NotificationItem>(`/notifications/${id}/read`, { method: "PATCH" }),
  monthlyCollectionStats: () => request<MonthlyCollectionStat[]>("/stats/monthly-collection"),
  paymentCollectionStats: () => request<PaymentCollectionStat[]>("/stats/payment-collection"),

  createTrashLog: (input: {
    householdId: string;
    status: "compliant" | "violation" | "missed";
    disposedBy?: "owner" | "representative";
    notes?: string;
  }) =>
    request<TrashLog>("/trash-logs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // --- mutations ---
  createHousehold: (input: {
    representative: string;
    address: string;
    contactNumber: string;
    purokId?: string; // ignored for purok-leaders (forced to their own purok)
    members?: { name: string; relation: string; age: number }[];
    username: string;
    password: string;
    email: string;
  }) =>
    request<Household>("/households", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateHousehold: (
    id: string,
    input: { representative?: string; contactNumber?: string; address?: string; username?: string; email?: string },
  ) =>
    request<Household>(`/households/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  addFamilyMember: (householdId: string, input: { name: string; relation: string; age: number }) =>
    request<FamilyMember>(`/households/${householdId}/members`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  createPurok: (input: {
    name: string;
    leaderName: string;
    complianceRate?: number;
    username: string;
    password: string;
    email: string;
  }) =>
    request<Purok>("/puroks", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePurok: (
    id: string,
    input: { name?: string; leaderName?: string; username?: string; email?: string },
  ) =>
    request<Purok>(`/puroks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  purokAccounts: (id: string) => request<PurokAccounts>(`/puroks/${id}/accounts`),

  createPayment: (input: {
    householdId: string;
    period: string;
    amount: number;
    orNumber?: string;
    datePaid?: string;
  }) =>
    request<Payment>("/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  createNotification: (input: {
    type: "collection" | "payment" | "violation";
    message: string;
    title?: string;
    targetPurokId?: string;
  }) =>
    request<NotificationItem>("/notifications", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** Landing route for a given role. */
export const roleHome = (role: Role) => `/${role}`;
