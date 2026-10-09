/**
 * Builds the text version of the site for command-line clients such as curl: the about text,
 * the works, the latest blog posts, the profile links and how to get in touch. Every line fits
 * in 80 terminal columns. `src/pages/text/[lang].txt.ts` calls it for each locale, so every
 * build writes `/text/ja.txt` and `/text/en.txt`.
 */
import { FEED_PATH, rssItemTitle } from "./blog-rss";
import type { BlogFrontmatter } from "./blog-schema";
import { contactPagePath } from "./components/site-nav";
import type { Locale } from "./i18n/locales";
import { PROFILE_LINKS } from "./profile-links";

/** Terminal columns that every line of the text version fits in. */
const MAX_WIDTH = 80;

/** How many of the latest posts the text version lists. */
const LATEST_POSTS_LIMIT = 5;

/** Formats a post's date as YYYY-MM-DD in Japan time, where the posts are written. */
const POST_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Text of the text version in one locale. */
interface TextSiteStrings {
  headings: {
    about: string;
    works: string;
    latest: string;
    links: string;
    contact: string;
  };
  about: readonly string[];
  works: readonly { name: string; lines: readonly string[] }[];
  noPosts: string;
  /** The contact section: the line that invites contact and the label before the form's URL. */
  contact: { lead: string; formLabel: string };
}

// Provisional: the wording of the about text and the works to list are not decided yet. The
// about text uses the design's sentences, and the works are the design's first two cards. The
// contact lines point to the contact page.
/** Text of the text version in each locale. The type requires every locale. */
const STRINGS: Record<Locale, TextSiteStrings> = {
  ja: {
    headings: {
      about: "$ whoami  # 自己紹介",
      works: "$ ls ~/works  # つくったもの",
      latest: "$ ls ~/blog  # 最新記事",
      links: "$ cat ~/links  # リンク",
      contact: "$ mail lina  # お問い合わせ",
    },
    about: [
      "創好リナ（Tsukusu Lina）",
      "バーチャルイキリプログラマ。名前の由来はLinux。",
      "配信もするし、開発もする。",
      "ITで遊ぶ動画と配信を、Resoniteを中心に届けています。",
    ],
    works: [
      {
        name: "ikili.pro",
        lines: [
          "このサイト。Obsidianで書いた記事が、ボタン1つで公開されます。",
          "astro / hono / cloudflare workers",
        ],
      },
      {
        name: "nostr-no-su",
        lines: ["Nostrの鍵を預かって署名するbunker。", "nostr / nip-46"],
      },
    ],
    noPosts: "まだ記事はありません。",
    contact: {
      lead: "お仕事のご相談やコラボのお誘いなどはこちらから。",
      formLabel: "フォーム:",
    },
  },
  en: {
    headings: {
      about: "$ whoami  # About",
      works: "$ ls ~/works  # Works",
      latest: "$ ls ~/blog  # Latest posts (in Japanese)",
      links: "$ cat ~/links  # Links",
      contact: "$ mail lina  # Contact",
    },
    about: [
      "Tsukusu Lina (創好リナ)",
      'A virtual "ikiri" programmer, named after Linux.',
      "Streams and builds software.",
      "Makes videos and streams about playing with IT, mostly in Resonite.",
    ],
    works: [
      {
        name: "ikili.pro",
        lines: [
          "This site. Posts written in Obsidian go live with one button.",
          "astro / hono / cloudflare workers",
        ],
      },
      {
        name: "nostr-no-su",
        lines: [
          "A bunker that keeps Nostr keys and signs with them.",
          "nostr / nip-46",
        ],
      },
    ],
    noPosts: "No posts yet.",
    contact: {
      lead: "For work inquiries, collaborations and more,",
      formLabel: "use the form:",
    },
  },
};

/** A blog post as `getCollection("blog")` returns it, reduced to what the text version reads. */
export interface TextSitePost {
  data: Pick<BlogFrontmatter, "title" | "slug" | "date" | "sponsor">;
}

/**
 * Returns how many terminal columns `text` takes: 2 for each East Asian wide or fullwidth code
 * point (CJK ideographs, kana, Hangul and fullwidth forms, in ranges close to Markus Kuhn's
 * `wcwidth`) and for each emoji with the default emoji presentation, and 1 for any other. An
 * ambiguous-width character such as `…` counts 1.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const c = char.codePointAt(0) ?? 0;
    const wide =
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x1f300 && c <= 0x1f64f) ||
      (c >= 0x1f900 && c <= 0x1f9ff) ||
      (c >= 0x20000 && c <= 0x3fffd) ||
      /\p{Emoji_Presentation}/u.test(String.fromCodePoint(c));
    width += wide ? 2 : 1;
  }
  return width;
}

/** Returns `text`, or its start followed by `...` when it is wider than `maxWidth` columns. */
function fitWidth(text: string, maxWidth: number): string {
  if (displayWidth(text) <= maxWidth) {
    return text;
  }
  const ellipsis = "...";
  let kept = "";
  for (const char of text) {
    if (displayWidth(kept + char + ellipsis) > maxWidth) {
      break;
    }
    kept += char;
  }
  return `${kept}${ellipsis}`;
}

/**
 * Returns the text version of the site in `locale`, ending with one newline.
 *
 * The latest posts are the newest `LATEST_POSTS_LIMIT` of `posts` by date, each with its date in
 * Japan time, its title (with `【PR】` for a sponsored post, cut with `...` to fit the line) and
 * the absolute URL of its page; without posts, a line says there are none. The profile links
 * print `shortForm` instead of `url` when a link has one. The contact section ends with a line
 * that invites contact and a line with the absolute URL of the contact page of `locale`.
 *
 * @param locale Language of the text; the post titles stay in Japanese.
 * @param posts Posts of the `blog` collection, in any order.
 * @param site Astro's `site`, the origin of the absolute URLs.
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function buildTextSite(
  locale: Locale,
  posts: readonly TextSitePost[],
  site: URL | undefined,
): string {
  if (site === undefined) {
    throw new Error(
      "The text version needs `site` in astro.config.mjs for absolute URLs",
    );
  }
  const strings = STRINGS[locale];
  const latest = [...posts]
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, LATEST_POSTS_LIMIT);
  const postLines =
    latest.length === 0
      ? [strings.noPosts]
      : latest.flatMap(({ data }) => {
          const date = POST_DATE_FORMAT.format(data.date);
          const title = fitWidth(
            rssItemTitle(data),
            MAX_WIDTH - displayWidth(date) - 2,
          );
          return [
            `${date}  ${title}`,
            `  ${new URL(`/blog/${data.slug}/`, site).toString()}`,
          ];
        });
  return [
    "ikili.pro",
    "",
    strings.headings.about,
    ...strings.about,
    "",
    strings.headings.works,
    ...strings.works.flatMap(({ name, lines }) => [
      name,
      ...lines.map((line) => `  ${line}`),
    ]),
    "",
    strings.headings.latest,
    ...postLines,
    `RSS: ${new URL(FEED_PATH, site).toString()}`,
    "",
    strings.headings.links,
    ...PROFILE_LINKS.flatMap(({ label, url, note, shortForm }) => [
      `${label[locale]} - ${note[locale]}`,
      `  ${shortForm ?? url}`,
    ]),
    "",
    strings.headings.contact,
    strings.contact.lead,
    `${strings.contact.formLabel} ${new URL(contactPagePath(locale), site).toString()}`,
    "",
  ].join("\n");
}
