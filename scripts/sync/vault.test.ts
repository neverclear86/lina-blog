import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanVault, type VaultArticle } from "./vault";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Creates a Vault in a temporary directory with the given files, keyed by Vault-relative path. */
function writeVault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "vault-"));
  roots.push(root);
  mkdirSync(join(root, "articles"), { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const BASE: Record<string, string> = {
  title: "title: T",
  slug: "slug: abcdefghijkl",
  emoji: "emoji: 📝",
  category: "category: 技術",
  description: "description: D",
  published: "published: true",
};

/** A published article whose frontmatter is `BASE` with the given lines replaced or removed. */
function article(
  overrides: Record<string, string | null> = {},
  extra: string[] = [],
  body = "本文\n",
): string {
  const lines = Object.entries({ ...BASE, ...overrides })
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([, line]) => line);
  return `---\n${[...lines, ...extra].join("\n")}\n---\n${body}`;
}

function only(root: string): VaultArticle {
  const articles = scanVault(root);
  expect(articles).toHaveLength(1);
  return articles[0];
}

describe("scanVault", () => {
  it("_ で始まるファイルとフォルダを深い階層まで外し、articles/ の外と .md 以外も集めない", () => {
    const root = writeVault({
      "articles/a.md": article(),
      "articles/_b.md": article(),
      "articles/_d/c.md": article(),
      "articles/s/t/_d/e.md": article(),
      "articles/s/f.md": article(),
      "articles/g.txt": article(),
      "notes/h.md": article(),
    });
    expect(scanVault(root).map((a) => a.path)).toEqual([
      "articles/a.md",
      "articles/s/f.md",
    ]);
  });

  it("結果を path の昇順で返す", () => {
    const root = writeVault({
      "articles/s/f.md": article(),
      "articles/s.md": article(),
    });
    expect(scanVault(root).map((a) => a.path)).toEqual([
      "articles/s.md",
      "articles/s/f.md",
    ]);
  });

  it("Vault 相対のパス、拡張子無しのファイル名、frontmatter の後ろの本文を返す", () => {
    const root = writeVault({
      "articles/s/記事.md": article({}, [], "# 見出し\n\n本文\n"),
    });
    expect(only(root)).toMatchObject({
      path: "articles/s/記事.md",
      name: "記事",
      body: "# 見出し\n\n本文\n",
    });
  });

  it("BOM と CRLF の frontmatter を読み、本文の改行を変えない", () => {
    const text = `﻿${article({}, [], "一行目\n二行目\n").replace(/\n/g, "\r\n")}`;
    const root = writeVault({ "articles/a.md": text });
    expect(only(root)).toMatchObject({
      kind: "ready",
      body: "一行目\r\n二行目\r\n",
    });
  });

  it.each([
    ["category: 技術", ["技術"]],
    ["category: [技術, 日記]", ["技術", "日記"]],
  ])("category を tags にする（%s）", (category, tags) => {
    const root = writeVault({
      "articles/a.md": article({ category }, ["tags: [x]"]),
    });
    const result = only(root);
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") expect(result.frontmatter.tags).toEqual(tags);
  });

  it.each([["title:"], ['title: ""'], ['title: "  "'], [null]])(
    "空か無い title をファイル名にする（%s）",
    (title) => {
      const root = writeVault({ "articles/名前.md": article({ title }) });
      const result = only(root);
      expect(result.kind).toBe("ready");
      if (result.kind === "ready")
        expect(result.frontmatter.title).toBe("名前");
    },
  );

  it("文字列でない title をファイル名にせず、公開の記事を invalid にする", () => {
    const root = writeVault({
      "articles/名前.md": article({ title: "title: 123" }),
    });
    const result = only(root);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/^title: /);
    }
  });

  it("Obsidian の tags だけで category が無い公開の記事は invalid になる", () => {
    const root = writeVault({
      "articles/a.md": article({ category: null }, ["tags: [技術]"]),
    });
    const result = only(root);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.errors).toEqual([expect.stringMatching(/^tags: /)]);
    }
  });

  it("Vault の date と Obsidian のプロパティは検証済みの frontmatter に入らない", () => {
    const root = writeVault({
      "articles/a.md": article({}, [
        "date: 2026-09-01",
        "id: 20260901",
        "aliases: [別名]",
        "created: 2026-09-01T09:00",
        "updated: 2026-09-02T10:00",
      ]),
    });
    const result = only(root);
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(Object.keys(result.frontmatter).sort()).toEqual([
        "description",
        "emoji",
        "slug",
        "tags",
        "title",
      ]);
    }
  });

  it("スキーマに合わない公開の記事を invalid にし、エラーを slug: で始まる文字列で返し、他の記事は ready で返す", () => {
    const root = writeVault({
      "articles/a.md": article({ slug: "slug: short" }),
      "articles/b.md": article(),
    });
    const [a, b] = scanVault(root);
    expect(a).toMatchObject({ path: "articles/a.md", kind: "invalid" });
    if (a.kind === "invalid") {
      expect(a.errors).toEqual([expect.stringMatching(/^slug: /)]);
    }
    expect(b).toMatchObject({ path: "articles/b.md", kind: "ready" });
  });

  it.each([["published: false"], ['published: "true"'], [null]])(
    "published が true でない記事は検証せず draft にし、slug を返す（%s）",
    (published) => {
      const root = writeVault({
        "articles/a.md": article({ published, slug: "slug: short" }),
      });
      expect(only(root)).toEqual({
        kind: "draft",
        path: "articles/a.md",
        name: "a",
        body: "本文\n",
        updated: undefined,
        published: false,
        slug: "short",
      });
    },
  );

  it("文字列でない slug と updated を undefined にする", () => {
    const root = writeVault({
      "articles/a.md": "---\nslug: 123\nupdated: 2026\n---\n本文\n",
    });
    expect(only(root)).toMatchObject({
      kind: "draft",
      slug: undefined,
      updated: undefined,
    });
  });

  it("YAML として読めない frontmatter の記事を unreadable にし、他の記事は ready で返す", () => {
    const root = writeVault({
      "articles/a.md": "---\na: 1\na: 2\n---\n本文\n",
      "articles/b.md": article(),
    });
    const [a, b] = scanVault(root);
    expect(a).toMatchObject({
      path: "articles/a.md",
      kind: "unreadable",
      published: undefined,
      body: "本文\n",
    });
    if (a.kind === "unreadable") {
      expect(a.errors).toHaveLength(1);
      expect(a.errors[0]).toContain("Map keys must be unique");
    }
    expect(b).toMatchObject({ path: "articles/b.md", kind: "ready" });
  });

  it.each([["- a"], ["abc"]])(
    "マッピングでない frontmatter の記事を unreadable にする（%s）",
    (yaml) => {
      const root = writeVault({ "articles/a.md": `---\n${yaml}\n---\n本文\n` });
      const result = only(root);
      expect(result).toMatchObject({
        kind: "unreadable",
        published: undefined,
      });
      if (result.kind === "unreadable") expect(result.errors).toHaveLength(1);
    },
  );

  it("中身の空の frontmatter の記事を draft にし、本文を返す", () => {
    const root = writeVault({ "articles/a.md": "---\n---\n本文" });
    expect(only(root)).toMatchObject({ kind: "draft", body: "本文" });
  });

  it("frontmatter の無い記事を draft にし、BOM を除いた全文を本文にする", () => {
    const root = writeVault({ "articles/a.md": "﻿本文" });
    expect(only(root)).toMatchObject({ kind: "draft", body: "本文" });
  });

  it("Vault の updated を結果の updated に文字列のまま返す", () => {
    const root = writeVault({
      "articles/a.md": article({}, ["updated: 2026-09-02T10:00"]),
    });
    expect(only(root)).toMatchObject({
      kind: "ready",
      updated: "2026-09-02T10:00",
    });
  });

  it("走査の前後で Vault のファイルの内容と更新時刻が変わらない", () => {
    const root = writeVault({
      "articles/a.md": article(),
      "articles/s/b.md": article({ published: null }),
    });
    const files = ["articles/a.md", "articles/s/b.md"].map((path) =>
      join(root, path),
    );
    const snapshot = () =>
      files.map((file) => ({
        text: readFileSync(file, "utf8"),
        mtime: statSync(file).mtimeMs,
      }));
    const before = snapshot();
    scanVault(root);
    expect(snapshot()).toEqual(before);
  });

  it("シンボリックリンクのファイルとフォルダをたどらない", () => {
    const root = writeVault({
      "articles/a.md": article(),
      "notes/n.md": article(),
      "notes/d/m.md": article(),
    });
    symlinkSync(join(root, "notes/n.md"), join(root, "articles/l.md"));
    symlinkSync(join(root, "notes/d"), join(root, "articles/dir"));
    expect(scanVault(root).map((a) => a.path)).toEqual(["articles/a.md"]);
  });

  it("articles/ が無い Vault では例外を投げる", () => {
    const root = writeVault({});
    rmSync(join(root, "articles"), { recursive: true });
    expect(() => scanVault(root)).toThrow(/ENOENT/);
  });
});
