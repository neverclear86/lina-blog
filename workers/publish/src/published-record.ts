const DEFAULT_API_URL = "https://api.github.com";
const RECORD_PATH = "src/content/published.json";
const RECORD_URL_PATH = `/repos/neverclear86/lina-blog/contents/${RECORD_PATH}?ref=main`;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** One entry of `GET /articles`: a published article and its content hash. */
export type PublishedArticle = { slug: string; hash: string | null };

/** Result of {@link listPublishedArticles}. `message` explains a failure for the error body. */
export type PublishedArticlesResult =
  | { ok: true; articles: PublishedArticle[] }
  | { ok: false; message: string };

/**
 * Reads the published record (`src/content/published.json` on `main` of this repository)
 * through the GitHub contents API and lists its articles in ascending order of slug, with
 * the stored content hash of each. The hashes are not computed here.
 *
 * - When the file does not exist (404), the list is empty.
 * - When GitHub cannot be reached or answers another non-2xx status, it fails.
 * - When the file is not JSON, has no `articles` object, or has an entry whose `hash` is
 *   neither 64 lowercase hexadecimal digits nor `null`, it fails. Other fields of an entry
 *   (`date`, `images`) are not checked.
 *
 * @param options.token GitHub token sent as `Authorization: Bearer <token>`.
 * @param options.apiUrl Base URL of the GitHub API. `https://api.github.com` when not given.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that
 *   they never reach the network.
 * @returns The articles, or a failure with a message. It never throws.
 */
export async function listPublishedArticles(
  { token, apiUrl }: { token: string; apiUrl?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<PublishedArticlesResult> {
  let text: string;
  try {
    const res = await fetchImpl(
      `${apiUrl ?? DEFAULT_API_URL}${RECORD_URL_PATH}`,
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
      return { ok: true, articles: [] };
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
  const list: PublishedArticle[] = [];
  for (const [slug, entry] of Object.entries(articles)) {
    const hash = (entry as { hash?: unknown } | null)?.hash;
    if (
      hash !== null &&
      !(typeof hash === "string" && HASH_PATTERN.test(hash))
    ) {
      return invalid;
    }
    list.push({ slug, hash });
  }
  list.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return { ok: true, articles: list };
}
