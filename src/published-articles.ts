/**
 * Which blog posts are on Nostr, read from the published record, `src/content/published.json`
 * (docs/publish-api.md). The record is read in Node at build time, by
 * `src/published-articles-source.ts`, and `linaPublishedSlugs()` in `astro.config.mjs` exports
 * the result as the virtual module `virtual:lina-published-slugs`. This module only parses and
 * looks up, and imports nothing from Node, so it can be imported by pages, which are prerendered
 * in workerd.
 */

const HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Parses the text of a published record and returns the slugs that are on Nostr: the slugs of
 * the entries whose `hash` is a content hash (64 lowercase hexadecimal digits) and not `null`.
 * The publish Worker posts to Nostr (step 4) before it writes the `hash` (step 6), so an entry
 * with a `hash` has been posted, and an entry with `hash: null` may not have been. A slug that
 * has no entry is not on Nostr either.
 *
 * Only `articles` and the `hash` of each entry are checked; the other fields are not read.
 *
 * @param text The content of the published record.
 * @param source Name of the file, used in the message of the error.
 * @returns The slugs of the entries that have a `hash`.
 * @throws {Error} When `text` is not JSON, `articles` is not an object, an entry is not an
 *   object, or an entry's `hash` is neither a content hash nor `null`. The message names
 *   `source` and says which part is wrong.
 */
export function parseNostrPublishedSlugs(
  text: string,
  source: string,
): Set<string> {
  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    throw new Error(`${source} is not valid JSON.`);
  }
  const articles = (record as { articles?: unknown } | null)?.articles;
  if (
    typeof articles !== "object" ||
    articles === null ||
    Array.isArray(articles)
  ) {
    throw new Error(`${source} has no "articles" object.`);
  }
  const slugs = new Set<string>();
  for (const [slug, entry] of Object.entries(articles)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`${source}: the entry of "${slug}" is not an object.`);
    }
    const hash = (entry as { hash?: unknown }).hash;
    if (hash === null) continue;
    if (typeof hash !== "string" || !HASH_PATTERN.test(hash)) {
      throw new Error(
        `${source}: the "hash" of "${slug}" is neither 64 lowercase hexadecimal digits nor null.`,
      );
    }
    slugs.add(slug);
  }
  return slugs;
}

/**
 * Tells whether the post with `slug` is on Nostr.
 *
 * @param slug The slug of the post.
 * @param published The slugs that are on Nostr, `nostrPublishedSlugs` of
 *   `virtual:lina-published-slugs`.
 */
export function isNostrPublished(
  slug: string,
  published: ReadonlySet<string>,
): boolean {
  return published.has(slug);
}
