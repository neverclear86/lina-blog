import { satteriHighlightPlugin } from "@astrojs/markdown-satteri";
import type { HastNode } from "satteri";
import {
  createHighlighter,
  type Highlighter,
  type ShikiTransformer,
  type ThemeRegistration,
} from "shiki";

/**
 * Languages highlighted in code blocks, by Shiki's language ids. Their aliases (for example `ts`,
 * `sh`, `py` and `yml`) and the languages their grammars embed (`postcss`, from `astro`) are
 * highlighted too. Code in any other language is shown as plain text.
 */
export const CODE_LANGUAGES = [
  "astro",
  "css",
  "diff",
  "dockerfile",
  "go",
  "html",
  "javascript",
  "json",
  "jsonc",
  "jsx",
  "markdown",
  "python",
  "rust",
  "shellscript",
  "sql",
  "toml",
  "tsx",
  "typescript",
  "yaml",
] as const;

/**
 * Marker color per role. Shiki picks one of these for each token from ROLE_THEME, and the color
 * tells roleClasses which role the token has; the colors are never rendered. They contain no
 * letters, so they compare equal to `token.color` without case folding.
 */
const ROLE_COLORS = {
  comment: "#000001",
  keyword: "#000002",
  string: "#000003",
  constant: "#000004",
  function: "#000005",
  type: "#000006",
  punctuation: "#000007",
} as const;

/**
 * Shiki theme mapping TextMate scopes to roles. Tokens matching none of these scopes get no role
 * and keep the block's default text color.
 */
const ROLE_THEME: ThemeRegistration = {
  name: "code-roles",
  type: "dark",
  fg: "#000000",
  bg: "#000000",
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: ROLE_COLORS.comment },
    },
    {
      scope: ["keyword", "storage"],
      settings: { foreground: ROLE_COLORS.keyword },
    },
    { scope: ["string"], settings: { foreground: ROLE_COLORS.string } },
    { scope: ["constant"], settings: { foreground: ROLE_COLORS.constant } },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: ROLE_COLORS.function },
    },
    {
      scope: [
        "entity.name.type",
        "support.type",
        "support.class",
        "entity.name.class",
      ],
      settings: { foreground: ROLE_COLORS.type },
    },
    {
      scope: ["punctuation", "keyword.operator"],
      settings: { foreground: ROLE_COLORS.punctuation },
    },
  ],
};

const ROLE_BY_COLOR = new Map<string, string>(
  Object.entries(ROLE_COLORS).map(([role, color]) => [color, role]),
);

/**
 * Replaces Shiki's inline styles with classes, because the site's CSP does not allow `style`
 * attributes: a token whose scope has a role gets `hl-<role>` (for example `hl-keyword`), and
 * neither the `<pre>` nor the tokens keep a `style`.
 */
const roleClasses: ShikiTransformer = {
  name: "role-classes",
  pre(node) {
    delete node.properties.style;
  },
  span(node, _line, _col, _lineNode, token) {
    delete node.properties.style;
    const role =
      token.color === undefined ? undefined : ROLE_BY_COLOR.get(token.color);
    if (role) {
      this.addClassToHast(node, `hl-${role}`);
    }
  },
};

/**
 * Marks the lines of `code` for a diff: a line starting with `+` gets `diff-add` and one starting
 * with `-` gets `diff-del`, `+++` and `---` header lines included. The marker stays in the text.
 */
function diffLines(code: string): ShikiTransformer {
  const lines = code.split("\n");
  return {
    name: "diff-lines",
    line(node, line) {
      const marker = lines[line - 1]?.charAt(0);
      if (marker === "+") {
        this.addClassToHast(node, "diff-add");
      } else if (marker === "-") {
        this.addClassToHast(node, "diff-del");
      }
    },
  };
}

let highlighter: Promise<Highlighter> | undefined;

/** Shiki highlighter with ROLE_THEME and CODE_LANGUAGES, created on first use and then shared. */
function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: [ROLE_THEME],
    langs: [...CODE_LANGUAGES],
  });
  return highlighter;
}

/**
 * Highlights one fenced code block for satteriHighlightPlugin. The result is always a
 * `<pre class="shiki code-roles" tabindex="0">`, so every block can be scrolled with the keyboard.
 *
 * - A language in CODE_LANGUAGES, or an alias of one, is highlighted with role classes.
 * - `diff` marks the lines with diffLines and highlights the code as the language written after
 *   it (```` ```diff js ````, passed as `meta`), or as a diff when nothing is written after it.
 * - Any other language, including one written after `diff`, and a block without a language are
 *   shown as plain text.
 *
 * Errors from Shiki are not caught, so they fail the build.
 */
export async function highlightCode(
  code: string,
  lang: string,
  meta?: string,
): Promise<HastNode> {
  const highlighter = await getHighlighter();
  const isDiff = lang === "diff";
  const requested = isDiff ? meta?.trim() || "diff" : lang;
  const root = highlighter.codeToHast(code, {
    lang: highlighter.getLoadedLanguages().includes(requested)
      ? requested
      : "text",
    theme: ROLE_THEME.name as string,
    transformers: isDiff ? [roleClasses, diffLines(code)] : [roleClasses],
  });
  return root.children[0] as unknown as HastNode;
}

/**
 * Sätteri hast plugin that highlights every fenced code block with highlightCode. Use it with
 * `markdown.syntaxHighlight: false` so Astro's own Shiki does not style the blocks first.
 */
export const highlightCodeBlocks = satteriHighlightPlugin(
  highlightCode,
  undefined,
);
