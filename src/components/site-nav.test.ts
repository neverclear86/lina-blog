import { describe, expect, it } from "vitest";
import { homeSectionPath, languageLinks, navLinks } from "./site-nav";

describe("homeSectionPath", () => {
  it("言語のトップのページの節を指すパスを返す", () => {
    expect(homeSectionPath("ja", "about")).toBe("/ja/#about");
    expect(homeSectionPath("en", "contact")).toBe("/en/#contact");
    expect(homeSectionPath("ja", "blog")).toBe("/ja/#blog");
  });
});

/** The items that are current at `pathname`, as `label=aria-current`. */
function currents(lang: "ja" | "en", pathname: string): string[] {
  return navLinks(lang, pathname)
    .filter((l) => l.current !== undefined)
    .map((l) => `${l.label}=${l.current}`);
}

describe("navLinks", () => {
  it("00 top から 04 works の順に並べ、トップ以外のページでは 03 blog が /blog/、他が言語のトップの節を指す", () => {
    expect(
      navLinks("en", "/en/about/").map(({ label, href }) => [label, href]),
    ).toEqual([
      ["00 top", "/en/#top"],
      ["01 about", "/en/#about"],
      ["02 latest", "/en/#latest"],
      ["03 blog", "/blog/"],
      ["04 works", "/en/#works"],
    ]);
  });

  it("言語のトップ（/ja/ と /ja）では 03 blog が同じページの #blog を指す", () => {
    const blog = (path: string) =>
      navLinks("ja", path).find((l) => l.label === "03 blog")?.href;
    expect(blog("/ja/")).toBe("/ja/#blog");
    expect(blog("/ja")).toBe("/ja/#blog");
    expect(blog("/en/")).toBe("/blog/");
  });

  it("表示の文字は言語によらず同じにする", () => {
    expect(navLinks("ja", "/ja/").map((l) => l.label)).toEqual(
      navLinks("en", "/en/").map((l) => l.label),
    );
  });

  it("トップのページでは現在地を付けない", () => {
    expect(currents("ja", "/ja/")).toEqual([]);
    expect(currents("ja", "/ja")).toEqual([]);
    expect(currents("en", "/en/")).toEqual([]);
  });

  it("/blog/ 自身では 03 blog を page、/blog でも page にする", () => {
    expect(currents("ja", "/blog/")).toEqual(["03 blog=page"]);
    expect(currents("ja", "/blog")).toEqual(["03 blog=page"]);
  });

  it("/blog/ 以下のページでは 03 blog を true にする", () => {
    expect(currents("ja", "/blog/hello/")).toEqual(["03 blog=true"]);
    expect(currents("ja", "/blog/tags/tech/")).toEqual(["03 blog=true"]);
  });

  it("/blog/ 以下の works を含むパスでは 04 works を現在地にしない", () => {
    expect(currents("ja", "/blog/works/")).toEqual(["03 blog=true"]);
  });

  it("/blogroll は /blog/ 以下とみなさない", () => {
    expect(currents("ja", "/blogroll/")).toEqual([]);
  });

  it("作品のページでは 04 works だけを true にする（英語でも同じ）", () => {
    expect(currents("ja", "/ja/works/ikili-pro/")).toEqual(["04 works=true"]);
    expect(currents("en", "/en/works/ikili-pro/")).toEqual(["04 works=true"]);
  });

  it("別の言語の作品のパスでは 04 works を現在地にしない", () => {
    expect(currents("ja", "/en/works/ikili-pro/")).toEqual([]);
  });

  it("別の言語のトップのパスでは 03 blog が /blog/ を指す", () => {
    expect(
      navLinks("ja", "/en/").find((l) => l.label === "03 blog")?.href,
    ).toBe("/blog/");
  });
});

describe("languageLinks", () => {
  it("今の言語はそのページ自身を指して現在地にし、他の言語は同じページのその言語を指す", () => {
    expect(languageLinks("ja", "/ja/")).toEqual([
      { locale: "ja", href: "/ja/", current: true },
      { locale: "en", href: "/en/", current: false },
    ]);
  });

  it("ブログのページでは今の言語のリンクだけを返す", () => {
    expect(languageLinks("ja", "/blog/hello/")).toEqual([
      { locale: "ja", href: "/blog/hello/", current: true },
    ]);
    expect(languageLinks("ja", "/blog/")).toHaveLength(1);
    expect(languageLinks("ja", "/blog")).toHaveLength(1);
  });

  it("ブログ以外の接頭辞の無いページでは、他の言語はその言語のトップを指す", () => {
    expect(languageLinks("ja", "/404")).toEqual([
      { locale: "ja", href: "/404", current: true },
      { locale: "en", href: "/en/", current: false },
    ]);
  });
});
