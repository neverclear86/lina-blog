import { defineHastPlugin, type HastNode } from "satteri";
import {
  externalLinkAttrs,
  externalNote,
  isExternalLink,
} from "../lib/external-link";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Returns whether a heading (`h1` to `h6`) holds `node`, at any depth. */
function inHeading(
  node: Readonly<HastNode>,
  parentOf: (node: Readonly<HastNode>) => Readonly<HastNode> | undefined,
): boolean {
  for (let p = parentOf(node); p; p = parentOf(p)) {
    if (p.type === "element" && HEADINGS.has(p.tagName)) return true;
  }
  return false;
}

/**
 * Returns whether `nodes` hold a text other than white space, at any depth. A link that holds
 * only images does not.
 */
function hasText(nodes: readonly HastNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === "text" && node.value.trim() !== "") ||
      (node.type === "element" && hasText(node.children)),
  );
}

/**
 * Hast plugin that opens the links of an article that leave the site in a new tab and says so.
 *
 * `site` is the site the article is on. A link whose `href` leaves it (`isExternalLink`) gets
 * the attributes of `externalLinkAttrs`: `target="_blank"` and a `rel` that is the `rel` it had
 * plus `noopener`. It also gets, at the end of its content, an arrow `↗` that assistive
 * technology skips (`aria-hidden`), after a no-break space that keeps the arrow with the last
 * word of the link, and a hidden text that says it is another site and opens in a new tab
 * (`externalNote` in Japanese, the language of the articles). A link that holds only images
 * gets the hidden text but no arrow. Every other link is left unchanged: a relative path, a `#`
 * anchor, a footnote reference and its back link, an absolute URL on `site`, and a URL that is
 * not `http:` or `https:` such as `mailto:`. A link written as raw HTML in an article is not a
 * hast element and is left unchanged too. So is a link in a heading (`h1` to `h6`): Astro makes
 * the id of a heading and its text in the table of contents from the text of the heading after
 * this plugin, and the arrow and the hidden text would end up in both.
 *
 * It must run after the plugins that read the text of a link (`taskItemLabel`, `youtubeEmbed`),
 * so that the hidden text is not part of what they read.
 */
export function externalLinks(site: URL) {
  return defineHastPlugin({
    name: "external-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const href = node.properties?.href;
        if (typeof href !== "string" || !isExternalLink(href, site)) return;
        if (inHeading(node, (n) => ctx.parent(n))) return;
        const rel = node.properties?.rel;
        const { target, rel: nextRel } = externalLinkAttrs(
          href,
          site,
          Array.isArray(rel) ? rel.join(" ") : (rel as string | undefined),
        );
        ctx.setProperty(node, "target", target);
        ctx.setProperty(node, "rel", nextRel);
        ctx.appendChild(node, [
          ...(hasText(node.children)
            ? [
                {
                  type: "element" as const,
                  tagName: "span",
                  properties: { ariaHidden: "true" },
                  children: [{ type: "text" as const, value: "\xa0↗" }],
                },
              ]
            : []),
          {
            type: "element" as const,
            tagName: "span",
            properties: { className: ["sr-only"] },
            children: [{ type: "text" as const, value: externalNote("ja") }],
          },
        ]);
      },
    },
  });
}
