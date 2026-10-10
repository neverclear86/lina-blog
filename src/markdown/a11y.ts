import { defineHastPlugin, type HastNode } from "satteri";

/**
 * Returns the text of `nodes` with runs of white space as one space, trimmed, leaving out the
 * text of nested lists (`ul` and `ol`).
 */
function itemText(nodes: readonly HastNode[]): string {
  const parts: string[] = [];
  const collect = (list: readonly HastNode[]) => {
    for (const node of list) {
      if (node.type === "text") parts.push(node.value);
      else if (
        node.type === "element" &&
        node.tagName !== "ul" &&
        node.tagName !== "ol"
      )
        collect(node.children);
    }
  };
  collect(nodes);
  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Hast plugin that names the checkbox of a GFM task list item.
 *
 * The checkbox `input` of an `li.task-list-item`, a child of the `li` or of its first `p` (a
 * loose list), gets an `aria-label` with the text of the item: its text with the text of links
 * and code, without the text of a nested list, so that a screen reader announces
 * "脚注, checkbox, checked" instead of an unnamed checkbox. Every other element is left
 * unchanged.
 */
export const taskItemLabel = defineHastPlugin({
  name: "task-item-label",
  element: {
    filter: ["li"],
    visit(node, ctx) {
      const classes = node.properties?.className;
      if (!Array.isArray(classes) || !classes.includes("task-list-item"))
        return;
      const first = node.children.find((child) => child.type === "element");
      const input = [
        ...node.children,
        ...(first?.type === "element" && first.tagName === "p"
          ? first.children
          : []),
      ].find((child) => child.type === "element" && child.tagName === "input");
      const label = itemText(node.children);
      if (input?.type !== "element") return;
      ctx.setProperty(input, "ariaLabel", label);
    },
  },
});

/**
 * Hast plugin that makes every table reachable with the keyboard.
 *
 * A table scrolls sideways when it is wider than the article (`display: block` and
 * `overflow-x: auto` in `src/components/ArticleBody.astro`), and a scrolling region that cannot
 * take focus cannot be scrolled with the keyboard. Every `table` gets `tabindex="0"`, whether or
 * not it scrolls at the width of the viewer.
 */
export const tableFocusable = defineHastPlugin({
  name: "table-focusable",
  element: {
    filter: ["table"],
    visit(node, ctx) {
      ctx.setProperty(node, "tabIndex", 0);
    },
  },
});
