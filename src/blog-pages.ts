/**
 * Paths, texts, breadcrumbs and tag filter links of the pages of blog posts: `/blog/`, which
 * lists every post, `/blog/tags/<slug>/`, which lists the posts of one tag, and `/blog/<slug>/`,
 * a post. For a post's page it also gives the posts next to it and the parts of its breadcrumb,
 * its date and its reading time.
 */
import { type BlogFrontmatter, blogSchema } from "./blog-schema";
import { homeSectionPath } from "./components/site-nav";
import type { UiKey } from "./i18n/ui";
import {
  type BlogTag,
  postsNewestFirst,
  tagPath,
  tagSlug,
} from "./latest-posts";
import { formatVideoDate } from "./latest-videos";

/** Path of the page that lists every post. */
const BLOG_INDEX_PATH = "/blog/";

/** Every tag that `blogSchema` allows, in the order it lists them. */
const BLOG_TAGS: readonly BlogTag[] = blogSchema.shape.tags.element.options;

/** Keys of the texts of each tag's page. */
const TAG_PAGE_KEYS: Record<
  BlogTag,
  { label: UiKey; subtitle: UiKey; noPosts: UiKey }
> = {
  制作記: {
    label: "blog.tag.devlog",
    subtitle: "blog.tagPage.devlog.subtitle",
    noPosts: "blog.tagPage.devlog.noPosts",
  },
  技術: {
    label: "blog.tag.tech",
    subtitle: "blog.tagPage.tech.subtitle",
    noPosts: "blog.tagPage.tech.noPosts",
  },
  日記: {
    label: "blog.tag.diary",
    subtitle: "blog.tagPage.diary.subtitle",
    noPosts: "blog.tagPage.diary.noPosts",
  },
};

/**
 * Returns the `getStaticPaths` entries of the tag pages: one for every tag that `blogSchema`
 * allows, in its order, whether or not any post has the tag.
 */
export function blogTagPagePaths() {
  return BLOG_TAGS.map((tag) => ({
    params: { tag: tagSlug(tag) },
    props: { tag },
  }));
}

/** Texts of a page of blog posts. */
export interface BlogListText {
  /** Path of the page after `~`, such as `~/blog` or `~/blog/tags/tech`. */
  label: string;
  /** Key of the name of the page in `<title>`. */
  title: UiKey;
  /** Key of the heading (`h1`) of the page. */
  subtitle: UiKey;
  /** Key of the text shown when the page has no posts. */
  noPosts: UiKey;
}

/**
 * Returns the texts of the page of `tag`'s posts, or of `/blog/` when `tag` is undefined. A tag
 * page's `<title>` is its subtitle, such as "技術の記事".
 */
export function blogListText(tag: BlogTag | undefined): BlogListText {
  if (tag === undefined) {
    return {
      label: "~/blog",
      title: "nav.blog",
      subtitle: "blog.index.subtitle",
      noPosts: "latest.blog.noPosts",
    };
  }
  const { subtitle, noPosts } = TAG_PAGE_KEYS[tag];
  return {
    label: `~/blog/tags/${tagSlug(tag)}`,
    title: subtitle,
    subtitle,
    noPosts,
  };
}

export interface TagFilterLink {
  /** Key of the link's text in `src/i18n/ui.ts`. */
  key: UiKey;
  href: string;
  /** Whether the link is to the page it is on, for `aria-current="page"`. */
  current: boolean;
}

/**
 * Returns the links of the tag filter in order: `/blog/` first, then the page of each tag that
 * `blogSchema` allows, in its order. The link to `/blog/` is current when `current` is undefined,
 * and the link of a tag when `current` is that tag.
 */
export function tagFilterLinks(current: BlogTag | undefined): TagFilterLink[] {
  return [
    {
      key: "blog.filter.all",
      href: BLOG_INDEX_PATH,
      current: current === undefined,
    },
    ...BLOG_TAGS.map((tag) => ({
      key: TAG_PAGE_KEYS[tag].label,
      href: tagPath(tag),
      current: tag === current,
    })),
  ];
}

/** One element of the breadcrumb of a page of blog posts. */
export interface BlogCrumb {
  /** Text of the element, such as `~` or `blog`. */
  text: string;
  /** Link target; undefined for the current page and for `tags`, which has no page. */
  href?: string;
}

/**
 * Returns the elements of the breadcrumb of the page of `tag`'s posts, or of `/blog/` when `tag`
 * is undefined: `~` (the top page of `ja`) and `blog` (a link to `/blog/` on a tag's page, the
 * current page on `/blog/`), and on a tag's page `tags` (no link) and the tag's slug as the
 * current page. The last element is always the current page and has no `href`.
 */
export function blogCrumbs(tag: BlogTag | undefined): BlogCrumb[] {
  const home = { text: "~", href: homeSectionPath("ja", "top") };
  if (tag === undefined) {
    return [home, { text: "blog" }];
  }
  return [
    home,
    { text: "blog", href: BLOG_INDEX_PATH },
    { text: "tags" },
    { text: tagSlug(tag) },
  ];
}

/** The posts next to a post in the order of `/blog/`, newest first. `undefined` at an end. */
export interface AdjacentPosts<T> {
  /** The post one step older, shown as `prev`. `undefined` for the oldest post. */
  prev: T | undefined;
  /** The post one step newer, shown as `next`. `undefined` for the newest post. */
  next: T | undefined;
}

/**
 * Returns the posts next to the post with `slug` in the order of `postsNewestFirst(posts)`, the
 * order of `/blog/`: `prev` is the one right after it (one step older) and `next` the one right
 * before it (one step newer). Posts with the same date keep their order in `posts`, as in that
 * list. Both are `undefined` when `posts` has no other post or none has `slug`. `posts` is not
 * changed.
 */
export function adjacentPosts<
  T extends { data: Pick<BlogFrontmatter, "date" | "slug"> },
>(posts: readonly T[], slug: string): AdjacentPosts<T> {
  const ordered = postsNewestFirst(posts);
  const index = ordered.findIndex((post) => post.data.slug === slug);
  if (index === -1) {
    return { prev: undefined, next: undefined };
  }
  return {
    prev: ordered[index + 1],
    next: index === 0 ? undefined : ordered[index - 1],
  };
}

/**
 * Returns the `getStaticPaths` entries of the pages of posts: one for each of `posts`, in its
 * order, with the post as the prop `post` and the posts next to it as the props `prev` and
 * `next` (see `adjacentPosts`). The slug of an entry is the post's `data.slug`, which is also
 * the `id` of the entry in the `blog` collection.
 */
export function blogPostPaths<
  T extends { data: Pick<BlogFrontmatter, "date" | "slug"> },
>(posts: readonly T[]) {
  return posts.map((post) => ({
    params: { slug: post.data.slug },
    props: { post, ...adjacentPosts(posts, post.data.slug) },
  }));
}

/** Parts of the breadcrumb `~ / blog / <year> / <file>` of a post's page. */
export interface BlogPostBreadcrumb {
  /** Year of the post's date in Japan time, such as `2026`. */
  year: string;
  /** File name at the end, the post's slug and `.md`. */
  file: string;
}

/**
 * Returns the year and the file name of the breadcrumb of the post with `slug` and `date`. The
 * year is the year of `blogPostDate(date).text`, the date in Japan time, so it matches the date
 * shown on the page even when the year in UTC is a different one.
 */
export function blogPostBreadcrumb(
  slug: string,
  date: Date,
): BlogPostBreadcrumb {
  return { year: formatVideoDate(date).slice(0, 4), file: `${slug}.md` };
}

/** A post's date for its page: the text shown and the value of `<time datetime>`. */
export interface BlogPostDate {
  /** `date` in Japan time as `YYYY.MM.DD`, the same as the post cards. */
  text: string;
  /** `date` in UTC as an ISO 8601 string, such as `2026-01-01T00:00:00.000Z`. */
  dateTime: string;
}

/** Returns the text and the `datetime` value of `date` for the page of a post. */
export function blogPostDate(date: Date): BlogPostDate {
  return { text: formatVideoDate(date), dateTime: date.toISOString() };
}

/** Characters of Japanese text that are read in a minute. */
const CHARACTERS_PER_MINUTE = 500;

/**
 * Opening line of a fenced code block: a run of three or more backticks, which cannot be
 * followed by another backtick on the line, or of three or more tildes, indented up to 3 spaces.
 */
const FENCE_OPEN = /^ {0,3}(?:(`{3,})[^`]*|(~{3,}).*)$/;

/** Line made of nothing but a run of backticks or tildes, indented up to 3 spaces. */
const FENCE_RUN = /^ {0,3}(`{3,}|~{3,})\s*$/;

/**
 * Returns how many minutes `body` takes to read, as a whole number of at least 1.
 *
 * `body` is the Markdown of a post without its frontmatter. The reading time is the number of
 * characters other than whitespace, counted in code points, divided by 500 and rounded up. The
 * lines of fenced code blocks, fences included, are left out because code is skimmed. A block
 * ends at a fence of the same character that is at least as long as its opening fence, or at the
 * end of `body`. Markdown syntax outside the blocks is counted as it is. A missing or empty
 * `body` takes 1 minute.
 */
export function readingMinutes(body: string | undefined): number {
  let fence: string | undefined;
  let characters = 0;
  for (const line of (body ?? "").split(/\r?\n/)) {
    if (fence === undefined) {
      const open = FENCE_OPEN.exec(line);
      if (open === null) {
        characters += [...line.replace(/\s/g, "")].length;
      } else {
        fence = open[1] ?? open[2];
      }
      continue;
    }
    const run = FENCE_RUN.exec(line)?.[1];
    if (run?.[0] === fence[0] && run.length >= fence.length) {
      fence = undefined;
    }
  }
  return Math.max(1, Math.ceil(characters / CHARACTERS_PER_MINUTE));
}
