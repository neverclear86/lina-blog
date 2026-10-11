import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = new URL("./", import.meta.url);

/** The directories of the components by section. `icons/` holds the icons and is not one. */
const SECTIONS = ["article", "blog", "contact", "home", "site"];

/**
 * Returns a file name without the extension (`.astro`, `.ts`, `.test.ts`) and the hyphens, in
 * lower case: `SiteHeader.astro` and `site-header.test.ts` both give `siteheader`.
 */
function stem(name: string): string {
  return name
    .replace(/(\.test)?\.(astro|ts)$/, "")
    .replaceAll("-", "")
    .toLowerCase();
}

describe("src/components/ の置き場所", () => {
  it("直下には区画と icons のディレクトリと、複数の区画を読む試験だけを置く", () => {
    const entries = readdirSync(DIR, { withFileTypes: true });
    expect(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(),
    ).toEqual([...SECTIONS, "icons"].sort());
    expect(
      entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(["directories.test.ts", "external-wiring.test.ts"]);
  });

  it.each(SECTIONS)(
    "%s/ の試験は、同じディレクトリの部品か補助の名前で始まる",
    (section) => {
      const names = readdirSync(new URL(`${section}/`, DIR));
      const sources = names
        .filter((name) => !name.endsWith(".test.ts"))
        .map(stem);
      const orphans = names
        .filter((name) => name.endsWith(".test.ts"))
        .filter(
          (name) => !sources.some((source) => stem(name).startsWith(source)),
        );
      expect(orphans).toEqual([]);
    },
  );
});
