import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../i18n/ui";
import { accountLinks } from "./hero-account";

const ACCOUNT = readFileSync(
  new URL("./HeroAccount.astro", import.meta.url),
  "utf8",
);

describe("accountLinks", () => {
  it("日本語のページでは YouTube・Twitter・GitHub・Nostr・Zenn の後ろに RSS を並べる", () => {
    expect(
      accountLinks("ja").map(({ id, label, href }) => [id, label, href]),
    ).toEqual([
      ["youtube", "YouTube", "https://www.youtube.com/@LinaTsukusu"],
      ["twitter", "Twitter(自称X)", "https://x.com/TsukusuLina"],
      ["github", "GitHub", "https://github.com/neverclear86"],
      [
        "nostr",
        "Nostr",
        "https://nostter.app/npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz",
      ],
      ["zenn", "Zenn", "https://zenn.dev/linatsukusu"],
      ["rss", "RSS", "/rss.xml"],
    ]);
  });

  it("Twitter のラベルは日英とも ui.ts の social.twitter と同じ文字列にする", () => {
    for (const lang of ["ja", "en"] as const) {
      const twitter = accountLinks(lang).find(({ id }) => id === "twitter");
      expect(twitter?.label).toBe(translate(lang, "social.twitter"));
    }
    expect(accountLinks("en")[1].label).toBe("Twitter (self-proclaimed X)");
  });

  it("プロフィールには rel を me で付け、RSS には付けない", () => {
    expect(accountLinks("ja").map(({ rel }) => rel)).toEqual([
      "me",
      "me",
      "me",
      "me",
      "me",
      undefined,
    ]);
  });
});

describe("HeroAccount の組み", () => {
  it("アバターの alt は空にし、隣の @LinaTsukusu に名指させる", () => {
    expect(ACCOUNT).toMatch(/<FaceIcon\b[^>]*\balt=""[^>]*\/>/);
    expect(ACCOUNT).toMatch(/<span class="handle">@LinaTsukusu<\/span>/);
  });

  it("リンクの四角は名前を aria-label に、rel を rel に渡し、nav の名前は hero.links にする", () => {
    expect(ACCOUNT).toMatch(
      /<a\b[^>]*\bhref=\{href\}[^>]*\brel=\{rel\}[^>]*\baria-label=\{label\}/,
    );
    expect(ACCOUNT).toMatch(
      /<nav aria-label=\{translate\(lang, "hero\.links"\)\}>/,
    );
  });

  it("インラインの style 属性を持たない", () => {
    expect(ACCOUNT).not.toMatch(/\sstyle=["{]/);
  });
});
