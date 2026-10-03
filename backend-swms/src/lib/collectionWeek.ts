// Weekly collection schedule. Trash is collected once a week, on the day
// configured in Admin Settings (SystemSettings.collectionDays, e.g. "Sunday").
// A "collection week" is the 7 days starting on that day, so a late pickup a
// few days afterwards still counts toward that week's collection.
//
// Every Date here is a calendar day as returned by getDbToday(): Philippines
// local date, stored at UTC midnight. All arithmetic is in UTC to match.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_COLLECTION_WEEKDAY = 0; // Sunday

// The first weekday named in the free-text setting ("Sunday", "every sun",
// "Sun 6AM"...). Falls back to Sunday when none is recognizable.
export function parseCollectionWeekday(collectionDays: string | null | undefined): number {
  const text = (collectionDays ?? "").toLowerCase();
  let bestIndex = Infinity;
  let bestWeekday = DEFAULT_COLLECTION_WEEKDAY;
  for (let weekday = 0; weekday < WEEKDAYS.length; weekday++) {
    const match = text.match(new RegExp(`\\b${WEEKDAYS[weekday].slice(0, 3)}`));
    if (match?.index !== undefined && match.index < bestIndex) {
      bestIndex = match.index;
      bestWeekday = weekday;
    }
  }
  return bestWeekday;
}

export function weekdayName(weekday: number): string {
  const name = WEEKDAYS[weekday];
  return name[0].toUpperCase() + name.slice(1);
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * DAY_MS);
}

// The collection day that starts the week `day` falls in: the most recent
// date on or before `day` that is the collection weekday.
export function collectionWeekStart(day: Date, collectionWeekday: number): Date {
  const back = (day.getUTCDay() - collectionWeekday + 7) % 7;
  return addDays(day, -back);
}

export function toIsoDate(day: Date): string {
  return day.toISOString().slice(0, 10);
}
