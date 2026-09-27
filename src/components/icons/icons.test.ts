import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = new URL("./", import.meta.url);

/** The icon components in this directory, read from the directory rather than listed by hand. */
const ICONS = readdirSync(DIR)
  .filter((name) => name.endsWith(".astro"))
  .sort()
  .map((name) => [name, readFileSync(new URL(name, DIR), "utf8")] as const);

const README = readFileSync(new URL("README.md", DIR), "utf8");

/** Returns the contents of the `<style>` elements of a component, joined. */
function styles(text: string): string {
  return [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join("\n");
}

describe("サービスのアイコン", () => {
  it("6 つのサービスの部品がある", () => {
    expect(ICONS.map(([name]) => name)).toEqual([
      "GitHubIcon.astro",
      "NostrIcon.astro",
      "RssIcon.astro",
      "XIcon.astro",
      "YouTubeIcon.astro",
      "ZennIcon.astro",
    ]);
  });

  it.each(ICONS)(
    "%s の fill と stroke は currentColor か none だけ",
    (_name, text) => {
      const values = [...text.matchAll(/\s(?:fill|stroke)="([^"]*)"/g)].map(
        (match) => match[1],
      );
      expect(values.length).toBeGreaterThan(0);
      expect(
        values.filter((value) => value !== "currentColor" && value !== "none"),
      ).toEqual([]);
    },
  );

  it.each(ICONS)(
    "%s の svg は支援技術から隠れ、大きさと class を持たない",
    (_name, text) => {
      const tag = /<svg\b[^>]*>/.exec(text)?.[0] ?? "";
      expect(tag).toContain('aria-hidden="true"');
      expect(tag).toContain('focusable="false"');
      expect(tag).toMatch(/\sviewBox="[^"]+"/);
      expect(tag).not.toMatch(/\s(?:width|height)=/);
      expect(text).not.toMatch(/\s(?:class|clip-path|mask)=/);
    },
  );

  it("README の表に部品ごとの出典の行がある", () => {
    const lines = README.split("\n");
    const missing = ICONS.filter(
      ([name]) =>
        !lines.some(
          (line) =>
            line.startsWith(`| \`${name}\` |`) && line.includes("https://"),
        ),
    ).map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it("YouTube と Twitter(自称X) はガイドラインの色のトークンで塗り、ほかは周りの文字色を使う", () => {
    const byName = Object.fromEntries(ICONS);
    expect(styles(byName["YouTubeIcon.astro"])).toContain(
      "color: var(--icon-yt)",
    );
    expect(styles(byName["XIcon.astro"])).toContain("color: var(--icon-x)");
    const others = ICONS.filter(
      ([name]) => name !== "YouTubeIcon.astro" && name !== "XIcon.astro",
    );
    expect(
      others.filter(([, text]) => styles(text) !== "").map(([name]) => name),
    ).toEqual([]);
    expect(
      ICONS.filter(([, text]) => / style=/.test(text)).map(([name]) => name),
    ).toEqual([]);
  });
});
