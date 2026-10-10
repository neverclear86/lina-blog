/**
 * Reads the published records from disk for `virtual:lina-published-slugs`, which
 * `astro.config.mjs` builds. Node only (`node:fs`): pages are prerendered in workerd, so they
 * import the virtual module instead of this file.
 */
import { readFileSync } from "node:fs";
import { parseNostrPublishedSlugs } from "./published-articles.ts";

/** A published record: the file and its name in messages. */
type RecordFile = { file: URL; name: string };

/** The published record that the publish Worker writes (docs/publish-api.md). */
const PUBLISHED_RECORD: RecordFile = {
  file: new URL("./content/published.json", import.meta.url),
  name: "src/content/published.json",
};

/**
 * The published record of the sample posts in `src/content/blog-dev/`. It is read only when the
 * posts are (`astro dev`, or `astro build` with `LINA_DEV_PAGES=1`).
 */
const DEV_PUBLISHED_RECORD: RecordFile = {
  file: new URL("./content/blog-dev/published.json", import.meta.url),
  name: "src/content/blog-dev/published.json",
};

/**
 * Reads the published record at `file` and returns the slugs that are on Nostr
 * ({@link parseNostrPublishedSlugs}). A missing file is an empty record, so no post is on Nostr
 * and the build goes on; any other failure to read the file is thrown.
 *
 * @param file The published record.
 * @param name Name of the file, used in the message of the error.
 * @returns The slugs that are on Nostr.
 * @throws {Error} When the file exists but does not have the form of docs/publish-api.md.
 */
export function readNostrPublishedSlugs(file: URL, name: string): Set<string> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
  return parseNostrPublishedSlugs(text, name);
}

/**
 * Returns the slugs that are on Nostr: those of `src/content/published.json`, and with `dev`
 * also those of `src/content/blog-dev/published.json` ({@link readNostrPublishedSlugs}).
 *
 * @param dev Whether the sample posts are read (`devPagesEnabled` in `src/dev/dev-pages.ts`).
 * @returns The slugs that are on Nostr.
 * @throws {Error} When a record exists but does not have the form of docs/publish-api.md.
 */
export function loadNostrPublishedSlugs(dev: boolean): Set<string> {
  const records = dev
    ? [PUBLISHED_RECORD, DEV_PUBLISHED_RECORD]
    : [PUBLISHED_RECORD];
  const slugs = new Set<string>();
  for (const { file, name } of records) {
    for (const slug of readNostrPublishedSlugs(file, name)) slugs.add(slug);
  }
  return slugs;
}
