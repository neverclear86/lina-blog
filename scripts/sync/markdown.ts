import { createHash } from "node:crypto";
import type { ArticleFrontmatter } from "./vault";

const BOM = String.fromCharCode(0xfeff);

/** A JSON escape, such as `\n` or a `\u` escape, and the combining marks right after it. */
const MARKS_AFTER_ESCAPE = /(\\(?:[bfnrt]|u[0-9a-f]{4}))(\p{M}+)/gu;

/** Writes each UTF-16 code unit of `text` as a `\u` escape with four lowercase hex digits. */
function escapeUnits(text: string): string {
  let escaped = "";
  for (let i = 0; i < text.length; i++) {
    escaped += `\\u${text.charCodeAt(i).toString(16).padStart(4, "0")}`;
  }
  return escaped;
}

/**
 * Writes `value` as a YAML double-quoted scalar: without a BOM, in NFC, and escaped as JSON.
 * The combining marks right after an escape are escaped too, so that the output stays in NFC
 * without the last letter of the escape and the mark composing into one character.
 */
function yamlString(value: string): string {
  return JSON.stringify(value.replaceAll(BOM, "").normalize("NFC")).replace(
    MARKS_AFTER_ESCAPE,
    (_, sequence: string, marks: string) => `${sequence}${escapeUnits(marks)}`,
  );
}

/** Writes `values` as a YAML flow sequence of double-quoted scalars. */
function yamlList(values: readonly string[]): string {
  return `[${values.map(yamlString).join(", ")}]`;
}

/**
 * Lists the lines of the frontmatter in the fixed key order, leaving out an optional key whose
 * value is `undefined`.
 */
function frontmatterLines(frontmatter: ArticleFrontmatter): string[] {
  const lines = [
    `title: ${yamlString(frontmatter.title)}`,
    `slug: ${yamlString(frontmatter.slug)}`,
    `emoji: ${yamlString(frontmatter.emoji)}`,
    `tags: ${yamlList(frontmatter.tags)}`,
    `description: ${yamlString(frontmatter.description)}`,
  ];
  const { sponsor, topics } = frontmatter;
  if (sponsor !== undefined) {
    lines.push("sponsor:", `  name: ${yamlString(sponsor.name)}`);
    if (sponsor.url !== undefined) {
      lines.push(`  url: ${yamlString(sponsor.url)}`);
    }
  }
  if (topics !== undefined) {
    lines.push(`topics: ${yamlList(topics)}`);
  }
  return lines;
}

/**
 * Builds the `markdown` of `PUT /articles/{slug}` in `docs/publish-api.md`, normalized as the
 * section "内容のハッシュ" of that document describes.
 *
 * The frontmatter has `title`, `slug`, `emoji`, `tags`, `description`, `sponsor` (`name`, then
 * `url`) and `topics` in this order, whatever the order of the keys in `frontmatter`, and leaves
 * out an optional key whose value is `undefined`; an empty `topics` is written as `[]`. It is
 * written without a YAML library, each string as a double-quoted scalar escaped as JSON and each
 * list as a flow sequence, so that the output and its content hash depend only on this function.
 *
 * The strings in the frontmatter and the body are put in NFC, and every BOM (U+FEFF) is removed.
 * In the body, CRLF and CR become LF, and the line breaks at the end become one; an empty body
 * leaves nothing after the closing `---`. A line break in a frontmatter string stays as the
 * escape `\n` or `\r`, so the output has no CR.
 *
 * @param frontmatter The frontmatter after validation, without `date`.
 * @param body The Markdown after the frontmatter.
 * @returns The Markdown with its frontmatter, in LF and NFC, without a BOM.
 */
export function buildMarkdown(
  frontmatter: ArticleFrontmatter,
  body: string,
): string {
  const normalizedBody = body
    .replaceAll(BOM, "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "");
  const head = ["---", ...frontmatterLines(frontmatter), "---"]
    .map((line) => `${line}\n`)
    .join("");
  return normalizedBody === "" ? head : `${head}${normalizedBody}\n`;
}

/**
 * Computes the content hash of `markdown`: the SHA-256 of its UTF-8 bytes, as 64 lowercase
 * hexadecimal digits. It is the value that the publishing Worker computes from the same string.
 *
 * @param markdown The Markdown that `buildMarkdown` returns.
 * @returns The hash in lowercase hexadecimal.
 */
export function hashMarkdown(markdown: string): string {
  return createHash("sha256").update(markdown, "utf8").digest("hex");
}
