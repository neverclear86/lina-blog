import { describe, expect, it, vi } from "vitest";
import { markZennUnpublished, unpublishZennArticle } from "./zenn-unpublish";

const TOKEN = "github-token";
const SLUG = "hello-ikili-pro";
const API = "https://api.github.com/repos/neverclear86/zenn-contents";
const HEAD = "1".repeat(40);
const HEAD_TREE = "2".repeat(40);
const NEW_TREE = "3".repeat(40);
const NEW_COMMIT = "4".repeat(40);
const FILE = `GET ${API}/contents/articles/${SLUG}.md?ref=${HEAD}`;
const REF = `GET ${API}/git/ref/heads/master`;
const TREES = `POST ${API}/git/trees`;
const COMMITS = `POST ${API}/git/commits`;
const REFS = `PATCH ${API}/git/refs/heads/master`;

// An article file as buildZennArticle writes it, with a `published: true` line in the body.
const ARTICLE = (published: string) =>
  [
    "---",
    'title: "こんにちは"',
    'emoji: "👋"',
    'type: "tech"',
    'topics: ["astro"]',
    `published: ${published}`,
    "---",
    "",
    "本文",
    "published: true",
    "",
    "---",
    "",
    "この記事は ikili.pro に掲載した記事の転載です。",
    "",
  ].join("\n");

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init);
const failure = (status: number) => () => new Response("failed", { status });

/**
 * Returns a `fetch` stub that answers by `"<METHOD> <URL>"`. The default answers are those of
 * a successful write on top of `HEAD` of zenn-contents, whose article is `published: true`;
 * `overrides` replaces the answer of a key. A key it does not know is answered 599.
 */
const stubGitHub = (
  overrides: Record<string, () => Response | Promise<Response>> = {},
) => {
  const answers: Record<string, () => Response | Promise<Response>> = {
    [REF]: () => json({ object: { sha: HEAD } }),
    [FILE]: () => new Response(ARTICLE("true")),
    [`GET ${API}/git/commits/${HEAD}`]: () =>
      json({ tree: { sha: HEAD_TREE } }),
    [TREES]: () => json({ sha: NEW_TREE }, { status: 201 }),
    [COMMITS]: () => json({ sha: NEW_COMMIT }, { status: 201 }),
    [REFS]: () => json({ ref: "refs/heads/master" }),
    ...overrides,
  };
  return vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    return answers[key]?.() ?? new Response("unknown", { status: 599 });
  });
};

const calls = (fetchImpl: ReturnType<typeof stubGitHub>) =>
  fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

const bodyOf = (fetchImpl: ReturnType<typeof stubGitHub>, key: string) => {
  const call = fetchImpl.mock.calls.find(
    ([url, init]) => `${init?.method ?? "GET"} ${url}` === key,
  );
  return JSON.parse(String(call?.[1]?.body));
};

describe("markZennUnpublished", () => {
  it("frontmatter の published: true だけを false にし、本文の同じ行は変えない", () => {
    expect(markZennUnpublished(ARTICLE("true"))).toBe(ARTICLE("false"));
  });

  it("値の後ろの空白と行末の CR を残す", () => {
    expect(
      markZennUnpublished("---\r\npublished:  true \t\r\n---\r\n本文\r\n"),
    ).toBe("---\r\npublished:  false \t\r\n---\r\n本文\r\n");
  });

  it("すでに published: false なら同じ文字列を返す", () => {
    const text = ARTICLE("false");
    expect(markZennUnpublished(text)).toBe(text);
  });

  it.each([
    { name: "frontmatter が無い", text: "title: a\npublished: true\n---\n" },
    {
      name: "published の行が frontmatter の外にしか無い",
      text: '---\ntitle: "a"\n---\npublished: true\n',
    },
    {
      name: "published の値が true でも false でもない",
      text: "---\npublished: yes\n---\n",
    },
    {
      name: "frontmatter が閉じておらず published の行も無い",
      text: "---\ntitle: a\n本文\n",
    },
  ])("$name なら null を返す", ({ text }) => {
    expect(markZennUnpublished(text)).toBeNull();
  });
});

describe("unpublishZennArticle", () => {
  const run = (fetchImpl: ReturnType<typeof stubGitHub>, apiUrl?: string) =>
    unpublishZennArticle({ token: TOKEN, apiUrl, slug: SLUG }, fetchImpl);

  it("master の記事のファイルを published: false にするコミットを作り、ファイルは消さない", async () => {
    const fetchImpl = stubGitHub();

    const result = await run(fetchImpl);

    expect(result).toEqual({ ok: true, zenn: { commit: NEW_COMMIT } });
    expect(calls(fetchImpl)).toEqual([
      REF,
      FILE,
      `GET ${API}/git/commits/${HEAD}`,
      TREES,
      COMMITS,
      REFS,
    ]);
    expect(bodyOf(fetchImpl, TREES)).toEqual({
      base_tree: HEAD_TREE,
      tree: [
        {
          path: `articles/${SLUG}.md`,
          mode: "100644",
          type: "blob",
          content: ARTICLE("false"),
        },
      ],
    });
    expect(bodyOf(fetchImpl, COMMITS)).toEqual({
      message: `content: ${SLUG} を非公開にする`,
      tree: NEW_TREE,
      parents: [HEAD],
    });
    expect(bodyOf(fetchImpl, REFS)).toEqual({ sha: NEW_COMMIT, force: false });
  });

  it("GitHub の認証の頭と API のバージョンを付けて、ファイルを raw で読む", async () => {
    const fetchImpl = stubGitHub();

    await run(fetchImpl);

    const [, init] = fetchImpl.mock.calls.find(([url]) =>
      String(url).includes("/contents/"),
    ) as [unknown, RequestInit];
    expect(init.headers).toEqual({
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "lina-blog-publish",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });

  it("apiUrl の下の zenn-contents の master だけに要求する", async () => {
    const base = "http://127.0.0.1:9999";
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const key = `${init?.method ?? "GET"} ${String(input)}`;
      return key ===
        `GET ${base}/repos/neverclear86/zenn-contents/git/ref/heads/master`
        ? json({ object: { sha: HEAD } })
        : new Response("Not Found", { status: 404 });
    });

    const result = await unpublishZennArticle(
      { token: TOKEN, apiUrl: base, slug: SLUG },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, zenn: null });
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      `${base}/repos/neverclear86/zenn-contents/git/ref/heads/master`,
      `${base}/repos/neverclear86/zenn-contents/contents/articles/${SLUG}.md?ref=${HEAD}`,
    ]);
  });

  it("zenn-contents に記事のファイルが無ければ、コミットを作らず zenn: null を返す", async () => {
    const fetchImpl = stubGitHub({
      [FILE]: () => new Response("Not Found", { status: 404 }),
    });

    const result = await run(fetchImpl);

    expect(result).toEqual({ ok: true, zenn: null });
    expect(calls(fetchImpl)).toEqual([REF, FILE]);
  });

  it("すでに published: false なら、コミットを作らず commit: null を返す", async () => {
    const fetchImpl = stubGitHub({
      [FILE]: () => new Response(ARTICLE("false")),
    });

    const result = await run(fetchImpl);

    expect(result).toEqual({ ok: true, zenn: { commit: null } });
    expect(calls(fetchImpl)).toEqual([REF, FILE]);
  });

  it("published の行が無いファイルは upstream_error にし、コミットを作らない", async () => {
    const fetchImpl = stubGitHub({ [FILE]: () => new Response("本文だけ\n") });

    const result = await run(fetchImpl);

    expect(result).toEqual({
      ok: false,
      code: "upstream_error",
      message: `articles/${SLUG}.md of neverclear86/zenn-contents has no published line in its frontmatter.`,
    });
    expect(calls(fetchImpl)).toEqual([REF, FILE]);
  });

  it.each([
    { name: "master の先頭の読み出し", key: REF },
    { name: "ファイルの読み出し", key: FILE },
    { name: "tree の作成", key: TREES },
  ])("$name が失敗したら upstream_error を返す", async ({ key }) => {
    const fetchImpl = stubGitHub({ [key]: failure(500) });

    const result = await run(fetchImpl);

    expect(result).toMatchObject({ ok: false, code: "upstream_error" });
  });

  it("ファイルの読み出しで 500 なら、状態とパスを message に入れる", async () => {
    const result = await run(stubGitHub({ [FILE]: failure(500) }));

    expect(result).toEqual({
      ok: false,
      code: "upstream_error",
      message: `GitHub answered 500 when reading articles/${SLUG}.md of neverclear86/zenn-contents.`,
    });
  });

  it("ファイルの読み出しで GitHub に届かなければ upstream_error を返す", async () => {
    const result = await run(
      stubGitHub({
        [FILE]: () => {
          throw new TypeError("network down");
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: "upstream_error",
      message: `Could not reach GitHub to read articles/${SLUG}.md of neverclear86/zenn-contents.`,
    });
  });

  it("master が先に動いていれば conflict を返す", async () => {
    const fetchImpl = stubGitHub({ [REFS]: failure(422) });

    const result = await run(fetchImpl);

    expect(result).toMatchObject({ ok: false, code: "conflict" });
  });
});
