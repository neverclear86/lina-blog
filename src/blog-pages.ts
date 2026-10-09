/**
 * Paths, texts, breadcrumbs and tag filter links of the pages of blog posts: `/blog/`, which
 * lists every post, and `/blog/tags/<slug>/`, which lists the posts of one tag.
 */
import { blogSchema } from "./blog-schema";
import { homeSectionPath } from "./components/site-nav";
import type { UiKey } from "./i18n/ui";
import { type BlogTag, tagPath, tagSlug } from "./latest-posts";

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
