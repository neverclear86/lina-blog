import { describe, expect, it } from "vitest";
import { homeSectionPath, languageLinks, navLinks } from "./site-nav";

describe("homeSectionPath", () => {
  it("言語のトップのページの節を指すパスを返す", () => {
    expect(homeSectionPath("ja", "about")).toBe("/ja/#about");
    expect(homeSectionPath("en", "contact")).toBe("/en/#contact");
  });
});

describe("navLinks", () => {
  it("トップ・プロフィール・つくったもの・さいきんは言語のトップの節を、ブログは /blog/ を指す", () => {
    expect(
      navLinks("en", "/en/about/").map(({ key, href }) => [key, href]),
    ).toEqual([
      ["nav.top", "/en/#top"],
      ["nav.about", "/en/#about"],
      ["nav.works", "/en/#works"],
      ["nav.latest", "/en/#latest"],
      ["nav.blog", "/blog/"],
    ]);
  });

  it("言語のトップのページではトップだけを現在地にする", () => {
    expect(
      navLinks("ja", "/ja/")
        .filter((l) => l.current)
        .map((l) => l.key),
    ).toEqual(["nav.top"]);
  });

  it("末尾のスラッシュの無いトップのパスでもトップを現在地にする", () => {
    expect(
      navLinks("ja", "/ja")
        .filter((l) => l.current)
        .map((l) => l.key),
    ).toEqual(["nav.top"]);
  });

  it("別の言語のトップのパスではトップを現在地にしない", () => {
    expect(navLinks("ja", "/en/").some((l) => l.current)).toBe(false);
  });

  it("/blog/ 以下のページではブログだけを現在地にする", () => {
    expect(
      navLinks("ja", "/blog/hello/")
        .filter((l) => l.current)
        .map((l) => l.key),
    ).toEqual(["nav.blog"]);
  });
});

describe("languageLinks", () => {
  it("今の言語はそのページ自身を指して現在地にし、他の言語は同じページのその言語を指す", () => {
    expect(languageLinks("ja", "/ja/")).toEqual([
      { locale: "ja", href: "/ja/", current: true },
      { locale: "en", href: "/en/", current: false },
    ]);
  });

  it("言語の接頭辞の無いページでは、他の言語はその言語のトップを指す", () => {
    expect(languageLinks("ja", "/blog/hello/")).toEqual([
      { locale: "ja", href: "/blog/hello/", current: true },
      { locale: "en", href: "/en/", current: false },
    ]);
  });
});
