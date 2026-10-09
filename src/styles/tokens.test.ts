import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The `.root` and `.root.dark` rules of `CBMain.dc.html`, the design copy the tokens were taken
 * from, without their `transition`. The design copy is kept outside the repository, so the rules
 * are written here.
 */
const design = `
.root {
  --bg: #ECEAE5; --fg: #232427; --muted: #5A5B5F; --line: #232427; --hair: #CFCBC3;
  --grid: #D9D6CF; --surf: #F8F7F3; --inv: #232427; --invfg: #F8F7F3; --invmuted: #A9A8A3;
  --shadow: #232427; --ph: #E2DFD8; --chip: #E2DFD8; --cbg: #232427; --cfg: #F8F7F3;
  --cmuted: #A9A8A3; --cline: #55565B; --cgrid: #2F3034; --fshadow: #E8731A; --num: #E8731A;
}
.root.dark {
  --bg: #17181B; --fg: #ECEAE5; --muted: #A3A3A0; --line: #5E6167; --hair: #34363B;
  --grid: #26282C; --surf: #222428; --inv: #ECEAE5; --invfg: #17181B; --invmuted: #55565B;
  --shadow: #ECEAE5; --ph: #2A2C31; --chip: #2E3035; --cbg: #E4E1DA; --cfg: #232427;
  --cmuted: #5A5B5F; --cline: #9E9B94; --cgrid: #D6D3CC; --fshadow: #232427; --num: #B85510;
}
`;

/**
 * The `.lx` (dark) and `.lx.light` rules of `Main.dc.html` with `--code` of `AArticle.dc.html` and
 * `--ov` of `AMobile.dc.html` added. The design copies are kept outside the repository, so the
 * rules are written here.
 */
const designA = `
.lx {
  --bg:#17181B;--bg2:#1C1E22;--panel:#202227;--hdr:rgba(23,24,27,.86);--line:rgba(236,234,229,.12);
  --line2:rgba(236,234,229,.26);--grid:rgba(236,234,229,.045);--text:#ECEAE5;--muted:#A3A3A0;
  --acc-text:#E8731A;--shade:rgba(23,24,27,.82);--av-hard:rgba(0,0,0,.38);--av-soft:rgba(0,0,0,.5);
  --lg-n:#ECEAE5;--lg-c:#A3A3A0;--lg-r:#3A3C42;--code:#121316;--ov:rgba(23,24,27,.8);
}
.lx.light {
  --bg:#ECEAE5;--bg2:#E2E0DA;--panel:#F6F5F1;--hdr:rgba(236,234,229,.88);--line:rgba(35,36,39,.14);
  --line2:rgba(35,36,39,.3);--grid:rgba(35,36,39,.06);--text:#232427;--muted:#5A5B5F;
  --acc-text:#232427;--shade:rgba(236,234,229,.86);--av-hard:rgba(35,36,39,.16);
  --av-soft:rgba(35,36,39,.22);--lg-n:#232427;--lg-c:#5A5B5F;--lg-r:#C9C6BF;--code:#17181B;
  --ov:rgba(236,234,229,.82);
}
`;
const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const highlightCss = readFileSync(
  new URL("../markdown/highlight.css", import.meta.url),
  "utf8",
);

/**
 * Returns the declarations of the rule whose selector starts a line of `css`.
 *
 * Comments are dropped, property names are kept as written and values are lowercased, with the
 * spaces around commas and the zero before a decimal point removed, so `#E8731A` in the design
 * and `#e8731a` in `tokens.css` compare equal, and so do `rgba(23,24,27,.86)` and
 * `rgba(23, 24, 27, 0.86)`.
 */
function declarations(css: string, selector: string): Record<string, string> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "m").exec(source);
  if (!match) {
    throw new Error(`no rule for ${selector}`);
  }
  const result: Record<string, string> = {};
  for (const declaration of match[1].split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) {
      continue;
    }
    result[declaration.slice(0, colon).trim()] = declaration
      .slice(colon + 1)
      .trim()
      .toLowerCase()
      .replace(/\s*,\s*/g, ",")
      .replace(/\b0\./g, ".");
  }
  return result;
}

/** Keeps only the custom properties (`--*`) of a rule. */
function customProperties(
  rule: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(rule).filter(([name]) => name.startsWith("--")),
  );
}

/**
 * Renames the properties `--line` and `--grid` of a rule of the earlier design to the names
 * `tokens.css` gives them, `--legacy-line` and `--legacy-grid`.
 */
function legacy(rule: Record<string, string>): Record<string, string> {
  const renamed: Record<string, string> = {
    "--line": "--legacy-line",
    "--grid": "--legacy-grid",
  };
  return Object.fromEntries(
    Object.entries(rule).map(([name, value]) => [renamed[name] ?? name, value]),
  );
}

const FOCUS_RING = { light: "#232427", dark: "#e8731a" };

const THEME_INDEPENDENT = {
  "--keyword": "#e8731a",
  "--keyword-hover": "#f08534",
  "--ink": "#17181b",
  "--ivory": "#eceae5",
  "--comment": "#a3a3a0",
  "--legacy-ink": "#232427",
  "--orange": "#e8731a",
  "--pink": "#f08fa6",
  "--blush": "#fbe3e3",
  "--green": "#8bbf5a",
  "--paper": "#f8f7f3",
  "--paper-muted": "#a9a8a3",
  "--field": "#ffffff",
};

describe("tokens.css", () => {
  const light = declarations(tokens, ":root");
  const dark = declarations(tokens, ':root[data-theme="dark"]');

  it("ライトのトークンはデザインの .root の変数を --line と --grid を --legacy- 付きにしてすべて同じ値で持つ", () => {
    const expected = legacy(customProperties(declarations(design, ".root")));
    expect(expected).toHaveProperty("--num");
    expect(light).toMatchObject(expected);
  });

  it("ダークのトークンはデザインの .root.dark の変数を --line と --grid を --legacy- 付きにして --num のほかは同じ値で持つ", () => {
    const expected = legacy(
      customProperties(declarations(design, ".root.dark")),
    );
    expect(expected["--num"]).toBe("#b85510");
    expect(dark).toMatchObject({ ...expected, "--num": "#a04a0e" });
  });

  it("ライトのトークンはデザインの A案 の .lx.light の変数をすべて同じ値で持つ", () => {
    const expected = customProperties(declarations(designA, ".lx.light"));
    expect(Object.keys(expected)).toHaveLength(18);
    expect(light).toMatchObject(expected);
  });

  it("ダークのトークンはデザインの A案 の .lx の変数をすべて同じ値で持つ", () => {
    const expected = customProperties(declarations(designA, ".lx"));
    expect(Object.keys(expected)).toHaveLength(18);
    expect(dark).toMatchObject(expected);
  });

  it("ダークのトークンはライトに無い名前の変数を持たない", () => {
    const missing = Object.keys(customProperties(dark)).filter(
      (name) => !(name in light),
    );
    expect(missing).toEqual([]);
  });

  it("フォーカスの輪の色はライトで文字色、ダークでオレンジになる", () => {
    expect(light["--focus-ring"]).toBe(FOCUS_RING.light);
    expect(light["--focus-ring"]).toBe(light["--text"]);
    expect(dark["--focus-ring"]).toBe(FOCUS_RING.dark);
    expect(dark["--focus-ring"]).toBe(THEME_INDEPENDENT["--keyword"]);
  });

  it("テーマに依らない色はテーマに依らないトークンとして :root にだけある", () => {
    expect(light).toMatchObject(THEME_INDEPENDENT);
    for (const name of Object.keys(THEME_INDEPENDENT)) {
      expect(dark).not.toHaveProperty(name);
    }
  });

  it("アイコンの色はライトで YouTube の Almost Black と Twitter(自称X) の黒、ダークで白になる", () => {
    expect(light).toMatchObject({
      "--icon-yt": "#212121",
      "--icon-x": "#000000",
    });
    expect(dark).toMatchObject({
      "--icon-yt": "#ffffff",
      "--icon-x": "#ffffff",
    });
  });

  it("コードブロックの文字色は A案 の文字・コメント・オレンジと同じ値を軸にする", () => {
    expect(light).toMatchObject({
      "--code-fg": light["--ivory"],
      "--code-comment": light["--comment"],
      "--code-keyword": light["--keyword"],
    });
  });

  it("コードブロックの文字色と diff の色はダークの規則で変えず、地は --code-bg でなく --code を使う", () => {
    expect(
      Object.keys(dark).filter((name) => name.startsWith("--code-")),
    ).toEqual([]);
    expect(light).not.toHaveProperty("--code-bg");
  });

  it("color-scheme はライトで light、ダークで dark になる", () => {
    expect(light["color-scheme"]).toBe("light");
    expect(dark["color-scheme"]).toBe("dark");
  });
});

/**
 * Text colors of code blocks. `src/markdown/highlight.css` sets `color` only to these tokens, and
 * each must reach 4.5:1 on every one of `CODE_BACKGROUNDS` in both themes.
 */
const CODE_FOREGROUNDS = [
  "--code-fg",
  "--code-comment",
  "--code-keyword",
  "--code-string",
  "--code-constant",
  "--code-function",
  "--code-type",
  "--code-punctuation",
] as const;

/**
 * Fills under code block text: the block itself, which changes with the theme, and an added and a
 * deleted line of a diff. `src/markdown/highlight.css` sets `background` or `background-color`
 * only to these tokens.
 */
const CODE_BACKGROUNDS = ["--code", "--code-add-bg", "--code-del-bg"] as const;

/** Each text color of a code block on each fill a code line can have. */
const CODE_TEXT_PAIRS: readonly (readonly [
  foreground: string,
  background: string,
])[] = CODE_FOREGROUNDS.flatMap((foreground) =>
  CODE_BACKGROUNDS.map((background) => [foreground, background] as const),
);

/**
 * The bar at the left edge of a diff line on the fill of that line. A diff line is told apart by
 * its bar and its `+` or `-`, not by its fill, so a bar is a graphical object that must reach 3:1
 * (WCAG 2.2 SC 1.4.11).
 */
const CODE_BAR_PAIRS: readonly (readonly [
  foreground: string,
  background: string,
])[] = [
  ["--code-add-bar", "--code-add-bg"],
  ["--code-del-bar", "--code-del-bg"],
];

/**
 * Foreground and background tokens of every text color in the design, checked in both themes.
 *
 * Text is judged against the fill under it; the 1px lines of `.grid` and `.cgrid` are not counted
 * as background. Every pair must reach 4.5:1: none relies on the 3:1 allowance for large text.
 * `--orange` is not a text color on `--bg` (2.53:1 in the light theme): text in `--orange` is
 * limited to decorative marks hidden from assistive technology. `--invmuted` is used only on
 * `--inv`. These are the pairs of the legacy tokens and of the code blocks (`CODE_TEXT_PAIRS`);
 * `A_TEXT_PAIRS` holds the plan A tokens'.
 */
const TEXT_PAIRS: readonly (readonly [
  foreground: string,
  background: string,
])[] = [
  ["--fg", "--bg"],
  ["--fg", "--surf"],
  ["--fg", "--chip"],
  ["--muted", "--bg"],
  ["--muted", "--surf"],
  ["--muted", "--ph"],
  ["--invfg", "--inv"],
  ["--invmuted", "--inv"],
  ["--cfg", "--cbg"],
  ["--cmuted", "--cbg"],
  ["--num", "--cbg"],
  ["--legacy-ink", "--orange"],
  ["--legacy-ink", "--pink"],
  ["--legacy-ink", "--blush"],
  ["--legacy-ink", "--paper"],
  ["--legacy-ink", "--field"],
  ["--paper-muted", "--legacy-ink"],
  ...CODE_TEXT_PAIRS,
];

/**
 * Foreground and background tokens of every text color of the plan A tokens, checked in both
 * themes. A background is a token, or `[translucent, under]` for a translucent token (`--hdr`,
 * `--shade`, `--ov`) laid over the fill that can come under it. Every pair must reach 4.5:1.
 *
 * Not checked: lines, shadows and the logo (a logotype is exempt from WCAG 1.4.3), and
 * `--keyword` as a text color on `--bg` (2.53:1 in the light theme), which is why `--acc-text`
 * and `--focus-ring` are the text color there.
 */
const A_FILLS = ["--bg", "--bg2", "--panel"] as const;
const A_TRANSLUCENT = ["--hdr", "--shade", "--ov"] as const;
const A_UNDER = [...A_FILLS, "--keyword"] as const;
const A_TEXT_PAIRS: readonly (readonly [
  foreground: string,
  background: string | readonly [translucent: string, under: string],
])[] = [
  ...["--text", "--muted", "--acc-text"].flatMap((foreground) => [
    ...A_FILLS.map((fill) => [foreground, fill] as const),
    ...A_TRANSLUCENT.flatMap((translucent) =>
      A_UNDER.map((under) => [foreground, [translucent, under]] as const),
    ),
  ]),
  ["--ivory", "--code"],
  ["--comment", "--code"],
  ["--keyword", "--code"],
  ["--ink", "--keyword"],
  ["--ink", "--keyword-hover"],
];

/**
 * Pairs of `A_TEXT_PAIRS` that are not checked. `--acc-text` on `--ov` over `--keyword` is 4.39:1
 * in the dark theme: `--ov` is on the image of the Hero on narrow screens only, and no orange
 * comes under it. `tokens.test.ts` checks that each of these fails when it is not excluded.
 */
const A_EXCLUDED = new Set(["--acc-text on --ov over --keyword"]);

/** The 3:1 pairs of `--focus-ring`: the backgrounds of the page. */
const FOCUS_PAIRS: readonly (readonly [
  foreground: string,
  background: string,
])[] = A_FILLS.map((fill) => ["--focus-ring", fill]);

/**
 * Icon colors of `src/components/icons/` on the face of `IconLink` (`--surf`), checked in both
 * themes. An icon is a graphical object, so it must reach 3:1 (WCAG 2.2 SC 1.4.11).
 */
const ICON_PAIRS: readonly (readonly [
  foreground: string,
  background: string,
])[] = [
  ["--fg", "--surf"],
  ["--icon-yt", "--surf"],
  ["--icon-x", "--surf"],
];

/**
 * Returns the WCAG 2.2 contrast ratio of two `#rrggbb` colors, from 1 to 21.
 *
 * The order of the arguments does not matter: the lighter color is always the numerator.
 */
function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns the relative luminance of a `#rrggbb` color as WCAG 2.2 defines it. */
function luminance(color: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(color);
  if (!match) {
    throw new Error(`not a #rrggbb color: ${color}`);
  }
  const [r, g, b] = match.slice(1).map((hex) => {
    const c = Number.parseInt(hex, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns `top`, a `#rrggbb` or `rgba(r,g,b,a)` color as `declarations` writes it, laid over the
 * opaque `#rrggbb` color `under`, as the `#rrggbb` color that the viewer sees. Each channel is
 * rounded to an integer, as a browser does.
 */
function flatten(top: string, under: string): string {
  if (top.startsWith("#")) {
    return top;
  }
  const match = /^rgba\((\d+),(\d+),(\d+),(\.?\d+(?:\.\d+)?)\)$/.exec(top);
  const base = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(under);
  if (!match || !base) {
    throw new Error(`cannot lay ${top} over ${under}`);
  }
  const alpha = Number(match[4]);
  const channels = [1, 2, 3].map((i) => {
    const value = Math.round(
      Number(match[i]) * alpha + Number.parseInt(base[i], 16) * (1 - alpha),
    );
    return value.toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

/**
 * Returns the tokens that `css` assigns with `var()` to any of `properties`, sorted and without
 * duplicates. Comments are ignored, and a property name only counts as a whole name, so `color`
 * does not match `outline-color` or `--code-color`.
 */
function tokensUsedFor(css: string, properties: readonly string[]): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = new RegExp(
    String.raw`(?<![\w-])(?:${properties.join("|")})\s*:\s*var\((--[\w-]+)\)`,
    "g",
  );
  return [
    ...new Set([...source.matchAll(pattern)].map((match) => match[1])),
  ].sort();
}

/** Returns the labels of the pairs of `A_TEXT_PAIRS` that are under 4.5:1 in `colors`. */
function failingTextPairs(colors: Record<string, string>): string[] {
  return A_TEXT_PAIRS.flatMap(([foreground, background]) => {
    const [fill, label] =
      typeof background === "string"
        ? [colors[background], `${foreground} on ${background}`]
        : [
            flatten(colors[background[0]], colors[background[1]]),
            `${foreground} on ${background[0]} over ${background[1]}`,
          ];
    return contrastRatio(colors[foreground], fill) < 4.5 ? [label] : [];
  });
}

describe("tokens.css のコントラスト", () => {
  const light = customProperties(declarations(tokens, ":root"));
  const themes = {
    light,
    dark: {
      ...light,
      ...customProperties(declarations(tokens, ':root[data-theme="dark"]')),
    },
  };

  it("contrastRatio は白と黒で 21、同じ色で 1、デザインのダークの --num で 3.7 を返し、#rrggbb でない値で投げる", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#232427", "#232427")).toBe(1);
    expect(contrastRatio("#b85510", "#e4e1da")).toBeCloseTo(3.7, 2);
    expect(() => contrastRatio("var(--fg)", "#000000")).toThrow(
      "not a #rrggbb color",
    );
  });

  it.each(Object.entries(themes))(
    "%s のテキストの色の対はすべて 4.5:1 以上になる",
    (_theme, colors) => {
      const failures = TEXT_PAIRS.flatMap(([foreground, background]) => {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        return ratio < 4.5 ? [`${foreground} / ${background}: ${ratio}`] : [];
      });
      expect(failures).toEqual([]);
    },
  );

  it("flatten は半透明の色を地に重ねた色を返し、不透明な色はそのまま返す", () => {
    expect(flatten("rgba(0,0,0,.5)", "#ffffff")).toBe("#808080");
    expect(flatten("rgba(23,24,27,.86)", "#eceae5")).toBe("#353537");
    expect(flatten("rgba(255,255,255,0)", "#123456")).toBe("#123456");
    expect(flatten("#17181b", "#ffffff")).toBe("#17181b");
    expect(() => flatten("var(--hdr)", "#ffffff")).toThrow("cannot lay");
  });

  it.each(Object.entries(themes))(
    "%s の A案 のテキストの色の対はすべて 4.5:1 以上になる",
    (_theme, colors) => {
      expect(
        failingTextPairs(colors).filter((label) => !A_EXCLUDED.has(label)),
      ).toEqual([]);
    },
  );

  it("除いた対は除かなければ落ちる", () => {
    const failures = Object.values(themes).flatMap(failingTextPairs);
    for (const label of A_EXCLUDED) {
      expect(failures).toContain(label);
    }
  });

  it.each(Object.entries(themes))(
    "%s のフォーカスの輪の色はページの地の上で 3:1 以上になる",
    (_theme, colors) => {
      const failures = FOCUS_PAIRS.flatMap(([foreground, background]) => {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        return ratio < 3 ? [`${foreground} / ${background}: ${ratio}`] : [];
      });
      expect(failures).toEqual([]);
    },
  );

  it.each(Object.entries(themes))(
    "%s のコードブロックの diff の帯は行の地の上で 3:1 以上になる",
    (_theme, colors) => {
      const failures = CODE_BAR_PAIRS.flatMap(([foreground, background]) => {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        return ratio < 3 ? [`${foreground} / ${background}: ${ratio}`] : [];
      });
      expect(failures).toEqual([]);
    },
  );

  it("tokensUsedFor は color と background に var() で渡したトークンだけを整列して重複なく返す", () => {
    const css = `
      /* color: var(--in-comment); */
      .a { color: var(--b); outline-color: var(--outline); --code-color: var(--custom); }
      .b { color: var(--a); background: var(--c); background-color: var(--d); }
      .c { color: var(--b); box-shadow: inset 3px 0 0 var(--shadow); color: red; }
    `;
    expect(tokensUsedFor(css, ["color"])).toEqual(["--a", "--b"]);
    expect(tokensUsedFor(css, ["background", "background-color"])).toEqual([
      "--c",
      "--d",
    ]);
  });

  it("コードブロックの CSS が文字色と地に使うトークンは、コントラストを確かめる一覧と一致する", () => {
    expect(tokensUsedFor(highlightCss, ["color"])).toEqual(
      [...CODE_FOREGROUNDS].sort(),
    );
    expect(
      tokensUsedFor(highlightCss, ["background", "background-color"]),
    ).toEqual([...CODE_BACKGROUNDS].sort());
  });

  it.each(Object.entries(themes))(
    "%s のコードブロックのフォーカスの輪は --keyword で描き、--code の上で 3:1 以上になる",
    (_theme, colors) => {
      const ring =
        /pre\.shiki:focus-visible\s*\{[^}]*?outline:\s*2px solid var\((--[\w-]+)\)/.exec(
          highlightCss,
        );
      expect(ring?.[1]).toBe("--keyword");
      expect(
        contrastRatio(colors["--keyword"], colors["--code"]),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(Object.entries(themes))(
    "%s のアイコンの色は --surf の上で 3:1 以上になる",
    (_theme, colors) => {
      const failures = ICON_PAIRS.flatMap(([foreground, background]) => {
        const ratio = contrastRatio(colors[foreground], colors[background]);
        return ratio < 3 ? [`${foreground} / ${background}: ${ratio}`] : [];
      });
      expect(failures).toEqual([]);
    },
  );
});
