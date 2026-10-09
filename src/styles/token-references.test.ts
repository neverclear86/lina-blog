import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url);

/** The custom properties that the Fonts API defines (`cssVariable` in `astro.config.mjs`). */
const FONT_VARIABLES = ["--font-body", "--font-mono-latin"];

/**
 * Reads the `.astro`, `.css` and `.ts` files under `src/` except the tests, without CSS comments.
 */
function sources(): { path: string; text: string }[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(astro|css|ts)$/.test(path))
    .filter((path) => !path.endsWith(".test.ts"))
    .sort()
    .map((path) => ({
      path,
      text: readFileSync(new URL(path, SRC), "utf8").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      ),
    }));
}

describe("var() で読むカスタムプロパティ", () => {
  it("フォールバックの無い var(--名前) は、src のどこかで定義されている", () => {
    const files = sources();
    expect(files.map((file) => file.path)).toContain("styles/tokens.css");
    const defined = new Set([
      ...FONT_VARIABLES,
      ...files.flatMap((file) =>
        [...file.text.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
      ),
    ]);
    const undefinedReads = files.flatMap((file) =>
      [...file.text.matchAll(/var\((--[\w-]+)\)/g)]
        .filter((match) => !defined.has(match[1]))
        .map((match) => `src/${file.path}: ${match[1]}`),
    );
    expect(undefinedReads).toEqual([]);
  });
});
