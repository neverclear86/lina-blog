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
  // End window of an article (src/components/ArticleEnd.astro).
  "articleEnd.heading": "読んでくれてありがと！",
  "articleEnd.nostr": "Nostr",
  "articleEnd.shareSuffix": "で共有",
  "articleEnd.copyPrefix": "リンクを",
  "articleEnd.copy": "コピー",
  "articleEnd.copyDone": "コピーしました！",
  "articleEnd.copyFail":
    "コピーできませんでした。アドレスバーから URL をコピーしてください",
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
  // Name of the tab list of the three views of the avatar (src/components/AvatarThreeView.astro).
  "avatar.tabsLabel": "アバターの向き",
  // Name of the author in the head of a post.
  "blog.author": "創好リナ",
  // Labels of the post tags. The Japanese labels are the tag names in the frontmatter.
  "blog.tag.devlog": "制作記",
  "blog.tag.diary": "日記",
  "blog.tag.tech": "技術",
  // Pages of the blog posts, /blog/ and /blog/tags/<slug>/: the heading, the tag filter and the
  // text shown when there are no posts.
  "blog.filter.all": "すべて",
  "blog.filter.label": "タグで絞り込む",
  "blog.index.subtitle": "記事一覧",
  "blog.postNav.label": "前後の記事",
  "blog.tagPage.devlog.noPosts": "制作記の記事はまだありません。",
  "blog.tagPage.devlog.subtitle": "制作記の記事",
  "blog.tagPage.diary.noPosts": "日記の記事はまだありません。",
  "blog.tagPage.diary.subtitle": "日記の記事",
  "blog.tagPage.tech.noPosts": "技術の記事はまだありません。",
  "blog.tagPage.tech.subtitle": "技術の記事",
  // Table of contents of a post (src/components/ArticleToc.astro): the name of its `<nav>` and the
  // `<summary>` of the closed one below 1024px.
  "blog.toc.label": "目次",
  "blog.toc.summary": "toc — 目次",
  // Copy button of a code block (src/code-copy.ts): its name, its three texts and two messages.
  "code.copy.name": "コードをコピー",
  "code.copy.idle": "copy",
  "code.copy.done": "copied",
  "code.copy.fail": "failed",
  "code.copy.doneMessage": "コードをコピーしました",
  "code.copy.failMessage":
    "コピーできませんでした。コードを選んであるので、手でコピーしてください",
  // Contact page and the contact band of the top page.
  "contact.lead": "お仕事のご相談、コラボのお誘いなどはこちらから。",
  "contact.title": "お問い合わせ",
  "contact.description":
    "創好リナへのお問い合わせのフォームです。お仕事のご相談、コラボのお誘いなどはこちらから。",
  "contact.open": "フォームをひらく",
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
  // Hero of the top page: the heading in two parts (the second one is marked), the intro and the
  // button to the latest video.
  "hero.headingLead": "IT技術で、",
  "hero.headingMark": "本気で遊ぶ。",
  "hero.intro":
    "配信もするし、開発もする。プログラミングやシステム構築を「遊び」として見せる、バーチャルイキリプログラマの創好リナです。",
  "hero.latestVideo": "最新の動画を見る",
  "hero.links": "リンク",
  // Name of the button that switches the pose of the avatar in the hero. "{n}" is the number of
  // the pose on show and "{total}" the number of poses (poseLabel in src/components/hero-poses.ts).
  "hero.poseButton": "アバターのポーズを切り替える（いま {n}/{total}）",
  "home.comingSoon": "準備中です。",
  // Hidden text after "JA" of the language switch on a page only in Japanese.
  "lang.jaOnly": "このページは日本語のみ",
  "latest.blog.all": "記事一覧",
  // Read after a post title on pages in other locales; the Japanese pages do not show it.
  "latest.blog.inJapanese": "(日本語)",
  "latest.blog.noPosts": "まだ記事はありません。",
  // Heading of the blog section on the home page.
  "latest.blog.title": "さいきんの記事",
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
  // "nav.label" names the <nav> of the site header and "nav.contact" is the text of its contact
  // button. The items of the navigation are in `src/components/site-nav.ts`. "nav.breadcrumb"
  // names the <nav> of the breadcrumb at the top of a page.
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
  // Label in front of the name of the sponsor in the OGP image of a sponsored post.
  "og.sponsor.label": "スポンサー",
  // Description of the site: the meta description and og:description of the pages that do not
  // pass their own, such as the top page.
  "site.description":
    "創好リナ（Tsukusu Lina）の個人サイト兼ブログ。創好リナはバーチャルイキリプログラマで、ITで遊ぶ動画と配信を、Resoniteを中心に届けている。",
  // Label of the Twitter link; "X" appears only in its icon.
  "social.twitter": "Twitter(自称X)",
  // Hidden text between the visible theme name and the name of the switch.
  "theme.nameSeparator": "：",
  "theme.toDark": "ダークテーマに切り替え",
  "theme.toLight": "ライトテーマに切り替え",
  // Name of the breadcrumb on the page of a work.
  "works.breadcrumb": "パンくず",
  // Text hidden from the eyes after a link to another site: the title of a work tile or a link of a work's page.
  "works.external": "（外部サイト）",
  // Heading of the videos and posts related to a work, on its page.
  "works.related": "関連する動画と記事",
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
    "articleEnd.heading": "Thanks for reading!",
    "articleEnd.nostr": "Nostr",
    "articleEnd.shareSuffix": " (share)",
    "articleEnd.copyPrefix": "",
    "articleEnd.copy": "Copy link",
    "articleEnd.copyDone": "Copied the link.",
    "articleEnd.copyFail": "Couldn't copy. Copy the URL from the address bar.",
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
    "avatar.tabsLabel": "Avatar view",
    "blog.author": "Tsukusu Lina",
    "blog.tag.devlog": "Devlog",
    "blog.tag.diary": "Diary",
    "blog.tag.tech": "Tech",
    "blog.filter.all": "All",
    "blog.filter.label": "Filter by tag",
    "blog.index.subtitle": "All posts",
    "blog.postNav.label": "Previous and next posts",
    "blog.tagPage.devlog.noPosts": "No Devlog posts yet.",
    "blog.tagPage.devlog.subtitle": "Devlog posts",
    "blog.tagPage.diary.noPosts": "No Diary posts yet.",
    "blog.tagPage.diary.subtitle": "Diary posts",
    "blog.tagPage.tech.noPosts": "No Tech posts yet.",
    "blog.tagPage.tech.subtitle": "Tech posts",
    "blog.toc.label": "Table of contents",
    "blog.toc.summary": "toc — Contents",
    "code.copy.name": "Copy code",
    "code.copy.idle": "copy",
    "code.copy.done": "copied",
    "code.copy.fail": "failed",
    "code.copy.doneMessage": "Copied the code.",
    "code.copy.failMessage":
      "Couldn't copy. The code is selected, so copy it by hand.",
    "contact.lead":
      "For work inquiries, collaborations and more, get in touch here.",
    "contact.title": "Contact",
    "contact.description":
      "The contact form for Tsukusu Lina, for work inquiries, collaborations and more.",
    "contact.open": "Open the form",
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
    "hero.headingLead": "Playing with tech,",
    "hero.headingMark": "for real.",
    "hero.intro":
      'I stream, and I build. I\'m Tsukusu Lina, a virtual "ikiri" programmer who turns programming and building systems into play.',
    "hero.latestVideo": "Watch the latest video",
    "hero.links": "Links",
    "hero.poseButton": "Switch the avatar's pose (now {n}/{total})",
    "home.comingSoon": "Coming soon.",
    "lang.jaOnly": "This page is only in Japanese",
    "latest.blog.all": "All posts",
    "latest.blog.inJapanese": "(in Japanese)",
    "latest.blog.noPosts": "No posts yet.",
    "latest.blog.title": "Recent posts",
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
    "og.sponsor.label": "Sponsored by",
    "site.description":
      'Personal site and blog of Tsukusu Lina (創好リナ), a virtual "ikiri" programmer who makes videos and streams about playing with IT, mostly in Resonite.',
    "social.twitter": "Twitter (self-proclaimed X)",
    "theme.nameSeparator": ": ",
    "theme.toDark": "Switch to dark theme",
    "theme.toLight": "Switch to light theme",
    "works.breadcrumb": "Breadcrumb",
    "works.external": "(external site)",
    "works.related": "Related videos and posts",
    "works.tech": "Tech stack",
  },
};

/** Returns the UI string for `key` in `locale`. */
export function translate(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}
