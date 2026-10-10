// Lighthouse CI configuration (`bun run lighthouse`). It measures the pages of `dist/` built with
// LINA_DEV_PAGES=1 (the blog post exists only in that build) on the Lighthouse default form factor,
// which is mobile, and keeps the reports in `.lighthouseci/` for scripts/lighthouse/report.ts.
const port = process.env.LHCI_PORT ?? "4321";
const origin = `http://127.0.0.1:${port}`;
const categories = ["performance", "accessibility", "best-practices", "seo"];

module.exports = {
  ci: {
    collect: {
      startServerCommand: `bunx astro preview --ignore-lock --host 127.0.0.1 --port ${port}`,
      startServerReadyPattern: "127.0.0.1",
      url: ["/ja/", "/en/", "/blog/", "/blog/dev-preview-sample/"].map(
        (path) => origin + path,
      ),
      numberOfRuns: 3,
      settings: { chromeFlags: "--no-sandbox" },
    },
    assert: {
      assertions: Object.fromEntries(
        categories.map((name) => [
          `categories:${name}`,
          ["warn", { minScore: 0.95 }],
        ]),
      ),
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
