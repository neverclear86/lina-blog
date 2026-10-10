import { describe, expect, it, vi } from "vitest";
import { commitFiles, getMainHead } from "./github-commit";

const TOKEN = "github-token";
const GIT = "https://api.github.com/repos/neverclear86/lina-blog/git";
const ZENN_GIT = "https://api.github.com/repos/neverclear86/zenn-contents/git";
const HEAD = "1".repeat(40);
const PARENT = "2".repeat(40);
const HEAD_TREE = "3".repeat(40);
const PARENT_TREE = "4".repeat(40);
const NEW_TREE = "5".repeat(40);
const NEW_COMMIT = "6".repeat(40);
const FILES = [
  { path: "src/content/published.json", content: '{"articles":{}}\n' },
  { path: "src/content/blog/hello.md", content: "# Hello\n" },
];

const ARTICLE = "src/content/blog/hello.md";
const RECORD = "src/content/published.json";
/** Entries of `HEAD_TREE` as `GET git/trees/{sha}?recursive=1` lists them. */
const HEAD_ENTRIES = [
  { path: "src", mode: "040000", type: "tree", sha: "7".repeat(40) },
  { path: "src/content", mode: "040000", type: "tree", sha: "8".repeat(40) },
  { path: RECORD, mode: "100644", type: "blob", sha: "9".repeat(40) },
  { path: ARTICLE, mode: "100644", type: "blob", sha: "a".repeat(40) },
];
const RECORD_FILE = { path: RECORD, content: '{"articles":{}}\n' };

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init);

/**
 * Returns a `fetch` stub that answers by `"<METHOD> <URL>"`. The default answers are those
 * of a successful write on top of `HEAD`; `overrides` replaces the answer of a key. A key it
 * does not know is answered 599. `git` is the base URL of the Git database API that it
 * answers for, and `branch` is the branch that `ref` and `refs` answer for.
 */
const stubGitHub = (
  overrides: Record<string, () => Response | Promise<Response>> = {},
  git = GIT,
  branch = "main",
) => {
  const answers: Record<string, () => Response | Promise<Response>> = {
    [`GET ${git}/ref/heads/${branch}`]: () => json({ object: { sha: HEAD } }),
    [`GET ${git}/commits/${HEAD}`]: () => json({ tree: { sha: HEAD_TREE } }),
    [`GET ${git}/commits/${PARENT}`]: () =>
      json({ tree: { sha: PARENT_TREE } }),
    [`GET ${git}/trees/${HEAD_TREE}?recursive=1`]: () =>
      json({ sha: HEAD_TREE, tree: HEAD_ENTRIES, truncated: false }),
    [`POST ${git}/trees`]: () => json({ sha: NEW_TREE }, { status: 201 }),
    [`POST ${git}/commits`]: () => json({ sha: NEW_COMMIT }, { status: 201 }),
    [`PATCH ${git}/refs/heads/${branch}`]: () =>
      json({ ref: `refs/heads/${branch}` }),
    ...overrides,
  };
  return vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    return answers[key]?.() ?? new Response("unknown", { status: 599 });
  });
};

/** The calls of a stub as `"<METHOD> <URL>"`, in order. */
const calls = (fetchImpl: ReturnType<typeof stubGitHub>) =>
  fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

/** The JSON body of the `n`th call of a stub. */
const bodyOf = (fetchImpl: ReturnType<typeof stubGitHub>, n: number) =>
  JSON.parse(String(fetchImpl.mock.calls[n]?.[1]?.body));

describe("getMainHead", () => {
  it("main の ref をトークンと User-Agent を付けて読み、その SHA を返す", async () => {
    const fetchImpl = stubGitHub();

    const result = await getMainHead({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({ ok: true, sha: HEAD });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]).toEqual([
      `${GIT}/ref/heads/main`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${TOKEN}`,
          "User-Agent": "lina-blog-publish",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    ]);
  });

  it("apiUrl を渡すとその基底 URL から読む", async () => {
    const git = "http://127.0.0.1:9999/repos/neverclear86/lina-blog/git";
    const fetchImpl = stubGitHub({}, git);

    const result = await getMainHead(
      { token: TOKEN, apiUrl: "http://127.0.0.1:9999" },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, sha: HEAD });
    expect(calls(fetchImpl)).toEqual([`GET ${git}/ref/heads/main`]);
  });

  it("repo と branch を渡すと、そのリポジトリのそのブランチの ref を読む", async () => {
    const fetchImpl = stubGitHub({}, ZENN_GIT, "master");

    const result = await getMainHead(
      { token: TOKEN, repo: "neverclear86/zenn-contents", branch: "master" },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, sha: HEAD });
    expect(calls(fetchImpl)).toEqual([`GET ${ZENN_GIT}/ref/heads/master`]);
  });

  it("repo だけを渡すと main を、branch だけを渡すと neverclear86/lina-blog を読む", async () => {
    const repoOnly = stubGitHub({}, ZENN_GIT);
    const branchOnly = stubGitHub({}, GIT, "master");

    await getMainHead(
      { token: TOKEN, repo: "neverclear86/zenn-contents" },
      repoOnly,
    );
    await getMainHead({ token: TOKEN, branch: "master" }, branchOnly);

    expect(calls(repoOnly)).toEqual([`GET ${ZENN_GIT}/ref/heads/main`]);
    expect(calls(branchOnly)).toEqual([`GET ${GIT}/ref/heads/master`]);
  });

  it("branch を渡したときの失敗の説明は、その ref の名前を含む", async () => {
    const fetchImpl = stubGitHub({
      [`GET ${GIT}/ref/heads/master`]: () =>
        new Response("Not Found", { status: 404 }),
    });

    const result = await getMainHead(
      { token: TOKEN, branch: "master" },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      message: "GitHub answered 404 when reading refs/heads/master.",
    });
  });

  it("GitHub が非 2xx を返すと、状態コードを含む説明で失敗を返す", async () => {
    const fetchImpl = stubGitHub({
      [`GET ${GIT}/ref/heads/main`]: () =>
        new Response("Not Found", { status: 404 }),
    });

    const result = await getMainHead({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "GitHub answered 404 when reading refs/heads/main.",
    });
  });

  it("GitHub に届かないときは失敗を返し、例外を投げない", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network down");
    });

    const result = await getMainHead({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "Could not reach GitHub when reading refs/heads/main.",
    });
  });

  it.each([
    ["JSON でない", () => new Response("not json")],
    ["object が無い", () => json({})],
    ["sha が 41 桁", () => json({ object: { sha: "1".repeat(41) } })],
    ["sha の前に文字がある", () => json({ object: { sha: `x${HEAD}` } })],
    ["sha が大文字の 16 進", () => json({ object: { sha: "A".repeat(40) } })],
  ])("応答の形が違う（%s）ときは失敗を返す", async (_name, answer) => {
    const fetchImpl = stubGitHub({ [`GET ${GIT}/ref/heads/main`]: answer });

    const result = await getMainHead({ token: TOKEN }, fetchImpl);

    expect(result.ok).toBe(false);
  });
});

describe("commitFiles", () => {
  it("main の先頭の tree を base_tree にしてファイルを 1 つのコミットで書き、ref を force: false で進める", async () => {
    const fetchImpl = stubGitHub();

    const result = await commitFiles(
      { token: TOKEN, message: "feat: publish", files: FILES },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    expect(calls(fetchImpl)).toEqual([
      `GET ${GIT}/ref/heads/main`,
      `GET ${GIT}/commits/${HEAD}`,
      `POST ${GIT}/trees`,
      `POST ${GIT}/commits`,
      `PATCH ${GIT}/refs/heads/main`,
    ]);
    expect(bodyOf(fetchImpl, 2)).toEqual({
      base_tree: HEAD_TREE,
      tree: FILES.map(({ path, content }) => ({
        path,
        mode: "100644",
        type: "blob",
        content,
      })),
    });
    expect(bodyOf(fetchImpl, 3)).toEqual({
      message: "feat: publish",
      tree: NEW_TREE,
      parents: [HEAD],
    });
    expect(bodyOf(fetchImpl, 4)).toEqual({ sha: NEW_COMMIT, force: false });
    expect(fetchImpl.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "lina-blog-publish",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  });

  it("apiUrl を渡すと 5 回の要求をすべてその基底 URL に送る", async () => {
    const git = "http://127.0.0.1:9999/repos/neverclear86/lina-blog/git";
    const fetchImpl = stubGitHub({}, git);

    const result = await commitFiles(
      {
        token: TOKEN,
        apiUrl: "http://127.0.0.1:9999",
        message: "m",
        files: FILES,
      },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    expect(calls(fetchImpl)).toEqual([
      `GET ${git}/ref/heads/main`,
      `GET ${git}/commits/${HEAD}`,
      `POST ${git}/trees`,
      `POST ${git}/commits`,
      `PATCH ${git}/refs/heads/main`,
    ]);
  });

  it("repo と branch を渡すと 5 回の要求をすべてそのリポジトリのそのブランチに送る", async () => {
    const fetchImpl = stubGitHub({}, ZENN_GIT, "master");

    const result = await commitFiles(
      {
        token: TOKEN,
        repo: "neverclear86/zenn-contents",
        branch: "master",
        message: "m",
        files: FILES,
      },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    expect(calls(fetchImpl)).toEqual([
      `GET ${ZENN_GIT}/ref/heads/master`,
      `GET ${ZENN_GIT}/commits/${HEAD}`,
      `POST ${ZENN_GIT}/trees`,
      `POST ${ZENN_GIT}/commits`,
      `PATCH ${ZENN_GIT}/refs/heads/master`,
    ]);
  });

  it("repo と branch と apiUrl を渡すと、apiUrl の下の指定したリポジトリに送る", async () => {
    const git = "http://127.0.0.1:9999/repos/neverclear86/zenn-contents/git";
    const fetchImpl = stubGitHub({}, git, "master");

    const result = await commitFiles(
      {
        token: TOKEN,
        apiUrl: "http://127.0.0.1:9999",
        repo: "neverclear86/zenn-contents",
        branch: "master",
        message: "m",
        files: FILES,
      },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    const urls = calls(fetchImpl);
    expect(urls[0]).toBe(`GET ${git}/ref/heads/master`);
    expect(urls[4]).toBe(`PATCH ${git}/refs/heads/master`);
  });

  it("repo と branch と parent を渡すと ref を読まず、そのリポジトリの parent から 4 回送る", async () => {
    const fetchImpl = stubGitHub({}, ZENN_GIT, "master");

    const result = await commitFiles(
      {
        token: TOKEN,
        repo: "neverclear86/zenn-contents",
        branch: "master",
        message: "m",
        files: FILES,
        parent: PARENT,
      },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    expect(calls(fetchImpl)).toEqual([
      `GET ${ZENN_GIT}/commits/${PARENT}`,
      `POST ${ZENN_GIT}/trees`,
      `POST ${ZENN_GIT}/commits`,
      `PATCH ${ZENN_GIT}/refs/heads/master`,
    ]);
  });

  it("branch を渡したときの conflict と upstream_error の説明は、その ref の名前を含む", async () => {
    const conflict = stubGitHub(
      {
        [`PATCH ${GIT}/refs/heads/master`]: () =>
          json({ message: "Update is not a fast forward" }, { status: 422 }),
      },
      GIT,
      "master",
    );
    const broken = stubGitHub(
      {
        [`PATCH ${GIT}/refs/heads/master`]: () =>
          new Response("boom", { status: 500 }),
      },
      GIT,
      "master",
    );
    const input = {
      token: TOKEN,
      branch: "master",
      message: "m",
      files: FILES,
    };

    expect(await commitFiles(input, conflict)).toEqual({
      ok: false,
      code: "conflict",
      message: `refs/heads/master on GitHub is no longer ${HEAD}; another publish moved it.`,
    });
    expect(await commitFiles(input, broken)).toEqual({
      ok: false,
      code: "upstream_error",
      message: "GitHub answered 500 when updating refs/heads/master.",
    });
  });

  it("parent を渡すと ref を読まず、そのコミットを親にする", async () => {
    const fetchImpl = stubGitHub();

    const result = await commitFiles(
      { token: TOKEN, message: "m", files: FILES, parent: PARENT },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    expect(calls(fetchImpl)).toEqual([
      `GET ${GIT}/commits/${PARENT}`,
      `POST ${GIT}/trees`,
      `POST ${GIT}/commits`,
      `PATCH ${GIT}/refs/heads/main`,
    ]);
    expect(bodyOf(fetchImpl, 1).base_tree).toBe(PARENT_TREE);
    expect(bodyOf(fetchImpl, 2).parents).toEqual([PARENT]);
  });

  it("新しい tree が親の tree と同じときはコミットも ref の更新もせず commit: null を返す", async () => {
    const fetchImpl = stubGitHub({
      [`POST ${GIT}/trees`]: () => json({ sha: HEAD_TREE }, { status: 201 }),
    });

    const result = await commitFiles(
      { token: TOKEN, message: "m", files: FILES },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: null });
    expect(calls(fetchImpl)).toEqual([
      `GET ${GIT}/ref/heads/main`,
      `GET ${GIT}/commits/${HEAD}`,
      `POST ${GIT}/trees`,
    ]);
  });

  it("ref の更新が 422（早送りでない）のときは conflict を返す", async () => {
    const fetchImpl = stubGitHub({
      [`PATCH ${GIT}/refs/heads/main`]: () =>
        json({ message: "Update is not a fast forward" }, { status: 422 }),
    });

    const result = await commitFiles(
      { token: TOKEN, message: "m", files: FILES },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      code: "conflict",
      message: `refs/heads/main on GitHub is no longer ${HEAD}; another publish moved it.`,
    });
  });

  it.each([
    ["ref の読み出し", `GET ${GIT}/ref/heads/main`, 500],
    ["親のコミットの読み出し", `GET ${GIT}/commits/${HEAD}`, 404],
    ["tree の作成", `POST ${GIT}/trees`, 422],
    ["コミットの作成", `POST ${GIT}/commits`, 422],
    ["ref の更新", `PATCH ${GIT}/refs/heads/main`, 500],
  ])(
    "%sが非 2xx のときは upstream_error を返す",
    async (_name, key, status) => {
      const fetchImpl = stubGitHub({
        [key]: () => new Response("failed", { status }),
      });

      const result = await commitFiles(
        { token: TOKEN, message: "m", files: FILES },
        fetchImpl,
      );

      expect(result).toMatchObject({ ok: false, code: "upstream_error" });
      expect((result as { message: string }).message).toContain(String(status));
    },
  );

  it.each([
    [
      "親のコミットに tree が無い",
      `GET ${GIT}/commits/${HEAD}`,
      () => json({}),
    ],
    [
      "tree の応答が JSON でない",
      `POST ${GIT}/trees`,
      () => new Response("not json", { status: 201 }),
    ],
    [
      "tree の応答に sha が無い",
      `POST ${GIT}/trees`,
      () => json({}, { status: 201 }),
    ],
    [
      "コミットの応答に sha が無い",
      `POST ${GIT}/commits`,
      () => json({}, { status: 201 }),
    ],
  ])(
    "2xx の応答の形が違う（%s）ときは upstream_error を返す",
    async (_name, key, answer) => {
      const fetchImpl = stubGitHub({ [key]: answer });

      const result = await commitFiles(
        { token: TOKEN, message: "m", files: FILES },
        fetchImpl,
      );

      expect(result).toMatchObject({ ok: false, code: "upstream_error" });
    },
  );

  it("GitHub に届かないときは upstream_error を返し、例外を投げない", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network down");
    });

    const result = await commitFiles(
      { token: TOKEN, message: "m", files: FILES, parent: PARENT },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      code: "upstream_error",
      message: `Could not reach GitHub when reading commit ${PARENT}.`,
    });
  });

  it("ref の更新の 2xx の本文は読まない", async () => {
    const json = vi.fn(async () => {
      throw new SyntaxError("not json");
    });
    const fetchImpl = stubGitHub({
      [`PATCH ${GIT}/refs/heads/main`]: () =>
        ({ ok: true, status: 200, json }) as unknown as Response,
    });

    const result = await commitFiles(
      { token: TOKEN, message: "m", files: FILES },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
    expect(json).not.toHaveBeenCalled();
  });

  describe("deletes", () => {
    it("消すパスを sha: null の項目にして、書き込みと同じ 1 つのコミットで送る", async () => {
      const fetchImpl = stubGitHub();

      const result = await commitFiles(
        {
          token: TOKEN,
          message: "m",
          files: [RECORD_FILE],
          deletes: [ARTICLE],
        },
        fetchImpl,
      );

      expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
      expect(calls(fetchImpl)).toEqual([
        `GET ${GIT}/ref/heads/main`,
        `GET ${GIT}/commits/${HEAD}`,
        `GET ${GIT}/trees/${HEAD_TREE}?recursive=1`,
        `POST ${GIT}/trees`,
        `POST ${GIT}/commits`,
        `PATCH ${GIT}/refs/heads/main`,
      ]);
      expect(bodyOf(fetchImpl, 3)).toEqual({
        base_tree: HEAD_TREE,
        tree: [
          { ...RECORD_FILE, mode: "100644", type: "blob" },
          { path: ARTICLE, mode: "100644", type: "blob", sha: null },
        ],
      });
    });

    it("親の tree に無い消すパスは tree の項目から外す", async () => {
      const fetchImpl = stubGitHub();

      const result = await commitFiles(
        {
          token: TOKEN,
          message: "m",
          files: [],
          deletes: ["src/content/blog/gone.md", ARTICLE],
        },
        fetchImpl,
      );

      expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
      expect(bodyOf(fetchImpl, 3).tree).toEqual([
        { path: ARTICLE, mode: "100644", type: "blob", sha: null },
      ]);
    });

    it("親の tree でディレクトリーのパスや、書き込むファイルと同じパスは消さない", async () => {
      const fetchImpl = stubGitHub();

      const result = await commitFiles(
        {
          token: TOKEN,
          message: "m",
          files: [RECORD_FILE],
          deletes: ["src/content", RECORD, ARTICLE],
        },
        fetchImpl,
      );

      expect(result).toEqual({ ok: true, commit: NEW_COMMIT });
      expect(bodyOf(fetchImpl, 3).tree).toEqual([
        { ...RECORD_FILE, mode: "100644", type: "blob" },
        { path: ARTICLE, mode: "100644", type: "blob", sha: null },
      ]);
    });

    it("消すパスが親に無く、書き込むファイルも無いときは tree を作らず commit: null を返す", async () => {
      const fetchImpl = stubGitHub();

      const result = await commitFiles(
        {
          token: TOKEN,
          message: "m",
          files: [],
          deletes: ["src/content/blog/gone.md"],
        },
        fetchImpl,
      );

      expect(result).toEqual({ ok: true, commit: null });
      expect(calls(fetchImpl)).toEqual([
        `GET ${GIT}/ref/heads/main`,
        `GET ${GIT}/commits/${HEAD}`,
        `GET ${GIT}/trees/${HEAD_TREE}?recursive=1`,
      ]);
    });

    it("消すパスが親に無く、書き込みも同じ内容のときはコミットせず commit: null を返す", async () => {
      const fetchImpl = stubGitHub({
        [`POST ${GIT}/trees`]: () => json({ sha: HEAD_TREE }, { status: 201 }),
      });

      const result = await commitFiles(
        {
          token: TOKEN,
          message: "m",
          files: [RECORD_FILE],
          deletes: ["src/content/blog/gone.md"],
        },
        fetchImpl,
      );

      expect(result).toEqual({ ok: true, commit: null });
      expect(bodyOf(fetchImpl, 3).tree).toEqual([
        { ...RECORD_FILE, mode: "100644", type: "blob" },
      ]);
      expect(calls(fetchImpl)).toHaveLength(4);
    });

    it.each([
      ["非 2xx", () => new Response("failed", { status: 500 })],
      ["JSON でない", () => new Response("not json")],
      ["tree が無い", () => json({ sha: HEAD_TREE, truncated: false })],
      [
        "truncated が true",
        () => json({ sha: HEAD_TREE, tree: HEAD_ENTRIES, truncated: true }),
      ],
      ["truncated が無い", () => json({ sha: HEAD_TREE, tree: HEAD_ENTRIES })],
    ])(
      "親の tree の読み出しが失敗した（%s）ときは tree を作らず upstream_error を返す",
      async (_name, answer) => {
        const fetchImpl = stubGitHub({
          [`GET ${GIT}/trees/${HEAD_TREE}?recursive=1`]: answer,
        });

        const result = await commitFiles(
          {
            token: TOKEN,
            message: "m",
            files: [RECORD_FILE],
            deletes: [ARTICLE],
          },
          fetchImpl,
        );

        expect(result).toMatchObject({ ok: false, code: "upstream_error" });
        expect(calls(fetchImpl)).not.toContain(`POST ${GIT}/trees`);
      },
    );
  });
});
