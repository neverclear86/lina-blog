import type { SitemapItem } from "@astrojs/sitemap";
import type { AstroIntegration } from "astro";
import { describe, expect, it } from "vitest";
import { devPages } from "./dev/dev-pages";
import { buildRobotsTxt, isSitemapPage, withXDefault } from "./sitemap";

type ConfigSetupOptions = Parameters<
  NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>
>[0];

/** Patterns of the routes that `devPages()` injects in `astro dev`. */
function devPagePatterns(): string[] {
  const patterns: string[] = [];
  devPages({}).hooks["astro:config:setup"]?.({
    command: "dev",
    injectRoute: (route: { pattern: string }) => patterns.push(route.pattern),
  } as unknown as ConfigSetupOptions);
  return patterns;
}

describe("isSitemapPage", () => {
  it("日英のページの URL を残す", () => {
    expect(isSitemapPage("https://ikili.pro/ja/")).toBe(true);
    expect(isSitemapPage("https://ikili.pro/en/")).toBe(true);
  });

  it("開発用のページを除く", () => {
    const patterns = devPagePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(isSitemapPage(`https://ikili.pro${pattern}/`)).toBe(false);
    }
  });

  it("テキストの応答を除く", () => {
    for (const path of [
      "/llms.txt",
      "/rss.xml",
      "/text/ja.txt",
      "/ansi/color.txt",
      "/ansi/plain.txt",
    ]) {
      expect(isSitemapPage(`https://ikili.pro${path}`)).toBe(false);
    }
  });
});

describe("withXDefault", () => {
  const paired: SitemapItem = {
    url: "https://ikili.pro/ja/",
    links: [
      { lang: "ja", url: "https://ikili.pro/ja/" },
      { lang: "en", url: "https://ikili.pro/en/" },
    ],
  };

  it("対のある項目の links の末尾に x-default の / を足す", () => {
    expect(withXDefault(paired).links).toEqual([
      { lang: "ja", url: "https://ikili.pro/ja/" },
      { lang: "en", url: "https://ikili.pro/en/" },
      { lang: "x-default", url: "https://ikili.pro/" },
    ]);
  });

  it("links の無い項目をそのまま返す", () => {
    const item: SitemapItem = { url: "https://ikili.pro/blog/" };
    expect(withXDefault(item)).toBe(item);
  });

  it("引数の項目と links を書き換えない", () => {
    withXDefault(paired);
    expect(paired.links).toHaveLength(2);
  });
});

describe("buildRobotsTxt", () => {
  it("すべてのクローラーを許可し sitemap の絶対 URL を指す", () => {
    expect(buildRobotsTxt(new URL("https://example.com"))).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap-index.xml\n",
    );
  });

  it("site が無いと例外を投げる", () => {
    expect(() => buildRobotsTxt(undefined)).toThrow("astro.config.mjs");
  });
});
