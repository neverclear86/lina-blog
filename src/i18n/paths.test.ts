import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  alternateLinks,
  canonicalUrl,
  localizedPath,
} from "./paths";

const site = new URL("https://example.com");

describe("localizedPath", () => {
  it("/ja/ で始まるパスは言語の接頭辞だけを英語に替える", () => {
    expect(localizedPath("/ja/", "en")).toBe("/en/");
    expect(localizedPath("/ja/about/", "en")).toBe("/en/about/");
  });

  it("/en/ で始まるパスは言語の接頭辞だけを日本語に替える", () => {
    expect(localizedPath("/en/", "ja")).toBe("/ja/");
    expect(localizedPath("/en/about/", "ja")).toBe("/ja/about/");
  });

  it("言語の接頭辞の無いパスは切り替え先の言語のトップを返す", () => {
    expect(localizedPath("/blog/hello/", "en")).toBe("/en/");
    expect(localizedPath("/", "en")).toBe("/en/");
  });

  it("言語の一覧に無い語で始まるパスは接頭辞の無いパスとして扱う", () => {
    expect(localizedPath("/japan/about/", "en")).toBe("/en/");
  });
});

describe("absoluteUrl", () => {
  it("サイト内のパスを site の絶対 URL にする", () => {
    expect(absoluteUrl("/og/ja.png", site)).toBe(
      "https://example.com/og/ja.png",
    );
  });
});

describe("canonicalUrl", () => {
  it("ページのパスを site の絶対 URL にする", () => {
    expect(canonicalUrl("/ja/works/ikili-pro/", site)).toBe(
      "https://example.com/ja/works/ikili-pro/",
    );
  });

  it("site が無いと例外を投げる", () => {
    expect(() => canonicalUrl("/ja/", undefined)).toThrow("site");
  });
});

describe("alternateLinks", () => {
  it("/ja/ で始まるページは自分を含む ja と en、x-default の / をこの順に返す", () => {
    expect(alternateLinks("/ja/works/ikili-pro/", site)).toEqual([
      { hreflang: "ja", href: "https://example.com/ja/works/ikili-pro/" },
      { hreflang: "en", href: "https://example.com/en/works/ikili-pro/" },
      { hreflang: "x-default", href: "https://example.com/" },
    ]);
  });

  it("/en/ で始まるページも同じ組を返す", () => {
    expect(alternateLinks("/en/", site)).toEqual([
      { hreflang: "ja", href: "https://example.com/ja/" },
      { hreflang: "en", href: "https://example.com/en/" },
      { hreflang: "x-default", href: "https://example.com/" },
    ]);
  });

  it("言語の接頭辞の無いページは既定の言語の自分自身だけを返す", () => {
    expect(alternateLinks("/blog/hello/", site)).toEqual([
      { hreflang: "ja", href: "https://example.com/blog/hello/" },
    ]);
  });

  it("site が無いと例外を投げる", () => {
    expect(() => alternateLinks("/ja/", undefined)).toThrow("site");
  });
});
