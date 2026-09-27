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

  it("ダークのトークンはデザインの .root.dark の変数をすべて同じ値で持つ", () => {
    const expected = customProperties(declarations(design, ".root.dark"));
    expect(expected).toHaveProperty("--num");
    expect(customProperties(dark)).toEqual(expected);
  });

  it("アクセント色とインク色はテーマに依らないトークンとして :root にだけある", () => {
    expect(light).toMatchObject(THEME_INDEPENDENT);
    for (const name of Object.keys(THEME_INDEPENDENT)) {
      expect(dark).not.toHaveProperty(name);
    }
  });

  it("color-scheme はライトで light、ダークで dark になる", () => {
    expect(light["color-scheme"]).toBe("light");
    expect(dark["color-scheme"]).toBe("dark");
  });
});
