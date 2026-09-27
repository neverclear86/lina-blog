/**
 * Chooses the locale of `/` from the request's `Accept-Language` header: the top page that
 * browsers are redirected to and the text version that command-line clients get.
 */
import { parseAccept } from "hono/utils/accept";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

/**
 * Returns the locale in `LOCALES` that `acceptLanguage` prefers, or `DEFAULT_LOCALE` when it
 * accepts none of them.
 *
 * Languages are tried from the highest `q` down, and those with the same `q` in header order.
 * A language is compared by its primary subtag, ignoring case, so `en-US` and `EN` both match
 * `en`. Languages with `q=0`, `*` and languages that are not in `LOCALES` are skipped.
 */
export function negotiateLocale(acceptLanguage: string | undefined): Locale {
  for (const { type, q } of parseAccept(acceptLanguage ?? "")) {
    if (q <= 0) continue;
    const primary = type.toLowerCase().split("-")[0];
    const locale = LOCALES.find((l) => l === primary);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
