import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublishClient } from "./client";
import { hashMarkdown } from "./markdown";
import {
  type ArticleReport,
  createLinkResolver,
  runSync,
  type SyncReport,
  syncCommand,
} from "./run";
import type { ArticleFrontmatter, VaultArticle } from "./vault";

/** `printf 'fixture-a' | sha256sum` */
const HASH_A =
  "06ada57c26aa5cf429e9f2c0a99e3e4a42daecd45fc4c955d7c1399ab4227ae8";
const URL_BASE = "https://publish.example.test";
const ENV = { PUBLISH_URL: URL_BASE, PUBLISH_TOKEN: "shared-secret" };
const RETRY = { retryDelaysMs: [0, 0] };

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Writes `files` (Vault-relative path to content) into a new temporary Vault and returns it. */
function makeVault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "lina-sync-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** An article with `published: true` whose frontmatter passes the schema. */
const article = (slug: string, body = "本文\n", extra = "") =>
  `---\npublished: true\ntitle: ${slug}\nslug: ${slug}\nemoji: "🧪"\ncategory: 技術\ndescription: 確認用\n${extra}---\n${body}`;

/** An article with `published: false`, with a slug unless `slug` is `undefined`. */
const draft = (slug?: string) =>
  `---\npublished: false\n${slug === undefined ? "" : `slug: ${slug}\n`}---\n本文\n`;

const A = "post-alpha-0001";
const B = "post-bravo-0002";
const Z = "post-zulu-00026";

type Respond = (key: string) => Response | undefined;

/**
 * A publish Worker for `fetch`: lists `listed`, answers `HEAD /images/*` with 404 and every
 * `PUT` and `DELETE` with 200, unless `respond` answers the call `<method> <path>`. `calls` is
 * every call in order, and `puts` the `markdown` that each `PUT /articles/*` carried.
 */
function fakeWorker(
  listed: { slug: string; hash: string | null }[] = [],
  respond: Respond = () => undefined,
) {
  const calls: string[] = [];
  const puts: Record<string, string> = {};
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const { pathname } = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${pathname}`;
    calls.push(key);
    if (key.startsWith("PUT /articles/")) {
      puts[pathname.slice("/articles/".length)] = JSON.parse(
        String(init?.body),
      ).markdown;
    }
    const custom = respond(key);
    if (custom) return custom;
    if (key === "GET /articles") return Response.json({ articles: listed });
    if (key.startsWith("HEAD /images/"))
      return new Response(null, { status: 404 });
    return new Response(null, { status: 200 });
  });
  return { fetchImpl, calls, puts };
}

/** Runs the sync of `files` against a fake Worker. */
async function sync(
  files: Record<string, string>,
  worker = fakeWorker(),
  dryRun = false,
) {
  const vaultRoot = makeVault(files);
  const client = createPublishClient(
    { url: URL_BASE, token: "t" },
    { fetchImpl: worker.fetchImpl, ...RETRY },
  );
  const report = await runSync({ vaultRoot, client, dryRun });
  return { report, vaultRoot, ...worker };
}

const entry = (
  action: ArticleReport["action"],
  slug: string | null,
  path: string | null,
  errors: string[] = [],
  updated: string | null = null,
): ArticleReport => ({ action, slug, path, updated, errors });

const errorBody = (status: number, error: Record<string, unknown>) =>
  Response.json({ error }, { status });

/** The hash that a sync of `files` sends for the article at `slug`. */
async function hashSent(files: Record<string, string>, slug: string) {
  const { puts } = await sync(files);
  return hashMarkdown(puts[slug]);
}

describe("createLinkResolver", () => {
  const ready = (path: string, slug: string): VaultArticle => ({
    kind: "ready",
    published: true,
    path,
    name: path.replace(/^.*\//, "").replace(/\.md$/, ""),
    body: "",
    updated: undefined,
    frontmatter: { slug } as ArticleFrontmatter,
  });
  const other = (kind: "draft" | "invalid" | "unreadable"): VaultArticle =>
    ({
      kind,
      path: `articles/${kind}.md`,
      name: kind,
      body: "",
      updated: undefined,
    }) as VaultArticle;

  it("素の名前で ready の記事を引くと published と slug を返す", () => {
    const resolve = createLinkResolver([ready("articles/foo.md", A)]);
    expect(resolve("foo")).toEqual({ kind: "published", slug: A });
  });

  it(".md 付きの名前と Vault 相対のパスでも同じ記事を引く", () => {
    const resolve = createLinkResolver([ready("articles/tech/foo.md", A)]);
    expect(resolve("foo.md")).toEqual({ kind: "published", slug: A });
    expect(resolve("articles/tech/foo")).toEqual({
      kind: "published",
      slug: A,
    });
    expect(resolve("articles/tech/foo.md")).toEqual({
      kind: "published",
      slug: A,
    });
  });

  it.each(["draft", "invalid", "unreadable"] as const)(
    "%s の記事は unpublished を返す",
    (kind) => {
      expect(createLinkResolver([other(kind)])(kind)).toEqual({
        kind: "unpublished",
      });
    },
  );

  it("記事でない名前は not_article を返す", () => {
    expect(createLinkResolver([ready("articles/foo.md", A)])("memo")).toEqual({
      kind: "not_article",
    });
  });

  it("同じ名前の記事が 2 本あると unpublished を返す", () => {
    const resolve = createLinkResolver([
      ready("articles/x/foo.md", A),
      ready("articles/y/foo.md", B),
    ]);
    expect(resolve("foo")).toEqual({ kind: "unpublished" });
    expect(resolve("articles/x/foo")).toEqual({ kind: "published", slug: A });
  });

  it("大文字と小文字だけが違う名前は not_article を返す", () => {
    const resolve = createLinkResolver([ready("articles/foo.md", A)]);
    expect(resolve("Foo")).toEqual({ kind: "not_article" });
  });
});

describe("runSync", () => {
  it("公開する記事は画像を HEAD と PUT で送ってから記事を PUT する", async () => {
    const { report, calls, puts } = await sync({
      [`articles/${A}.md`]: article(A, "![[pic.png]]\n"),
      "_attachments/pic.png": "fixture-a",
    });
    expect(calls).toEqual([
      "GET /articles",
      `HEAD /images/${HASH_A}.png`,
      `PUT /images/${HASH_A}.png`,
      `PUT /articles/${A}`,
    ]);
    expect(puts[A]).toContain(`![](image:${HASH_A}.png)`);
    expect(report).toEqual({
      dryRun: false,
      ok: true,
      fatal: null,
      articles: [entry("publish", A, `articles/${A}.md`)],
    });
  });

  it("変更の無い記事は何も送らず unchanged と報告する", async () => {
    const files = { [`articles/${A}.md`]: article(A, "変えない本文\n") };
    const hash = await hashSent(files, A);
    const { report, calls } = await sync(
      files,
      fakeWorker([{ slug: A, hash }]),
    );
    expect(calls).toEqual(["GET /articles"]);
    expect(report.articles).toEqual([
      entry("unchanged", A, `articles/${A}.md`),
    ]);
    expect(report.ok).toBe(true);
  });

  it("一覧のハッシュが違う記事は update として PUT する", async () => {
    const { report, calls } = await sync(
      { [`articles/${A}.md`]: article(A) },
      fakeWorker([{ slug: A, hash: null }]),
    );
    expect(calls).toEqual(["GET /articles", `PUT /articles/${A}`]);
    expect(report.articles).toEqual([entry("update", A, `articles/${A}.md`)]);
  });

  it("Vault の updated を報告に載せる", async () => {
    const { report } = await sync({
      [`articles/${A}.md`]: article(A, "本文\n", 'updated: "2026-05-01"\n'),
    });
    expect(report.articles).toEqual([
      entry("publish", A, `articles/${A}.md`, [], "2026-05-01"),
    ]);
  });

  it("下書きで一覧に有る記事は DELETE で取り下げる", async () => {
    const { report, calls } = await sync(
      { [`articles/${A}.md`]: draft(A) },
      fakeWorker([{ slug: A, hash: "x" }]),
    );
    expect(calls).toEqual(["GET /articles", `DELETE /articles/${A}`]);
    expect(report.articles).toEqual([
      entry("unpublish", A, `articles/${A}.md`),
    ]);
  });

  it("DELETE の失敗を error の項目にし、次の記事は送る", async () => {
    const { report, calls } = await sync(
      {
        [`articles/${A}.md`]: draft(A),
        [`articles/${B}.md`]: article(B),
      },
      fakeWorker([{ slug: A, hash: "x" }], (key) =>
        key.startsWith("DELETE ")
          ? errorBody(500, { code: "internal", message: "boom" })
          : undefined,
      ),
    );
    expect(calls).toEqual([
      "GET /articles",
      `DELETE /articles/${A}`,
      `DELETE /articles/${A}`,
      `DELETE /articles/${A}`,
      `PUT /articles/${B}`,
    ]);
    expect(report.articles).toEqual([
      entry("error", A, `articles/${A}.md`, [
        `DELETE /articles/${A} failed: 500 internal: boom`,
      ]),
      entry("publish", B, `articles/${B}.md`),
    ]);
    expect(report.ok).toBe(false);
  });

  it("Vault に無い公開中の記事は取り下げず missing と報告し、ok は true のまま", async () => {
    const { report, calls } = await sync(
      { [`articles/${B}.md`]: draft(B) },
      fakeWorker([{ slug: A, hash: "x" }]),
    );
    expect(calls).toEqual(["GET /articles"]);
    expect(report).toEqual({
      dryRun: false,
      ok: true,
      fatal: null,
      articles: [
        entry("missing", A, null),
        entry("draft", B, `articles/${B}.md`),
      ],
    });
  });

  describe("記事を送らずエラーにする", () => {
    const good = { [`articles/${B}.md`]: article(B) };
    const cases: [string, Record<string, string>, string[]][] = [
      [
        "記事でないノートへのリンク",
        {
          [`articles/${A}.md`]: article(A, "前 [[私的]] 後\n"),
          "notes/私的.md": "私的なメモ",
        },
        ["not_article_link: [[私的]] (line 1)"],
      ],
      [
        "無い画像",
        { [`articles/${A}.md`]: article(A, "![[none.png]]\n") },
        ["not_found: none.png"],
      ],
      [
        "同名の画像が 2 つ",
        {
          [`articles/${A}.md`]: article(A, "![[dup.png]]\n"),
          "x/dup.png": "fixture-a",
          "y/dup.png": "fixture-a",
        },
        ["ambiguous: dup.png (x/dup.png, y/dup.png)"],
      ],
      [
        "対応しない拡張子の画像",
        {
          [`articles/${A}.md`]: article(A, "![[doc.bmp]]\n"),
          "doc.bmp": "fixture-a",
        },
        ["unsupported_extension: doc.bmp"],
      ],
    ];

    it.each(cases)(
      "%s の記事は理由を報告し、他の記事は送る",
      async (_name, files, errors) => {
        const { report, calls } = await sync({ ...files, ...good });
        expect(calls).toEqual(["GET /articles", `PUT /articles/${B}`]);
        expect(report.ok).toBe(false);
        expect(report.articles).toEqual([
          entry("error", A, `articles/${A}.md`, errors),
          entry("publish", B, `articles/${B}.md`),
        ]);
      },
    );

    it("frontmatter の誤りの記事は slug を null にして理由を報告し、他の記事は送る", async () => {
      const bad = `---\npublished: true\nslug: short\nemoji: "🧪"\ncategory: 技術\ndescription: 確認用\n---\n本文\n`;
      const { report, calls } = await sync({
        "articles/bad.md": bad,
        ...good,
      });
      expect(calls).toEqual(["GET /articles", `PUT /articles/${B}`]);
      expect(report.articles).toEqual([
        entry("error", null, "articles/bad.md", [
          "frontmatter: slug: Invalid string: must match pattern /^[a-z0-9_-]{12,50}$/",
        ]),
        entry("publish", B, `articles/${B}.md`),
      ]);
    });
  });

  describe("Markdown 形式のリンク", () => {
    it.each([
      ["[メモ](../notes/memo.md)", "../notes/memo.md"],
      ["[a](<私的 メモ.md>)", "私的 メモ.md"],
      ["[see [1]](memo.md)", "memo.md"],
      ["[a](memo(1).md)", "memo(1"],
      ["[![x](pic.png)](memo.md)", "memo.md"],
      ["`\\![a](memo.md)`", "memo.md"],
      ["[a]: memo.md", "memo.md"],
      ["[a]:\n  <私的.md>", "私的.md"],
      ["`![](a.png)`", "a.png"],
    ])(
      "相対パスの %j を含む記事は markdown_link のエラーにする",
      async (text, destination) => {
        const { report, calls } = await sync({
          [`articles/${A}.md`]: article(A, `${text}\n`),
          [`articles/${B}.md`]: article(B),
          "pic.png": "fixture-a",
        });
        expect(calls).toEqual(["GET /articles", `PUT /articles/${B}`]);
        expect(report.articles).toEqual([
          entry("error", A, `articles/${A}.md`, [
            `markdown_link: ${destination}`,
          ]),
          entry("publish", B, `articles/${B}.md`),
        ]);
      },
    );

    it("https: と /blog/ と #見出し へのリンクと脚注の記事は送る", async () => {
      const body =
        "[a](https://example.com/x) [b](/blog/x) [c](#見出し) [d](mailto:a@example.com) [e](<https://example.com/y z>)\n\n脚注[^1]\n\n[^1]: 本文\n";
      const { report, calls } = await sync({
        [`articles/${A}.md`]: article(A, body),
      });
      expect(calls).toEqual(["GET /articles", `PUT /articles/${A}`]);
      expect(report.articles).toEqual([
        entry("publish", A, `articles/${A}.md`),
      ]);
    });
  });

  it("画像の送信に失敗した記事は記事を PUT せず、次の記事は送る", async () => {
    const { report, calls } = await sync(
      {
        [`articles/${A}.md`]: article(A, "![[pic.png]]\n"),
        [`articles/${B}.md`]: article(B),
        "pic.png": "fixture-a",
      },
      fakeWorker([], (key) =>
        key.startsWith("PUT /images/")
          ? errorBody(422, { code: "unsupported_media_type", message: "no" })
          : undefined,
      ),
    );
    expect(calls).toEqual([
      "GET /articles",
      `HEAD /images/${HASH_A}.png`,
      `PUT /images/${HASH_A}.png`,
      `PUT /articles/${B}`,
    ]);
    expect(report.articles).toEqual([
      entry("error", A, `articles/${A}.md`, [
        `image ${HASH_A}.png failed: 422 unsupported_media_type: no`,
      ]),
      entry("publish", B, `articles/${B}.md`),
    ]);
  });

  it("image: の参照が 21 種の記事は何も送らずエラーにし、20 種の記事は送る", async () => {
    const names = Array.from(
      { length: 21 },
      (_, index) => `img${String(index).padStart(2, "0")}.png`,
    );
    const embeds = (list: string[]) =>
      `${list.map((name) => `![[${name}]]`).join("\n")}\n`;
    const files: Record<string, string> = {
      [`articles/${A}.md`]: article(A, embeds(names)),
      [`articles/${B}.md`]: article(B, embeds(names.slice(0, 20))),
    };
    for (const name of names) files[`_img/${name}`] = `content of ${name}`;
    const { report, calls } = await sync(files);
    expect(report.articles).toEqual([
      entry("error", A, `articles/${A}.md`, [
        "too_many_images: 21 images (at most 20)",
      ]),
      entry("publish", B, `articles/${B}.md`),
    ]);
    expect(calls.filter((call) => call.startsWith("HEAD "))).toHaveLength(20);
    expect(calls).toContain(`PUT /articles/${B}`);
    expect(calls).not.toContain(`PUT /articles/${A}`);
  });

  it("記事の PUT の失敗（422）をエラーにし、次の記事は送る", async () => {
    const { report, calls } = await sync(
      {
        [`articles/${A}.md`]: article(A),
        [`articles/${B}.md`]: article(B),
      },
      fakeWorker([], (key) =>
        key === `PUT /articles/${A}`
          ? errorBody(422, { code: "invalid_frontmatter", message: "bad" })
          : undefined,
      ),
    );
    expect(calls).toEqual([
      "GET /articles",
      `PUT /articles/${A}`,
      `PUT /articles/${B}`,
    ]);
    expect(report.articles).toEqual([
      entry("error", A, `articles/${A}.md`, [
        `PUT /articles/${A} failed: 422 invalid_frontmatter: bad`,
      ]),
      entry("publish", B, `articles/${B}.md`),
    ]);
  });

  it("PUT の 500 に付いた step と、fetch が投げる失敗をエラーにする", async () => {
    const { report } = await sync(
      {
        [`articles/${A}.md`]: article(A),
        [`articles/${B}.md`]: article(B),
      },
      fakeWorker([], (key) => {
        if (key === `PUT /articles/${A}`) {
          return errorBody(500, {
            code: "publish_failed",
            message: "stopped",
            step: "3",
          });
        }
        if (key === `PUT /articles/${B}`) throw new TypeError("offline");
        return undefined;
      }),
    );
    expect(report.articles).toEqual([
      entry("error", A, `articles/${A}.md`, [
        `PUT /articles/${A} failed: 500 publish_failed (step 3): stopped`,
      ]),
      entry("error", B, `articles/${B}.md`, [
        `PUT /articles/${B} failed: no response network_error: Could not reach the publish Worker for PUT /articles/${B}.`,
      ]),
    ]);
  });

  it("変換に失敗した公開中の記事は missing に出さない", async () => {
    const { report, calls } = await sync(
      { [`articles/${A}.md`]: article(A, "![[none.png]]\n") },
      fakeWorker([{ slug: A, hash: "x" }]),
    );
    expect(calls).toEqual(["GET /articles"]);
    expect(report.articles).toEqual([
      entry("error", A, `articles/${A}.md`, ["not_found: none.png"]),
    ]);
  });

  it("slug の重なる 2 本はどちらもエラーにして送らず、ok は false", async () => {
    const { report, calls } = await sync({
      "articles/a.md": article(A),
      "articles/b.md": article(A, "別の本文\n"),
    });
    expect(calls).toEqual(["GET /articles"]);
    expect(report.articles).toEqual([
      entry("error", A, "articles/a.md", [
        `duplicate_slug: ${A} is also used by articles/b.md`,
      ]),
      entry("error", A, "articles/b.md", [
        `duplicate_slug: ${A} is also used by articles/a.md`,
      ]),
    ]);
    expect(report.ok).toBe(false);
  });

  it("変換に失敗した記事と slug が重なる下書きは、一覧に有っても DELETE を送らずエラーにする", async () => {
    const { report, calls } = await sync(
      {
        "articles/failed.md": article(A, "![[none.png]]\n"),
        "articles/old.md": draft(A),
      },
      fakeWorker([{ slug: A, hash: "x" }]),
    );
    expect(calls).toEqual(["GET /articles"]);
    expect(report.articles).toEqual([
      entry("error", A, "articles/failed.md", ["not_found: none.png"]),
      entry("error", A, "articles/old.md", [
        `duplicate_slug: ${A} is also used by articles/failed.md`,
      ]),
    ]);
  });

  it("slug の無い下書きは slug が null の draft と報告する", async () => {
    const { report, calls } = await sync({ "articles/idea.md": draft() });
    expect(calls).toEqual(["GET /articles"]);
    expect(report.articles).toEqual([entry("draft", null, "articles/idea.md")]);
    expect(report.ok).toBe(true);
  });

  it("GET /articles の失敗は fatal にし、他の要求を送らない", async () => {
    const { report, calls } = await sync(
      { [`articles/${A}.md`]: article(A) },
      fakeWorker([], (key) =>
        key === "GET /articles"
          ? errorBody(401, { code: "unauthorized", message: "bad token" })
          : undefined,
      ),
    );
    expect(calls).toEqual(["GET /articles"]);
    expect(report).toEqual({
      dryRun: false,
      ok: false,
      fatal: "GET /articles failed: 401 unauthorized: bad token",
      articles: [],
    });
  });

  it("Vault の articles/ が無いと fatal にする", async () => {
    const vaultRoot = makeVault({ "notes/memo.md": "メモ" });
    const { fetchImpl, calls } = fakeWorker();
    const client = createPublishClient(
      { url: URL_BASE, token: "t" },
      { fetchImpl, ...RETRY },
    );
    const report = await runSync({ vaultRoot, client, dryRun: false });
    expect(report).toEqual({
      dryRun: false,
      ok: false,
      fatal: `Could not read the Vault: ENOENT: no such file or directory, scandir '${join(vaultRoot, "articles")}'`,
      articles: [],
    });
    expect(calls).toEqual([]);
  });

  it("画像を送る実行の前後で Vault のファイルの一覧と内容と更新時刻が変わらない", async () => {
    const files = {
      [`articles/${A}.md`]: article(A, "![[pic.png]]\n"),
      [`articles/${B}.md`]: draft(B),
      "pic.png": "fixture-a",
      "notes/memo.md": "メモ",
    };
    const vaultRoot = makeVault(files);
    const snapshot = () =>
      readdirSync(vaultRoot, { recursive: true })
        .map(String)
        .sort()
        .map((path) => {
          const stat = statSync(join(vaultRoot, path));
          return [
            path,
            stat.isFile() ? readFileSync(join(vaultRoot, path), "utf8") : null,
            stat.mtimeMs,
          ];
        });
    const before = snapshot();
    const worker = fakeWorker([{ slug: B, hash: "x" }]);
    const client = createPublishClient(
      { url: URL_BASE, token: "t" },
      { fetchImpl: worker.fetchImpl, ...RETRY },
    );
    await runSync({ vaultRoot, client, dryRun: false });
    expect(worker.calls).toContain(`PUT /articles/${A}`);
    expect(snapshot()).toEqual(before);
  });

  it("articles は Vault の段の項目（path 順）、差分の項目（slug 順）の順に並べる", async () => {
    const bad = `---\npublished: true\nslug: short\nemoji: "🧪"\ncategory: 技術\ndescription: 確認用\n---\n本文\n`;
    const { report } = await sync({
      "articles/a-bad.md": bad,
      "articles/b-idea.md": draft(),
      "articles/c-zulu.md": article(Z),
      "articles/d-alpha.md": article(A),
    });
    expect(report.articles.map((item) => [item.action, item.path])).toEqual([
      ["error", "articles/a-bad.md"],
      ["draft", "articles/b-idea.md"],
      ["publish", "articles/d-alpha.md"],
      ["publish", "articles/c-zulu.md"],
    ]);
  });
});

describe("syncCommand", () => {
  const options = { ...RETRY };

  it("エラーが無ければ終了コード 0 で、出力は JSON.parse で報告に戻る", async () => {
    const vaultRoot = makeVault({ [`articles/${A}.md`]: article(A) });
    const { fetchImpl } = fakeWorker();
    const { output, exitCode } = await syncCommand(
      ["--vault", vaultRoot],
      ENV,
      { fetchImpl, ...options },
    );
    const parsed: SyncReport = JSON.parse(output);
    expect(exitCode).toBe(0);
    expect(output).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
    expect(parsed).toEqual({
      dryRun: false,
      ok: true,
      fatal: null,
      articles: [entry("publish", A, `articles/${A}.md`)],
    });
  });

  it("記事のエラーがあると終了コード 1", async () => {
    const vaultRoot = makeVault({
      [`articles/${A}.md`]: article(A, "![[none.png]]\n"),
    });
    const { fetchImpl } = fakeWorker();
    const { output, exitCode } = await syncCommand(
      ["--vault", vaultRoot],
      ENV,
      { fetchImpl, ...options },
    );
    expect(exitCode).toBe(1);
    expect(JSON.parse(output).ok).toBe(false);
  });

  it.each([
    [["--dry-run"], ENV, "Pass the Vault root with --vault <path>.", true],
    [
      ["--vault", "/nowhere"],
      {},
      "Set the environment variables: PUBLISH_URL, PUBLISH_TOKEN.",
      false,
    ],
    [
      ["--vault", "/nowhere", "--dry-run"],
      { PUBLISH_URL: URL_BASE },
      "Set the environment variables: PUBLISH_TOKEN.",
      true,
    ],
    [
      ["--vault", "/nowhere", "--bogus"],
      ENV,
      "Unknown option '--bogus'",
      false,
    ],
    [
      ["--vault", "/nowhere", "extra"],
      ENV,
      "Unexpected argument 'extra'",
      false,
    ],
  ])(
    "引数 %j と環境 %j の誤りは fatal にして終了コード 1",
    async (args, env, fatal, dryRun) => {
      const { fetchImpl } = fakeWorker();
      const { output, exitCode } = await syncCommand(args, env, {
        fetchImpl,
        ...options,
      });
      const parsed: SyncReport = JSON.parse(output);
      expect(exitCode).toBe(1);
      expect(parsed).toEqual({
        dryRun,
        ok: false,
        fatal: expect.stringContaining(fatal),
        articles: [],
      });
      expect(parsed.fatal?.startsWith(fatal)).toBe(true);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("--dry-run では GET /articles だけを送り、無しで回すと HEAD と PUT を送る", async () => {
    const files = {
      [`articles/${A}.md`]: article(A, "![[pic.png]]\n"),
      [`articles/${B}.md`]: draft(B),
      "pic.png": "fixture-a",
    };
    const vaultRoot = makeVault(files);
    const listed = [{ slug: B, hash: "x" }];

    const dry = fakeWorker(listed);
    const dryResult = await syncCommand(
      ["--vault", vaultRoot, "--dry-run"],
      ENV,
      { fetchImpl: dry.fetchImpl, ...options },
    );
    expect(dry.calls).toEqual(["GET /articles"]);
    expect(JSON.parse(dryResult.output)).toEqual({
      dryRun: true,
      ok: true,
      fatal: null,
      articles: [
        entry("publish", A, `articles/${A}.md`),
        entry("unpublish", B, `articles/${B}.md`),
      ],
    });
    expect(dryResult.exitCode).toBe(0);

    const real = fakeWorker(listed);
    await syncCommand(["--vault", vaultRoot], ENV, {
      fetchImpl: real.fetchImpl,
      ...options,
    });
    expect(real.calls).toEqual([
      "GET /articles",
      `HEAD /images/${HASH_A}.png`,
      `PUT /images/${HASH_A}.png`,
      `PUT /articles/${A}`,
      `DELETE /articles/${B}`,
    ]);
  });
});
