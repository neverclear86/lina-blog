import { defineHastPlugin } from "satteri";

/**
 * The `style` Sätteri gives the cells of an aligned GFM table column (`:--`, `:-:`, `--:`).
 */
const ALIGN_STYLE = /^text-align:\s*(left|center|right);?$/;

/**
 * Hast plugin that moves GFM table alignment from inline styles to classes, so that the
 * rendered articles have no `style` attributes for a Content Security Policy to allow.
 *
 * A `th` or `td` whose `style` is `text-align: left`, `center` or `right` gets the class
 * `align-left`, `align-center` or `align-right` and loses its `style`. Cells without a `style`
 * and cells whose `style` is anything else are left unchanged.
 */
export const tableAlignToClass = defineHastPlugin({
  name: "table-align-to-class",
  element: {
    filter: ["th", "td"],
    visit(node, ctx) {
      const style = node.properties?.style;
      if (typeof style !== "string") return;
      const match = ALIGN_STYLE.exec(style.trim());
      if (!match) return;
      ctx.setProperty(node, "className", [`align-${match[1]}`]);
      ctx.setProperty(node, "style", null);
    },
  },
});
