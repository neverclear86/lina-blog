#!/usr/bin/env node
// Serves a built worktree (dist/ must exist) with `astro preview` and captures pages with
// headless Chromium through Playwright.
//
// Each path is captured at every width and theme as a full-page PNG,
// <out>/<name>-<width>-<theme>.png, with animations disabled (reduced motion) so shots are
// stable. With --selector, only the first matching element is captured, scrolled into view,
// as <out>/<name>-<selector slug>-<width>-<theme>.png. One JSON line per shot is printed to stdout:
//   {"file", "path", "width", "theme", "status", "overflowX", "overflowing"[, "selector", "box"]}
// overflowX is how far the page scrolls horizontally (0 means no horizontal overflow);
// overflowing lists up to 10 elements that stick out of the viewport horizontally;
// box is the bounding box of the captured element ({x, y, width, height}).
//
// Only the preview server of this worktree is stopped afterwards (`astro preview stop`).
//
// Usage:
//   node .claude/scripts/screenshot.mjs --root <worktree> --port <port> --out <dir> [options] <path>...
// Options:
//   --widths 1440,390          viewport widths (default 1440,390)
//   --themes light,dark        themes to capture (default light,dark): each is the
//                              prefers-color-scheme value and the theme saved in localStorage
//                              under "theme" (the pages follow the saved theme, not the OS)
//   --motion reduce            prefers-reduced-motion: reduce (default) or no-preference
//   --height 900               viewport height before the full-page capture (default 900)
//   --selector <css>           capture only the first element matching this CSS selector

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },
    port: { type: "string" },
    out: { type: "string" },
    widths: { type: "string", default: "1440,390" },
    themes: { type: "string", default: "light,dark" },
    motion: { type: "string", default: "reduce" },
    height: { type: "string", default: "900" },
    selector: { type: "string" },
  },
});

if (!values.root || !values.port || !values.out || positionals.length === 0) {
  console.error(
    "usage: node screenshot.mjs --root <worktree> --port <port> --out <dir> [--widths 1440,390] [--themes light,dark] [--motion reduce] [--selector <css>] <path>...",
  );
  process.exit(1);
}

const root = resolve(values.root);
const port = Number(values.port);
const out = resolve(values.out);
const widths = values.widths.split(",").map(Number);
const themes = values.themes.split(",");
const height = Number(values.height);
const selector = values.selector;
const base = `http://127.0.0.1:${port}`;

if (!existsSync(join(root, "dist"))) {
  console.error(`dist/ not found. run bun run build in ${root} first`);
  process.exit(1);
}

/** Resolves true when nothing listens on the port. */
function portIsFree(p) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done(false));
    server.listen(p, "127.0.0.1", () => server.close(() => done(true)));
  });
}

/** Runs `astro preview <args>` in the worktree and returns the result. */
function astroPreview(args) {
  return spawnSync("bunx", ["astro", "preview", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

/** Waits until the preview server answers, for up to 30 seconds. */
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${base}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`preview did not start on ${base}`);
}

/** Turns a URL path into a file name: / → index, /en/blog/ → en_blog. */
function nameOf(path) {
  return path.replace(/^\/+|\/+$/g, "").replaceAll("/", "_") || "index";
}

/** Turns a CSS selector into a file name part: .site-header a → site-header-a. */
function slugOf(css) {
  return css.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

if (!(await portIsFree(port))) {
  console.error(`port ${port} is in use`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const started = astroPreview([
  "--background",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
]);
if (started.status !== 0) {
  console.error(started.stdout, started.stderr);
  process.exit(1);
}

let browser;
let failed = false;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  for (const path of positionals) {
    for (const width of widths) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme: theme,
          reducedMotion: values.motion,
        });
        // The pages take the theme from localStorage and ignore prefers-color-scheme.
        await context.addInitScript((saved) => {
          try {
            localStorage.setItem("theme", saved);
          } catch {}
        }, theme);
        const page = await context.newPage();
        const response = await page.goto(`${base}${path}`, {
          waitUntil: "networkidle",
        });
        await page.evaluate(() => document.fonts.ready);
        const suffix = selector ? `-${slugOf(selector)}` : "";
        const file = join(out, `${nameOf(path)}${suffix}-${width}-${theme}.png`);
        let target = {};
        if (selector) {
          const element = page.locator(selector).first();
          await element.scrollIntoViewIfNeeded();
          await element.screenshot({ path: file });
          target = { selector, box: await element.boundingBox() };
        } else {
          await page.screenshot({ path: file, fullPage: true });
        }
        const overflow = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          const overflowing = [];
          for (const el of document.body.querySelectorAll("*")) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.right > viewport + 0.5 || rect.left < -0.5) {
              const id = el.id ? `#${el.id}` : "";
              const cls = el.classList.length
                ? `.${[...el.classList].join(".")}`
                : "";
              overflowing.push(`${el.tagName.toLowerCase()}${id}${cls}`);
            }
          }
          return {
            overflowX: document.documentElement.scrollWidth - viewport,
            overflowing: overflowing.slice(0, 10),
          };
        });
        console.log(
          JSON.stringify({
            file,
            path,
            width,
            theme,
            status: response?.status() ?? null,
            ...overflow,
            ...target,
          }),
        );
        await context.close();
      }
    }
  }
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  await browser?.close();
  astroPreview(["stop"]);
}
process.exit(failed ? 1 : 0);
