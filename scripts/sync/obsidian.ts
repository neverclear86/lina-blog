/**
 * Conversion of the Obsidian syntax in an article body into the Markdown that the site
 * publishes. Comments are removed, links to published articles become URLs on the site, and
 * links or embeds that would expose other notes of the Vault are reported as errors.
 */

/** URL of an article page without the slug. */
const ARTICLE_URL_BASE = "https://ikili.pro/blog/";

/** Extensions that Obsidian shows as images, compared without regard to case. */
const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

/** Start of a line that opens a fenced code block: at most three spaces and a fence. */
const FENCE_OPEN = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})/;

/**
 * What a link name refers to in the Vault: an article with `published: true` and its slug, an
 * article with `published: false`, or a note that is not an article.
 */
export type LinkTarget =
  | { kind: "published"; slug: string }
  | { kind: "unpublished" }
  | { kind: "not_article" };

/**
 * Looks up the target of a `[[link]]`. `name` is the part before `|` and `#`, without a `\`
 * before `|`, trimmed, as written in the body.
 */
export type ResolveLink = (name: string) => LinkTarget;

/**
 * Why a piece of Obsidian syntax cannot be published.
 *
 * - `not_article_link`: a `[[link]]` to a note that is not an article
 * - `unpublished_link`: a `[[link]]` to an article with `published: false`
 * - `heading_only_link`: a `[[#heading]]` or `[[]]` link without a note name
 * - `non_image_embed`: a `![[embed]]` of anything but an image
 * - `unclosed_comment`: a `%%` comment without the closing `%%`
 */
export type ObsidianErrorCode =
  | "not_article_link"
  | "unpublished_link"
  | "heading_only_link"
  | "non_image_embed"
  | "unclosed_comment";

/** One rejected piece of syntax, with the 1-based line of the body where it starts. */
export interface ObsidianError {
  code: ObsidianErrorCode;
  /** The syntax as written, such as `[[note]]`, or `%%` for an unclosed comment. */
  source: string;
  line: number;
}

/** Result of `convertObsidianSyntax`: the converted body, or every error in the body. */
export type ObsidianConversion =
  | { ok: true; markdown: string }
  | { ok: false; errors: ObsidianError[] };

/** 1-based line of `text` that the character at `index` is on. */
function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/** Whether `name` ends with an image extension of Obsidian. */
function isImage(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot !== -1 && IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/** End of the line that starts at `start`: the index of its `\n`, or the length of `text`. */
function lineEnd(text: string, start: number): number {
  const newline = text.indexOf("\n", start);
  return newline === -1 ? text.length : newline;
}

/** Where inline code starting at `index` must close: the next blank or fence line. */
function codeSpanLimit(text: string, index: number): number {
  let newline = text.indexOf("\n", index);
  while (newline !== -1) {
    const start = newline + 1;
    const end = lineEnd(text, start);
    const line = text.slice(start, end);
    if (line.trim() === "" || FENCE_OPEN.test(line)) {
      return start;
    }
    newline = end === text.length ? -1 : end;
  }
  return text.length;
}

/** Start of the next run of exactly `length` backticks in `text` from `from` to `end`, or -1. */
function findBacktickRun(
  text: string,
  from: number,
  length: number,
  end: number,
): number {
  let index = from;
  while (index < end) {
    if (text[index] !== "`") {
      index += 1;
      continue;
    }
    let runEnd = index;
    while (runEnd < end && text[runEnd] === "`") {
      runEnd += 1;
    }
    if (runEnd - index === length) {
      return index;
    }
    index = runEnd;
  }
  return -1;
}

/**
 * Converts the Obsidian syntax in an article body (the Markdown after the frontmatter).
 *
 * - `%%comment%%`, including one over several lines, is removed.
 * - `[[name]]`, `[[name|text]]` and `[[name#heading]]` to an article with `published: true`
 *   become `[text](https://ikili.pro/blog/<slug>)`. The heading is dropped, and the text is
 *   the part after `|`, or else the name, with `[` and `]` escaped. In a table, `\|` also
 *   separates the text.
 * - `![[name]]` whose name ends with an image extension of Obsidian is kept as written.
 * - Other links and embeds, a `[[#heading]]` link without a note name, and a `%%` without the
 *   closing `%%` are errors. Nothing after an unclosed `%%` is checked.
 * - Fenced code blocks (opened after at most three spaces) and inline code are kept as
 *   written, with no syntax converted in them. Inline code does not run past a blank line
 *   or a fence. A fence without its closing line runs to the end of the body.
 *
 * Every error in the body is reported, and no converted body is returned when there is one.
 */
export function convertObsidianSyntax(
  body: string,
  resolve: ResolveLink,
): ObsidianConversion {
  const errors: ObsidianError[] = [];
  let markdown = "";
  let index = 0;

  while (index < body.length) {
    if (index === 0 || body[index - 1] === "\n") {
      const openEnd = lineEnd(body, index);
      const fence = FENCE_OPEN.exec(body.slice(index, openEnd));
      if (fence) {
        const close = new RegExp(
          `^[ \\t]*${fence[1][0]}{${fence[1].length},}[ \\t]*$`,
        );
        let blockEnd = body.length;
        let lineStart = openEnd + 1;
        while (lineStart <= body.length) {
          const end = lineEnd(body, lineStart);
          if (close.test(body.slice(lineStart, end))) {
            blockEnd = end;
            break;
          }
          lineStart = end + 1;
        }
        markdown += body.slice(index, blockEnd);
        index = blockEnd;
        continue;
      }
    }

    if (body[index] === "`") {
      let runEnd = index;
      while (body[runEnd] === "`") {
        runEnd += 1;
      }
      const length = runEnd - index;
      const close = findBacktickRun(
        body,
        runEnd,
        length,
        codeSpanLimit(body, index),
      );
      const codeEnd = close === -1 ? runEnd : close + length;
      markdown += body.slice(index, codeEnd);
      index = codeEnd;
      continue;
    }

    if (body.startsWith("%%", index)) {
      const close = body.indexOf("%%", index + 2);
      if (close === -1) {
        errors.push({
          code: "unclosed_comment",
          source: "%%",
          line: lineAt(body, index),
        });
        break;
      }
      index = close + 2;
      continue;
    }

    const embed = body.startsWith("![[", index);
    if (embed || body.startsWith("[[", index)) {
      const contentStart = index + (embed ? 3 : 2);
      const close = body.indexOf("]]", contentStart);
      const content = close === -1 ? "" : body.slice(contentStart, close);
      if (close !== -1 && !content.includes("\n")) {
        const source = body.slice(index, close + 2);
        const line = lineAt(body, index);
        const bar = content.indexOf("|");
        let namePart = bar === -1 ? content : content.slice(0, bar);
        if (namePart.endsWith("\\")) {
          namePart = namePart.slice(0, -1);
        }
        const hash = namePart.indexOf("#");
        const name = (hash === -1 ? namePart : namePart.slice(0, hash)).trim();

        if (embed) {
          if (isImage(name)) {
            markdown += source;
          } else {
            errors.push({ code: "non_image_embed", source, line });
          }
        } else if (name === "") {
          errors.push({ code: "heading_only_link", source, line });
        } else {
          const target = resolve(name);
          if (target.kind === "published") {
            const text = (bar === -1 ? name : content.slice(bar + 1)).replace(
              /[[\]]/g,
              "\\$&",
            );
            markdown += `[${text}](${ARTICLE_URL_BASE}${target.slug})`;
          } else if (target.kind === "unpublished") {
            errors.push({ code: "unpublished_link", source, line });
          } else {
            errors.push({ code: "not_article_link", source, line });
          }
        }
        index = close + 2;
        continue;
      }
    }

    markdown += body[index];
    index += 1;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, markdown };
}
