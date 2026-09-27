/**
 * UI strings for each locale. The Japanese dictionary defines the keys, and the type of
 * `ui` requires every other locale to provide the same keys.
 */
import type { Locale } from "./locales";

const ja = {
  // About section of the top page. Text in [brackets] is a placeholder for a line to be written.
  "about.subtitle": "創好リナってこんな人",
  "about.lead":
    "名前の由来はLinux。配信もするし、開発もする、バーチャルイキリプログラマです。[自己紹介のひとこと]",
  "about.fullBodyAlt": "創好リナの全身",
  "about.stream.title": "配信",
  "about.stream.activity.label": "活動",
  "about.stream.activity.value": "YouTube・配信（Resonite中心）、雑談配信",
  "about.stream.topics.label": "よく扱う",
  "about.stream.topics.value": "Nostr、Gleam、Strudel、ComputerCraft",
  "about.stream.note.label": "ひとこと",
  "about.stream.note.value": "[配信のひとこと]",
  "about.dev.title": "開発",
  "about.dev.work.label": "仕事",
  "about.dev.work.value": "フリーランスエンジニア",
  "about.dev.skills.label": "得意",
  "about.dev.skills.value": "[得意な領域・技術]",
  "about.dev.handle.label": "名義",
  "about.dev.handle.value": "GitHubなどではLinaTsukusu",
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
    "about.subtitle": "Meet Tsukusu Lina",
    "about.lead":
      'Named after Linux. A virtual "ikiri" programmer who streams and builds software. [A line about herself]',
    "about.fullBodyAlt": "Full-body illustration of Tsukusu Lina",
    "about.stream.title": "Streaming",
    "about.stream.activity.label": "Activity",
    "about.stream.activity.value":
      "YouTube videos and streams (mostly in Resonite), chat streams",
    "about.stream.topics.label": "Topics",
    "about.stream.topics.value": "Nostr, Gleam, Strudel, ComputerCraft",
    "about.stream.note.label": "Note",
    "about.stream.note.value": "[A line about streaming]",
    "about.dev.title": "Development",
    "about.dev.work.label": "Work",
    "about.dev.work.value": "Freelance engineer",
    "about.dev.skills.label": "Strengths",
    "about.dev.skills.value": "[Areas and technologies]",
    "about.dev.handle.label": "Handle",
    "about.dev.handle.value": "LinaTsukusu on GitHub and elsewhere",
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
