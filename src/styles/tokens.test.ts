import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const design = readFileSync(
  new URL("../../design/CBMain.dc.html", import.meta.url),
  "utf8",
);
const tokens = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

/**
 * Returns the declarations of the rule whose selector starts a line of `css`.
 *
 * Comments are dropped, property names are kept as written and values are lowercased, so
 * `#E8731A` in the design and `#e8731a` in `tokens.css` compare equal.
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
      .toLowerCase();
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

const THEME_INDEPENDENT = {
  "--ink": "#232427",
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

  it("ライトのトークンはデザインの .root の変数をすべて同じ値で持つ", () => {
    const expected = customProperties(declarations(design, ".root"));
    expect(expected).toHaveProperty("--num");
    expect(light).toMatchObject(expected);
  });

  it("ダークのトークンはデザインの .root.dark の変数を --num のほかは同じ値で持ち、ほかにはアイコンの色だけを持つ", () => {
    const expected = customProperties(declarations(design, ".root.dark"));
    expect(expected["--num"]).toBe("#b85510");
    expect(customProperties(dark)).toEqual({
      ...expected,
      "--num": "#a04a0e",
      "--icon-yt": "#ffffff",
      "--icon-x": "#ffffff",
    });
  });

  it("アクセント色とインク色はテーマに依らないトークンとして :root にだけある", () => {
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

  it("color-scheme はライトで light、ダークで dark になる", () => {
    expect(light["color-scheme"]).toBe("light");
    expect(dark["color-scheme"]).toBe("dark");
  });
});

/**
 * Foreground and background tokens of every text color in the design, checked in both themes.
 *
 * Text is judged against the fill under it; the 1px lines of `.grid` and `.cgrid` are not counted
 * as background. Every pair must reach 4.5:1: none relies on the 3:1 allowance for large text.
 * `--orange` is not a text color on `--bg` (2.53:1 in the light theme): text in `--orange` is
 * limited to decorative marks hidden from assistive technology. `--invmuted` is used only on
 * `--inv`.
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
  ["--ink", "--orange"],
  ["--ink", "--pink"],
  ["--ink", "--blush"],
  ["--ink", "--paper"],
  ["--ink", "--field"],
  ["--paper-muted", "--ink"],
];

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
