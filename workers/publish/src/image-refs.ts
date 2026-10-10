import { FRONTMATTER } from "./article-markdown";
import type { ErrorCode } from "./errors";
import { imageUrl, parseImageName } from "./images";

// At most 20 distinct images per article, so that step 1 checks R2 at most 20 times and stays
// within the free plan's 50 subrequests (docs/publish-api.md).
const MAX_IMAGES = 20;

// Opening line of a fenced code block, from the first column: 3 or more ` with no ` after them
// on the line, since the info string of a backtick fence cannot contain one, or 3 or more ~.
const FENCE_OPEN = /^(`{3,}(?=[^`]*$)|~{3,})/;

// Closing line of a fenced code block: 0 to 3 spaces, 3 or more ` or ~, then only spaces or tabs.
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*\n?$/;

// A line after which a fence is no longer told apart from other blocks: a fence line indented by
// 1 to 3 spaces, which may belong to a list item, or a line starting with `<`, which may open an
// HTML block that holds fence lines as HTML.
const UNSURE_LINE = /^(?: {1,3}(?:`{3,}|~{3,})| {0,3}<)/;

// A link destination `](image:<name>)`. The name is everything up to the closing parenthesis.
const IMAGE_REF = /\]\(image:([^)\n]*)\)/g;

// Any other `image:` that may be a destination: not part of a longer scheme or of a URL path,
// and followed by a character that can start a name. Matched without regard to case.
// Backslash escapes such as `image\:` and character references such as `&#105;` are not
// decoded.
const LEFTOVER_REF = /(?<![\w/.~%+-])image:[^\s)>"'`<]+/gi;

/** Result of {@link rewriteImageRefs}. `names` are distinct, in order of first reference. */
export type ImageRefsResult =
  | { ok: true; markdown: string; names: string[] }
  | {
      ok: false;
      code: Extract<ErrorCode, "too_many_images" | "invalid_markdown">;
      message: string;
    };

/**
 * Applies `rewrite` to the parts of `markdown` outside fenced code blocks and keeps the blocks as
 * they are. The frontmatter is a part outside code. A fence opens at a line that starts with 3
 * or more backticks without a backtick after them, or with 3 or more tildes, and closes at a line
 * of 0 to 3 spaces and at least as many of the same character followed only by spaces or tabs;
 * a fence that is never closed runs to the end. After a line that starts with `<` (0 to 3
 * spaces allowed) or a fence line indented by 1 to 3 spaces, no fence opens: the rest is outside
 * code.
 *
 * @param markdown The Markdown of the article, frontmatter included.
 * @param rewrite Called with each part outside code, in order.
 * @returns The text with every outside part replaced by what `rewrite` returned.
 */
function mapOutsideFences(
  markdown: string,
  rewrite: (text: string) => string,
): string {
  const frontmatter = FRONTMATTER.exec(markdown)?.[0] ?? "";
  let output = "";
  let outside = frontmatter;
  let fence: string | null = null;
  let canOpen = true;
  for (const line of markdown.slice(frontmatter.length).split(/(?<=\n)/)) {
    if (fence !== null) {
      output += line;
      const close = FENCE_CLOSE.exec(line);
      if (
        close &&
        close[1][0] === fence[0] &&
        close[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (UNSURE_LINE.test(line)) {
      canOpen = false;
    }
    const open = canOpen ? FENCE_OPEN.exec(line) : null;
    if (open) {
      output += rewrite(outside) + line;
      outside = "";
      fence = open[1];
    } else {
      outside += line;
    }
  }
  return output + rewrite(outside);
}

/**
 * Checks the `image:` references of an article and rewrites them to the public image URL, as
 * `docs/publish-api.md` specifies for `PUT /articles/{slug}`.
 *
 * A reference is a link destination written `](image:<name>)`, of an image or of a link. The
 * whole Markdown is scanned, frontmatter included, except the fenced code blocks that
 * {@link mapOutsideFences} finds. Code spans, indented code blocks and fences in a list item or
 * a block quote are scanned like the rest, so that a misjudged code boundary rewrites or rejects
 * a reference instead of leaving it. Any other `image:` in the scanned parts, in any case, is
 * rejected with `invalid_markdown` when it does not follow a letter, a digit or one of `_/.~%+-`
 * and is followed by a character other than a space, `)`, `>`, a quote, a backtick or `<`.
 * Backslash escapes such as `image\:` and character references such as `&#105;` are not
 * decoded.
 *
 * The body is rejected with `too_many_images` when it references more than 20 distinct names,
 * whatever their form, and then with `invalid_markdown` when a name is not one that
 * {@link parseImageName} accepts or another `image:` is left.
 *
 * The function neither reads R2 nor throws. A caller must confirm that every name is stored
 * before it uses the rewritten Markdown.
 *
 * @param markdown The Markdown of the article, frontmatter included.
 * @returns The Markdown with each reference replaced by `](https://img.ikili.pro/<name>)` and
 *   the distinct names in order of first reference, or the error code and a message that lists
 *   the malformed names and the other `image:` found.
 */
export function rewriteImageRefs(markdown: string): ImageRefsResult {
  const names = new Set<string>();
  const malformed = new Set<string>();
  const leftovers: string[] = [];
  const rewritten = mapOutsideFences(markdown, (text) => {
    for (const match of text.replace(IMAGE_REF, " ").matchAll(LEFTOVER_REF)) {
      leftovers.push(match[0]);
    }
    return text.replace(IMAGE_REF, (reference, name: string) => {
      names.add(name);
      if (parseImageName(name) === null) {
        malformed.add(name);
        return reference;
      }
      return `](${imageUrl(name)})`;
    });
  });
  if (names.size > MAX_IMAGES) {
    return {
      ok: false,
      code: "too_many_images",
      message: `The body references ${names.size} images; at most ${MAX_IMAGES} are allowed.`,
    };
  }
  const parts = [...malformed, ...leftovers];
  if (parts.length > 0) {
    return {
      ok: false,
      code: "invalid_markdown",
      message: `Image references must be ](image:<sha256>.<ext>): ${parts.join(", ")}.`,
    };
  }
  return { ok: true, markdown: rewritten, names: [...names] };
}
