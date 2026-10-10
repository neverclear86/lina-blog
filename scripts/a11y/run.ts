/**
 * Accessibility audit of the built site: `bun run a11y [--port N] [--widths 1440,390]
 * [--themes light,dark] [path...]`. Run `bun run build` first (`LINA_DEV_PAGES=1` also builds the
 * posts and the dev pages).
 *
 * It serves `dist/client/` with `astro preview` and opens every page of the build, or the given
 * paths, at each width and in each theme, with reduced motion. For each case it prints one JSON
 * line: `{path, width, theme, status, violations, undecided, checked, low}`.
 * - `violations` are the axe results that fail the audit (`isFailing`), with up to 5 targets each.
 * - `undecided` is how many nodes axe's `color-contrast` rule could not decide, for example
 *   because a gradient, an image, a pseudo-element or another element is behind the text.
 * - `checked` is how many of those texts were measured on a screenshot with the glyphs hidden
 *   (`worstRatio`), and `low` lists the ones under the ratio WCAG AA needs (`requiredRatio`).
 *
 * The last line is `a11y: ok` (exit code 0) or `a11y: FAILED` (exit code 1: a case has a
 * violation or a low text, or answered a status other than `expectedStatus`). Exit code 2:
 * `dist/client/` is missing or the server did not start. The server is stopped at the end.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { THEME_STORAGE_KEY } from "../../src/theme.ts";
import {
  expectedStatus,
  isFailing,
  type Pixels,
  type Rect,
  type Rgb,
  requiredRatio,
  routesOf,
  worstRatio,
} from "./audit.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DIST = `${ROOT}dist/client`;
const VIEWPORT_HEIGHT = 900;

/** One text of an element: its color, font and the boxes of its lines in page pixels. */
type TextBox = {
  selector: string;
  text: string;
  color: Rgb;
  alpha: number;
  fontSize: number;
  fontWeight: number;
  rects: Rect[];
};

/** One failing axe result, as printed. */
type Violation = { id: string; impact?: string | null; targets: string[] };

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: "string" },
    widths: { type: "string", default: "1440,390" },
    themes: { type: "string", default: "light,dark" },
  },
});
const widths = values.widths.split(",").map(Number);
const themes = values.themes.split(",");

/** Returns a port nothing listens on. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/** Runs `astro preview <args>` in the repository and returns the result. */
function astroPreview(args: string[]) {
  return spawnSync("bunx", ["astro", "preview", ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

/** Waits until the preview server answers, for up to 30 seconds. */
async function waitForServer(base: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${base}/`);
      return;
    } catch {
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  throw new Error(`preview did not start on ${base}`);
}

/**
 * Returns the text of the elements that axe's `color-contrast` rule left undecided
 * (`incomplete`), for example because a gradient, an image, a pseudo-element or another
 * element is behind the text. Text in an `aria-hidden` subtree is decoration and is left out.
 * Each text node gives its color, the
 * opacity it is drawn with, its font, and the boxes of its lines clipped to every ancestor that
 * clips its content (`overflow` other than `visible`, padding box).
 */
function textBoxes(page: Page, selectors: string[]): Promise<TextBox[]> {
  return page.evaluate((list) => {
    const boxes: TextBox[] = [];
    const channels = (css: string): { rgb: Rgb; alpha: number } => {
      const numbers = (css.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      if (css.startsWith("color(")) {
        const [r, g, b, a] =
          numbers.slice(-4).length === 4
            ? numbers.slice(-4)
            : [...numbers.slice(-3), 1];
        return { rgb: [r * 255, g * 255, b * 255], alpha: a };
      }
      return {
        rgb: [numbers[0], numbers[1], numbers[2]],
        alpha: numbers[3] ?? 1,
      };
    };
    for (const selector of list) {
      let element: Element | null = null;
      try {
        element = document.querySelector(selector);
      } catch {
        continue;
      }
      if (!element || element.closest("[aria-hidden=true]")) continue;
      if (
        !element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        })
      )
        continue;
      let opacity = 1;
      const clips: number[][] = [];
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node);
        opacity *= Number(style.opacity);
        if (
          node !== document.documentElement &&
          (style.overflowX !== "visible" || style.overflowY !== "visible")
        ) {
          const rect = node.getBoundingClientRect();
          clips.push([
            rect.left + node.clientLeft,
            rect.top + node.clientTop,
            node.clientWidth,
            node.clientHeight,
          ]);
        }
      }
      const style = getComputedStyle(element);
      const { rgb, alpha } = channels(style.color);
      for (const child of element.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE) continue;
        const text = (child.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        const rects: Rect[] = [];
        for (const line of range.getClientRects()) {
          let left = line.left;
          let top = line.top;
          let right = line.right;
          let bottom = line.bottom;
          for (const [cx, cy, cw, ch] of clips) {
            left = Math.max(left, cx);
            top = Math.max(top, cy);
            right = Math.min(right, cx + cw);
            bottom = Math.min(bottom, cy + ch);
          }
          if (right - left <= 0.5 || bottom - top <= 0.5) continue;
          rects.push([
            left + window.scrollX,
            top + window.scrollY,
            right - left,
            bottom - top,
          ]);
        }
        boxes.push({
          selector,
          text: text.slice(0, 24),
          color: rgb,
          alpha: alpha * opacity,
          fontSize: Number.parseFloat(style.fontSize),
          fontWeight: Number.parseInt(style.fontWeight, 10),
          rects,
        });
      }
    }
    return boxes;
  }, selectors);
}

/** Audits one page at one width in one theme and returns the result line. */
async function auditCase(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  base: string,
  path: string,
  width: number,
  theme: string,
) {
  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
    colorScheme: theme === "light" ? "light" : "dark",
    reducedMotion: "reduce",
  });
  try {
    // The pages take the theme from localStorage and ignore prefers-color-scheme.
    await context.addInitScript(
      ([key, saved]) => {
        try {
          localStorage.setItem(key, saved);
        } catch {}
      },
      [THEME_STORAGE_KEY, theme],
    );
    const page = await context.newPage();
    const response = await page.goto(`${base}${path}`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    const status = response?.status() ?? null;

    const results = await new AxeBuilder({ page }).analyze();
    const violations: Violation[] = results.violations
      .filter(isFailing)
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes
          .slice(0, 5)
          .map((node) => node.target.join(" ")),
      }));

    const undecidedNodes = results.incomplete
      .filter((item) => item.id === "color-contrast")
      .flatMap((item) => item.nodes);
    const selectors = undecidedNodes
      .map((node) => node.target)
      .filter(
        (target): target is string[] =>
          target.length === 1 && typeof target[0] === "string",
      )
      .map((target) => target[0]);

    await page.evaluate(() => window.scrollTo(0, 0));
    const boxes = await textBoxes(page, selectors);
    await page.addStyleTag({
      content:
        "*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; transition: none !important; animation: none !important; }",
    });
    const shot = await page.screenshot({ fullPage: true });
    const { data, info } = await sharp(shot)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels: Pixels = { data, width: info.width, height: info.height };

    let checked = 0;
    const low: string[] = [];
    for (const box of boxes) {
      const ratio = worstRatio(pixels, box.rects, box.color, box.alpha);
      if (ratio === undefined) continue;
      checked++;
      const needed = requiredRatio(box.fontSize, box.fontWeight);
      if (ratio < needed)
        low.push(
          `${ratio.toFixed(2)} < ${needed} ${box.selector} "${box.text}"`,
        );
    }
    return {
      path,
      width,
      theme,
      status,
      violations,
      undecided: undecidedNodes.length,
      checked,
      low,
    };
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) {
  console.error("dist/client/ not found. Run `bun run build` first.");
  process.exit(2);
}
const paths =
  positionals.length > 0
    ? positionals
    : routesOf(readdirSync(DIST, { recursive: true, encoding: "utf8" }));
const port = values.port ? Number(values.port) : await freePort();
const base = `http://127.0.0.1:${port}`;

const started = astroPreview([
  "--background",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
]);
if (started.status !== 0) {
  console.error(started.stdout, started.stderr);
  process.exit(2);
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let exitCode = 0;
try {
  await waitForServer(base);
  browser = await chromium.launch({ headless: true });
  for (const path of paths) {
    for (const width of widths) {
      for (const theme of themes) {
        const result = await auditCase(browser, base, path, width, theme);
        console.log(JSON.stringify(result));
        if (
          result.status !== expectedStatus(path) ||
          result.violations.length > 0 ||
          result.low.length > 0
        )
          exitCode = 1;
      }
    }
  }
  console.log(exitCode === 0 ? "a11y: ok" : "a11y: FAILED");
} catch (error) {
  console.error(error);
  exitCode = 2;
} finally {
  await browser?.close();
  astroPreview(["stop"]);
}
process.exit(exitCode);
