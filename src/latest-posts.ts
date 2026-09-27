/**
 * Orders and labels blog posts for the lists of posts: the posts newest first by date, the posts
 * with a tag, the chip tone of each tag, and the URL slug and path of each tag's list.
 */
import type { BlogFrontmatter } from "./blog-schema";

/** A tag of a blog post, one of the values `blogSchema` allows. */
export type BlogTag = BlogFrontmatter["tags"][number];

/** Tone of the chip that shows a tag, one of the tones of `src/components/Chip.astro`. */
export type TagChipTone = "orange" | "neutral";

/** Tone of each tag's chip. A post about making something stands out in orange. */
const TAG_CHIP_TONES: Record<BlogTag, TagChipTone> = {
  制作記: "orange",
  技術: "neutral",
  日記: "neutral",
};

/** URL slug of a tag, used in the path of the tag's list and in its `blog.tag.*` UI key. */
export type TagSlug = "devlog" | "tech" | "diary";

/** URL slug of each tag. */
const TAG_SLUGS: Record<BlogTag, TagSlug> = {
  制作記: "devlog",
  技術: "tech",
  日記: "diary",
};

/**
 * Returns all of `posts`, newest first by `data.date`. Posts with the same date keep their order
 * in `posts`. `posts` is not changed.
 */
export function postsNewestFirst<
  T extends { data: Pick<BlogFrontmatter, "date"> },
>(posts: readonly T[]): T[] {
  return [...posts].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}

/**
 * Returns the newest `limit` posts, newest first by `data.date`. Posts with the same date keep
 * their order in `posts`. `posts` is not changed.
 */
export function newestPosts<T extends { data: Pick<BlogFrontmatter, "date"> }>(
  posts: readonly T[],
  limit: number,
): T[] {
  return postsNewestFirst(posts).slice(0, limit);
}

/**
 * Returns the posts of `posts` that have `tag`, newest first by `data.date`. Posts with the same
 * date keep their order in `posts`. `posts` is not changed.
 */
export function postsWithTag<
  T extends { data: Pick<BlogFrontmatter, "date" | "tags"> },
>(posts: readonly T[], tag: BlogTag): T[] {
  return postsNewestFirst(posts.filter((post) => post.data.tags.includes(tag)));
}

/** Returns the URL slug of `tag`, such as `tech` for 技術. */
export function tagSlug(tag: BlogTag): TagSlug {
  return TAG_SLUGS[tag];
}

/** Returns the path of the list of posts with `tag`, such as `/blog/tags/tech/`. */
export function tagPath(tag: BlogTag): string {
  return `/blog/tags/${tagSlug(tag)}/`;
}

/** Returns the tone of the chip that shows `tag`. */
export function tagChipTone(tag: BlogTag): TagChipTone {
  return TAG_CHIP_TONES[tag];
}
