import { youtubeVideoId } from "../../../src/markdown/youtube-id";

// Opening line of a fenced code block: the prefix (blockquote marks, indentation and a list
// marker), then 3 or more ` with no ` after them on the line, since the info string of a
// backtick fence cannot contain one, or 3 or more ~, then the info string.
const FENCE_OPEN =
  /^([ \t>]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?)(`{3,}(?=[^`]*$)|~{3,})(.*)$/;

// Closing line of a fenced code block: the prefix without a list marker, 3 or more ` or ~, then
// only spaces or tabs.
const FENCE_CLOSE = /^[ \t>]*(`{3,}|~{3,})[ \t]*$/;

// A line of only a URL, bare or in <>, from the first column.
const URL_LINE = /^(?:<(https:\/\/[^\s>]+)>|(https:\/\/\S+))[ \t]*$/;

// The start of a tag, comment, declaration or processing instruction. An autolink does not
// match, since the character after its first word is `:`.
const HTML_START = /<(?:\/?([A-Za-z][A-Za-z0-9-]*)(?=[\s/>]|$)|[!?])/g;

// A backslash escape, or a code span between backtick runs of the same length.
const ESCAPE_OR_CODE_SPAN = /\\[\s\S]|(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

// A character reference, which the title of a Zenn accordion shows as the characters.
const CHARACTER_REFERENCE = /&(?:#\d+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/;

// The YouTube URLs that Zenn embeds as they are (isYoutubeUrl in zenn-editor).
const ZENN_YOUTUBE = [
  /^https:\/\/youtu\.be\/[\w-]+(?:\?[\w=&-]+)?$/,
  /^https:\/\/(?:www\.)?youtube\.com\/watch\?[\w=&-]+$/,
];

// The tags in a summary whose text Zenn shows as the plain title.
const SUMMARY_FORMATTING = /<\/?(?:strong|code)>/g;

const ASIDE_OPEN = /^<aside class="(note|warning)(?: face)?">[ \t]*$/;
const ASIDE_CLOSE = /^<\/aside>[ \t]*$/;
const DETAILS_OPEN = /^<details(?: open)?>[ \t]*$/;
const DETAILS_CLOSE = /^<\/details>[ \t]*$/;
const SUMMARY = /^<summary>(.*)<\/summary>[ \t]*$/;

/** Result of {@link convertToZennSyntax}. */
export type ZennSyntaxResult =
  | { ok: true; markdown: string }
  | { ok: false; message: string };

function isBlank(line: string | undefined): boolean {
  return line === undefined || line.trim() === "";
}

/**
 * The info string of a fenced code block in the Zenn syntax, for the info string `info` of this
 * site. This site reads the first word as the language, with a file name after its first `:`,
 * and the rest as the meta. Zenn reads everything after the first `:` as the file name and a
 * `diff` word before it as the mark of a diff.
 *
 * - `diff:<name>` followed by one word `<lang>` is `diff <lang>:<name>`.
 * - `diff:<name>` with no meta, or with a meta of more than one word, is `diff:<name>`.
 * - `<lang>:<name>` is `<lang>:<name>`, so the meta, which this site does not show, is not part
 *   of the file name.
 * - Any other info string, including a language followed by `:` only, is returned as written.
 */
function zennInfo(info: string): string {
  const [word = "", ...meta] = info.trim().split(/\s+/);
  const colon = word.indexOf(":");
  if (colon < 0 || colon === word.length - 1 || meta.length === 0) return info;
  if (word.slice(0, colon) === "diff" && meta.length === 1) {
    return `diff ${meta[0]}:${word.slice(colon + 1)}`;
  }
  return word;
}

/**
 * `text` with its code spans and backslash escapes replaced by spaces, so that a tag in a span
 * and an escaped `<` are not found.
 */
function blankCodeSpans(text: string): string {
  return text.replace(ESCAPE_OR_CODE_SPAN, (match) =>
    match.replace(/[^\n]/g, " "),
  );
}

/**
 * Converts the body of an article, the markdown after the frontmatter with LF line ends, from the
 * syntax of this site to the syntax of Zenn, and rejects the HTML that Zenn cannot show. It reads
 * the body line by line and does not parse Markdown.
 *
 * A fenced code block is found by its opening and closing fence lines, which may have blockquote
 * marks, indentation and a list marker before the fence. Its lines are never changed, except the
 * info string on the opening line, and no HTML is looked for in it. A fence that the Markdown
 * processor ends before its closing line, such as one in a block quote that stops, is read to the
 * closing fence or the end of the body, so the HTML after it is not found. An indented code block
 * is not told apart from a list item: a line in it that looks like an opening fence is read as
 * one, so its info string can be changed and the lines after it are read as code up to a closing
 * fence.
 *
 * Outside code blocks:
 *
 * - A line of only a YouTube URL that `youtubeVideoId` accepts, bare or in `<>`, from the first
 *   column and between blank lines or the ends of the body, becomes
 *   `https://www.youtube.com/watch?v=<ID>`, unless it is a bare URL that Zenn embeds as it is
 *   (`https://youtu.be/<ID>` or `https://(www.)youtube.com/watch?...`) without a `t` parameter,
 *   which is kept as written.
 * - `<aside class="note">` and `<aside class="warning">`, each with ` face` allowed, become
 *   `:::message` and `:::message alert`. `<details>` or `<details open>` followed by a line
 *   `<summary>TITLE</summary>` becomes `:::details TITLE`, with the `<strong>`, `</strong>`,
 *   `<code>` and `</code>` tags in TITLE removed. Their closing tags become `:::`. Each tag is
 *   alone on its line from the first column, and the blank lines next to the opening and closing
 *   lines are removed.
 * - Any other start of an HTML tag, comment, declaration or processing instruction is
 *   rejected, except `<br>` in any case, and so are a container inside another, one that is
 *   not closed or closes without opening, and a TITLE that is empty or has `<` or a character
 *   reference after those tags are removed. A `<` in a code span or after a backslash is not a
 *   tag.
 *
 * @param body The body of the article.
 * @returns The converted body, or a failure whose message lists `line N: <the line>` of each
 *   rejected line in order. It never throws.
 */
export function convertToZennSyntax(body: string): ZennSyntaxResult {
  const lines = body.split("\n");
  const output: string[] = [];
  const problems: string[] = [];
  let block: { line: number; text: string }[] = [];
  let fence: string | null = null;
  let open: { tag: "aside" | "details"; line: number } | null = null;
  let needSummary = false;
  let afterOpener = false;

  // Looks for HTML in the lines outside code collected since the last flush.
  const flush = () => {
    const blanked = blankCodeSpans(block.map((entry) => entry.text).join("\n"));
    blanked.split("\n").forEach((text, index) => {
      const hasHtml = [...text.matchAll(HTML_START)].some(
        (match) => match[1]?.toLowerCase() !== "br",
      );
      if (hasHtml) {
        problems.push(`line ${block[index].line}: ${block[index].text.trim()}`);
      }
    });
    block = [];
  };

  for (const [index, line] of lines.entries()) {
    const number = index + 1;

    if (fence !== null) {
      const close = FENCE_CLOSE.exec(line);
      if (
        close &&
        close[1][0] === fence[0] &&
        close[1].length >= fence.length
      ) {
        fence = null;
      }
      output.push(line);
      continue;
    }

    if (needSummary) {
      needSummary = false;
      const summary = SUMMARY.exec(line);
      if (summary) {
        const title = summary[1].replace(SUMMARY_FORMATTING, "").trim();
        if (
          title === "" ||
          title.includes("<") ||
          CHARACTER_REFERENCE.test(title)
        ) {
          problems.push(
            `line ${number}: the <summary> of <details> must be plain text`,
          );
        } else {
          output.push(`:::details ${title}`);
          afterOpener = true;
        }
        continue;
      }
      problems.push(
        `line ${number - 1}: <details> must be followed by a <summary> line`,
      );
    }

    if (isBlank(line)) {
      flush();
      if (!afterOpener) output.push(line);
      continue;
    }
    afterOpener = false;

    const fenceOpen = FENCE_OPEN.exec(line);
    if (fenceOpen) {
      flush();
      fence = fenceOpen[2];
      output.push(fenceOpen[1] + fenceOpen[2] + zennInfo(fenceOpen[3]));
      continue;
    }

    if (open === null) {
      const aside = ASIDE_OPEN.exec(line);
      if (aside) {
        flush();
        open = { tag: "aside", line: number };
        output.push(aside[1] === "warning" ? ":::message alert" : ":::message");
        afterOpener = true;
        continue;
      }
      if (DETAILS_OPEN.test(line)) {
        flush();
        open = { tag: "details", line: number };
        needSummary = true;
        continue;
      }
    } else if (
      (open.tag === "aside" ? ASIDE_CLOSE : DETAILS_CLOSE).test(line)
    ) {
      flush();
      open = null;
      while (output.length > 0 && isBlank(output.at(-1))) output.pop();
      output.push(":::");
      continue;
    }

    const url = URL_LINE.exec(line);
    const id = url ? youtubeVideoId(url[1] ?? url[2]) : undefined;
    if (
      url &&
      id !== undefined &&
      isBlank(lines[index - 1]) &&
      isBlank(lines[index + 1])
    ) {
      flush();
      const bare = url[2];
      const kept =
        bare !== undefined &&
        ZENN_YOUTUBE.some((pattern) => pattern.test(bare)) &&
        !new URL(bare).searchParams.has("t") &&
        (new URL(bare).searchParams.get("v") ?? id) === id;
      output.push(kept ? line : `https://www.youtube.com/watch?v=${id}`);
      continue;
    }

    block.push({ line: number, text: line });
    output.push(line);
  }

  flush();
  if (open !== null) {
    problems.push(`line ${open.line}: <${open.tag}> is not closed`);
  }
  if (problems.length > 0) {
    return {
      ok: false,
      message: `The body has HTML that Zenn cannot show: ${problems.join("; ")}.`,
    };
  }
  return { ok: true, markdown: output.join("\n") };
}
