/**
 * Writes the dates of posts and videos, which are published in Japan, in Japan time.
 */

/** Formats a date as YYYY-MM-DD in Japan time. */
const JST_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Writes `date` in Japan time as `YYYY.MM.DD`, whatever the time zone of the build. */
export function formatJstDate(date: Date): string {
  return JST_DATE_FORMAT.format(date).replaceAll("-", ".");
}
