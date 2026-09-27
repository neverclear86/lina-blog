/**
 * UI strings for each locale. The Japanese dictionary defines the keys, and the type of
 * `ui` requires every other locale to provide the same keys.
 */
import type { Locale } from "./locales";

const ja = {
  "home.comingSoon": "準備中です。",
  // Subtitle of the Latest section on the home page.
  "latest.subtitle": "さいきんの配信と記事",
  // The locale's own name, shown on the links to it; not translated into other locales.
  "locale.name": "日本語",
  // Label of the Twitter link; "X" appears only in its icon.
  "social.twitter": "Twitter(自称X)",
  "theme.toDark": "ダークテーマに切り替え",
  "theme.toLight": "ライトテーマに切り替え",
} as const;

/** Key of a UI string. */
export type UiKey = keyof typeof ja;

/** UI strings by locale, then by key. */
export const ui: Record<Locale, Record<UiKey, string>> = {
  ja,
  en: {
    "home.comingSoon": "Coming soon.",
    "latest.subtitle": "Recent streams and posts",
    "locale.name": "English",
    "social.twitter": "Twitter (self-proclaimed X)",
    "theme.toDark": "Switch to dark theme",
    "theme.toLight": "Switch to light theme",
  },
};

/** Returns the UI string for `key` in `locale`. */
export function translate(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}
