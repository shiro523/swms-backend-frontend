// Seeds the database with sample data mirroring swms-backend's seed set, plus
// login accounts for every role. Usage: npm run db:seed
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDestructiveOpsAllowed } from "./guardDestructiveOp";

// ---------------------------------------------------------------------------
// Data generators (ported from swms-backend/scripts/seed.js so the seeded app
// looks identical to the old backend's demo dataset).
// ---------------------------------------------------------------------------

const purokRows = [
  { id: "p1", name: "Purok 1 - Mabini", leader: "Rosario Dizon", complianceRate: 91 },
  { id: "p2", name: "Purok 2 - Rizal", leader: "Edgar Villanueva", complianceRate: 84 },
  { id: "p3", name: "Purok 3 - Bonifacio", leader: "Marites Ocampo", complianceRate: 78 },
  { id: "p4", name: "Purok 4 - Aguinaldo", leader: "Noel Fernandez", complianceRate: 88 },
  { id: "p5", name: "Purok 5 - Luna", leader: "Cristina Bautista", complianceRate: 95 },
];

const firstNames = [
  "Maria", "Jose", "Ana", "Pedro", "Luz", "Ramon", "Carmen", "Antonio",
  "Elena", "Ricardo", "Rosa", "Manuel", "Teresa", "Fernando", "Grace",
  "Danilo", "Nenita", "Ferdinand", "Vilma", "Roberto",
];
const lastNames = [
  "Santos", "Reyes", "Cruz", "Bautista", "Gonzales", "Ramos", "Mendoza",
  "Torres", "Flores", "Villanueva", "Castro", "Aquino", "Del Rosario",
  "Garcia", "Pascual",
];

const pick = <T,>(arr: T[], seed: number) => arr[seed % arr.length];

const households = Array.from({ length: 40 }).map((_, i) => {
  const purok = purokRows[i % purokRows.length];
  const rep = `${pick(firstNames, i)} ${pick(lastNames, i * 3 + 1)}`;
  const memberCount = 2 + (i % 4);
  return {
    id: `hh${i + 1}`,
    code: `HH-${String(1000 + i)}`,
    representative: rep,
    address: `${12 + i} ${purok.name.split(" - ")[1]} St., ${purok.name.split(" - ")[0]}`,
    purokId: purok.id,
    contactNumber: `09${(170000000 + i * 913).toString().slice(0, 9)}`,
    members: Array.from({ length: memberCount }).map((__, j) => ({
      id: `hh${i + 1}-m${j + 1}`,
      name: j === 0 ? rep : `${pick(firstNames, i + j + 5)} ${pick(lastNames, i * 3 + 1)}`,
      relation: j === 0 ? "House Representative" : ["Spouse", "Child", "Child", "Parent"][j % 4],
      age: 18 + ((i + j * 7) % 50),
    })),
    registeredAt: `2025-${String(1 + (i % 12)).padStart(2, "0")}-1${i % 9}`,
    paymentStatus: i % 5 === 0 || i % 7 === 0 ? "unpaid" : "paid",
    complianceRate: 60 + ((i * 7) % 40),
  };
});

const trashLogs = Array.from({ length: 60 }).map((_, i) => {
  const hh = households[i % households.length];
  const day = 1 + (i % 28);
  const statusRoll = i % 10;
  return {
    id: `tl${i + 1}`,
    householdId: hh.id,
    date: `2026-07-${String(day).padStart(2, "0")}`,
    time: i % 2 === 0 ? "06:15 AM" : "06:45 AM",
    collector: pick(["Jun Alvarez", "Bert Domingo", "Sarah Lim"], i),
    status: statusRoll < 7 ? "compliant" : statusRoll < 9 ? "violation" : "missed",
    disposedBy: i % 4 === 0 ? "representative" : "owner",
    notes: statusRoll < 7 ? null : "Mixed biodegradable and recyclable waste.",
  };
});

const violations = trashLogs
  .filter((t) => t.status === "violation")
  .map((t, i) => ({
    id: `v${i + 1}`,
    householdId: t.householdId,
    type: i % 5 === 0 ? "Repeat Violation" : i % 2 === 0 ? "Improper Segregation" : "Missed Collection",
    date: t.date,
    isRepeat: i % 5 === 0,
    notes: t.notes ?? "Violation recorded during scheduled collection.",
  }));

const payments = households.map((hh, i) => ({
  id: `pay${i + 1}`,
  householdId: hh.id,
  period: "July 2026",
  amount: 75,
  status: hh.paymentStatus,
  datePaid: hh.paymentStatus === "paid" ? `2026-07-0${1 + (i % 9)}` : null,
}));

// Barangay-wide (no targetPurokId/targetHouseholdId) — visible to every
// role. Read state is per-user (NotificationRead), not seeded here, so
// every seeded notification starts unread for every account, matching the
// schema's actual default (no NotificationRead row = unread).
const notifications = [
  { id: "n1", title: "Collection Schedule", message: "Waste collection for Purok 1–3 is scheduled tomorrow, 6:00 AM.", type: "collection", date: "2026-07-09" },
  { id: "n2", title: "Payment Due Reminder", message: "Your July 2026 waste collection fee (₱75.00) is due on July 15.", type: "payment", date: "2026-07-08" },
  { id: "n3", title: "Violation Recorded", message: "Improper segregation was recorded during your last collection.", type: "violation", date: "2026-07-06" },
  { id: "n4", title: "Collection Schedule", message: "Waste collection for Purok 4–5 is scheduled July 11, 6:00 AM.", type: "collection", date: "2026-07-05" },
];

const monthlyCollectionStats = [
  { month: "Feb", compliant: 210, violations: 34, missed: 12 },
  { month: "Mar", compliant: 228, violations: 29, missed: 10 },
  { month: "Apr", compliant: 219, violations: 41, missed: 15 },
  { month: "May", compliant: 241, violations: 22, missed: 8 },
  { month: "Jun", compliant: 255, violations: 18, missed: 6 },
  { month: "Jul", compliant: 262, violations: 15, missed: 5 },
];

const paymentCollectionStats = [
  { month: "Feb", collected: 14250, target: 17400 },
  { month: "Mar", collected: 15600, target: 17700 },
  { month: "Apr", collected: 15975, target: 18000 },
  { month: "May", collected: 16800, target: 18150 },
  { month: "Jun", collected: 17325, target: 18300 },
  { month: "Jul", collected: 12900, target: 18450 },
];

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

async function seed() {
  assertDestructiveOpsAllowed("db:seed");

  await prisma.$transaction(
    async (tx) => {
      // Wipe existing data (children first) so re-seeding is idempotent.
      await tx.$executeRawUnsafe(
        `TRUNCATE users, family_members, trash_logs, violations, payments, notifications, monthly_collection_stats, payment_collection_stats, households, puroks RESTART IDENTITY CASCADE`,
      );

      await tx.purok.createMany({
        data: purokRows.map((p) => ({ id: p.id, name: p.name, leaderName: p.leader, complianceRate: p.complianceRate })),
      });

      await tx.household.createMany({
        data: households.map((h) => ({
          id: h.id,
          code: h.code,
          representative: h.representative,
          address: h.address,
          purokId: h.purokId,
          contactNumber: h.contactNumber,
          registeredAt: new Date(h.registeredAt),
          paymentStatus: h.paymentStatus,
          complianceRate: h.complianceRate,
        })),
      });

      await tx.familyMember.createMany({
        data: households.flatMap((h) =>
          h.members.map((m) => ({ id: m.id, householdId: h.id, name: m.name, relation: m.relation, age: m.age })),
        ),
      });

      await tx.trashLog.createMany({
        data: trashLogs.map((t) => ({
          id: t.id,
          householdId: t.householdId,
          logDate: new Date(t.date),
          logTime: t.time,
          collector: t.collector,
          status: t.status,
          disposedBy: t.disposedBy,
          notes: t.notes,
        })),
      });

      await tx.violation.createMany({
        data: violations.map((v) => ({
          id: v.id,
          householdId: v.householdId,
          type: v.type,
          vDate: new Date(v.date),
          isRepeat: v.isRepeat,
          notes: v.notes,
        })),
      });

      await tx.payment.createMany({
        data: payments.map((p) => ({
          id: p.id,
          householdId: p.householdId,
          period: p.period,
          amount: p.amount,
          status: p.status,
          datePaid: p.datePaid ? new Date(p.datePaid) : null,
        })),
      });

      await tx.notification.createMany({
        data: notifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          nDate: new Date(n.date),
        })),
      });

      await tx.monthlyCollectionStat.createMany({
        data: monthlyCollectionStats.map((s, i) => ({ ord: i, month: s.month, compliant: s.compliant, violations: s.violations, missed: s.missed })),
      });

      await tx.paymentCollectionStat.createMany({
        data: paymentCollectionStats.map((s, i) => ({ ord: i, month: s.month, collected: s.collected, target: s.target })),
      });

      // --- User accounts ---------------------------------------------------
      // Just the three real test accounts requested — no generic/numbered
      // demo accounts. Gmail plus-addressing (jemarleeamoin+role@gmail.com)
      // lets all three share one real inbox while staying unique in the DB.
      const demoHousehold = households[3];
      const sharedPasswordHash = await bcrypt.hash("12345678", 10);

      const users = [
        {
          username: "reyinoc",
          email: "jemarleeamoin+admin@gmail.com",
          passwordHash: sharedPasswordHash,
          role: "admin",
          name: "Rey Inoc",
          householdId: null,
          purokId: null,
        },
        {
          username: "crisler",
          email: "jemarleeamoin+leader@gmail.com",
          passwordHash: sharedPasswordHash,
          role: "purok-leader",
          name: "Crisler",
          householdId: null,
          purokId: purokRows[0].id,
        },
        {
          username: "jemarlee",
          email: "jemarleeamoin+resident@gmail.com",
          passwordHash: sharedPasswordHash,
          role: "resident",
          name: demoHousehold.representative,
          householdId: demoHousehold.id,
          purokId: null,
        },
      ];

      await tx.user.createMany({ data: users });

      console.log("Seed complete.");
      console.log("Test logins (username / password / email):");
      console.log("  reyinoc  / 12345678 / jemarleeamoin+admin@gmail.com     (admin)");
      console.log("  crisler  / 12345678 / jemarleeamoin+leader@gmail.com    (purok-leader, Purok 1 - Mabini)");
      console.log(`  jemarlee / 12345678 / jemarleeamoin+resident@gmail.com  (resident, ${demoHousehold.code} — ${demoHousehold.representative})`);
    },
    { timeout: 30000 },
  );
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Seeding failed:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
