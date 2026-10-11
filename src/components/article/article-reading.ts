/**
 * Script of the page of a post that follows the reader: it sets `--reading-progress` on `<html>`,
 * moves `aria-current="location"` to the link of the `h2` that the reader is in in the table of
 * contents, and reveals the line and the bar (`ReadingProgress`), which are hidden until this
 * runs. It does its work once when the module runs and again in the next frame after a `scroll`,
 * a `resize` or the `load` of the page. A post whose `.article-body` is missing is left alone.
 */
import { oncePerFrame } from "../site/once-per-frame";
import { currentHeadingIndex, readingProgress } from "./reading-progress";

const body = document.querySelector<HTMLElement>(".article-body");
if (body) {
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>(".toc-side .toc a"),
  ];
  // `a.hash` percent-encodes a Japanese id, which `getElementById` does not find.
  const ids = links.map((link) => link.getAttribute("href")?.slice(1) ?? "");
  const header = document.querySelector<HTMLElement>(".site-header");
  const update = () => {
    const scrollY = window.scrollY;
    const rect = body.getBoundingClientRect();
    const progress = readingProgress(scrollY, {
      bodyTop: rect.top + scrollY,
      bodyBottom: rect.bottom + scrollY,
      headerBottom: header?.getBoundingClientRect().bottom ?? 0,
      viewportHeight: window.innerHeight,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    });
    document.documentElement.style.setProperty(
      "--reading-progress",
      progress.toFixed(3),
    );
    const tops = ids.map(
      (id) => document.getElementById(id)?.getBoundingClientRect().top ?? null,
    );
    const index = currentHeadingIndex(tops, scrollY, progress);
    links.forEach((link, i) => {
      if (i === index) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  const schedule = oncePerFrame(update);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  addEventListener("load", schedule);
  update();
  for (const meter of document.querySelectorAll("[data-reading-progress]")) {
    meter.removeAttribute("hidden");
  }
}
