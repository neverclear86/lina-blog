import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../", import.meta.url);

/** Returns a file under `src/` as text. */
function read(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8");
}

describe("Breadcrumb のマークアップ", () => {
  const source = read("components/site/Breadcrumb.astro");

  it("nav を nav.breadcrumb の名前で ol / li に並べ、区切りの / は読み上げから隠す", () => {
    expect(source).toContain('translate(lang, "nav.breadcrumb")');
    expect(source).toContain("<ol>");
    expect(source).toContain("<li>");
    expect(source).toContain('<span aria-hidden="true">/</span>');
  });

  it("最後の項目だけに aria-current を付け、リンクの名前は label から取る", () => {
    expect(source).toContain(
      'aria-current={index === last ? "page" : undefined}',
    );
    expect(source).toContain("aria-label={item.label}");
    expect(source).toContain("{index < last && ");
  });
});

describe("Breadcrumb の配線", () => {
  it.each([
    [
      "components/blog/BlogIndex.astro",
      '<Breadcrumb lang="ja" items={crumbs} />',
    ],
    [
      "components/article/ArticleHead.astro",
      '<Breadcrumb lang="ja" items={blogPostBreadcrumb(slug, date)} />',
    ],
    [
      "pages/[lang]/contact/index.astro",
      "<Breadcrumb lang={lang} items={crumbs} />",
    ],
  ])(
    "%s は言語を渡して Breadcrumb を置き、パンくずの規則を持たない",
    (path, tag) => {
      const source = read(path);
      expect(source).toContain(tag);
      expect(source).not.toContain("crumbs {");
    },
  );
});
