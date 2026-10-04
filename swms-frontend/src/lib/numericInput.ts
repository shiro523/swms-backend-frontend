// Keystroke-level filters for numeric form fields. <input type="number">
// still accepts "e", "+", "-" and "." (e.g. "1e2"), so these fields use a
// plain text input with a numeric keyboard and strip anything else as the
// user types or pastes. The backend validates the same rules again.

// Matches backend-swms/src/schema/household.schema.ts. Digits only, kept as
// a string so a leading 0 (09XXXXXXXXX) is never lost.
export const CONTACT_NUMBER_MAX_DIGITS = 11;

export function toDigits(value: string, maxDigits: number): string {
  return value.replace(/\D/g, "").slice(0, maxDigits);
}

export function toContactNumber(value: string): string {
  return toDigits(value, CONTACT_NUMBER_MAX_DIGITS);
}

// Ages are validated as 0-120 server-side; 3 digits is enough to type any of them.
export function toAge(value: string): string {
  return toDigits(value, 3);
}

// Peso amount: digits with at most one "." and two decimal places.
export function toMoney(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

export const contactNumberInputProps = {
  type: "text",
  inputMode: "numeric",
  autoComplete: "tel",
  maxLength: CONTACT_NUMBER_MAX_DIGITS,
  pattern: `\\d{1,${CONTACT_NUMBER_MAX_DIGITS}}`,
  title: `Digits only, up to ${CONTACT_NUMBER_MAX_DIGITS} (e.g. 09171234567)`,
  placeholder: "09XXXXXXXXX",
} as const;

export const ageInputProps = {
  type: "text",
  inputMode: "numeric",
  maxLength: 3,
} as const;

export const moneyInputProps = {
  type: "text",
  inputMode: "decimal",
} as const;
