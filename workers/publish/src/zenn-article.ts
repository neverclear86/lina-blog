import type { SubmittedFrontmatter } from "./article-markdown";

// The tag that sends an article to Zenn.
const ZENN_TAG = "技術";

/**
 * Tells whether an article with these tags is also published on Zenn, that is, whether it has
 * the tag 技術.
 *
 * @param tags The `tags` of the article's frontmatter.
 */
export function isZennTarget(tags: readonly string[]): boolean {
  return tags.includes(ZENN_TAG);
}

/**
 * Path of an article's file in the Zenn repository.
 *
 * @param slug The slug of the article, which Zenn uses as the file name.
 * @returns `articles/<slug>.md`.
 */
export function zennArticlePath(slug: string): string {
  return `articles/${slug}.md`;
}

/** Input of {@link buildZennArticle}. */
export type ZennArticleInput = {
  /** The article's frontmatter, as `blogSchema` checked it. */
  frontmatter: Pick<SubmittedFrontmatter, "title" | "emoji" | "topics">;
  /** The text after the frontmatter, in the notation that Zenn renders. */
  body: string;
  /** The public URL of the article on ikili.pro, which the link to the original points to. */
  originalUrl: string;
  /** `true` to publish the article on Zenn, `false` to withdraw it. */
  published: boolean;
};

// A JSON string is a YAML double-quoted scalar, which `js-yaml` reads back as the same text.
// JSON leaves C1 controls and the line and paragraph separators as they are, so they are
// escaped here: a YAML parser may reject them or take them for line breaks.
function yamlString(text: string): string {
  return JSON.stringify(text).replace(
    /[\p{Cc}\p{Zl}\p{Zp}]/gu,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/**
 * Builds the full text of a Zenn article file, `articles/<slug>.md`: a frontmatter in Zenn's
 * format, the body, a rule, and a line that links to the original on ikili.pro, because Zenn
 * cannot set a canonical URL.
 *
 * The frontmatter has `title`, `emoji`, `type: "tech"`, `topics` (an empty array when the
 * article has none) and `published`, in this order, each string as a double-quoted scalar. The
 * body loses its leading empty lines and trailing whitespace, so the text ends with exactly one
 * newline. The same input gives the same text.
 *
 * It does not check the input. The frontmatter must have passed `blogSchema`, which rejects
 * more than 5 topics, as `parseArticleMarkdown` and the `blog` collection check it.
 *
 * @param input The frontmatter, body, URL of the original and whether to publish.
 * @returns The text of the file.
 */
export function buildZennArticle(input: ZennArticleInput): string {
  const { frontmatter, body, originalUrl, published } = input;
  const topics = (frontmatter.topics ?? []).map(yamlString).join(", ");
  const head = [
    "---",
    `title: ${yamlString(frontmatter.title)}`,
    `emoji: ${yamlString(frontmatter.emoji)}`,
    'type: "tech"',
    `topics: [${topics}]`,
    `published: ${published}`,
    "---",
  ].join("\n");
  const text = body.replace(/^\n+/, "").trimEnd();
  const link = `この記事は ikili.pro に掲載した記事の転載です。原典: [ikili.pro の記事](${originalUrl})`;
  const parts = text === "" ? [head, link] : [head, text, "---", link];
  return `${parts.join("\n\n")}\n`;
}
