import { parseImageName } from "./images";

const DEFAULT_API_URL = "https://api.github.com";
const RECORD_PATH = "src/content/published.json";
const RECORD_URL_PATH = `/repos/neverclear86/lina-blog/contents/${RECORD_PATH}`;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
// Form of an entry's `date` (docs/publish-api.md): a UTC date-time to the second.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** One entry of `GET /articles`: a published article and its content hash. */
export type PublishedArticle = { slug: string; hash: string | null };

/** Result of {@link listPublishedArticles}. `message` explains a failure for the error body. */
export type PublishedArticlesResult =
  | { ok: true; articles: PublishedArticle[] }
  | { ok: false; message: string };

/**
 * An entry of the published record: the content hash of the article (or `null` for an article
 * whose publication stopped partway, as docs/publish-api.md says), its publication date and
 * the names of its images.
 */
export type PublishedEntry = {
  hash: string | null;
  date: string;
  images: string[];
};

/**
 * The published record, `src/content/published.json`, as docs/publish-api.md defines it.
 * `articles` maps each published slug to its entry.
 */
export type PublishedRecord = { articles: Record<string, PublishedEntry> };

/** Result of {@link readPublishedRecord}. `message` explains a failure for the error body. */
export type PublishedRecordResult =
  | { ok: true; record: PublishedRecord }
  | { ok: false; message: string };

/**
 * Tells whether `value` is a `date` of the published record: {@link DATE_PATTERN} on a real
 * calendar date and time. `Date.parse` rolls `2026-02-30` over to March, so the parsed time is
 * turned back into a string and compared.
 */
function isRecordDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(value);
  return (
    !Number.isNaN(time) &&
    new Date(time).toISOString() === value.replace("Z", ".000Z")
  );
}

/**
 * Reads the published record (`src/content/published.json` of this repository) at `ref` through
 * the GitHub contents API and checks it against the form in docs/publish-api.md.
 *
 * - When GitHub answers 404 (no such file at `ref`, or no such `ref`), the record is empty.
 * - When GitHub cannot be reached or answers another non-2xx status, it fails.
 * - When the file is not JSON or has no `articles` object, it fails. It also fails when an
 *   entry's `hash` is neither 64 lowercase hexadecimal digits nor `null`, its `date` is not a
 *   real UTC date-time to the second (`2026-09-28T12:34:56Z`), or its `images` is not an array
 *   of names that {@link parseImageName} accepts.
 * - Only `articles` and the `hash`, `date` and `images` of each entry are kept; other fields
 *   are dropped.
 *
 * @param options.token GitHub token sent as `Authorization: Bearer <token>`.
 * @param options.apiUrl Base URL of the GitHub API. `https://api.github.com` when not given.
 * @param options.ref Branch name or commit SHA to read at, sent as the `ref` query.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that
 *   they never reach the network.
 * @returns The record, or a failure with a message. It never throws.
 */
export async function readPublishedRecord(
  { token, apiUrl, ref }: { token: string; apiUrl?: string; ref: string },
  fetchImpl: typeof fetch = fetch,
): Promise<PublishedRecordResult> {
  let text: string;
  try {
    const res = await fetchImpl(
      `${apiUrl ?? DEFAULT_API_URL}${RECORD_URL_PATH}?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          Accept: "application/vnd.github.raw+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "lina-blog-publish",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (res.status === 404) {
      return { ok: true, record: { articles: {} } };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `GitHub answered ${res.status} when reading ${RECORD_PATH}.`,
      };
    }
    text = await res.text();
  } catch {
    return {
      ok: false,
      message: `Could not reach GitHub to read ${RECORD_PATH}.`,
    };
  }

  const invalid = {
    ok: false,
    message: `${RECORD_PATH} on GitHub is not a valid published record.`,
  } as const;
  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    return invalid;
  }
  const articles = (record as { articles?: unknown } | null)?.articles;
  if (
    typeof articles !== "object" ||
    articles === null ||
    Array.isArray(articles)
  ) {
    return invalid;
  }
  const entries: [string, PublishedEntry][] = [];
  for (const [slug, entry] of Object.entries(articles)) {
    const { hash, date, images } = (entry ?? {}) as {
      hash?: unknown;
      date?: unknown;
      images?: unknown;
    };
    if (
      (hash !== null &&
        !(typeof hash === "string" && HASH_PATTERN.test(hash))) ||
      !isRecordDate(date) ||
      !Array.isArray(images) ||
      !images.every(
        (name) => typeof name === "string" && parseImageName(name) !== null,
      )
    ) {
      return invalid;
    }
    entries.push([slug, { hash, date, images: [...images] }]);
  }
  return {
    ok: true,
    record: { articles: Object.fromEntries(entries) },
  };
}

/**
 * Lists the articles of the published record on `main` ({@link readPublishedRecord} with `ref`
 * `main`) in ascending order of slug, with the stored content hash of each. The hashes are not
 * computed here. It fails when the record cannot be read or does not have the documented form.
 *
 * @param options.token GitHub token sent as `Authorization: Bearer <token>`.
 * @param options.apiUrl Base URL of the GitHub API. `https://api.github.com` when not given.
 * @param fetchImpl The `fetch` to call, passed to {@link readPublishedRecord}.
 * @returns The articles, or a failure with a message. It never throws.
 */
export async function listPublishedArticles(
  { token, apiUrl }: { token: string; apiUrl?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<PublishedArticlesResult> {
  const result = await readPublishedRecord(
    { token, apiUrl, ref: "main" },
    fetchImpl,
  );
  if (!result.ok) return result;
  const list = Object.entries(result.record.articles).map(
    ([slug, { hash }]) => ({ slug, hash }),
  );
  list.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return { ok: true, articles: list };
}

/**
 * Returns a copy of `record` in which `slug` has `entry`, added or in place of the old entry.
 * The given record is not changed.
 *
 * @param record The published record to start from.
 * @param slug The slug of the article.
 * @param entry The new entry of the article.
 * @returns The new record.
 */
export function withPublishedEntry(
  record: PublishedRecord,
  slug: string,
  entry: PublishedEntry,
): PublishedRecord {
  return { articles: { ...record.articles, [slug]: entry } };
}

/**
 * Returns a copy of `record` without the entry of `slug`. The given record is not changed, and
 * a `slug` that has no entry gives a copy of the whole record.
 *
 * @param record The published record to start from.
 * @param slug The slug of the article to leave out.
 * @returns The new record.
 */
export function withoutPublishedEntry(
  record: PublishedRecord,
  slug: string,
): PublishedRecord {
  return {
    articles: Object.fromEntries(
      Object.entries(record.articles).filter(([key]) => key !== slug),
    ),
  };
}

/**
 * Lists the images that only the article `slug` refers to, that is, the images of its entry
 * that no other entry of `record` has in its `images`.
 *
 * What refers to an image is read from the `images` of the entries, not from the text of the
 * articles on GitHub, so that this needs no request. Every other entry counts, also one whose
 * `hash` is `null` (its publication stopped partway), because its article file was committed
 * to `main` in the same commit as its entry. An article whose images are already in R2 but
 * whose entry is not written yet is not seen, so `record` should be the latest one on `main`.
 * The result is read from `record` as given: once the entry of `slug` is gone, nothing is
 * left to read.
 *
 * @param record The published record.
 * @param slug The slug of the article.
 * @returns The names in the order of the entry's `images`, each once. It is empty when
 *   `record` has no entry of `slug`; the caller tells that case apart with `Object.hasOwn`.
 */
export function exclusiveImages(
  record: PublishedRecord,
  slug: string,
): string[] {
  if (!Object.hasOwn(record.articles, slug)) return [];
  const shared = new Set<string>();
  for (const [key, { images }] of Object.entries(record.articles)) {
    if (key === slug) continue;
    for (const name of images) shared.add(name);
  }
  return [...new Set(record.articles[slug].images)].filter(
    (name) => !shared.has(name),
  );
}

/**
 * Writes the published record in the form of docs/publish-api.md: slugs in ascending order of
 * UTF-16 code units, the fields of each entry in the order `hash`, `date`, `images`, and
 * `JSON.stringify(value, null, 2)` followed by one newline.
 * JavaScript puts keys that are array indices (such as `9`) before the others, so such keys
 * would not be in order. The slugs of `src/blog-schema.ts` are never array indices.
 *
 * @param record The published record.
 * @returns The content of `src/content/published.json`.
 */
export function serializePublishedRecord(record: PublishedRecord): string {
  const articles = Object.fromEntries(
    Object.keys(record.articles)
      .sort()
      .map((slug) => {
        const { hash, date, images } = record.articles[slug] as PublishedEntry;
        return [slug, { hash, date, images }];
      }),
  );
  return `${JSON.stringify({ articles }, null, 2)}\n`;
}
