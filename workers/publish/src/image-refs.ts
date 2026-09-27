import { imageUrl, parseImageName } from "./images";

// At most 20 distinct images per article, so that step 1 checks R2 at most 20 times and stays
// within the free plan's 50 subrequests (docs/publish-api.md).
const MAX_IMAGES = 20;

// Opening or closing line of a fenced code block: 0 to 3 spaces, then 3 or more ` or ~.
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// A line of 3 or more hyphens, such as a frontmatter delimiter. It ends a paragraph.
const DASH_LINE = /^ {0,3}-{3,}\s*$/;

// A link destination `](image:<name>)`. The name is everything up to the closing parenthesis.
const IMAGE_REF = /\]\(image:([^)\n]*)\)/g;

// An `image:` destination in another form: after `](` (spaces or `<` allowed), in a reference
// definition (also in a list item or a block quote), in an autolink, or in a quoted src, srcset
// or href attribute of HTML. Matched without regard to case.
const LEFTOVER_REF =
  /(?:\]\(\s*<?|^[ \t>*+\-\d.)]*\[[^\]\n]+\]:\s*<?|<|\b(?:src|srcset|href)\s*=\s*["'])image:[^\s)>"']*/gim;

const BACKTICKS = /`+/g;

/** Result of {@link rewriteImageRefs}. `names` are distinct, in order of first reference. */
export type ImageRefsResult =
  | { ok: true; markdown: string; names: string[] }
  | {
      ok: false;
      code: "too_many_images" | "invalid_markdown";
      message: string;
    };

/**
 * Applies `rewrite` to the parts of `markdown` outside fenced code blocks and code spans and
 * keeps the rest as is.
 *
 * @param markdown The text to scan.
 * @param rewrite Called with each part outside code, in order.
 * @returns The text with every outside part replaced by what `rewrite` returned.
 */
function mapOutsideCode(
  markdown: string,
  rewrite: (text: string) => string,
): string {
  let output = "";
  let paragraph = "";
  let fence: string | null = null;
  const flush = () => {
    output += mapOutsideCodeSpans(paragraph, rewrite);
    paragraph = "";
  };
  for (const line of markdown.split(/(?<=\n)/)) {
    const marker = FENCE.exec(line);
    if (fence !== null) {
      output += line;
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        line.slice(marker[0].length).trim() === ""
      ) {
        fence = null;
      }
    } else if (marker) {
      flush();
      fence = marker[1];
      output += line;
    } else if (line.trim() === "" || DASH_LINE.test(line)) {
      flush();
      output += line;
    } else {
      paragraph += line;
    }
  }
  flush();
  return output;
}

/**
 * Applies `rewrite` to the parts of one paragraph outside code spans. A run of backticks opens a
 * span only when a later run of the same length closes it.
 *
 * @param paragraph Lines outside fences with no blank line or line of hyphens among them.
 * @param rewrite Called with each part outside code spans, in order.
 * @returns The paragraph with every outside part replaced by what `rewrite` returned.
 */
function mapOutsideCodeSpans(
  paragraph: string,
  rewrite: (text: string) => string,
): string {
  const runs = [...paragraph.matchAll(BACKTICKS)];
  let output = "";
  let position = 0;
  let index = 0;
  while (index < runs.length) {
    const open = runs[index];
    const closeIndex = runs.findIndex(
      (run, later) => later > index && run[0].length === open[0].length,
    );
    if (closeIndex === -1) {
      index += 1;
      continue;
    }
    const close = runs[closeIndex];
    const end = close.index + close[0].length;
    output += rewrite(paragraph.slice(position, open.index));
    output += paragraph.slice(open.index, end);
    position = end;
    index = closeIndex + 1;
  }
  return output + rewrite(paragraph.slice(position));
}

/**
 * Checks the `image:` references of an article and rewrites them to the public image URL, as
 * `docs/publish-api.md` specifies for `PUT /articles/{slug}`.
 *
 * A reference is a link destination written `](image:<name>)`, of an image or of a link. The
 * whole Markdown is scanned, frontmatter included, except fenced code blocks and code spans. A
 * fence opens at a line of 0 to 3 spaces and 3 or more backticks or tildes, and closes at a line
 * of at least as many of the same character followed only by spaces; a fence that is never
 * closed runs to the end. A code span is a run of backticks closed by the next run of the same
 * length before a blank line or a line of 3 or more hyphens; a run without such a closing run
 * is plain text. An `image:` destination outside code in another form is rejected with
 * `invalid_markdown`: after `](` (spaces or `<` allowed), in a reference definition (also in a
 * list item or a block quote), in an autolink, in a quoted `src`, `srcset` or `href` attribute
 * of HTML, or with the scheme in another case.
 *
 * The body is rejected with `too_many_images` when it references more than 20 distinct names,
 * whatever their form, and then with `invalid_markdown` when a name is not one that
 * {@link parseImageName} accepts or another `image:` destination is left.
 *
 * The function neither reads R2 nor throws. A caller must confirm that every name is stored
 * before it uses the rewritten Markdown.
 *
 * @param markdown The Markdown of the article, frontmatter included.
 * @returns The Markdown with each reference replaced by `](https://img.ikili.pro/<name>)` and
 *   the distinct names in order of first reference, or the error code and a message that lists
 *   the malformed names and the other `image:` destinations.
 */
export function rewriteImageRefs(markdown: string): ImageRefsResult {
  const names = new Set<string>();
  const malformed = new Set<string>();
  const leftovers: string[] = [];
  const rewritten = mapOutsideCode(markdown, (text) => {
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
