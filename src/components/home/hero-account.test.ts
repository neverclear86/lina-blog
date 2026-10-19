import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../../i18n/ui";
import { externalLabel } from "../../lib/external-link";
import { accountLinks } from "./hero-account";

const ACCOUNT = readFileSync(
  new URL("./HeroAccount.astro", import.meta.url),
  "utf8",
);

const SITE = new URL("https://ikili.pro");

describe("accountLinks", () => {
  it("日本語のページでは YouTube・Twitter・GitHub・Nostr・Zenn の後ろに RSS を並べる", () => {
    expect(accountLinks("ja", SITE).map(({ id, href }) => [id, href])).toEqual([
      ["youtube", "https://www.youtube.com/@LinaTsukusu"],
      ["twitter", "https://x.com/TsukusuLina"],
      ["github", "https://github.com/neverclear86"],
      [
        "nostr",
        "https://nostter.app/npub1ljnatxkrh9mqzkj5h5pu6s97yk582xzdqp55afcch98rsaadec9sz4g9vt",
      ],
      ["zenn", "https://zenn.dev/linatsukusu"],
      ["rss", "/rss.xml"],
    ]);
  });

  it("サイトの外へ出るプロフィールの名前は、外部サイトで新しいタブで開く旨の注記で終わる", () => {
    expect(accountLinks("ja", SITE).map(({ label }) => label)).toEqual([
      "YouTube（外部サイト・新しいタブで開く）",
      "Twitter(自称X)（外部サイト・新しいタブで開く）",
      "GitHub（外部サイト・新しいタブで開く）",
      "Nostr（外部サイト・新しいタブで開く）",
      "Zenn（外部サイト・新しいタブで開く）",
      "RSS",
    ]);
  });

  it("Twitter のラベルは日英とも ui.ts の social.twitter と同じ文字列にする", () => {
    for (const lang of ["ja", "en"] as const) {
      const twitter = accountLinks(lang, SITE).find(
        ({ id }) => id === "twitter",
      );
      expect(twitter?.label).toBe(
        externalLabel(lang, translate(lang, "social.twitter")),
      );
    }
    expect(accountLinks("en", SITE)[1].label).toBe(
      "Twitter (self-proclaimed X) (external site, opens in a new tab)",
    );
    expect(accountLinks("en", SITE)[5].label).toBe("RSS");
  });

  it("プロフィールは target を _blank、rel を me noopener にし、RSS には target も rel も付けない", () => {
    const links = accountLinks("ja", SITE);
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

describe("HeroAccount の組み", () => {
  it("アバターの alt は空にし、隣の @LinaTsukusu に名指させる", () => {
    expect(ACCOUNT).toMatch(/<FaceIcon\b[^>]*\balt=""[^>]*\/>/);
    expect(ACCOUNT).toMatch(/<span class="handle">@LinaTsukusu<\/span>/);
  });

  it("リンクの四角は名前を aria-label に、target を target に、rel を rel に渡し、nav の名前は hero.links にする", () => {
    expect(ACCOUNT).toMatch(
      /<a\b[^>]*\bhref=\{href\}[^>]*\btarget=\{target\}[^>]*\brel=\{rel\}[^>]*\baria-label=\{label\}/,
    );
    expect(ACCOUNT).toMatch(
      /<nav aria-label=\{translate\(lang, "hero\.links"\)\}>/,
    );
  });

  it("インラインの style 属性を持たない", () => {
    expect(ACCOUNT).not.toMatch(/\sstyle=["{]/);
  });
});
