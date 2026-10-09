/**
 * UI strings for each locale. The Japanese dictionary defines the keys, and the type of
 * `ui` requires every other locale to provide the same keys.
 */
import type { Locale } from "./locales";

const ja = {
  // About section of the top page. Text in [brackets] is a placeholder for a line to be written.
  // A "\n" in "about.heading" breaks the line.
  "about.heading": "はじめまして、\n創好リナです。",
  "about.lead":
    "エンジニアをしながら、VTuberとして動画と配信をやっています。プログラミングやシステム構築を「遊び」として見せるのが好きで、役に立つかどうかより、おもしろいかどうかで技術をさわっています。",
  "about.lead2":
    "エンジニアじゃなくても楽しめるように作っているので、気軽にのぞいていってください。",
  "about.stream.title": "動画と配信",
  "about.stream.body":
    "YouTubeで動画と配信をしています。Resoniteを題材にすることが多めです。",
  "about.dev.title": "開発",
  "about.dev.body":
    "フリーランスのエンジニア。このサイトやNostrまわりの道具も自作しています。",
  "about.spec.job": "エンジニア兼VTuber",
  "about.spec.like": "[好きなもの]",
  // Alt texts of the avatar images (src/avatar-images.ts). The poses are decorative and have none.
  "avatar.frontAlt": "創好リナ 正面",
  "avatar.sideAlt": "創好リナ 側面",
  "avatar.backAlt": "創好リナ 背面",
  "avatar.thumbsUpAlt": "サムズアップする創好リナ",
  "avatar.thinkingAlt": "考えこむ創好リナ",
  // Names of the parts that the lines on the three views of the avatar point at
  // (src/components/AvatarThreeView.astro). The codes under the names are not translated.
  "avatar.note.ahoge": "アホ毛",
  "avatar.note.tie": "ネクタイ",
  "avatar.note.zettai": "絶対領域",
  "avatar.note.sneakers": "スニーカー",
  "avatar.note.qr": "袖のQRコード",
  "avatar.note.nail": "ネイル",
  "avatar.note.nametag": "ネームタグ",
  // Labels of the post tags. The Japanese labels are the tag names in the frontmatter.
  "blog.tag.devlog": "制作記",
  "blog.tag.diary": "日記",
  "blog.tag.tech": "技術",
  // Pages of the blog posts, /blog/ and /blog/tags/<slug>/: the heading, the tag filter and the
  // text shown when there are no posts.
  "blog.filter.all": "すべて",
  "blog.filter.label": "タグで絞り込む",
  "blog.index.subtitle": "記事一覧",
  "blog.tagPage.devlog.noPosts": "制作記の記事はまだありません。",
  "blog.tagPage.devlog.subtitle": "制作記の記事",
  "blog.tagPage.diary.noPosts": "日記の記事はまだありません。",
  "blog.tagPage.diary.subtitle": "日記の記事",
  "blog.tagPage.tech.noPosts": "技術の記事はまだありません。",
  "blog.tagPage.tech.subtitle": "技術の記事",
  // Contact section of the top page.
  "contact.subtitle": "お問い合わせ",
  "contact.lead": "お仕事のご相談やコラボのお誘いなど、お気軽にどうぞ。",
  "contact.kind": "ご用件",
  "contact.kind.work": "お仕事のご相談",
  "contact.kind.collab": "コラボのお誘い",
  "contact.kind.other": "その他",
  "contact.name": "お名前",
  "contact.email": "メールアドレス",
  "contact.message": "内容",
  "contact.note": "ソッコー確認するね",
  "contact.submit": "送信する",
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
  // Name after "© <year>" in the site footer.
  "footer.copyrightHolder": "創好リナ",
  // Names of the two <nav> of the site footer: the pages of the site and the links to profiles.
  "footer.linksLabel": "リンク",
  "footer.siteLabel": "サイト",
  // Name of the link from the logo in the site header to the top page.
  "header.homeLabel": "ikili.pro トップ",
  // Hero of the top page; "hero.intro" shows from 768px and "hero.introShort" below it.
  "hero.intro":
    "配信もするし、開発もする。ITで遊ぶ動画と配信を、Resoniteを中心に届けています。",
  "hero.introShort":
    "配信もするし、開発もする。ITで遊ぶ動画と配信を届けています。",
  "hero.links": "リンク",
  "hero.tagline": "バーチャルイキリプログラマ",
  "home.comingSoon": "準備中です。",
  "latest.blog.all": "記事一覧",
  "latest.blog.heading": "ブログ",
  // Read after a post title on pages in other locales; the Japanese pages do not show it.
  "latest.blog.inJapanese": "(日本語)",
  "latest.blog.noPosts": "まだ記事はありません。",
  // Heading of the Latest section on the home page.
  "latest.title": "さいきんの配信",
  // Link to the YouTube channel: the button after the small video windows and the link text of the
  // large window shown without a video.
  "latest.videos.channel": "YouTubeチャンネルへ",
  // Shown in the large window in place of the newest video when the feed gives none, such as when
  // it cannot be read.
  "latest.videos.empty": "最新の動画を表示できませんでした。",
  // Name of the menu button of the site header; whether the menu is open is its expanded state.
  "menu.label": "メニュー",
  // Main navigation of the site header; "nav.label" names its <nav>. "nav.breadcrumb" names the
  // <nav> of the breadcrumb at the top of a page.
  "nav.about": "プロフィール",
  "nav.blog": "ブログ",
  "nav.breadcrumb": "パンくず",
  "nav.contact": "お問い合わせ",
  "nav.label": "メイン",
  "nav.latest": "さいきん",
  "nav.top": "トップ",
  "nav.works": "つくったもの",
  // The 404 page, which is in Japanese and shows the English message and link under the heading.
  "notFound.back": "トップへもどる",
  "notFound.message": "このページは存在しないよ。",
  "notFound.subtitle": "ページが見つからないよ",
  "notFound.topLink": "日本語のトップページへ",
  // Says that the site can also be read with curl; shown at the end of the strip of the hero.
  "site.curlHint": "$ curl ikili.pro でも読めるよ",
  // Description of the site: the meta description and og:description of the pages that do not
  // pass their own, such as the top page.
  "site.description":
    "創好リナ（Tsukusu Lina）の個人サイト兼ブログ。創好リナはバーチャルイキリプログラマで、ITで遊ぶ動画と配信を、Resoniteを中心に届けている。",
  // Label of the Twitter link; "X" appears only in its icon.
  "social.twitter": "Twitter(自称X)",
  "theme.toDark": "ダークテーマに切り替え",
  "theme.toLight": "ライトテーマに切り替え",
  // Name of the breadcrumb on the page of a work.
  "works.breadcrumb": "パンくず",
  // Text hidden from the eyes after a link to another site: the title of a work tile or a link of a work's page.
  "works.external": "（外部サイト）",
  "works.links": "リンク",
  // Name of the list of the technologies of a work.
  "works.tech": "使用技術",
} as const;

/** Key of a UI string. */
export type UiKey = keyof typeof ja;

/** UI strings by locale, then by key. */
export const ui: Record<Locale, Record<UiKey, string>> = {
  ja,
  en: {
    "about.heading": "Hi there,\nI'm Tsukusu Lina.",
    "about.lead":
      "I'm an engineer who also makes videos and streams as a VTuber. I like showing programming and building systems as play, and I pick up technologies because they are fun, not because they are useful.",
    "about.lead2":
      "I make things that you can enjoy even if you are not an engineer, so feel free to look around.",
    "about.stream.title": "Videos and streams",
    "about.stream.body":
      "I post videos and stream on YouTube, often about Resonite.",
    "about.dev.title": "Development",
    "about.dev.body":
      "A freelance engineer. I also build my own tools, such as this site and tools around Nostr.",
    "about.spec.job": "Engineer and VTuber",
    "about.spec.like": "[Things I like]",
    "avatar.frontAlt": "Tsukusu Lina, front view",
    "avatar.sideAlt": "Tsukusu Lina, side view",
    "avatar.backAlt": "Tsukusu Lina, back view",
    "avatar.thumbsUpAlt": "Tsukusu Lina giving a thumbs-up",
    "avatar.thinkingAlt": "Tsukusu Lina, deep in thought",
    "avatar.note.ahoge": "Cowlick",
    "avatar.note.tie": "Tie",
    "avatar.note.zettai": "Zettai ryoiki",
    "avatar.note.sneakers": "Sneakers",
    "avatar.note.qr": "Sleeve QR",
    "avatar.note.nail": "Nails",
    "avatar.note.nametag": "Name tag",
    "blog.tag.devlog": "Devlog",
    "blog.tag.diary": "Diary",
    "blog.tag.tech": "Tech",
    "blog.filter.all": "All",
    "blog.filter.label": "Filter by tag",
    "blog.index.subtitle": "All posts",
    "blog.tagPage.devlog.noPosts": "No Devlog posts yet.",
    "blog.tagPage.devlog.subtitle": "Devlog posts",
    "blog.tagPage.diary.noPosts": "No Diary posts yet.",
    "blog.tagPage.diary.subtitle": "Diary posts",
    "blog.tagPage.tech.noPosts": "No Tech posts yet.",
    "blog.tagPage.tech.subtitle": "Tech posts",
    "contact.subtitle": "Get in touch",
    "contact.lead":
      "Feel free to reach out about work, collaborations, or anything else.",
    "contact.kind": "Topic",
    "contact.kind.work": "Work inquiry",
    "contact.kind.collab": "Collaboration",
    "contact.kind.other": "Other",
    "contact.name": "Name",
    "contact.email": "Email",
    "contact.message": "Message",
    "contact.note": "I'll check it right away",
    "contact.submit": "Send",
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
    "footer.copyrightHolder": "Tsukusu Lina",
    "footer.linksLabel": "Links",
    "footer.siteLabel": "Site",
    "header.homeLabel": "ikili.pro home",
    "hero.intro":
      "I stream, and I build software. I make videos and streams about having fun with IT, mostly in Resonite.",
    "hero.introShort":
      "I stream, and I build software. I make videos and streams about having fun with IT.",
    "hero.links": "Links",
    "hero.tagline": 'Virtual "ikiri" programmer',
    "home.comingSoon": "Coming soon.",
    "latest.blog.all": "All posts",
    "latest.blog.heading": "Blog",
    "latest.blog.inJapanese": "(in Japanese)",
    "latest.blog.noPosts": "No posts yet.",
    "latest.title": "Recent streams",
    "latest.videos.channel": "Visit the YouTube channel",
    "latest.videos.empty": "Couldn't show the latest videos.",
    "menu.label": "Menu",
    "nav.about": "About",
    "nav.blog": "Blog",
    "nav.breadcrumb": "Breadcrumb",
    "nav.contact": "Contact",
    "nav.label": "Main",
    "nav.latest": "Latest",
    "nav.top": "Top",
    "nav.works": "Works",
    "notFound.back": "Back to top",
    "notFound.message": "This page doesn't exist.",
    "notFound.subtitle": "Page not found",
    "notFound.topLink": "Go to the English top page",
    "site.curlHint": "$ curl ikili.pro works too",
    "site.description":
      'Personal site and blog of Tsukusu Lina (創好リナ), a virtual "ikiri" programmer who makes videos and streams about playing with IT, mostly in Resonite.',
    "social.twitter": "Twitter (self-proclaimed X)",
    "theme.toDark": "Switch to dark theme",
    "theme.toLight": "Switch to light theme",
    "works.breadcrumb": "Breadcrumb",
    "works.external": "(external site)",
    "works.links": "Links",
    "works.tech": "Tech stack",
  },
};

/** Returns the UI string for `key` in `locale`. */
export function translate(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}
