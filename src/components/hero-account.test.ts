import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../i18n/ui";
import { accountLinks } from "./hero-account";

const ACCOUNT = readFileSync(
  new URL("./HeroAccount.astro", import.meta.url),
  "utf8",
);

/** Returns the body of the first at-rule that starts with `prelude`, without its braces. */
const atRule = (prelude: string) => {
  const from = ACCOUNT.indexOf(prelude);
  expect(from).toBeGreaterThanOrEqual(0);
  const open = ACCOUNT.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < ACCOUNT.length; i++) {
    if (ACCOUNT[i] === "{") depth++;
    if (ACCOUNT[i] === "}" && --depth === 0) return ACCOUNT.slice(open + 1, i);
  }
  throw new Error(`unclosed: ${prelude}`);
};

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
  it("アバターは 96px の FaceIcon で、隣の @LinaTsukusu が名指すので alt を空にする", () => {
    expect(ACCOUNT).toMatch(
      /<div class="ticks-acc"><FaceIcon kind="avatar" size=\{96\} alt="" \/><\/div>/,
    );
    expect(ACCOUNT).toMatch(/<span class="handle">@LinaTsukusu<\/span>/);
  });

  it("リンクの四角は .sq で、名前を aria-label に、rel を rel に渡し、nav の名前は hero.links にする", () => {
    expect(ACCOUNT).toMatch(
      /<a\s+class:list=\{\["sq", `sq-\$\{id\}`\]\}\s+href=\{href\}\s+rel=\{rel\}\s+aria-label=\{label\}\s*>/,
    );
    expect(ACCOUNT).toMatch(
      /<nav aria-label=\{translate\(lang, "hero\.links"\)\}>/,
    );
  });

  it("窓の外側の箱を container にし、幅 459px 以下で nav を 2 段目に移し、317px 以下で折り返す", () => {
    expect(ACCOUNT).toMatch(/\.account \{\s*container-type: inline-size;/);
    const narrow = atRule("@container (max-width: 459px)");
    expect(narrow).toMatch(/\.text \{\s*display: contents;/);
    expect(narrow).toMatch(/nav \{\s*grid-column: 1 \/ -1;/);
    expect(atRule("@container (max-width: 317px)")).toMatch(
      /nav \{\s*flex-wrap: wrap;/,
    );
  });

  it("767px 以下は label を出さず、アバターを 70px にし、nav を常に 2 段目に置く", () => {
    const mobile = atRule("@media (max-width: 767px)");
    expect(mobile).toMatch(/\.label \{\s*display: none;/);
    expect(mobile).toMatch(
      /\.ticks-acc :global\(img\) \{\s*width: 70px;\s*height: 70px;/,
    );
    expect(mobile).toMatch(/\.text \{\s*display: contents;/);
    expect(mobile).toMatch(/nav \{\s*grid-column: 1 \/ -1;/);
  });

  it("インラインの style 属性を持たない", () => {
    expect(ACCOUNT).not.toMatch(/\sstyle=["{]/);
  });
});
