import { describe, expect, it } from "vitest";
import { footerProfileLinks, footerSiteLinks } from "./footer-links";

describe("footerSiteLinks", () => {
  it("日本語のページではトップ・プロフィール・ブログ・つくったもの・お問い合わせの順に、言語のトップとその節と /blog/ を指す", () => {
    expect(footerSiteLinks("ja").map(({ key, href }) => [key, href])).toEqual([
      ["nav.top", "/ja/"],
      ["nav.about", "/ja/#about"],
      ["nav.blog", "/blog/"],
      ["nav.works", "/ja/#works"],
      ["nav.contact", "/ja/#contact"],
    ]);
  });

  it("英語のページでは言語の接頭辞だけが変わり、ブログは接頭辞の無い /blog/ のままにする", () => {
    expect(footerSiteLinks("en").map(({ href }) => href)).toEqual([
      "/en/",
      "/en/#about",
      "/blog/",
      "/en/#works",
      "/en/#contact",
    ]);
  });
});

describe("footerProfileLinks", () => {
  it("日本語のページでは PROFILE_LINKS の 5 つの後ろに RSS を並べる", () => {
    expect(
      footerProfileLinks("ja").map(({ label, href }) => [label, href]),
    ).toEqual([
      ["YouTube", "https://www.youtube.com/@LinaTsukusu"],
      ["Twitter(自称X)", "https://x.com/TsukusuLina"],
      ["GitHub", "https://github.com/neverclear86"],
      [
        "Nostr",
        "https://nostter.app/npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz",
      ],
      ["Zenn", "https://zenn.dev/linatsukusu"],
      ["RSS", "/rss.xml"],
    ]);
  });

  it("英語のページでは Twitter のラベルを Twitter (self-proclaimed X) にする", () => {
    expect(footerProfileLinks("en").map(({ label }) => label)).toContain(
      "Twitter (self-proclaimed X)",
    );
  });

  it("プロフィールには rel を me で付け、RSS には付けない", () => {
    expect(footerProfileLinks("ja").map(({ rel }) => rel)).toEqual([
      "me",
      "me",
      "me",
      "me",
      "me",
      undefined,
    ]);
  });
});
