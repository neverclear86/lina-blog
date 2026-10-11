#!/usr/bin/env node
// Checks the built site: an `<a href>` to another host than ikili.pro has `target="_blank"`, a
// `rel` with `noopener` and a note that it opens in a new tab (its `aria-label`, or a `.sr-only`
// element inside it); no other `<a>` has `target="_blank"` or the note. Every HTML file is read
// by headless Chromium. The rule for "another host" restates `isExternalLink` on purpose, so the
// check does not depend on the code it checks.
// Prints one JSON line per file, {file, links, external, problems}, where a problem is
// "<kind> <href> <name>" with the kind no-target, target-inside, no-noopener, no-note or
// note-inside, then `external-links: ok` (exit 0) or `external-links: FAILED <n> problems` (exit 1).
// Usage: node scripts/audit/external-links.mjs [--skip <css>] <dist/client>
//   --skip <css>  leaves out the links inside the elements this selector matches

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const SITE = new URL("https://ikili.pro/");
const NOTE = /新しいタブで開く|opens in a new tab/;
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { skip: { type: "string" } },
});
const root = resolve(positionals[0] ?? "dist/client");
const files = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".html"))
  .sort();

/** Returns whether `href` leaves the site. */
function leaves(href) {
  try {
    const url = new URL(href, SITE);
    return /^https?:$/.test(url.protocol) && url.hostname !== SITE.hostname;
  } catch {
    return false;
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let count = 0;
for (const file of files) {
  await page.setContent(readFileSync(join(root, file), "utf8"));
  const links = await page.evaluate(
    (skip) =>
      [...document.querySelectorAll("a[href]")]
        .filter((a) => !(skip && a.closest(skip)))
        .map((a) => ({
          href: a.getAttribute("href"),
          target: a.getAttribute("target"),
          rel: a.getAttribute("rel") ?? "",
          label: a.getAttribute("aria-label"),
          hidden: [...a.querySelectorAll(".sr-only")]
            .map((node) => node.textContent)
            .join(" "),
          text: (a.textContent ?? "").replace(/\s+/g, " ").trim(),
        })),
    values.skip ?? "",
  );
  const problems = [];
  for (const link of links) {
    const out = leaves(link.href);
    const noted = NOTE.test(link.label ?? link.hidden);
    const at = `${link.href} ${(link.label ?? link.text).slice(0, 60)}`;
    if (out && link.target !== "_blank") problems.push(`no-target ${at}`);
    if (!out && link.target === "_blank") problems.push(`target-inside ${at}`);
    if (link.target === "_blank" && !link.rel.split(/\s+/).includes("noopener"))
      problems.push(`no-noopener ${at}`);
    if (out && !noted) problems.push(`no-note ${at}`);
    if (!out && noted) problems.push(`note-inside ${at}`);
  }
  count += problems.length;
  const external = links.filter((link) => leaves(link.href)).length;
  console.log(
    JSON.stringify({ file, links: links.length, external, problems }),
  );
}
await browser.close();
console.log(
  count > 0 ? `external-links: FAILED ${count} problems` : "external-links: ok",
);
process.exit(count > 0 ? 1 : files.length === 0 ? 2 : 0);
