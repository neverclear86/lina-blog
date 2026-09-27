import { sha256 } from "hono/utils/crypto";

/**
 * Computes the content hash of an article: the SHA-256 of `markdown` encoded as UTF-8, as 64
 * lowercase hexadecimal digits. The string is hashed as is, without normalizing line breaks,
 * the BOM or Unicode; `docs/publish-api.md` leaves the normalization to the sender.
 *
 * @param markdown The Markdown of the article, frontmatter included.
 * @returns The hash in lowercase hexadecimal.
 * @throws Error `crypto.subtle is not available` when the runtime has no `crypto.subtle`,
 *   which Workers and Node.js both have.
 */
export async function contentHash(markdown: string): Promise<string> {
  const hash = await sha256(markdown);
  if (hash === null) {
    throw new Error("crypto.subtle is not available");
  }
  return hash;
}
