import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HERO = readFileSync(new URL("./Hero.astro", import.meta.url), "utf8");
const POSES = readFileSync(
  new URL("./HeroPoses.astro", import.meta.url),
  "utf8",
);
const WINDOW_CSS = readFileSync(
  new URL("../styles/window.css", import.meta.url),
  "utf8",
);

/** Returns the part of `HERO` from `start` up to the next `end`. */
const between = (start: string, end: string) => {
  const from = HERO.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const to = HERO.indexOf(end, from);
  expect(to).toBeGreaterThan(from);
  return HERO.slice(from, to);
};

describe("Hero の飾りと窓の差し込み口", () => {
  it("斜めの帯・斜線・2 本の線・5 つの印は 1 つの aria-hidden の箱に入る", () => {
    const decor = between('<div class="decor"', '<div class="hero-grid">');
    expect(decor).toMatch(/^<div class="decor" aria-hidden="true">/);
    expect(decor).toContain('<div class="hatch">');
    expect(decor).toContain('<div class="band">');
    expect(decor.match(/class="ln ln-/g)).toHaveLength(2);
    expect(decor.match(/class="cross c\d"/g)).toHaveLength(5);
  });

  it("Hero の下の斜線の帯は .stripes で、支援技術から隠す", () => {
    expect(HERO).toMatch(/<div class="stripes" aria-hidden="true"><\/div>/);
  });

  it("プロンプトは支援技術から隠す", () => {
    expect(HERO).toMatch(/<p class="whoami" aria-hidden="true">/);
  });

  it("ボタンは #latest へのリンクで、A案の .btn .btn-acc を使う", () => {
    expect(HERO).toMatch(/<a class="btn btn-acc latest" href="#latest">/);
  });

  it("C'案の部品を使わない", () => {
    expect(HERO).not.toMatch(/import (Kao|Chip|IconLink|Tape)\b/);
    expect(HERO).not.toMatch(/PROFILE_LINKS/);
  });

  it("インラインの style 属性を持たない", () => {
    expect(HERO).not.toMatch(/\sstyle=["{]/);
  });

  it("アカウントの窓の箱は左の列の最後で HeroAccount を入れ、右の列の箱は格子の 2 つ目の子で HeroPoses だけを持つ", () => {
    const left = between('<div class="hero-left">', '<div class="hero-right">');
    expect(left).toMatch(
      /<div class="hero-account"><HeroAccount lang=\{lang\} \/><\/div>\s*<\/div>\s*$/,
    );
    expect(
      HERO.match(
        /<div class="hero-right">\s*<HeroPoses lang=\{lang\} \/>\s*<\/div>/g,
      ),
    ).toHaveLength(1);
  });
});

/** Returns the text inside every `@media (max-width: 767px) { … }` block of `css`, joined. */
function mobileCss(css: string): string {
  const marker = "@media (max-width: 767px) {";
  const blocks: string[] = [];
  for (
    let at = css.indexOf(marker);
    at >= 0;
    at = css.indexOf(marker, at + 1)
  ) {
    const open = css.indexOf("{", at);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
      if (depth === 0) {
        blocks.push(css.slice(open + 1, i));
        break;
      }
    }
  }
  expect(blocks.length).toBeGreaterThan(0);
  return blocks.join("\n");
}

/** Returns the declarations of the rule of `selector` in `css`, each on one line. */
function declarationsOf(css: string, selector: string): string[] {
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
    (m) => m[1].trim() === selector,
  );
  expect(rule, selector).toBeDefined();
  return (rule?.[2] ?? "")
    .split(";")
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

describe("Hero の 767px 以下の組み", () => {
  const hero = mobileCss(HERO.slice(HERO.indexOf("<style>")));
  const poses = mobileCss(POSES.slice(POSES.indexOf("<style>")));
  const windowCss = mobileCss(WINDOW_CSS);

  it("格子と右の列は箱を作らず、右の列の部品は Hero に対して置かれる", () => {
    expect(declarationsOf(hero, ".hero-grid")).toEqual(
      expect.arrayContaining([
        "position: static",
        "min-height: 0",
        "padding: 0",
      ]),
    );
    expect(declarationsOf(hero, ".hero-right")).toEqual(
      expect.arrayContaining(["display: contents"]),
    );
  });

  it("左の列は上を 330px 空けて重ね、文字の無いところのタップは下のボタンに届く", () => {
    expect(declarationsOf(hero, ".hero-left")).toEqual(
      expect.arrayContaining([
        "gap: 18px",
        "padding: 440px 16px 32px",
        "pointer-events: none",
      ]),
    );
    expect(declarationsOf(hero, ".hero-left > *")).toEqual(
      expect.arrayContaining(["pointer-events: auto"]),
    );
  });

  it("左の列の地は 330px から 110px で --ov に変わり、タップを受ける", () => {
    const rule = declarationsOf(hero, ".hero-left::before");
    expect(rule).toEqual(
      expect.arrayContaining([
        'content: ""',
        "position: absolute",
        "inset: 330px 0 0",
        "z-index: -1",
        "pointer-events: auto",
      ]),
    );
    expect(rule.join(";")).toMatch(
      /background: linear-gradient\( ?to bottom, transparent 0, var\(--ov\) 110px, var\(--ov\) 100% ?\)/,
    );
  });

  it("whoami は左上 16px に重ね、地は --shade にする", () => {
    expect(declarationsOf(hero, ".whoami")).toEqual(
      expect.arrayContaining([
        "position: absolute",
        "top: 16px",
        "left: 16px",
        "z-index: 2",
        "background: var(--shade)",
      ]),
    );
  });

  it("帯は 140px で 52% に置き、斜線は 22px、印は出さない", () => {
    expect(declarationsOf(hero, ".decor")).toEqual(["--band-left: 52%"]);
    expect(declarationsOf(hero, ".band")).toEqual(
      expect.arrayContaining(["top: -6%", "width: 140px", "height: 80%"]),
    );
    expect(declarationsOf(hero, ".hatch")).toEqual(
      expect.arrayContaining([
        "top: -6%",
        "left: calc(var(--band-left) - 64px)",
        "width: 22px",
        "height: 80%",
      ]),
    );
    expect(declarationsOf(hero, ".cross")).toEqual(["display: none"]);
  });

  it("見出しは 36px、紹介文は 15px、アカウントの窓の上の余白は無い", () => {
    expect(declarationsOf(hero, ".heading")).toEqual(
      expect.arrayContaining(["font-size: 36px"]),
    );
    expect(declarationsOf(hero, ".intro")).toEqual(
      expect.arrayContaining(["font-size: 15px"]),
    );
    expect(declarationsOf(hero, ".hero-account")).toEqual(["margin-top: 0"]);
  });

  it("ポーズは上から 20px で高さ 1195px、スペック表は右上 16px に 2 行だけ出す", () => {
    expect(declarationsOf(poses, ".pose")).toEqual(
      expect.arrayContaining(["top: 20px", "bottom: auto", "height: 1195px"]),
    );
    expect(declarationsOf(poses, ".spec")).toEqual(
      expect.arrayContaining(["top: 16px", "right: 16px", "display: flex"]),
    );
    expect(declarationsOf(poses, ".spec-row:nth-child(-n + 3)")).toEqual([
      "display: none",
    ]);
  });

  it("格子の線は 32px、斜線の帯は 14px、アバターの影は小さい（window.css）", () => {
    expect(declarationsOf(windowCss, ".gridbg")).toEqual([
      "background-size: 32px 32px",
    ]);
    expect(declarationsOf(windowCss, ".stripes")).toEqual(
      expect.arrayContaining(["height: 14px", "background-size: 32px 32px"]),
    );
    expect(declarationsOf(windowCss, ".av-shadow").join(";")).toMatch(
      /drop-shadow\(12px 8px 0 var\(--av-hard\)\) drop-shadow\(0 20px 28px var\(--av-soft\)\)/,
    );
  });
});
