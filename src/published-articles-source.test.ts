import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  loadNostrPublishedSlugs,
  readNostrPublishedSlugs,
} from "./published-articles-source";

const HASH = `${"0".repeat(63)}1`;
const dir = mkdtempSync(join(tmpdir(), "published-articles-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(name: string, text: string): URL {
  const path = join(dir, name);
  writeFileSync(path, text);
  return pathToFileURL(path);
}

describe("readNostrPublishedSlugs", () => {
  it("ファイルの hash が有る項目の slug を返す", () => {
    const file = write(
      "ok.json",
      JSON.stringify({
        articles: { a: { hash: HASH }, b: { hash: null } },
      }),
    );
    expect(readNostrPublishedSlugs(file, "ok.json")).toEqual(new Set(["a"]));
  });

  it("ファイルが無いときはどの記事も投稿していないものとして空の集合を返す", () => {
    const file = pathToFileURL(join(dir, "missing.json"));
    expect(readNostrPublishedSlugs(file, "missing.json").size).toBe(0);
  });

  it("形が違うファイルは名前を添えた理由で投げる", () => {
    const file = write("bad.json", "{}");
    expect(() => readNostrPublishedSlugs(file, "bad.json")).toThrow(
      'bad.json has no "articles" object.',
    );
  });

  it("ENOENT 以外の読み込みの失敗は投げる（ディレクトリ）", () => {
    expect(() =>
      readNostrPublishedSlugs(pathToFileURL(`${dir}/`), "dir"),
    ).toThrow();
  });
});

describe("loadNostrPublishedSlugs", () => {
  it("dev のときは見本の記録の投稿済みの記事を含む", () => {
    expect(loadNostrPublishedSlugs(true).has("dev-preview-sample")).toBe(true);
  });

  it("dev でないときは見本の記録を読まない", () => {
    expect(loadNostrPublishedSlugs(false).has("dev-preview-sample")).toBe(
      false,
    );
  });

  it("見本の記録には hash が null の項目もある（投稿済みと未投稿の両方を見られる）", () => {
    const published = loadNostrPublishedSlugs(true);
    const record = JSON.parse(
      readFileSync(
        new URL("./content/blog-dev/published.json", import.meta.url),
        "utf8",
      ),
    ) as { articles: Record<string, { hash: string | null }> };
    expect(record.articles["dev-preview-newer"]?.hash).toBeNull();
    expect(published.has("dev-preview-newer")).toBe(false);
  });

  it("見本の記録の slug は blog-dev の記事の slug のどれかである", () => {
    const base = new URL("./content/blog-dev/", import.meta.url);
    const record = JSON.parse(
      readFileSync(new URL("published.json", base), "utf8"),
    ) as { articles: Record<string, unknown> };
    const slugs = new Set(
      readdirSync(base)
        .filter((name) => name.endsWith(".md"))
        .map((name) => {
          const text = readFileSync(new URL(name, base), "utf8");
          return /^slug: (.+)$/m.exec(text)?.[1];
        }),
    );
    for (const slug of Object.keys(record.articles)) {
      expect(slugs.has(slug)).toBe(true);
    }
  });
});
