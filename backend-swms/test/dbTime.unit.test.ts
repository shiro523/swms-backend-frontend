// Pure-function regression coverage for the UTC->Philippines calendar-day
// bug: the database connection's session timezone is GMT, so a trash log,
// violation, payment, or household registration recorded between midnight
// and 8 AM Philippines time was being stored under the previous calendar
// day, and the TrashLog (household_id, log_date) daily-duplicate check is
// keyed on that same wrong date. No database connection needed — this
// exercises the conversion math directly against fixed instants.
import { describe, expect, it } from "vitest";
import { toPhilippinesCalendarDay, toPhilippinesTime12h } from "@/lib/dbTime";

describe("Philippines local time conversion", () => {
  it("an evening UTC instant that is already the next Philippines day returns that next day, not the UTC day", () => {
    // 2026-09-30 17:30 UTC = 2026-10-01 01:30 AM Philippines time.
    const instant = new Date("2026-09-30T17:30:00.000Z");
    const day = toPhilippinesCalendarDay(instant);
    expect(day.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(toPhilippinesTime12h(instant)).toBe("01:30 AM");
  });

  it("exactly at the UTC midnight rollover (8:00 AM Philippines time) still resolves to the correct Philippines day", () => {
    // 2026-10-01 00:00 UTC = 2026-10-01 08:00 AM Philippines time — the
    // boundary where CURRENT_DATE/UTC-day and the Philippines day happen
    // to already agree, included so the boundary itself is covered.
    const instant = new Date("2026-10-01T00:00:00.000Z");
    const day = toPhilippinesCalendarDay(instant);
    expect(day.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(toPhilippinesTime12h(instant)).toBe("08:00 AM");
  });

  it("a midday UTC instant (well outside the rollover window) still resolves correctly", () => {
    // 2026-10-01 05:00 UTC = 2026-10-01 01:00 PM Philippines time.
    const instant = new Date("2026-10-01T05:00:00.000Z");
    const day = toPhilippinesCalendarDay(instant);
    expect(day.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(toPhilippinesTime12h(instant)).toBe("01:00 PM");
  });

  it("just before the UTC midnight rollover, the Philippines day has already advanced", () => {
    // 2026-09-30 23:59 UTC = 2026-10-01 07:59 AM Philippines time — the
    // last minute of the 8-hour window this bug affected.
    const instant = new Date("2026-09-30T23:59:00.000Z");
    const day = toPhilippinesCalendarDay(instant);
    expect(day.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(toPhilippinesTime12h(instant)).toBe("07:59 AM");
  });
});
