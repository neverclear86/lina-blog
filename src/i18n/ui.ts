/**
 * UI strings for each locale. The Japanese dictionary defines the keys, and the type of
 * `ui` requires every other locale to provide the same keys.
 */
import type { Locale } from "./locales";

const ja = {
  "home.comingSoon": "準備中です。",
} as const;

/** Key of a UI string. */
export type UiKey = keyof typeof ja;

/** UI strings by locale, then by key. */
export const ui: Record<Locale, Record<UiKey, string>> = {
  ja,
  en: {
    "home.comingSoon": "Coming soon.",
  },
};

/** Returns the UI string for `key` in `locale`. */
export function translate(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}
