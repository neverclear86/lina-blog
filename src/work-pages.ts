/**
 * Paths and link rows of the pages of works: which works get a page in each locale, and the
 * rows of a work's links in the order the page lists them.
 */
import { LOCALES, type Locale } from "./i18n/locales";
import { translate } from "./i18n/ui";

/** A related video or making-of post of a work, as `workSchema` gives it. */
interface WorkLink {
  url: string;
  name?: string;
}

/** The links of a work, as `workSchema` gives them. */
export interface WorkLinks {
  demo?: string;
  repo?: string;
  videos: readonly WorkLink[];
  posts: readonly WorkLink[];
}

/** A row of the link list on a work's page. */
export interface WorkLinkRow {
  /** Kind shown on the left of the row; not translated. */
  kind: "demo" | "repo" | "video" | "blog";
  href: string;
  /** Text of the link. */
  text: string;
  /** Whether the link leaves the site, so that the row ends with an arrow. */
  external: boolean;
}

/** Hosts of Twitter, without `www.`. */
const TWITTER_HOSTS = new Set(["twitter.com", "x.com"]);

/**
 * Returns the `getStaticPaths` entries of the pages of works: one for each locale of each work
 * whose `hasPage` is true, in the order of `works`. A work without a page gets no entry.
 */
export function workPagePaths<
  T extends { data: { slug: string; hasPage: boolean } },
>(works: readonly T[]) {
  return works
    .filter((work) => work.data.hasPage)
    .flatMap((work) =>
      LOCALES.map((lang) => ({
        params: { lang, slug: work.data.slug },
        props: { lang, work },
      })),
    );
}

/**
 * Returns the rows of `links`: the demo, the repository, the videos and the posts, in this
 * order, leaving out the ones the work does not have.
 *
 * The text of a row is the link's `name`. Without one it is the URL without `https://`, except
 * that a Twitter URL shows the label `social.twitter` in `lang`. A row is external when its host
 * differs from the host of `site`.
 */
export function workLinkRows(
  links: WorkLinks,
  lang: Locale,
  site: URL,
): WorkLinkRow[] {
  const row = (
    kind: WorkLinkRow["kind"],
    { url, name }: WorkLink,
  ): WorkLinkRow => {
    const { hostname } = new URL(url);
    const isTwitter = TWITTER_HOSTS.has(hostname.replace(/^www\./, ""));
    const text =
      name ??
      (isTwitter
        ? translate(lang, "social.twitter")
        : url.replace(/^https:\/\//, ""));
    return { kind, href: url, text, external: hostname !== site.hostname };
  };
  return [
    ...(links.demo === undefined ? [] : [row("demo", { url: links.demo })]),
    ...(links.repo === undefined ? [] : [row("repo", { url: links.repo })]),
    ...links.videos.map((link) => row("video", link)),
    ...links.posts.map((link) => row("blog", link)),
  ];
}
