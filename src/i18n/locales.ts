/**
 * Languages the site is published in. `astro.config.mjs` builds its `i18n` settings from
 * these, and pages under `src/pages/[lang]/` are generated once for each of them.
 */

/** Locale codes, used as the URL prefix (`/ja/`, `/en/`) and as `<html lang>`. */
export const LOCALES = ["ja", "en"] as const;

/** One of the locale codes in `LOCALES`. */
export type Locale = (typeof LOCALES)[number];

/** Astro's `i18n.defaultLocale`, and the language of pages outside `src/pages/[lang]/`. */
export const DEFAULT_LOCALE: Locale = "ja";
