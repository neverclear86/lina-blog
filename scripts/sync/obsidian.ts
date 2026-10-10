/**
 * Conversion of the Obsidian syntax in an article body into the Markdown that the site
 * publishes. Comments are removed, links to published articles become URLs on the site, and
 * links or embeds that would expose other notes of the Vault are reported as errors.
 */
import { type MdastNode, markdownToMdast } from "satteri";
import { imageMarkdown, mapImages } from "./images";

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
 * - `backtick_in_link`: a `[[link]]` to an article with `published: true` that has a `` ` `` in it
 * - `link_out_of_code`: a `[[link]]` or a `![[embed]]` but an image that is not in code in the
 *   converted body with its image references rewritten
 * - `comment_out_of_code`: a `%%` that is not in code in the converted body with its image
 *   references rewritten
 */
export type ObsidianErrorCode =
  | "not_article_link"
  | "unpublished_link"
  | "heading_only_link"
  | "non_image_embed"
  | "unclosed_comment"
  | "backtick_in_link"
  | "link_out_of_code"
  | "comment_out_of_code";

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

/**
 * Which UTF-16 code units of `text` are code (a code block or inline code) when the site's
 * Markdown processor parses it.
 */
function codeMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false);
  const visit = (node: MdastNode): void => {
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined) {
        throw new Error(`The ${node.type} node has no position`);
      }
      mask.fill(true, start, end);
      return;
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(markdownToMdast(text));
  return mask;
}

/**
 * The body without its `%%comment%%`s outside the code that `code` (`codeMask(body)`) marks.
 * `origin` maps each index of `text` to its index in `body`, and `unclosed` is the index in
 * `body` of a `%%` without the closing `%%`, where `text` ends, or -1.
 */
function removeComments(
  body: string,
  code: boolean[],
): {
  text: string;
  origin: number[];
  unclosed: number;
} {
  let text = "";
  const origin: number[] = [];
  let index = 0;
  while (index < body.length) {
    if (!code[index] && body.startsWith("%%", index)) {
      const close = body.indexOf("%%", index + 2);
      if (close === -1) {
        return { text, origin, unclosed: index };
      }
      index = close + 2;
      continue;
    }
    text += body[index];
    origin.push(index);
    index += 1;
  }
  return { text, origin, unclosed: -1 };
}

/** The note name of the content of a `[[link]]`, without the text and the heading. */
function noteName(content: string): string {
  const bar = content.indexOf("|");
  let namePart = bar === -1 ? content : content.slice(0, bar);
  if (namePart.endsWith("\\")) {
    namePart = namePart.slice(0, -1);
  }
  const hash = namePart.indexOf("#");
  return (hash === -1 ? namePart : namePart.slice(0, hash)).trim();
}

/**
 * `markdown` with each image reference rewritten as `resolveImages` rewrites it, with a name of
 * the same form in place of each image's. `from` maps each index of `markdown` to an index in
 * the body, and the result's `from` does the same for `text`.
 */
function withImagesRewritten(
  markdown: string,
  from: number[],
): { text: string; from: number[] } {
  let text = "";
  const rewrittenFrom: number[] = [];
  let position = 0;
  const keep = (end: number): void => {
    text += markdown.slice(position, end);
    for (let at = position; at < end; at += 1) {
      rewrittenFrom.push(from[at]);
    }
  };
  mapImages(markdown, (ref) => {
    if (!isImage(ref.target)) return null;
    const written = imageMarkdown(ref.alt, `${"0".repeat(64)}.png`);
    keep(ref.start);
    text += written;
    for (let count = 0; count < written.length; count += 1) {
      rewrittenFrom.push(from[ref.start]);
    }
    position = ref.end;
    return null;
  });
  keep(markdown.length);
  return { text, from: rewrittenFrom };
}

/**
 * Errors for the `%%` and for the `[[link]]` and `![[embed]]` other than an image embed that are
 * not in code in `markdown`, the converted body with its image references rewritten. `from`
 * maps each index of `markdown` to the index in `body` that it comes from.
 */
function outOfCode(
  markdown: string,
  from: number[],
  body: string,
): ObsidianError[] {
  const errors: ObsidianError[] = [];
  const code = codeMask(markdown);
  let index = 0;
  while (index < markdown.length) {
    if (code[index]) {
      index += 1;
      continue;
    }
    if (markdown.startsWith("%%", index)) {
      const close = markdown.indexOf("%%", index + 2);
      const end = close === -1 ? index + 2 : close + 2;
      const source = markdown.slice(index, end);
      errors.push({
        code: "comment_out_of_code",
        source,
        line: lineAt(body, from[index]),
      });
      index = end;
      continue;
    }
    const embed = markdown.startsWith("![[", index);
    if (embed || markdown.startsWith("[[", index)) {
      const contentStart = index + (embed ? 3 : 2);
      const close = markdown.indexOf("]]", contentStart);
      const content = close === -1 ? "" : markdown.slice(contentStart, close);
      if (close !== -1 && !content.includes("\n")) {
        if (!embed || !isImage(noteName(content))) {
          const source = markdown.slice(index, close + 2);
          errors.push({
            code: "link_out_of_code",
            source,
            line: lineAt(body, from[index]),
          });
        }
        index = close + 2;
        continue;
      }
    }
    index += 1;
  }
  return errors;
}

/**
 * Converts the Obsidian syntax in an article body (the Markdown after the frontmatter).
 *
 * - `%%comment%%`, including one over several lines, is removed.
 * - `[[name]]`, `[[name|text]]` and `[[name#heading]]` to an article with `published: true`
 *   become `[text](https://ikili.pro/blog/<slug>)`. The heading is dropped, and the text is
 *   the part after `|`, or else the name, with `[`, `]` and a `\` not before `|` escaped. In
 *   a table, `\|` also separates the text and is kept in it.
 * - `![[name]]` whose name ends with an image extension of Obsidian is kept as written.
 * - Other links and embeds, a link to a published article with a `` ` `` in it, a
 *   `[[#heading]]` link without a note name, and a `%%` without the closing `%%` are errors.
 *   Nothing after an unclosed `%%` is checked.
 * - Code is what the site's Markdown processor reads as a code block or inline code. A `%%`
 *   in the code of the body is kept. A link or embed is kept as written only when it is in
 *   code both in the body and in the body without its comments; otherwise it is converted
 *   or reported.
 * - When there is no other error, a `%%`, a link or an embed but an image that is not in code
 *   in the converted body with its image references rewritten as `resolveImages` rewrites
 *   them, as when a converted link or a rewritten image changes the cells of a table row, is
 *   an error.
 *
 * Every error in the body is reported, except the last kind when there is another one, and
 * no converted body is returned when there is an error.
 */
export function convertObsidianSyntax(
  body: string,
  resolve: ResolveLink,
): ObsidianConversion {
  const errors: ObsidianError[] = [];
  const bodyCode = codeMask(body);
  const { text, origin, unclosed } = removeComments(body, bodyCode);
  const textCode = codeMask(text);
  const from: number[] = [];
  let markdown = "";
  const emit = (part: string, at: number): void => {
    markdown += part;
    for (let count = 0; count < part.length; count += 1) {
      from.push(origin[at]);
    }
  };
  let index = 0;

  while (index < text.length) {
    if (textCode[index] && bodyCode[origin[index]]) {
      emit(text[index], index);
      index += 1;
      continue;
    }

    const embed = text.startsWith("![[", index);
    if (embed || text.startsWith("[[", index)) {
      const contentStart = index + (embed ? 3 : 2);
      const close = text.indexOf("]]", contentStart);
      const content = close === -1 ? "" : text.slice(contentStart, close);
      if (close !== -1 && !content.includes("\n")) {
        const source = text.slice(index, close + 2);
        const line = lineAt(body, origin[index]);
        const bar = content.indexOf("|");
        const name = noteName(content);

        if (embed) {
          if (isImage(name)) {
            emit(source, index);
          } else {
            errors.push({ code: "non_image_embed", source, line });
          }
        } else if (name === "") {
          errors.push({ code: "heading_only_link", source, line });
        } else {
          const target = resolve(name);
          if (target.kind === "published" && !content.includes("`")) {
            const text = (bar === -1 ? name : content.slice(bar + 1)).replace(
              /\\(?!\|)|[[\]]/g,
              "\\$&",
            );
            emit(`[${text}](${ARTICLE_URL_BASE}${target.slug})`, index);
          } else if (target.kind === "published") {
            errors.push({ code: "backtick_in_link", source, line });
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

    emit(text[index], index);
    index += 1;
  }

  if (unclosed !== -1) {
    errors.push({
      code: "unclosed_comment",
      source: "%%",
      line: lineAt(body, unclosed),
    });
  }
  if (errors.length === 0) {
    const rewritten = withImagesRewritten(markdown, from);
    errors.push(...outOfCode(rewritten.text, rewritten.from, body));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, markdown };
}
