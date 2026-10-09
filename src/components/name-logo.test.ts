import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
  it("パスの数は compact が 7、full が 9、full-sub が full に足す分の 4 になる", () => {
    expect(paths(BLOCKS.compact)).toHaveLength(7);
    expect(paths(BLOCKS.full)).toHaveLength(9);
    expect(paths(BLOCKS.sub)).toHaveLength(4);
  });

  it("パスは fill 属性を持たず、クラス n・c・r・k のどれかで塗る", () => {
    const all = Object.values(BLOCKS).flatMap(paths);
    for (const tag of all) {
      expect(tag).not.toMatch(/\sfill=/);
      expect(tag).toMatch(/\sclass="(?:n|c|r|k)(?: cur)?"/);
    }
  });

  it("カーソルのパスは compact と full に 1 つずつあり、クラス cur を持つ", () => {
    const cursors = (marker: string) =>
      paths(marker).filter((tag) => tag.includes("cur"));
    expect(cursors(BLOCKS.compact)).toHaveLength(1);
    expect(cursors(BLOCKS.full)).toHaveLength(1);
    expect(cursors(BLOCKS.compact)[0]).toMatch(/class="k cur"/);
    expect(cursors(BLOCKS.full)[0]).toMatch(/class="k cur"/);
  });
});
