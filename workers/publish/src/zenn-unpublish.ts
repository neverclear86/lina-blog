import { commitFiles, getMainHead } from "./github-commit";
import { zennArticlePath } from "./zenn-article";

const DEFAULT_API_URL = "https://api.github.com";
const ZENN_REPO = "neverclear86/zenn-contents";
const ZENN_BRANCH = "master";
// The `published` line of a Zenn article's frontmatter: the key, the value, and the blanks
// (and the CR of a CRLF file) after it.
const PUBLISHED_LINE = /^(published:[ \t]*)(true|false)([ \t\r]*)$/;

/**
 * Result of {@link unpublishZennArticle}. `zenn` is `null` when zenn-contents has no file for
 * the article, and `{ commit }` otherwise: the SHA of the commit that made the file
 * `published: false`, or `null` when it already was and no commit was made. `conflict` means
 * that `master` moved after it was read; `upstream_error` is any other failure.
 */
export type ZennUnpublishResult =
  | { ok: true; zenn: { commit: string | null } | null }
  | { ok: false; code: "conflict" | "upstream_error"; message: string };

/**
 * Sets `published: false` in the frontmatter of a Zenn article file.
 *
 * Only the first line `published: true` or `published: false` between the opening `---` (the
 * first line) and the next `---` line is looked at, and only its `true` is replaced; the other
 * lines, the line endings and the whitespace after the value stay as they are. The text is
 * returned as it is when the value already is `false`.
 *
 * @param text The whole text of the file.
 * @returns The new text, or `null` when the file has no frontmatter or the frontmatter has no
 *   line `published: true` or `published: false`.
 */
export function markZennUnpublished(text: string): string | null {
  const lines = text.split("\n");
  if (lines[0]?.trimEnd() !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trimEnd() === "---") return null;
    const match = PUBLISHED_LINE.exec(line);
    if (match) {
      lines[i] = `${match[1]}false${match[3]}`;
      return lines.join("\n");
    }
  }
  return null;
}

/**
 * Makes the article `slug` in zenn-contents `published: false`, because Zenn does not take
 * an article down when its file is deleted. It reads the article's file in zenn-contents and
 * changes only its `published` line, so that the body stays as it is. It sends at most 6
 * requests, in this order:
 *
 * 1. `GET git/ref/heads/master` for the commit to read and to commit on.
 * 2. `GET contents/articles/{slug}.md` at that commit.
 * 3. {@link commitFiles} on that commit, which sends 4 requests.
 *
 * - When the file does not exist (404), the article was never copied to Zenn and nothing is
 *   written: `zenn` is `null`.
 * - When the file already is `published: false`, nothing is written: `commit` is `null`.
 * - When `master` moved after it was read, so that the ref cannot be fast-forwarded, it fails
 *   with `conflict`.
 * - When the file has no `published` line to rewrite, or GitHub cannot be reached or answers
 *   any other non-2xx status, it fails with `upstream_error`.
 *
 * @param options.token GitHub token sent as `Authorization: Bearer <token>`. It needs read and
 *   write access to the contents of zenn-contents.
 * @param options.apiUrl Base URL of the GitHub API. `https://api.github.com` when not given.
 * @param options.slug The slug of the article, which is also the file name on Zenn.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that
 *   they never reach the network.
 * @returns The outcome, or a failure with its code and message. It never throws.
 */
export async function unpublishZennArticle(
  { token, apiUrl, slug }: { token: string; apiUrl?: string; slug: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ZennUnpublishResult> {
  const head = await getMainHead(
    { token, apiUrl, repo: ZENN_REPO, branch: ZENN_BRANCH },
    fetchImpl,
  );
  if (!head.ok) {
    return { ok: false, code: "upstream_error", message: head.message };
  }

  const path = zennArticlePath(slug);
  let text: string;
  try {
    const res = await fetchImpl(
      `${apiUrl ?? DEFAULT_API_URL}/repos/${ZENN_REPO}/contents/${path}?ref=${head.sha}`,
      {
        headers: {
          Accept: "application/vnd.github.raw+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "lina-blog-publish",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (res.status === 404) return { ok: true, zenn: null };
    if (!res.ok) {
      return {
        ok: false,
        code: "upstream_error",
        message: `GitHub answered ${res.status} when reading ${path} of ${ZENN_REPO}.`,
      };
    }
    text = await res.text();
  } catch {
    return {
      ok: false,
      code: "upstream_error",
      message: `Could not reach GitHub to read ${path} of ${ZENN_REPO}.`,
    };
  }

  const next = markZennUnpublished(text);
  if (next === null) {
    return {
      ok: false,
      code: "upstream_error",
      message: `${path} of ${ZENN_REPO} has no published line in its frontmatter.`,
    };
  }
  if (next === text) return { ok: true, zenn: { commit: null } };

  const committed = await commitFiles(
    {
      token,
      apiUrl,
      repo: ZENN_REPO,
      branch: ZENN_BRANCH,
      message: `content: ${slug} を非公開にする`,
      files: [{ path, content: next }],
      parent: head.sha,
    },
    fetchImpl,
  );
  if (!committed.ok) return committed;
  return { ok: true, zenn: { commit: committed.commit } };
}
