import type { z } from "astro/zod";
import { load, YAMLException } from "js-yaml";
import { blogSchema } from "../../../src/blog-schema";
import type { ErrorCode } from "./errors";

/**
 * Frontmatter of an article sent to the publish Worker, as `docs/publish-api.md` defines it:
 * `blogSchema` without `date`, which the Worker sets. A `date` in the input is rejected before
 * this schema runs, because the schema would drop it as an unknown key.
 */
const submittedSchema = blogSchema.omit({ date: true });

// The frontmatter is the lines between a first line `---` and the next line `---`. A line that
// starts with `---` or `+++` before that one fails the match, because Astro ends a frontmatter
// at such a line and would read the post differently.
export const FRONTMATTER = /^---\n((?:(?!---|\+\+\+)[^\n]*\n)*)---\n/;

/** Frontmatter of an article after {@link parseArticleMarkdown} checks it, without `date`. */
export type SubmittedFrontmatter = z.output<typeof submittedSchema>;

/**
 * Result of {@link parseArticleMarkdown}. `body` is the text after the closing `---` line, as
 * it was sent.
 */
export type ParseArticleResult =
  | { ok: true; frontmatter: SubmittedFrontmatter; body: string }
  | {
      ok: false;
      code: Extract<
        ErrorCode,
        "invalid_markdown" | "invalid_frontmatter" | "slug_mismatch"
      >;
      message: string;
    };

/**
 * Splits the markdown of an article, as `docs/publish-api.md` defines it for sending an article,
 * into its frontmatter and body and checks them in this order:
 *
 * - `invalid_markdown` when the markdown contains CR or a BOM (U+FEFF) anywhere; the sender
 *   normalizes it and the Worker does not.
 * - `invalid_frontmatter` when the markdown does not start with a frontmatter between `---`
 *   lines, the frontmatter is not valid YAML or not a mapping, it has `date`, or it does not
 *   match `blogSchema` without `date`.
 * - `slug_mismatch` when the frontmatter's `slug` differs from `slug`.
 *
 * The frontmatter is read with `js-yaml`'s `load`, as Astro reads the frontmatter of a post,
 * so a frontmatter that passes here is read the same way by `astro build`.
 *
 * @param markdown The markdown of the article, frontmatter included.
 * @param slug The slug that the frontmatter's `slug` must equal.
 * @returns The checked frontmatter, without the keys that the schema does not list, and the
 *   body, or a failure with an error code and a message for the sender. It never throws.
 */
export function parseArticleMarkdown(
  markdown: string,
  slug: string,
): ParseArticleResult {
  if (/[\r\u{FEFF}]/u.test(markdown)) {
    return {
      ok: false,
      code: "invalid_markdown",
      message:
        "Markdown must not contain CR or a BOM; normalize it before sending.",
    };
  }

  const match = FRONTMATTER.exec(markdown);
  if (match === null) {
    return {
      ok: false,
      code: "invalid_frontmatter",
      message: "Markdown must start with a YAML frontmatter between --- lines.",
    };
  }

  let data: unknown;
  try {
    data = load(match[1]);
  } catch (error) {
    const reason =
      error instanceof YAMLException ? error.reason : String(error);
    return {
      ok: false,
      code: "invalid_frontmatter",
      message: `Frontmatter is not valid YAML: ${reason}.`,
    };
  }

  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      code: "invalid_frontmatter",
      message: "Frontmatter must be a YAML mapping.",
    };
  }

  if (Object.hasOwn(data, "date")) {
    return {
      ok: false,
      code: "invalid_frontmatter",
      message: "Frontmatter must not have date; the publish Worker sets it.",
    };
  }

  const result = submittedSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) =>
        issue.path.length > 0
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message,
      )
      .join("; ");
    return {
      ok: false,
      code: "invalid_frontmatter",
      message: `Frontmatter does not match the schema: ${issues}.`,
    };
  }

  if (result.data.slug !== slug) {
    return {
      ok: false,
      code: "slug_mismatch",
      message: `Frontmatter slug "${result.data.slug}" does not match the path slug "${slug}".`,
    };
  }

  return {
    ok: true,
    frontmatter: result.data,
    body: markdown.slice(match[0].length),
  };
}
