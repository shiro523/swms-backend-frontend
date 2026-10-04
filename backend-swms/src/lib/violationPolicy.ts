// Repeat-violation policy. Every violation on record counts (completed ones
// too — completion means the resident complied with that one, not that it
// never happened). From this many violations on, a household is flagged for
// the admin, who can send it a consequence notice.
export const VIOLATION_NOTICE_THRESHOLD = 5;

// Leader/admin alert created when a household reaches the threshold.
export const VIOLATION_LIMIT_ALERT_TITLE = "Violation Limit Reached";

// The notice the admin sends to the household's resident.
export const CONSEQUENCE_NOTICE_TITLE = "Violation Consequence Notice";
