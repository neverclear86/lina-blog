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

/**
 * A kind 5 (NIP-09 deletion request) event before signing. It has no `pubkey`, `id` or `sig`.
 */
export type DeletionEventTemplate = {
  kind: 5;
  created_at: number;
  tags: string[][];
  content: string;
};

/**
 * Builds the kind 5 (NIP-09 deletion request) event that asks to delete the kind 30023 event
 * of an article, before signing.
 *
 * The tags are, in this order: `a` with `30023:<pubkey>:<slug>`, and `k` with `30023`.
 * `content` is empty. Relays that follow NIP-09 delete every version of the article up to
 * `created_at`.
 *
 * @param options.pubkey The author's public key in lowercase hex, the `pubkey` of the article's
 *   event. It is used as is, without checking.
 * @param options.slug The slug of the article, the `d` tag of the article's event.
 * @param options.now The time the event is created. `created_at` is its UNIX time in seconds,
 *   rounded down.
 * @returns The event without `pubkey`, `id` and `sig`.
 */
export function buildDeletionEvent(options: {
  pubkey: string;
  slug: string;
  now: Date;
}): DeletionEventTemplate {
  const { pubkey, slug, now } = options;
  return {
    kind: 5,
    created_at: Math.floor(now.getTime() / 1000),
    tags: [
      ["a", `30023:${pubkey}:${slug}`],
      ["k", "30023"],
    ],
    content: "",
  };
}
