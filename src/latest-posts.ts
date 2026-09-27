/**
 * Picks and labels blog posts for a list of the latest posts: the newest posts by date, and the
 * chip tone of each post's tag.
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

/**
 * Returns the newest `limit` posts, newest first by `data.date`. Posts with the same date keep
 * their order in `posts`. `posts` is not changed.
 */
export function newestPosts<T extends { data: Pick<BlogFrontmatter, "date"> }>(
  posts: readonly T[],
  limit: number,
): T[] {
  return [...posts]
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, limit);
}

/** Returns the tone of the chip that shows `tag`. */
export function tagChipTone(tag: BlogTag): TagChipTone {
  return TAG_CHIP_TONES[tag];
}
