/** Paths of the same page in each locale, for the language links in the layout. */
import { LOCALES, type Locale } from "./locales";

/** Returns whether `segment` is one of the locale codes in `LOCALES`. */
function isLocale(segment: string): segment is Locale {
  return (LOCALES as readonly string[]).includes(segment);
}

/**
 * Returns the path of the page at `pathname` in `locale`.
 *
 * A path that starts with a locale prefix, such as `/ja/about/`, keeps everything after
 * the prefix (`/en/about/`), since every page under `src/pages/[lang]/` exists in each
 * locale. A path without a locale prefix, such as `/blog/...` or `/`, has no counterpart
 * in other locales, so this returns the top page of `locale` (`/en/`).
 */
export function localizedPath(pathname: string, locale: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) {
    return `/${locale}/`;
  }
  return ["", locale, ...rest].join("/");
}
