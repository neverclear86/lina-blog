import { defineHastPlugin } from "satteri";
import { youtubeVideoId } from "./youtube-id";

/**
 * Hast plugin that turns a paragraph holding only a YouTube video URL into an embedded player.
 *
 * The paragraph must contain one link whose text is its own URL, as a bare URL or `<URL>`
 * produces, and `youtubeVideoId` must accept the URL. The player is an `iframe` of
 * `www.youtube-nocookie.com` with `loading="lazy"`, so the page gets no script and the player
 * loads only when it nears the viewport. Any other paragraph is left unchanged.
 */
export const youtubeEmbed = defineHastPlugin({
  name: "youtube-embed",
  element: {
    filter: ["p"],
    visit(node, ctx) {
      const [link, ...rest] = node.children;
      if (rest.length > 0 || link?.type !== "element") return;
      const href = link.properties?.href;
      const [text, ...more] = link.children;
      if (
        typeof href !== "string" ||
        more.length > 0 ||
        text?.type !== "text" ||
        text.value !== href
      ) {
        return;
      }
      const id = youtubeVideoId(href);
      if (id === undefined) return;
      ctx.replaceNode(node, {
        type: "element",
        tagName: "iframe",
        properties: {
          className: ["youtube-embed"],
          src: `https://www.youtube-nocookie.com/embed/${id}`,
          title: "YouTube の動画",
          width: 560,
          height: 315,
          loading: "lazy",
          allow:
            "clipboard-write; encrypted-media; picture-in-picture; web-share",
          allowFullScreen: true,
        },
        children: [],
      });
    },
  },
});
