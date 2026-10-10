/** The categories of a Lighthouse report that the summary shows, in the order of its columns. */
const CATEGORIES = [
  { id: "performance", label: "Performance" },
  { id: "accessibility", label: "Accessibility" },
  { id: "best-practices", label: "Best Practices" },
  { id: "seo", label: "SEO" },
] as const;

/**
 * One run in `.lighthouseci/manifest.json`, which Lighthouse CI writes with the `filesystem`
 * upload target. `isRepresentativeRun` marks the run of a URL whose first contentful paint and
 * time to interactive are closest to the medians of its runs. `summary` holds the category
 * scores from 0 to 1, or null when Lighthouse could not score the category.
 */
export type ManifestEntry = {
  url: string;
  isRepresentativeRun: boolean;
  summary: Partial<Record<(typeof CATEGORIES)[number]["id"], number | null>>;
};

/**
 * Makes the Markdown of the job summary from the manifest: a table with a row for each URL
 * (in the order of its first run in the manifest, shown as its path) and a column for each
 * category, holding the score of the representative run as an integer from 0 to 100. A
 * category that the run has no score for (missing, or null as when an audit fails) shows `-`.
 * A URL without a representative run has no row. Throws when the manifest has no
 * representative run.
 */
export function summaryMarkdown(manifest: ManifestEntry[]): string {
  const representative = new Map(
    manifest
      .filter((entry) => entry.isRepresentativeRun)
      .map((entry) => [entry.url, entry]),
  );
  if (representative.size === 0) {
    throw new Error("the manifest has no representative run");
  }
  const urls = [...new Set(manifest.map((entry) => entry.url))].filter((url) =>
    representative.has(url),
  );
  const header = ["Page", ...CATEGORIES.map((category) => category.label)];
  const rows = urls.map((url) => {
    const scores = CATEGORIES.map((category) => {
      const score = representative.get(url)?.summary[category.id];
      return score === undefined || score === null
        ? "-"
        : String(Math.round(score * 100));
    });
    return [`\`${new URL(url).pathname}\``, ...scores];
  });
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [
    "## Lighthouse (mobile)",
    "",
    line(header),
    line(header.map((_, index) => (index === 0 ? ":--" : "--:"))),
    ...rows.map(line),
    "",
    "Scores of the representative run of each page (the run closest to the median FCP and TTI).",
    "",
  ].join("\n");
}
