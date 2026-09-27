import type { BlogFrontmatter } from "../../../src/blog-schema";

/**
 * Frontmatter of an article: the schema of `src/blog-schema.ts` without `date`, already
 * validated.
 */
type ArticleFrontmatter = Omit<BlogFrontmatter, "date">;

/**
 * A kind 30023 (NIP-23 long-form content) event before signing. It has no `pubkey`, `id` or
 * `sig`.
 */
export type ArticleEventTemplate = {
  kind: 30023;
  created_at: number;
  tags: string[][];
  content: string;
};

/**
 * Builds the kind 30023 (NIP-23 long-form content) event of an article, before signing.
 *
 * The tags are, in this order: `d` (the slug), `title`, `published_at`, `summary` (the
 * description), one `t` for each value of `tags` in order, and `sponsor` with the sponsor's
 * name only when the frontmatter has `sponsor`. There is no `image` tag. `emoji`, `topics` and
 * the sponsor's `url` are not used.
 *
 * @param options.frontmatter The validated frontmatter of the article.
 * @param options.body The Markdown of the article without the frontmatter, with the image
 *   references already replaced. It becomes `content` as is, without trimming.
 * @param options.publishedDate `date` of the article in the published record, an ISO 8601
 *   date-time. `published_at` is its UNIX time in seconds, rounded down; it does not depend
 *   on `now`.
 * @param options.now The time the event is created. `created_at` is its UNIX time in seconds,
 *   rounded down.
 * @returns The event without `pubkey`, `id` and `sig`.
 * @throws RangeError `Invalid published date: <publishedDate>` when `Date.parse` cannot read
 *   `publishedDate`.
 */
export function buildArticleEvent(options: {
  frontmatter: ArticleFrontmatter;
  body: string;
  publishedDate: string;
  now: Date;
}): ArticleEventTemplate {
  const { frontmatter, body, publishedDate, now } = options;
  const publishedMs = Date.parse(publishedDate);
  if (Number.isNaN(publishedMs)) {
    throw new RangeError(`Invalid published date: ${publishedDate}`);
  }
  const tags = [
    ["d", frontmatter.slug],
    ["title", frontmatter.title],
    ["published_at", String(Math.floor(publishedMs / 1000))],
    ["summary", frontmatter.description],
    ...frontmatter.tags.map((tag) => ["t", tag]),
  ];
  if (frontmatter.sponsor !== undefined) {
    tags.push(["sponsor", frontmatter.sponsor.name]);
  }
  return {
    kind: 30023,
    created_at: Math.floor(now.getTime() / 1000),
    tags,
    content: body,
  };
}
