#!/usr/bin/env node
// Measures what still moves under `prefers-reduced-motion`. Serves a built worktree (dist/ must
// exist) with `astro preview` and opens every page in headless Chromium through Playwright.
// At each page, width and theme it lists the animations and transitions whose `playState` is
// `running` (`document.getAnimations()`), sampled 60ms after each of these steps: the page opens,
// the network is idle, one Tab, a hover on the first elements of each kind in HOVER_KINDS, a
// scroll down the page in steps and back to the top, and a click on the first elements of each
// kind in CLICK_KINDS. One JSON line per page, width and theme is printed to stdout:
//   {"path", "width", "theme", "motion", "status", "running"}
// `running` has one entry for each animation, "<first step it ran in>: <animation|transition>
// <name> <element>".
// With the default --motion reduce the script exits with 1 when any `running` is not empty.
// With --motion no-preference it only reports, and a list that is not empty shows that the
// measurement sees the motion of the pages.
//
// The pages are every index.html under dist/client and /404, unless paths are given. The sample
// posts of src/content/blog-dev/ and the /dev/* pages exist only in a build with
// `LINA_DEV_PAGES=1`.
//
// Only the preview server of this worktree is stopped afterwards (`astro preview stop`).
//
// Usage:
//   node scripts/audit/reduced-motion.mjs --root <worktree> --port <port> [options] [<path>...]
// Options:
//   --widths 1440,390          viewport widths (default 1440,390)
//   --themes light,dark        themes: the prefers-color-scheme value and the theme saved in
//                              localStorage under "theme" (default light,dark)
//   --motion reduce            prefers-reduced-motion: reduce (default) or no-preference

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

/** Selectors whose first three visible elements are hovered. */
const HOVER_KINDS = [
  ".ws",
  "a.win",
  ".win",
  ".btn",
  ".acct",
  "summary",
  ".pose-btn",
  ".theme-toggle",
  ".menu-toggle",
  ".copy",
  "[role=tab]",
];

/** Selectors whose first three visible elements are clicked. */
const CLICK_KINDS = [
  ".pose-btn",
  "[role=tab]",
  ".menu-toggle",
  ".copy",
  "summary",
  ".theme-toggle",
];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },
    port: { type: "string" },
    widths: { type: "string", default: "1440,390" },
    themes: { type: "string", default: "light,dark" },
    motion: { type: "string", default: "reduce" },
  },
});

if (!values.root || !values.port) {
  console.error(
    "usage: node reduced-motion.mjs --root <worktree> --port <port> [--widths 1440,390] [--themes light,dark] [--motion reduce] [<path>...]",
  );
  process.exit(1);
}

const root = resolve(values.root);
const port = Number(values.port);
const widths = values.widths.split(",").map(Number);
const themes = values.themes.split(",");
const base = `http://127.0.0.1:${port}`;
const client = join(root, "dist", "client");

if (!existsSync(client)) {
  console.error(`dist/client not found. run bun run build in ${root} first`);
  process.exit(1);
}

/** The URL paths of the built pages: every index.html, and /404. */
function builtPaths(dir = "") {
  const paths = [];
  for (const entry of readdirSync(join(client, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== "_astro")
        paths.push(...builtPaths(`${dir}/${entry.name}`));
    } else if (entry.name === "index.html") {
      paths.push(`${dir}/`);
    } else if (dir === "" && entry.name === "404.html") {
      paths.push("/404");
    }
  }
  return paths.sort();
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

/** Lists the running animations and transitions of the page as strings. */
function runningOf(page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => {
        const target = a.effect?.target;
        const element = target
          ? `${target.tagName.toLowerCase()}${[...target.classList].map((c) => `.${c}`).join("")}`
          : "?";
        return a instanceof CSSTransition
          ? `transition ${a.transitionProperty} ${element}`
          : `animation ${a.animationName ?? ""} ${element}`;
      }),
  );
}

if (!(await portIsFree(port))) {
  console.error(`port ${port} is in use`);
  process.exit(1);
}
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

const paths = positionals.length > 0 ? positionals : builtPaths();
let failed = false;
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${base}/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  browser = await chromium.launch({ headless: true });
  for (const path of paths) {
    for (const width of widths) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
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
        const found = new Map();
        /** Waits 60ms after a step and records what runs, once for each animation. */
        const sample = async (step) => {
          await page.waitForTimeout(60);
          for (const entry of await runningOf(page)) {
            if (!found.has(entry)) found.set(entry, step);
          }
        };
        const response = await page.goto(`${base}${path}`, {
          waitUntil: "domcontentloaded",
        });
        await sample("open");
        await page.waitForLoadState("networkidle");
        await sample("idle");
        await page.keyboard.press("Tab");
        await sample("tab");
        for (const kind of HOVER_KINDS) {
          const elements = page.locator(`${kind}:visible`);
          const count = Math.min(await elements.count(), 3);
          for (let i = 0; i < count; i++) {
            try {
              await elements.nth(i).hover({ timeout: 500 });
            } catch {
              continue;
            }
            await sample(`hover ${kind}`);
          }
        }
        await page.mouse.move(0, 0);
        const height = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        for (let y = 0; y <= height; y += 450) {
          await page.mouse.wheel(0, 450);
          await sample("scroll");
        }
        await page.evaluate(() => scrollTo(0, 0));
        await sample("scroll top");
        for (const kind of CLICK_KINDS) {
          const elements = page.locator(`${kind}:visible`);
          const count = Math.min(await elements.count(), 3);
          for (let i = 0; i < count; i++) {
            try {
              await elements.nth(i).click({ timeout: 500 });
            } catch {
              continue;
            }
            await sample(`click ${kind}`);
            await page.keyboard.press("Escape");
          }
        }
        const running = [...found].map(([entry, step]) => `${step}: ${entry}`);
        if (values.motion === "reduce" && running.length > 0) failed = true;
        console.log(
          JSON.stringify({
            path,
            width,
            theme,
            motion: values.motion,
            status: response?.status() ?? null,
            running,
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
