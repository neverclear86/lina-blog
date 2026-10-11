/**
 * Data of the samples in `src/dev/sections/`: the posts, videos, table of contents items and
 * breadcrumbs that the components under test take as props. A file in `src/dev/sections/` imports
 * what its section shows.
 */
import type { ComponentProps } from "astro/types";
import { blogCrumbs, blogPostBreadcrumb } from "../blog-pages";
import type ArticleToc from "../components/article/ArticleToc.astro";
import type PostNav from "../components/article/PostNav.astro";
import { sponsorNotice } from "../components/article/sponsor-notice";
import type PostRows from "../components/blog/PostRows.astro";
import type LatestPosts from "../components/home/LatestPosts.astro";
import { translate } from "../i18n/ui";
import type { YouTubeVideo } from "../youtube-feed";

export const tagCrumbs = blogCrumbs("技術");
export const postCrumbs = blogPostBreadcrumb(
  "my-first-article",
  new Date("2026-05-01T00:00:00Z"),
);
export const longCrumbs = blogPostBreadcrumb(
  "a-very-long-slug-for-a-post-about-how-this-site-was-made",
  new Date("2026-05-01T00:00:00Z"),
);
export const sampleSite = new URL("https://ikili.pro");
export const contactCrumbs = [
  { text: "~", href: "/en/", label: translate("en", "nav.top") },
  { text: "contact" },
];

export const samplePosts: ComponentProps<typeof LatestPosts>["posts"] = [
  {
    data: {
      title: "サイトをAstroで作り直した話",
      slug: "sample-post-devlog",
      date: new Date("2026-09-20"),
      tags: ["制作記"],
    },
  },
  {
    data: {
      title: "Cloudflare Workersで静的なページとAPIを同じWorkerから配信する",
      slug: "sample-post-tech-devlog",
      date: new Date("2026-09-12"),
      tags: ["技術", "制作記"],
    },
  },
  {
    data: {
      title: "配信の機材を少しずつ入れ替えた一週間",
      slug: "sample-post-diary",
      date: new Date("2026-09-05"),
      tags: ["日記"],
    },
  },
  {
    data: {
      title: "いちばん古い記事は出ない",
      slug: "sample-post-oldest",
      date: new Date("2026-08-01"),
      tags: ["技術"],
    },
  },
];

// Sponsors for the notice samples: one with a URL of another site, whose name is a link that
// opens in a new tab; one with a URL on this site, whose name is a link that does not; and one
// without a URL.
export const sampleNotices = [
  { name: "サンプル株式会社", url: "https://example.com/" },
  { name: "サンプル株式会社", url: "https://ikili.pro/" },
  { name: "サンプル株式会社" },
]
  .map(sponsorNotice)
  .filter((notice) => notice !== undefined);

// Posts for the samples of the links to the posts next to a post: a short title, and a title that
// wraps to three lines or more at 390px.
export const samplePrevPost: ComponentProps<typeof PostNav>["prev"] = {
  data: { title: "短い題", slug: "sample-post-short" },
};
export const sampleNextPost: ComponentProps<typeof PostNav>["next"] = {
  data: {
    title:
      "Cloudflare Workersで静的なページとAPIを同じWorkerから配信し、お問い合わせのフォームまで1つにまとめた構成の記録",
    slug: "sample-post-long-title",
  },
};

// Items for the table of contents samples: the last has a long text with a word that has no
// break, to show that an item wraps and never pushes the window wider.
export const sampleToc: ComponentProps<typeof ArticleToc>["items"] = [
  { slug: "a-article-toc", text: "なぜ公開するのか" },
  { slug: "a-article-toc", text: "READMEを本気で書く" },
  {
    slug: "a-article-toc",
    text: "長い見出しは折り返される。区切りの無い語も supercalifragilisticexpialidocious",
  },
  { slug: "a-article-toc", text: "おわりに" },
];

// Posts for the post rows samples: a title that wraps to three lines or more at 390px, three
// tags and a sponsor. They are not in date order, to show that the rows keep the order they are
// given.
export const sampleListPosts: ComponentProps<typeof PostRows>["posts"] = [
  {
    data: {
      title: "サイトをAstroで作り直した話",
      slug: "sample-post-devlog",
      date: new Date("2026-09-20"),
      tags: ["制作記"],
    },
  },
  {
    data: {
      title:
        "Cloudflare Workersで静的なページとAPIを同じWorkerから配信し、お問い合わせのフォームまで1つにまとめた構成の記録",
      slug: "sample-post-long-title",
      date: new Date("2026-09-12"),
      tags: ["技術", "制作記", "日記"],
    },
  },
  {
    data: {
      title: "配信の機材を少しずつ入れ替えた一週間",
      slug: "sample-post-diary",
      date: new Date("2026-08-20"),
      tags: ["日記"],
    },
  },
  {
    data: {
      title: "キーボードを提供していただいたので使ってみた",
      slug: "sample-post-sponsor",
      date: new Date("2026-08-28"),
      tags: ["技術"],
      sponsor: { name: "サンプル株式会社" },
    },
  },
  {
    data: {
      title: "短い題",
      slug: "sample-post-short",
      date: new Date("2026-08-01"),
      tags: ["技術"],
    },
  },
];

const sampleVideo = (
  id: string,
  title: string,
  publishedAt: string,
): YouTubeVideo => ({
  id,
  title,
  publishedAt: new Date(publishedAt),
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnail: {
    src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    srcset: `https://i.ytimg.com/vi/${id}/mqdefault.jpg 320w, https://i.ytimg.com/vi/${id}/hqdefault.jpg 480w`,
  },
});

// Videos for the Latest samples. The IDs do not exist on i.ytimg.com, so the thumbnails do
// not load and the boxes stay empty.
export const sampleVideos: YouTubeVideo[] = [
  sampleVideo(
    "AAAAAAAAAAA",
    "長いタイトルの見本。".repeat(10),
    "2026-09-27T15:30:00Z",
  ),
  sampleVideo(
    "BBBBBBBBBBB",
    "長いタイトルの見本。".repeat(10),
    "2026-09-20T10:00:00Z",
  ),
  sampleVideo("CCCCCCCCCCC", "短いタイトル", "2026-09-13T10:00:00Z"),
];
