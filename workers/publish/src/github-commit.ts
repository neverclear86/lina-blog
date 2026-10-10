const DEFAULT_API_URL = "https://api.github.com";
const GIT_URL_PATH = "/repos/neverclear86/lina-blog/git";
const SHA_PATTERN = /^[0-9a-f]{40}$/;

/** One file that {@link commitFiles} writes: its path in the repository and its whole text. */
export type CommitFile = { path: string; content: string };

/** Result of {@link getMainHead}. `message` explains a failure for the error body. */
export type MainHeadResult =
  | { ok: true; sha: string }
  | { ok: false; message: string };

/**
 * Result of {@link commitFiles}. `commit` is the SHA of the new commit, or `null` when the
 * files already had this content, no path was left to delete, and no commit was made.
 * `conflict` means that `main` moved after the parent; `upstream_error` is any other failure
 * of GitHub.
 */
export type CommitFilesResult =
  | { ok: true; commit: string | null }
  | { ok: false; code: "conflict" | "upstream_error"; message: string };

/**
 * Outcome of one request to GitHub. `status` is the status of a non-2xx answer, and `null`
 * when GitHub could not be reached or answered a body that is not JSON.
 */
type GitHubResponse =
  | { ok: true; body: unknown }
  | { ok: false; status: number | null; message: string };

/**
 * Sends one request to the Git database API of this repository and reads its JSON body.
 *
 * @param fetchImpl The `fetch` to call, as a plain function (see {@link commitFiles}).
 * @param url Full URL of the request.
 * @param token GitHub token sent as `Authorization: Bearer <token>`.
 * @param what What the request does, as a phrase for the messages, such as `creating a tree`.
 * @param send Method and JSON payload of a `POST` or `PATCH`. A `GET` is sent when it is not
 *   given. The body of a `PATCH` answer is not read.
 * @returns The parsed body (`null` for a `PATCH`), or a failure with its status and message.
 *   It never throws.
 */
async function requestGitHub(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  what: string,
  send?: { method: "POST" | "PATCH"; payload: unknown },
): Promise<GitHubResponse> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "lina-blog-publish",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  let res: Response;
  try {
    res = await fetchImpl(
      url,
      send
        ? {
            method: send.method,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(send.payload),
          }
        : { headers },
    );
  } catch {
    return {
      ok: false,
      status: null,
      message: `Could not reach GitHub when ${what}.`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `GitHub answered ${res.status} when ${what}.`,
    };
  }
  if (send?.method === "PATCH") {
    return { ok: true, body: null };
  }
  try {
    return { ok: true, body: await res.json() };
  } catch {
    return {
      ok: false,
      status: null,
      message: `GitHub answered an unexpected body when ${what}.`,
    };
  }
}

/** Returns `value` when it is a SHA of 40 lowercase hexadecimal digits, otherwise `null`. */
function asSha(value: unknown): string | null {
  return typeof value === "string" && SHA_PATTERN.test(value) ? value : null;
}

/**
 * Reads the commit SHA that `refs/heads/main` of this repository points to, through the Git
 * database API of GitHub. A caller that reads other files at this SHA passes it to
 * {@link commitFiles} as `parent`, so that the commit is made on top of what it read.
 *
 * - When GitHub cannot be reached or answers a non-2xx status (404 included), it fails.
 * - When the answer has no `object.sha` of 40 lowercase hexadecimal digits, it fails.
 *
 * @param options.token GitHub token sent as `Authorization: Bearer <token>`.
 * @param options.apiUrl Base URL of the GitHub API. `https://api.github.com` when not given.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that
 *   they never reach the network.
 * @returns The SHA, or a failure with a message. It never throws.
 */
export async function getMainHead(
  { token, apiUrl }: { token: string; apiUrl?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<MainHeadResult> {
  const what = "reading refs/heads/main";
  const res = await requestGitHub(
    fetchImpl,
    `${apiUrl ?? DEFAULT_API_URL}${GIT_URL_PATH}/ref/heads/main`,
    token,
    what,
  );
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  const sha = asSha(
    (res.body as { object?: { sha?: unknown } } | null)?.object?.sha,
  );
  if (sha === null) {
    return {
      ok: false,
      message: `GitHub answered an unexpected body when ${what}.`,
    };
  }
  return { ok: true, sha };
}

/**
 * Writes and deletes files on `main` of this repository in one commit, through the Git
 * database API of GitHub. It sends at most 6 requests, in this order:
 *
 * 1. `GET git/ref/heads/main` for the parent commit, skipped when `parent` is given.
 * 2. `GET git/commits/{parent}` for the tree of the parent.
 * 3. `GET git/trees/{tree}?recursive=1` for the files of the parent, skipped when `deletes` is
 *    empty. A path to delete that is not a file of the parent, or that `files` writes, is left
 *    out, because GitHub refuses to delete a file that does not exist.
 * 4. `POST git/trees` with that tree as `base_tree`, each file as a blob entry of mode `100644`
 *    with its `content`, and each path left to delete as a blob entry with `sha: null`. Files
 *    of the parent that are not given stay as they are.
 * 5. `POST git/commits` with `message`, the new tree and the parent.
 * 6. `PATCH git/refs/heads/main` with the new commit and `force: false`.
 *
 * - When there is no file to write and no path left to delete, it sends no request 4 and
 *   makes no commit.
 * - When the new tree is the tree of the parent, it stops after request 4 and makes no commit.
 * - When request 6 is answered 422, GitHub refused an update that is not a fast forward:
 *   `main` has moved after the parent, and it fails with `conflict`. The new commit is left
 *   unreferenced.
 * - When GitHub cannot be reached, answers another non-2xx status (a 422 of requests 1 to 5
 *   included), answers requests 1, 2, 4 and 5 without the SHA it needs, or answers request 3
 *   without a `tree` array or with `truncated` that is not `false`, it fails with
 *   `upstream_error`.
 *
 * @param options.token GitHub token sent as `Authorization: Bearer <token>`. It needs write
 *   access to the contents of this repository.
 * @param options.apiUrl Base URL of the GitHub API. `https://api.github.com` when not given.
 * @param options.message Commit message.
 * @param options.files Files to write. A path that the parent already has is replaced.
 * @param options.deletes Paths of files to delete, relative to the root of the repository.
 *   Empty when not given.
 * @param options.parent Commit SHA to commit on, as {@link getMainHead} returned it. When it is
 *   not given, the SHA that `refs/heads/main` points to is read first.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that
 *   they never reach the network.
 * @returns The SHA of the new commit, `null` when no commit was made, or a failure with its
 *   code and message. It never throws.
 */
export async function commitFiles(
  {
    token,
    apiUrl,
    message,
    files,
    deletes = [],
    parent,
  }: {
    token: string;
    apiUrl?: string;
    message: string;
    files: CommitFile[];
    deletes?: string[];
    parent?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<CommitFilesResult> {
  const base = `${apiUrl ?? DEFAULT_API_URL}${GIT_URL_PATH}`;
  const upstream = (text: string) =>
    ({ ok: false, code: "upstream_error", message: text }) as const;
  const unexpected = (what: string) =>
    upstream(`GitHub answered an unexpected body when ${what}.`);

  let parentSha = parent;
  if (parentSha === undefined) {
    const head = await getMainHead({ token, apiUrl }, fetchImpl);
    if (!head.ok) {
      return upstream(head.message);
    }
    parentSha = head.sha;
  }

  let what = `reading commit ${parentSha}`;
  const parentCommit = await requestGitHub(
    fetchImpl,
    `${base}/commits/${parentSha}`,
    token,
    what,
  );
  if (!parentCommit.ok) {
    return upstream(parentCommit.message);
  }
  const parentTree = asSha(
    (parentCommit.body as { tree?: { sha?: unknown } } | null)?.tree?.sha,
  );
  if (parentTree === null) {
    return unexpected(what);
  }

  let present: string[] = [];
  if (deletes.length > 0) {
    what = `reading tree ${parentTree}`;
    const listed = await requestGitHub(
      fetchImpl,
      `${base}/trees/${parentTree}?recursive=1`,
      token,
      what,
    );
    if (!listed.ok) {
      return upstream(listed.message);
    }
    const body = listed.body as { tree?: unknown; truncated?: unknown } | null;
    if (!Array.isArray(body?.tree) || body.truncated !== false) {
      return unexpected(what);
    }
    const blobs = new Set(
      body.tree
        .filter(
          (entry) => (entry as { type?: unknown } | null)?.type === "blob",
        )
        .map((entry) => (entry as { path: unknown }).path),
    );
    const written = new Set(files.map(({ path }) => path));
    present = deletes.filter((path) => blobs.has(path) && !written.has(path));
  }
  const entries = [
    ...files.map(({ path, content }) => ({
      path,
      mode: "100644",
      type: "blob",
      content,
    })),
    ...present.map((path) => ({
      path,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];
  if (entries.length === 0) {
    return { ok: true, commit: null };
  }

  what = "creating a tree";
  const created = await requestGitHub(fetchImpl, `${base}/trees`, token, what, {
    method: "POST",
    payload: { base_tree: parentTree, tree: entries },
  });
  if (!created.ok) {
    return upstream(created.message);
  }
  const tree = asSha((created.body as { sha?: unknown } | null)?.sha);
  if (tree === null) {
    return unexpected(what);
  }
  if (tree === parentTree) {
    return { ok: true, commit: null };
  }

  what = "creating a commit";
  const commit = await requestGitHub(
    fetchImpl,
    `${base}/commits`,
    token,
    what,
    { method: "POST", payload: { message, tree, parents: [parentSha] } },
  );
  if (!commit.ok) {
    return upstream(commit.message);
  }
  const sha = asSha((commit.body as { sha?: unknown } | null)?.sha);
  if (sha === null) {
    return unexpected(what);
  }

  what = "updating refs/heads/main";
  const updated = await requestGitHub(
    fetchImpl,
    `${base}/refs/heads/main`,
    token,
    what,
    { method: "PATCH", payload: { sha, force: false } },
  );
  if (!updated.ok) {
    if (updated.status === 422) {
      return {
        ok: false,
        code: "conflict",
        message: `refs/heads/main on GitHub is no longer ${parentSha}; another publish moved it.`,
      };
    }
    return upstream(updated.message);
  }
  return { ok: true, commit: sha };
}
