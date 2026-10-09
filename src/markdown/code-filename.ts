import { defineMdastPlugin } from "satteri";

/** A fence's language followed by `:` and a file name, as in ```` ```ts:src/hello.ts ````. */
const LANG_WITH_FILENAME = /^([^:]*):(.+)$/;

/** Title of the window of a code block that has neither a file name nor a language. */
const UNTITLED = "text";

/**
 * Mdast plugin that wraps every code block in a window: `<figure class="code-window">` with the
 * title in a `<figcaption>` before the `<pre>`.
 *
 * The title is the file name of a fence written as ```` ```ts:src/hello.ts ````. Without a file
 * name it is the language as written in the fence (`ts`, `brainfuck`, `diff`), and `text` when
 * the block has no language. The meta after the language is not shown. The language of the
 * block that a highlighter sees later is the part before the first `:` (none when that part is
 * empty), so it sees `ts` for the fence above; the meta is kept. A language followed by `:` with
 * nothing after it is not a file name, and stays the language and the title as written.
 */
export const codeFilename = defineMdastPlugin({
  name: "code-filename",
  code(node, ctx) {
    const match = LANG_WITH_FILENAME.exec(node.lang ?? "");
    ctx.replaceNode(node, {
      type: "codeWindow",
      data: { hName: "figure", hProperties: { className: ["code-window"] } },
      children: [
        {
          type: "codeWindowTitle",
          data: { hName: "figcaption" },
          children: [
            { type: "text", value: match ? match[2] : node.lang || UNTITLED },
          ],
        },
        {
          type: "code",
          lang: match ? match[1] : node.lang,
          meta: node.meta,
          value: node.value,
        },
      ],
    });
  },
});
