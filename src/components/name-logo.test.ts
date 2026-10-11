import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssOfAstro, parseCss, rulesFor, valueIn } from "../test/css-source";

const SOURCE = readFileSync(
  new URL("./NameLogo.astro", import.meta.url),
  "utf8",
);

/** Conditions of the blocks in `NameLogo.astro` that hold the paths of each form. */
const BLOCKS = {
  compact: 'variant === "compact"',
  full: 'variant !== "compact"',
  sub: 'variant === "full-sub"',
};

/** The classes that paint the paths. */
const PAINTS = ["n", "c", "r", "k"];

/**
 * Returns the opening tags of the `<path>` elements in the block that starts at `marker`, up to
 * the next `</>`.
 */
function paths(marker: string): string[] {
  const from = SOURCE.indexOf(marker);
  if (from === -1) {
    throw new Error(`NameLogo.astro has no block that starts at ${marker}`);
  }
  const block = SOURCE.slice(from).split("</>")[0];
  return [...block.matchAll(/<path\b[^>]*>/g)].map((match) => match[0]);
}

describe("NameLogo", () => {
  it("パスは fill 属性を持たず、クラス n・c・r・k のどれかで塗る", () => {
    const blocks = Object.values(BLOCKS).map(paths);
    for (const block of blocks) expect(block.length).toBeGreaterThan(0);
    for (const tag of blocks.flat()) {
      expect(tag).not.toMatch(/\sfill=/);
      expect(tag).toMatch(/\sclass="(?:n|c|r|k)(?: cur)?"/);
    }
  });

  it("n・c・r・k のクラスはトークンで塗る", () => {
    const rules = parseCss(cssOfAstro(SOURCE));
    for (const name of PAINTS) {
      expect(
        rulesFor(rules, `.${name}`).map((rule) => valueIn(rule, "fill")),
        name,
      ).toEqual([expect.stringMatching(/^var\(--[\w-]+\)$/)]);
    }
  });

  it("カーソルのパスは compact と full に 1 つずつあり、クラス cur を持つ", () => {
    const cursors = (marker: string) =>
      paths(marker).filter((tag) => /\bcur\b/.test(tag));
    expect(cursors(BLOCKS.compact)).toHaveLength(1);
    expect(cursors(BLOCKS.full)).toHaveLength(1);
  });
});
