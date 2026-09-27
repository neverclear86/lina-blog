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
  // Labels of the post tags. The Japanese labels are the tag names in the frontmatter.
  "blog.tag.devlog": "制作記",
  "blog.tag.diary": "日記",
  "blog.tag.tech": "技術",
  // Contact form: the status line, the text under a rejected field and the noscript notice.
  "contact.error.invalid": "正しい形式で入力してください。",
  "contact.error.invalidChoice": "選択肢から選んでください。",
  "contact.error.invalidEmail": "メールアドレスの形式で入力してください。",
  "contact.error.newline": "改行を入れずに入力してください。",
  "contact.error.required": "入力してください。",
  "contact.error.requiredChoice": "選んでください。",
  // "{max}" is replaced with the limit by contactFieldMessage in src/contact-form.ts.
  "contact.error.tooLong": "{max} 文字以内で入力してください。",
  "contact.noscript": "送信には JavaScript が必要です。",
  "contact.status.failed":
    "送信できませんでした。時間をおいてもう一度お試しください。",
  "contact.status.invalid": "入力内容を確かめてください。",
  "contact.status.network":
    "通信できませんでした。接続を確かめてもう一度お試しください。",
  "contact.status.sending": "送信中…",
  "contact.status.sent": "送信しました。ありがとうございます！",
  "contact.status.turnstile": "確認に失敗しました。もう一度送信してください。",
  "contact.status.unavailable":
    "確認を読み込めませんでした。ページを再読み込みしてください。",
  "contact.status.waiting":
    "確認が終わるまで少し待ってから、もう一度送信してください。",
  "home.comingSoon": "準備中です。",
  "latest.blog.all": "記事一覧",
  "latest.blog.heading": "ブログ",
  // Read after a post title on pages in other locales; the Japanese pages do not show it.
  "latest.blog.inJapanese": "(日本語)",
  "latest.blog.noPosts": "まだ記事はありません。",
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
    "blog.tag.devlog": "Devlog",
    "blog.tag.diary": "Diary",
    "blog.tag.tech": "Tech",
    "contact.error.invalid": "Enter a valid value.",
    "contact.error.invalidChoice": "Choose one of the options.",
    "contact.error.invalidEmail": "Enter a valid email address.",
    "contact.error.newline": "Remove the line breaks.",
    "contact.error.required": "This field is required.",
    "contact.error.requiredChoice": "Please choose one.",
    "contact.error.tooLong": "Use {max} characters or fewer.",
    "contact.noscript": "Sending requires JavaScript.",
    "contact.status.failed":
      "Couldn't send your message. Please try again later.",
    "contact.status.invalid": "Please check the marked fields.",
    "contact.status.network":
      "Couldn't reach the server. Check your connection and try again.",
    "contact.status.sending": "Sending…",
    "contact.status.sent": "Sent. Thank you!",
    "contact.status.turnstile": "Verification failed. Please send again.",
    "contact.status.unavailable":
      "Couldn't load the verification. Please reload the page.",
    "contact.status.waiting":
      "Please wait for the verification to finish, then send again.",
    "home.comingSoon": "Coming soon.",
    "latest.blog.all": "All posts",
    "latest.blog.heading": "Blog",
    "latest.blog.inJapanese": "(in Japanese)",
    "latest.blog.noPosts": "No posts yet.",
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
