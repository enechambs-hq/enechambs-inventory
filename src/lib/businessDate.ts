/**
 * The business day, as Enechambs reckons it: Africa/Lagos (WAT, UTC+1).
 *
 * Date inputs were mixing two clocks. A form's default value came from the
 * browser's local date while its `max` came from `toISOString()`, which is UTC —
 * and between 00:00 and 01:00 WAT those are different days. The default then sat
 * above the max, so the browser's own validation refused to submit: for that
 * hour every night nobody could record a sale for today, and on the 1st of a
 * month the only accepted date belonged to the previous month.
 *
 * Both sides now come from here, so they always agree, and they agree with the
 * server, which files business dates in Lagos too.
 */
export const BUSINESS_TIMEZONE = 'Africa/Lagos';

// en-CA formats as YYYY-MM-DD, which is what <input type="date"> expects.
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The business date of `at` (default: now), as YYYY-MM-DD. */
export function businessDate(at: Date = new Date()): string {
  return formatter.format(at);
}

/** First day of the business month containing `at`, as YYYY-MM-DD. */
export function startOfBusinessMonth(at: Date = new Date()): string {
  return `${businessDate(at).slice(0, 7)}-01`;
}
