import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCss } from "../test/css-source";

/** Returns a file next to this one as text. */
function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("article.css", () => {
  it("規則はすべて .article-body の下にあり、:global() を使わない", () => {
    const rules = parseCss(read("./article.css"));
    expect(rules.length).toBeGreaterThan(0);
    const outside = rules
      .flatMap((rule) => rule.selectors)
      .filter(
        (selector) =>
          !/^\.article-body(?![\w-])/.test(selector) ||
          selector.includes(":global"),
      );
    expect(outside).toEqual([]);
  });

  it("ArticleBody.astro は :global() を使わない", () => {
    expect(read("../components/article/ArticleBody.astro")).not.toContain(
      ":global",
    );
  });

  it("ArticleBody.astro は article.css を読み込む", () => {
    expect(read("../components/article/ArticleBody.astro")).toContain(
      'import "../../markdown/article.css";',
    );
  });
});
