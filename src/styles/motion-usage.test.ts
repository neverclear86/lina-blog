import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Returns the `.astro` files under `dir`, as absolute paths. */
const astroFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(path);
    return entry.name.endsWith(".astro") ? [path] : [];
  });

/** Returns the source of every component the `roots` import, directly or not, and of the roots. */
const reachable = (roots: string[]) => {
  const found = new Map<string, string>();
  const queue = [...roots];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (found.has(path)) continue;
    const text = readFileSync(path, "utf8");
    found.set(path, text);
    for (const match of text.matchAll(/from\s+"(\.[^"]*\.astro)"/g)) {
      queue.push(resolve(dirname(path), match[1] ?? ""));
    }
  }
  return found;
};

const COMPONENTS = reachable(astroFiles(resolve(SRC, "pages")));

describe("ページから届く部品が使う動き", () => {
  it("旧デザインの動きのクラスを使わない", () => {
    const classes = /(["\s])(caret|a-typeLoop|reveal)(["\s])/;
    const violations = [...COMPONENTS]
      .filter(([, text]) => classes.test(text))
      .map(([path]) => relative(SRC, path));
    expect(violations).toEqual([]);
  });

  it("ページから届く部品を読めている", () => {
    expect(COMPONENTS.size).toBeGreaterThan(10);
  });
});
