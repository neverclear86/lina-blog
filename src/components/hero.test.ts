import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HERO = readFileSync(new URL("./Hero.astro", import.meta.url), "utf8");
const POSES = readFileSync(
  new URL("./HeroPoses.astro", import.meta.url),
  "utf8",
);
const MOTION = readFileSync(
  new URL("../styles/motion.css", import.meta.url),
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
    expect(HERO).toMatch(/<p class="whoami rv" aria-hidden="true">/);
  });

  it("ボタンは #latest へのリンクで、A案の .btn .btn-acc を使う", () => {
    expect(HERO).toMatch(/<a class="btn btn-acc latest rv" href="#latest">/);
  });

  it("プロフィールのリンクの一覧 PROFILE_LINKS を使わない", () => {
    expect(HERO).not.toMatch(/PROFILE_LINKS/);
  });

  it("インラインの style 属性を持たない", () => {
    expect(HERO).not.toMatch(/\sstyle=["{]/);
  });

  it("アカウントの窓の箱は左の列の最後で HeroAccount を入れ、右の列の箱は格子の 2 つ目の子で HeroPoses だけを持つ", () => {
    const left = between('<div class="hero-left">', '<div class="hero-right">');
    expect(left).toMatch(
      /<div class="hero-account rv"><HeroAccount lang=\{lang\} \/><\/div>\s*<\/div>\s*$/,
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

/** Returns the text inside every `header { … }` block of `css`, joined. */
function blockOf(css: string, header: string): string {
  const blocks: string[] = [];
  for (
    let at = css.indexOf(header);
    at >= 0;
    at = css.indexOf(header, at + 1)
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
  expect(blocks.length, header).toBeGreaterThan(0);
  return blocks.join("\n");
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
    expect(declarationsOf(hero, ".hero-account")).toEqual([
      "margin-top: 0",
      "animation-delay: 0.7s",
    ]);
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
      expect.arrayContaining(["height: 14px", "--stripes-period: 32px"]),
    );
    expect(declarationsOf(windowCss, ".av-shadow").join(";")).toMatch(
      /drop-shadow\(12px 8px 0 var\(--av-hard\)\) drop-shadow\(0 20px 28px var\(--av-soft\)\)/,
    );
  });
});

describe("Hero の帯・斜線・下の帯の流れ", () => {
  const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const style = () => noComments(HERO.slice(HERO.indexOf("<style>")));
  const mobile = () => mobileCss(style());
  const reduce = () =>
    blockOf(style(), "@media (prefers-reduced-motion: reduce) {");
  const windowCss = () => noComments(WINDOW_CSS);
  const windowMobile = () => mobileCss(windowCss());
  const windowReduce = () =>
    blockOf(windowCss(), "@media (prefers-reduced-motion: reduce) {");

  it("帯の文字は 8 回繰り返し、band-flow は 2 回分（-25%）で 1 周して継ぎ目が出ない", () => {
    expect(HERO).toMatch(/const BAND_TEXT = [^\n]*\.repeat\(8\);/);
    expect(style()).toMatch(
      /@keyframes band-flow\s*\{\s*to\s*\{\s*translate: 0 -25%;/,
    );
  });

  it("帯の文字は PC で 56s、767px 以下で 44s の linear infinite", () => {
    expect(declarationsOf(style(), ".band-text")).toContain(
      "animation: band-flow 56s linear infinite",
    );
    expect(declarationsOf(mobile(), ".band-text")).toContain(
      "animation-duration: 44s",
    );
  });

  it("斜線は ::before を 1 周期ぶん長くして上へずらし、.hatch 自身の流れと background-position は動かさない", () => {
    expect(declarationsOf(style(), ".hatch::before")).toEqual(
      expect.arrayContaining([
        "inset: 0 0 calc(-1 * var(--hatch-period))",
        "animation: hatch-up 1.2s linear infinite",
      ]),
    );
    expect(style()).toMatch(
      /@keyframes hatch-up\s*\{\s*to\s*\{\s*translate: 0 calc\(-1 \* var\(--hatch-period\)\);/,
    );
    expect(declarationsOf(style(), ".hatch")).toContain("overflow: hidden");
    expect(declarationsOf(style(), ".hatch").join("\n")).not.toMatch(
      /hatch-up/,
    );
    expect(style()).not.toMatch(/background-position/);
  });

  it("斜線の周期は --hatch-on と --hatch-period の 1 か所で、PC は 5px と 15px、767px 以下は 4px と 12px と 1s", () => {
    expect(declarationsOf(style(), ".hatch")).toEqual(
      expect.arrayContaining(["--hatch-on: 5px", "--hatch-period: 15px"]),
    );
    expect(declarationsOf(style(), ".hatch::before").join("\n")).toMatch(
      /var\(--hatch-on\).*var\(--hatch-on\) var\(--hatch-period\)/,
    );
    expect(declarationsOf(style(), ".hatch").join("\n")).not.toMatch(
      /background/,
    );
    expect(declarationsOf(mobile(), ".hatch")).toEqual(
      expect.arrayContaining(["--hatch-on: 4px", "--hatch-period: 12px"]),
    );
    expect(declarationsOf(mobile(), ".hatch").join("\n")).not.toMatch(
      /background/,
    );
    expect(declarationsOf(mobile(), ".hatch::before")).toEqual([
      "animation-duration: 1s",
    ]);
  });

  it("下の帯は ::before を 1 周期ぶん長くして右へずらし、PC は 40px で 1.6s、767px 以下は 32px で 1.4s", () => {
    expect(declarationsOf(windowCss(), ".stripes")).toEqual(
      expect.arrayContaining(["--stripes-period: 40px", "overflow: hidden"]),
    );
    expect(declarationsOf(windowCss(), ".stripes").join("\n")).not.toMatch(
      /background/,
    );
    expect(declarationsOf(windowCss(), ".stripes::before")).toEqual(
      expect.arrayContaining([
        "inset: 0 calc(-1 * var(--stripes-period)) 0 0",
        "animation: stripes-right 1.6s linear infinite",
      ]),
    );
    expect(windowCss()).toMatch(
      /@keyframes stripes-right\s*\{\s*from\s*\{\s*translate: calc\(-1 \* var\(--stripes-period\)\) 0;\s*\}\s*to\s*\{\s*translate: 0 0;/,
    );
    expect(declarationsOf(windowMobile(), ".stripes")).toEqual(
      expect.arrayContaining(["--stripes-period: 32px", "height: 14px"]),
    );
    expect(declarationsOf(windowMobile(), ".stripes::before")).toEqual([
      "animation-duration: 1.4s",
    ]);
  });

  it("prefers-reduced-motion: reduce で帯の文字、斜線、下の帯の animation を止める", () => {
    expect(reduce()).toMatch(
      /\.band-text,\s*\.hatch::before\s*\{\s*animation: none;\s*\}/,
    );
    expect(windowReduce()).toMatch(
      /\.stripes::before\s*\{\s*animation: none;\s*\}/,
    );
  });
});

/** Returns the declarations of every rule of `selector` in `css`, one entry for each. */
const rulesDeclarationsOf = (css: string, selector: string) => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    (m) => m[1].trim().replace(/\s+/g, " ") === selector,
  );
  expect(rules.length, selector).toBeGreaterThan(0);
  return rules
    .flatMap((m) => m[2].split(";"))
    .map((d) => d.trim().replace(/\s+/g, " "))
    .filter(Boolean);
};

describe("Hero の初回表示の演出", () => {
  const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
  /** The style of `Hero.astro` before its first `@media`. */
  const outsideMedia = () => between("<style>", "@media");
  /** The 767px block of `Hero.astro`. */
  const mobile = () =>
    between("@media (max-width: 767px)", "@media (prefers-reduced-motion");
  /** The reduced-motion block of `Hero.astro`. */
  const reduce = () => between("@media (prefers-reduced-motion", "</style>");

  it("左の列の 6 つの要素が .rv を持つ", () => {
    const left = between('<div class="hero-left">', '<div class="hero-right">');
    for (const cls of [
      "whoami",
      "ticks hero-logo",
      "heading",
      "intro",
      "btn btn-acc latest",
      "hero-account",
    ]) {
      expect(left, cls).toMatch(
        new RegExp(`class="${cls}\\b[^"]*\\brv\\b[^"]*"`),
      );
    }
    expect(left.match(/class="[^"]*\brv\b[^"]*"/g)).toHaveLength(6);
  });

  it("遅延は whoami 0.2s、ロゴ 0.35s、見出し 0.5s、紹介文 0.6s、ボタン 0.7s、アカウントの窓 0.8s", () => {
    const css = outsideMedia();
    const delays = [
      [".whoami", "0.2s"],
      [".hero-logo", "0.35s"],
      [".heading", "0.5s"],
      [".intro", "0.6s"],
      [".latest", "0.7s"],
      [".hero-account", "0.8s"],
    ];
    for (const [selector, delay] of delays) {
      expect(declarationsOf(css, selector), selector).toContain(
        `animation-delay: ${delay}`,
      );
    }
  });

  it("767px 以下はロゴ 0.4s、見出し 0.55s、アカウントの窓 0.7s、whoami は演出なしで、紹介文とボタンは変えない", () => {
    const css = mobile();
    expect(declarationsOf(css, ".hero-logo")).toContain(
      "animation-delay: 0.4s",
    );
    expect(declarationsOf(css, ".heading")).toContain("animation-delay: 0.55s");
    expect(declarationsOf(css, ".hero-account")).toContain(
      "animation-delay: 0.7s",
    );
    expect(declarationsOf(css, ".whoami")).toContain("animation: none");
    expect(declarationsOf(css, ".intro").join(";")).not.toMatch(/animation/);
    expect(declarationsOf(css, ".latest").join(";")).not.toMatch(/animation/);
  });

  it("帯は band-in を 0.9s、遅延 0.1s で、斜線は遅延なしで再生する", () => {
    const css = outsideMedia();
    expect(declarationsOf(css, ".band")).toContain(
      `animation: band-in 0.9s ${EASE} 0.1s backwards`,
    );
    expect(declarationsOf(css, ".hatch")).toContain(
      `animation: band-in 0.9s ${EASE} backwards`,
    );
  });

  it("ロゴのカーソルの点滅は 1.6s 後に始まる", () => {
    expect(declarationsOf(outsideMedia(), ".hero-logo :global(.cur)")).toEqual([
      "animation-delay: 1.6s",
    ]);
  });

  it("動きを減らす設定では帯と斜線の出現を止める", () => {
    expect(rulesDeclarationsOf(reduce(), ".band, .hatch")).toEqual([
      "animation: none",
    ]);
  });

  it("rv-up は 18px 下から出て、767px 以下は 16px にし、動きを減らす設定では止める", () => {
    const keyframes = MOTION.slice(MOTION.indexOf("@keyframes rv-up"));
    expect(keyframes.slice(0, keyframes.indexOf("@keyframes band-in"))).toMatch(
      /from\s*\{\s*opacity: 0;\s*translate: 0 var\(--rv-dy, 18px\);\s*\}/,
    );
    expect(rulesDeclarationsOf(MOTION, ".rv")).toEqual([
      `animation: rv-up 0.7s ${EASE} backwards`,
      "--rv-dy: 16px",
    ]);
    expect(MOTION).toMatch(
      /@media \(max-width: 767px\) \{\s*\.rv \{\s*--rv-dy: 16px;/,
    );
    expect(MOTION).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.rv,[^@]*animation: none/,
    );
  });

  it("band-in は下から上へ開く", () => {
    const keyframes = MOTION.slice(MOTION.indexOf("@keyframes band-in"));
    expect(
      keyframes.slice(0, keyframes.indexOf("@keyframes typeLoop")),
    ).toMatch(
      /from\s*\{\s*clip-path: inset\(100% 0 0 0\);\s*\}\s*to\s*\{\s*clip-path: inset\(0 0 0 0\);/,
    );
  });

  it("テーマの属性やテーマの設定で出現の規則を変えない", () => {
    const style = HERO.slice(HERO.indexOf("<style>"));
    expect(style).not.toMatch(/data-theme|prefers-color-scheme/);
    expect(MOTION).not.toMatch(/data-theme|prefers-color-scheme/);
  });
});
