import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssOfAstro, parseCss } from "../test/css-source";

const SRC = new URL("../", import.meta.url);

/**
 * The widths at which the layout changes (the table in the "CSS" section of `README.md`). The
 * wide side of a width N is `min-width: N` and the narrow side is `max-width: N-1`, so the
 * viewport of exactly N px is on the wide side.
 */
const BREAKPOINTS = [360, 600, 768, 900, 1024, 1200, 1280];

/** Returns the `(min-width: …)` and `(max-width: …)` features in `text`, in source order. */
function widthFeatures(text: string): RegExpExecArray[] {
  return [...text.matchAll(/\(\s*(min|max)-width\s*:\s*([^)]*?)\s*\)/g)];
}

/**
 * Returns the width features in `text` that are not written as `min-width: N` or `max-width: N-1`
 * for a width N of `BREAKPOINTS`; a value that is not whole pixels, such as `767.98px`, is one.
 */
function offBreakpoints(text: string): string[] {
  return widthFeatures(text).flatMap(([feature, side, value]) => {
    const pixels = /^(\d+)px$/.exec(value);
    const width = pixels && Number(pixels[1]) + (side === "max" ? 1 : 0);
    return width && BREAKPOINTS.includes(width) ? [] : [feature];
  });
}

/** Returns the paths under `src/` of the files whose name ends with one of `suffixes`. */
function sourcesEndingWith(...suffixes: string[]): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (path) =>
      !path.endsWith(".test.ts") &&
      suffixes.some((suffix) => path.endsWith(suffix)),
  );
}

describe("ブレークポイントの境界", () => {
  it("src の @media の幅は min-width: N か max-width: N-1 で、N は一覧の幅", () => {
    const paths = sourcesEndingWith(".astro", ".css");
    expect(paths).toContain("components/home/Hero.astro");
    expect(paths).toContain("styles/global.css");
    const media = paths.flatMap((path) => {
      const text = readFileSync(new URL(path, SRC), "utf8");
      const rules = parseCss(path.endsWith(".css") ? text : cssOfAstro(text));
      return rules.flatMap((rule) =>
        rule.conditions
          .filter((condition) => condition.startsWith("@media"))
          .map((condition) => ({ path, condition })),
      );
    });
    expect(
      media.flatMap(({ condition }) => widthFeatures(condition)),
    ).not.toEqual([]);
    expect(
      media.flatMap(({ path, condition }) =>
        offBreakpoints(condition).map((feature) => `src/${path}: ${feature}`),
      ),
    ).toEqual([]);
  });

  it("src の sizes と matchMedia の幅も同じ書き方で、<style> の外にある", () => {
    const paths = sourcesEndingWith(".astro", ".ts");
    expect(paths).toContain("lib/avatar-images.ts");
    expect(paths).toContain("components/home/AvatarThreeView.astro");
    const outside = paths.map((path) => ({
      path,
      text: readFileSync(new URL(path, SRC), "utf8").replace(
        /<style(?:\s[^>]*)?>[\s\S]*?<\/style>/g,
        "",
      ),
    }));
    expect(outside.flatMap(({ text }) => widthFeatures(text))).not.toEqual([]);
    expect(
      outside.flatMap(({ path, text }) =>
        offBreakpoints(text).map((feature) => `src/${path}: ${feature}`),
      ),
    ).toEqual([]);
  });

  it("README の表の幅は BREAKPOINTS と同じ並びである", () => {
    const readme = readFileSync(
      new URL("../../README.md", import.meta.url),
      "utf8",
    );
    const widths = [...readme.matchAll(/^\| `(\d+)px`\s*\|/gm)].map((row) =>
      Number(row[1]),
    );
    expect(widths).toEqual(BREAKPOINTS);
  });

  it("900px ちょうどは広い側で、901px や 767.98px や em は一覧の外になる", () => {
    expect(
      offBreakpoints("(min-width: 900px) and (max-width: 1279px)"),
    ).toEqual([]);
    expect(offBreakpoints("( max-width:899px )")).toEqual([]);
    expect(offBreakpoints("(min-width: 901px)")).toEqual([
      "(min-width: 901px)",
    ]);
    expect(offBreakpoints("(max-width: 900px)")).toEqual([
      "(max-width: 900px)",
    ]);
    expect(offBreakpoints("(max-width: 767.98px)")).toEqual([
      "(max-width: 767.98px)",
    ]);
    expect(offBreakpoints("(min-width: 48em)")).toEqual(["(min-width: 48em)"]);
    expect(offBreakpoints("(min-width: 899px)")).toEqual([
      "(min-width: 899px)",
    ]);
    expect(offBreakpoints("(max-width: 899px) 128px, 374px")).toEqual([]);
  });
});
