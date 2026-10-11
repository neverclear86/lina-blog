import { describe, expect, it } from "vitest";
import { footerProfileLinks, footerSiteLinks } from "./footer-links";

const SITE = new URL("https://ikili.pro");

describe("footerSiteLinks", () => {
  it("日本語のページではトップ・プロフィール・ブログ・お問い合わせの順に、言語のトップとその節と /blog/ とお問い合わせのページを指す", () => {
    expect(footerSiteLinks("ja").map(({ key, href }) => [key, href])).toEqual([
      ["nav.top", "/ja/"],
      ["nav.about", "/ja/#about"],
      ["nav.blog", "/blog/"],
      ["nav.contact", "/ja/contact/"],
    ]);
  });

  it("英語のページでは言語の接頭辞だけが変わり、ブログは接頭辞の無い /blog/ のままにする", () => {
    expect(footerSiteLinks("en").map(({ href }) => href)).toEqual([
      "/en/",
      "/en/#about",
      "/blog/",
      "/en/contact/",
    ]);
  });
});

describe("footerProfileLinks", () => {
  it("日本語のページでは PROFILE_LINKS の 5 つの後ろに RSS を並べる", () => {
    expect(
      footerProfileLinks("ja", SITE).map(({ label, href }) => [label, href]),
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
    expect(footerProfileLinks("en", SITE).map(({ label }) => label)).toContain(
      "Twitter (self-proclaimed X)",
    );
  });

  it("プロフィールは external で target を _blank、rel を me noopener にし、RSS は external でなく target も rel も付けない", () => {
    const links = footerProfileLinks("ja", SITE);
    expect(links.map(({ external }) => external)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(links.map(({ target }) => target)).toEqual([
      "_blank",
      "_blank",
      "_blank",
      "_blank",
      "_blank",
      undefined,
    ]);
    expect(links.map(({ rel }) => rel)).toEqual([
      "me noopener",
      "me noopener",
      "me noopener",
      "me noopener",
      "me noopener",
      undefined,
    ]);
  });
});
