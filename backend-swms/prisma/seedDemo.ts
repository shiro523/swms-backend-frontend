// Additive demo-data seed for defense/demo purposes. Unlike seed.ts and
// wipe.ts, this NEVER truncates or deletes anything — it only inserts a
// fixed set of new records (createMany + skipDuplicates), so it is safe to
// run against a database that already has real, hand-created data. Running
// it more than once does not create duplicates: every record uses a fixed,
// deterministic id and/or unique field, and skipDuplicates relies on the
// database's own unique constraints to skip anything already present.
//
// Dates are hardcoded (not computed relative to "now") so re-running this
// script always produces the exact same rows — required for idempotency.
// They're chosen to fall inside the Reports feature's rolling 6-month
// window as of when this was written (April-September 2026), which comfortably
// covers the October 2026 defense with margin.
//
// Usage: npm run db:seed:demo
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

// Separate, non-destructive safety gate — deliberately NOT the same env var
// as guardDestructiveOp.ts's ALLOW_DESTRUCTIVE_DB_OPS, since this script
// never deletes anything and conflating the two would be misleading. Still
// required so demo data can never be injected into a database "by accident"
// just because the command exists.
const REQUIRED_VALUE = "yes-seed-demo-data";
function assertDemoSeedAllowed(): void {
  if (process.env.ALLOW_DEMO_SEED === REQUIRED_VALUE) return;
  console.error(
    `\nRefusing to run "db:seed:demo": this adds demo households, residents, and activity to whatever database DATABASE_URL currently points to.\n\n` +
      `To run it on purpose (your local/demo database only), add this line to backend-swms/.env:\n\n` +
      `  ALLOW_DEMO_SEED=${REQUIRED_VALUE}\n\n` +
      `Then re-run the command. Do NOT set this in a production environment.\n`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

const firstNames = ["Liza", "Arnel", "Susan", "Wilfredo", "Corazon", "Bayani", "Divina", "Melchor", "Josefina", "Rogelio", "Perla", "Domingo"];
const lastNames = ["Alvarez", "Domingo", "Lim", "Ocampo", "Fernandez", "Bautista", "Salazar", "Navarro", "Ignacio", "Marquez"];
const pick = <T,>(arr: T[], seed: number) => arr[seed % arr.length];

const demoPuroks = [
  { id: "demo-purok-1", name: "Purok 3 - Bonifacio", leaderName: "Marites Ocampo" },
  { id: "demo-purok-2", name: "Purok 4 - Aguinaldo", leaderName: "Noel Fernandez" },
  { id: "demo-purok-3", name: "Purok 5 - Luna", leaderName: "Cristina Bautista" },
];

// Continues the real HH-100x numbering (current live data ends at HH-1005).
const demoHouseholds = Array.from({ length: 15 }).map((_, i) => {
  const purok = demoPuroks[i % demoPuroks.length];
  const rep = `${pick(firstNames, i)} ${pick(lastNames, i * 3 + 2)}`;
  const memberCount = 2 + (i % 3);
  return {
    id: `demo-hh-${i + 1}`,
    code: `HH-${1006 + i}`,
    representative: rep,
    address: `${20 + i} ${purok.name.split(" - ")[1]} St., ${purok.name.split(" - ")[0]}`,
    purokId: purok.id,
    contactNumber: `09${(180500000 + i * 743).toString().slice(0, 9)}`,
    registeredAt: `2026-${String(1 + (i % 3)).padStart(2, "0")}-${String(5 + (i % 20)).padStart(2, "0")}`,
    members: Array.from({ length: memberCount }).map((__, j) => ({
      id: `demo-hh-${i + 1}-m${j + 1}`,
      name: j === 0 ? rep : `${pick(firstNames, i + j + 6)} ${pick(lastNames, i * 3 + 2)}`,
      relation: j === 0 ? "House Representative" : ["Spouse", "Child", "Parent"][j % 3],
      age: 19 + ((i + j * 5) % 55),
    })),
  };
});

// One trash-log date per household per month across the 6-month reporting
// window, skipping one month here and there so "missed" collections are
// represented too (a missing date for a month = that household wasn't
// logged that month, which is what the real app would show as a gap).
const REPORT_WINDOW_MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const demoTrashLogs = demoHouseholds.flatMap((hh, i) => {
  return REPORT_WINDOW_MONTHS.map((yearMonth, m) => {
    // Status varies by household/month so both violations and missed
    // pickups (not just the row's absence) show up in the demo data.
    const day = 8 + ((i + m * 5) % 18);
    const roll = (i + m * 3) % 10;
    const status = roll < 7 ? "compliant" : roll < 9 ? "violation" : "missed";
    return {
      id: `demo-tl-${i + 1}-${m + 1}`,
      householdId: hh.id,
      date: `${yearMonth}-${String(day).padStart(2, "0")}`,
      time: (i + m) % 2 === 0 ? "06:10 AM" : "06:40 AM",
      collector: pick(["Jun Alvarez", "Bert Domingo", "Sarah Lim"], i + m),
      status,
      disposedBy: (i + m) % 3 === 0 ? "representative" : "owner",
      notes: status === "compliant" ? null : "Mixed biodegradable and recyclable waste.",
    };
  });
});

// Repeat/non-repeat is derived the same way the real app derives it: within
// each household's own violation-status logs in chronological order, the
// first is a fresh violation, every one after that is a repeat.
const demoViolations: { id: string; householdId: string; type: string; date: string; isRepeat: boolean; notes: string }[] = [];
for (const hh of demoHouseholds) {
  const hhViolationLogs = demoTrashLogs
    .filter((t) => t.householdId === hh.id && t.status === "violation")
    .sort((a, b) => a.date.localeCompare(b.date));
  hhViolationLogs.forEach((t, idx) => {
    const isRepeat = idx > 0;
    demoViolations.push({
      id: `demo-v-${t.id}`,
      householdId: hh.id,
      type: isRepeat ? "Repeat Violation" : "Improper Segregation",
      date: t.date,
      isRepeat,
      notes: t.notes ?? "Violation recorded during scheduled collection.",
    });
  });
}

// Each household pays a subset of the three periods below, leaving some
// gaps so both "paid" and "unpaid" households/periods show up.
const PAYMENT_PERIODS = ["April 2026", "June 2026", "August 2026"];
const demoPayments = demoHouseholds.flatMap((hh, i) => {
  return PAYMENT_PERIODS.filter((_, p) => (i + p) % 3 !== 0).map((period, p) => ({
    id: `demo-pay-${i + 1}-${p + 1}`,
    householdId: hh.id,
    period,
    amount: 75,
    datePaid: `2026-${String(4 + PAYMENT_PERIODS.indexOf(period) * 2).padStart(2, "0")}-${String(10 + (i % 15)).padStart(2, "0")}`,
    orNumber: `OR-2026-${String(5000 + i * 3 + p)}`,
  }));
});

const demoNotifications = [
  { id: "demo-n-1", title: "Collection Schedule", message: "Waste collection for Purok 3-5 is scheduled every first Monday of the month, 6:00 AM.", type: "collection", date: "2026-09-01", read: false, targetPurokId: null as string | null },
  { id: "demo-n-2", title: "Payment Due Reminder", message: "August 2026 waste collection fees (₱75.00) are now due.", type: "payment", date: "2026-08-20", read: false, targetPurokId: null },
  { id: "demo-n-3", title: "Violation Notice", message: "Repeated improper segregation has been recorded for some households this quarter.", type: "violation", date: "2026-07-15", read: true, targetPurokId: "demo-purok-1" },
  { id: "demo-n-4", title: "Collection Schedule", message: "Purok 4 (Aguinaldo) collection moved to 6:30 AM starting this month.", type: "collection", date: "2026-06-02", read: true, targetPurokId: "demo-purok-2" },
  { id: "demo-n-5", title: "Payment Due Reminder", message: "June 2026 fees are due for Purok 5 (Luna) households.", type: "payment", date: "2026-06-10", read: true, targetPurokId: "demo-purok-3" },
];

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

async function seedDemo() {
  assertDemoSeedAllowed();

  await prisma.$transaction(
    async (tx) => {
      const purokResult = await tx.purok.createMany({
        data: demoPuroks.map((p) => ({ id: p.id, name: p.name, leaderName: p.leaderName, complianceRate: 100 })),
        skipDuplicates: true,
      });

      const householdResult = await tx.household.createMany({
        data: demoHouseholds.map((h) => ({
          id: h.id,
          code: h.code,
          representative: h.representative,
          address: h.address,
          purokId: h.purokId,
          contactNumber: h.contactNumber,
          registeredAt: new Date(h.registeredAt),
          paymentStatus: "unpaid", // corrected below once payments are inserted
          complianceRate: 100, // corrected below once trash logs are inserted
        })),
        skipDuplicates: true,
      });

      const memberResult = await tx.familyMember.createMany({
        data: demoHouseholds.flatMap((h) =>
          h.members.map((m) => ({ id: m.id, householdId: h.id, name: m.name, relation: m.relation, age: m.age })),
        ),
        skipDuplicates: true,
      });

      const trashLogResult = await tx.trashLog.createMany({
        data: demoTrashLogs.map((t) => ({
          id: t.id,
          householdId: t.householdId,
          logDate: new Date(t.date),
          logTime: t.time,
          collector: t.collector,
          status: t.status,
          disposedBy: t.disposedBy,
          notes: t.notes,
        })),
        skipDuplicates: true,
      });

      const violationResult = await tx.violation.createMany({
        data: demoViolations.map((v) => ({
          id: v.id,
          householdId: v.householdId,
          type: v.type,
          vDate: new Date(v.date),
          isRepeat: v.isRepeat,
          notes: v.notes,
        })),
        skipDuplicates: true,
      });

      const paymentResult = await tx.payment.createMany({
        data: demoPayments.map((p) => ({
          id: p.id,
          householdId: p.householdId,
          period: p.period,
          amount: p.amount,
          status: "paid",
          datePaid: new Date(p.datePaid),
          orNumber: p.orNumber, // already trimmed/uppercase, matching Batch 3 C5 normalization
        })),
        skipDuplicates: true,
      });

      const notificationResult = await tx.notification.createMany({
        data: demoNotifications.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          nDate: new Date(n.date),
          isRead: n.read,
          targetPurokId: n.targetPurokId,
        })),
        skipDuplicates: true,
      });

      // Recompute compliance the same way trashLogRepository.createWithViolation
      // does for a real submission, so demo households aren't stuck at the 100
      // placeholder above regardless of their actual demo trash-log history.
      for (const hh of demoHouseholds) {
        const [totalLogs, compliantLogs] = await Promise.all([
          tx.trashLog.count({ where: { householdId: hh.id } }),
          tx.trashLog.count({ where: { householdId: hh.id, status: "compliant" } }),
        ]);
        const complianceRate = totalLogs > 0 ? Math.round((compliantLogs / totalLogs) * 100) : 100;
        const hasPayment = await tx.payment.count({ where: { householdId: hh.id } });
        await tx.household.update({
          where: { id: hh.id },
          data: { complianceRate, paymentStatus: hasPayment > 0 ? "paid" : "unpaid" },
        });
      }

      for (const purok of demoPuroks) {
        const avg = await tx.household.aggregate({ where: { purokId: purok.id }, _avg: { complianceRate: true } });
        await tx.purok.update({ where: { id: purok.id }, data: { complianceRate: Math.round(avg._avg.complianceRate ?? 100) } });
      }

      // --- Login accounts ----------------------------------------------------
      const demoPasswordHash = await bcrypt.hash("Demo12345!", 10);
      const leaderUsers = demoPuroks.map((p, i) => ({
        username: `demoleader${i + 1}`,
        email: `demoleader${i + 1}@example.com`,
        passwordHash: demoPasswordHash,
        role: "purok-leader",
        name: p.leaderName,
        purokId: p.id,
      }));
      const residentUsers = demoHouseholds.map((h, i) => ({
        username: `demoresident${i + 1}`,
        email: `demoresident${i + 1}@example.com`,
        passwordHash: demoPasswordHash,
        role: "resident",
        name: h.representative,
        householdId: h.id,
      }));

      // createMany requires uniform shape per call; leaders and residents use
      // different optional FKs, so two calls (still one transaction, still
      // skipDuplicates-safe on username/email).
      const leaderResult = await tx.user.createMany({ data: leaderUsers, skipDuplicates: true });
      const residentResult = await tx.user.createMany({ data: residentUsers, skipDuplicates: true });

      console.log("Demo seed complete. Rows inserted this run (0 on a repeat run means already present):");
      console.log({
        puroks: purokResult.count,
        households: householdResult.count,
        familyMembers: memberResult.count,
        trashLogs: trashLogResult.count,
        violations: violationResult.count,
        payments: paymentResult.count,
        notifications: notificationResult.count,
        leaderUsers: leaderResult.count,
        residentUsers: residentResult.count,
      });
      console.log("\nDemo logins (username / password):");
      leaderUsers.forEach((u) => console.log(`  ${u.username} / Demo12345!  (purok-leader, ${u.name})`));
      console.log(`  demoresident1..${residentUsers.length} / Demo12345!  (resident, one per demo household)`);
    },
    { timeout: 60000 },
  );
}

seedDemo()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Demo seed failed:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
