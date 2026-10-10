import { describe, expect, it } from "vitest";
import { type ManifestEntry, summaryMarkdown } from "./summary";

const scores = (performance: number) => ({
  performance,
  accessibility: 1,
  "best-practices": 1,
  seo: 0.92,
});

const run = (
  path: string,
  isRepresentativeRun: boolean,
  summary: ManifestEntry["summary"],
): ManifestEntry => ({
  url: `http://127.0.0.1:4321${path}`,
  isRepresentativeRun,
  summary,
});

describe("summaryMarkdown", () => {
  it("代表の run のスコアだけを 1 ページ 1 行に 0 から 100 の整数で表す", () => {
    const markdown = summaryMarkdown([
      run("/ja/", false, scores(0.5)),
      run("/ja/", true, scores(0.846)),
      run("/ja/", false, scores(0.9)),
    ]);
    expect(markdown).toContain("| `/ja/` | 85 | 100 | 100 | 92 |");
    expect(markdown.match(/`\/ja\/`/g)).toHaveLength(1);
  });

  it("列は Performance、Accessibility、Best Practices、SEO の順に並ぶ", () => {
    const markdown = summaryMarkdown([run("/ja/", true, scores(1))]);
    expect(markdown).toContain(
      "| Page | Performance | Accessibility | Best Practices | SEO |",
    );
  });

  it("行は manifest に最初に現れる URL の順に並ぶ", () => {
    const markdown = summaryMarkdown([
      run("/ja/", false, scores(0.5)),
      run("/en/", false, scores(0.5)),
      run("/en/", true, scores(0.9)),
      run("/ja/", true, scores(0.9)),
    ]);
    expect(markdown.indexOf("`/ja/`")).toBeLessThan(markdown.indexOf("`/en/`"));
  });

  it("スコアが無い分類は - にする", () => {
    const markdown = summaryMarkdown([run("/ja/", true, { seo: 1 })]);
    expect(markdown).toContain("| `/ja/` | - | - | - | 100 |");
  });

  it("スコアが null の分類は - にする", () => {
    const markdown = summaryMarkdown([
      run("/ja/", true, {
        performance: null,
        accessibility: 1,
        "best-practices": 1,
        seo: 1,
      }),
    ]);
    expect(markdown).toContain("| `/ja/` | - | 100 | 100 | 100 |");
  });

  it("代表の run が無い URL は行にしない", () => {
    const markdown = summaryMarkdown([
      run("/ja/", true, scores(0.9)),
      run("/en/", false, scores(0.9)),
    ]);
    expect(markdown).not.toContain("`/en/`");
  });

  it("代表の run が 1 件も無いときは例外を投げる", () => {
    expect(() => summaryMarkdown([run("/ja/", false, scores(0.9))])).toThrow(
      "no representative run",
    );
  });
});
