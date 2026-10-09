import { describe, expect, it } from "vitest";
import { translate } from "./i18n/ui";
import { openGraphTags, pageDescription, twitterTags } from "./page-meta";

describe("pageDescription", () => {
  it("説明文を渡すとそのまま返す", () => {
    expect(pageDescription("ja", "作品の説明")).toBe("作品の説明");
  });

  it("説明文を省略すると、その言語のサイトの説明文を返す", () => {
    expect(pageDescription("ja", undefined)).toBe(
      translate("ja", "site.description"),
    );
    expect(pageDescription("en", undefined)).toBe(
      translate("en", "site.description"),
    );
  });
});

describe("openGraphTags", () => {
  it("日本語のページは og の 6 つをこの順に返し、og:locale は ja_JP になる", () => {
    expect(
      openGraphTags({
        lang: "ja",
        title: "ikili.pro",
        description: "作品の説明",
        url: "https://example.com/ja/works/ikili-pro/",
      }),
    ).toEqual([
      { property: "og:title", content: "ikili.pro" },
      { property: "og:description", content: "作品の説明" },
      {
        property: "og:url",
        content: "https://example.com/ja/works/ikili-pro/",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ikili.pro" },
      { property: "og:locale", content: "ja_JP" },
    ]);
  });

  it("英語のページの og:locale は en_US になる", () => {
    expect(
      openGraphTags({
        lang: "en",
        title: "ikili.pro",
        description: "Description",
        url: "https://example.com/en/",
      }),
    ).toContainEqual({ property: "og:locale", content: "en_US" });
  });

  it("画像を渡すと、og:locale の後ろに og:image、幅 1200、高さ 630 をこの順に足す", () => {
    const tags = openGraphTags({
      lang: "ja",
      title: "ikili.pro",
      description: "説明",
      url: "https://example.com/ja/",
      image: "https://example.com/og/ja.png",
    });
    expect(tags).toHaveLength(9);
    expect(tags.slice(5)).toEqual([
      { property: "og:locale", content: "ja_JP" },
      { property: "og:image", content: "https://example.com/og/ja.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    ]);
  });
});

describe("twitterTags", () => {
  it("画像を渡すと、twitter:card を summary_large_image にして twitter:image を続ける", () => {
    expect(twitterTags("https://example.com/og/ja.png")).toEqual([
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://example.com/og/ja.png" },
    ]);
  });

  it("画像を渡さないと、twitter:card を summary にして twitter:image を出さない", () => {
    expect(twitterTags(undefined)).toEqual([
      { name: "twitter:card", content: "summary" },
    ]);
  });
});
