import { defineMdastPlugin } from "satteri";

/** A fence's language followed by `:` and a file name, as in ```` ```ts:src/hello.ts ````. */
const LANG_WITH_FILENAME = /^([^:]*):(.+)$/;

/**
 * Mdast plugin that shows the file name of a fenced code block written as
 * ```` ```ts:src/hello.ts ````.
 *
 * The block becomes `<figure class="code-file">` with the file name in a `<figcaption>`
 * before the `<pre>`. The language is the part before the first `:` (none when that part is
 * empty), so a highlighter that runs on the `<pre>` later sees `ts`. The meta after the
 * language is kept. Blocks without `:` in the language, or with nothing after it, are left
 * unchanged.
 */
export const codeFilename = defineMdastPlugin({
  name: "code-filename",
  code(node, ctx) {
    const match = LANG_WITH_FILENAME.exec(node.lang ?? "");
    if (!match) return;
    ctx.replaceNode(node, {
      type: "codeFile",
      data: { hName: "figure", hProperties: { className: ["code-file"] } },
      children: [
        {
          type: "codeFileName",
          data: { hName: "figcaption" },
          children: [{ type: "text", value: match[2] }],
        },
        {
          type: "code",
          lang: match[1],
          meta: node.meta,
          value: node.value,
        },
      ],
    });
  },
});
