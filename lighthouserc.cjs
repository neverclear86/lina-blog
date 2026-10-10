// Lighthouse CI configuration (`bun run lighthouse`). It measures the pages of `dist/` built with
// LINA_DEV_PAGES=1 (the blog post exists only in that build) on the Lighthouse default form factor,
// which is mobile, and keeps the reports in `.lighthouseci/` for scripts/lighthouse/report.ts.
// The pages are served by `wrangler dev`, as the Worker serves them in production, so the HTML is
// compressed as it is on Cloudflare (`astro preview` sends it uncompressed).
// Performance is asserted per page at the `error` level, so a pull request that scores under a
// page's target fails the job. The other categories only warn under 95.
const port = process.env.LHCI_PORT ?? "4321";
const origin = `http://127.0.0.1:${port}`;
const otherCategories = ["accessibility", "best-practices", "seo"];

// The lowest Performance score a page may get, taken as the best of its three runs. A page that
// reaches 95 on CI keeps 0.95. The targets of /ja/, /en/ and /blog/dev-preview-sample/ are lower:
// each is the lowest score seen in at least five CI runs of one commit minus the larger of 0.05
// and the spread of those runs, rounded down to a multiple of 0.05.
const performanceTargets = {
  "/ja/": 0.75,
  "/en/": 0.6,
  "/blog/": 0.95,
  "/blog/dev-preview-sample/": 0.75,
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: `bunx wrangler dev --ip 127.0.0.1 --port ${port} --inspector-port ${Number(port) + 1}`,
      startServerReadyPattern: "Ready on",
      url: Object.keys(performanceTargets).map((path) => origin + path),
      numberOfRuns: 3,
      settings: { chromeFlags: "--no-sandbox" },
    },
    assert: {
      assertMatrix: [
        ...Object.entries(performanceTargets).map(([path, minScore]) => ({
          matchingUrlPattern: `^http://[^/]+${path}$`,
          assertions: { "categories:performance": ["error", { minScore }] },
        })),
        {
          matchingUrlPattern: ".*",
          assertions: Object.fromEntries(
            otherCategories.map((name) => [
              `categories:${name}`,
              ["warn", { minScore: 0.95 }],
            ]),
          ),
        },
      ],
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
