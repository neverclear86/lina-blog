import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The components and pages that write an `<a>` to another site themselves, and how many such
 * links each has: every one takes `target` and `rel` from `externalLinkAttrs` and ends with an
 * `ExternalNote`. `SiteFooter.astro` and `HeroAccount.astro` take them from `footerProfileLinks`
 * and `accountLinks` instead.
 */
const WIRED = [
  ["components/LatestVideoFeature.astro", 2],
  ["components/LatestVideoList.astro", 2],
  ["components/ArticleEnd.astro", 2],
  ["components/SponsorNotice.astro", 1],
  ["components/ContactBand.astro", 1],
  ["pages/[lang]/contact/index.astro", 1],
] as const;

const source = (file: string) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("外部リンクの配線", () => {
  it.each(WIRED)(
    "%s は外部の <a> の target と rel を externalLinkAttrs から取る（%i 件）",
    (file, count) => {
      const text = source(file);
      expect(text.match(/\{\.\.\.externalLinkAttrs\(/g)).toHaveLength(count);
      expect(text).not.toMatch(/target="_blank"/);
    },
  );

  it.each(WIRED)(
    "%s は外部の <a> ごとに ExternalNote を置く（%i 件）",
    (file, count) => {
      expect(source(file).match(/<ExternalNote\b/g)).toHaveLength(count);
    },
  );

  it("SiteFooter は links の列の <a> に target と rel を渡し、external のときだけ ExternalNote を置く", () => {
    const text = source("components/SiteFooter.astro");
    expect(text).toMatch(/<a href=\{href\} target=\{target\} rel=\{rel\}>/);
    expect(text).toMatch(/\{external && <ExternalNote lang=\{lang\} \/>\}/);
  });
});
