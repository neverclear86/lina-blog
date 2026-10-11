/**
 * Reads the CSS of a `.css` file or of the `<style>` of an `.astro` file as rules, so that a
 * test asks which rules set a property under which condition instead of matching text. It
 * ignores whitespace, comments and the order of `@media` blocks, and keeps the source order of
 * rules and declarations for tests of the cascade order.
 */

/** One `property: value` pair of a rule. */
export interface CssDeclaration {
  property: string;
  /** The value with its whitespace collapsed to single spaces; `!important` stays in it. */
  value: string;
}

/** A rule with its declarations and the at-rules it is nested in. */
export interface CssRule {
  /**
   * The selectors, split at the top-level commas, with each run of whitespace collapsed to one
   * space (the spacing around combinators is kept as written), e.g. `.a:is(:hover, :focus)`.
   */
  selectors: string[];
  /** The declarations in the order they are written, so a repeated property appears twice. */
  declarations: CssDeclaration[];
  /**
   * The preludes of the enclosing at-rules, outermost first, as `normalizeCondition` writes
   * them: `@supports (a: b)`, `@media screen`, or `@keyframes name` for `from` and `to`.
   */
  conditions: string[];
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Returns the index after the string that starts with the quote at `start`. */
function skipString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === text[start]) return i + 1;
  }
  throw new Error("A string is not closed");
}

/** Returns `text` without the CSS comments; a `/*` inside a string is kept. */
function stripComments(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end - 1;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("A comment is not closed");
      i = end + 1;
    } else {
      out += text[i];
    }
  }
  return out;
}

/**
 * Returns the index of the first char of `stops` at or after `from` that is outside strings
 * and parentheses, or -1.
 */
function indexOfTop(text: string, stops: string, from = 0): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") i = skipString(text, i) - 1;
    else if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (depth === 0 && stops.includes(text[i])) return i;
  }
  return -1;
}

/** Splits `text` at every top-level `separator`, trims the pieces and drops the empty ones. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let from = 0;
  for (
    let at = indexOfTop(text, separator);
    at >= 0;
    at = indexOfTop(text, separator, from)
  ) {
    parts.push(text.slice(from, at));
    from = at + 1;
  }
  parts.push(text.slice(from));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** Returns the index of the `}` that closes the `{` at `open`. */
function closeOf(css: string, open: number): number {
  let depth = 0;
  let at = indexOfTop(css, "{}", open);
  while (at >= 0) {
    depth += css[at] === "{" ? 1 : -1;
    if (depth === 0) return at;
    at = indexOfTop(css, "{}", at + 1);
  }
  throw new Error("A block is not closed");
}

/**
 * Returns the prelude of an at-rule with its whitespace ignored, so `@media ( min-width:768px )`
 * and `@media (min-width: 768px)` give the same string.
 */
function normalizeCondition(prelude: string): string {
  return collapse(prelude)
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*:\s*/g, ": ");
}

function parseDeclarations(body: string): CssDeclaration[] {
  return splitTop(body, ";").map((text) => {
    const colon = text.indexOf(":");
    if (colon < 0) throw new Error(`Not a declaration: ${text}`);
    return {
      property: text.slice(0, colon).trim(),
      value: collapse(text.slice(colon + 1)),
    };
  });
}

function parseInto(css: string, conditions: string[], rules: CssRule[]): void {
  for (let from = 0; css.slice(from).trim() !== ""; ) {
    const stop = indexOfTop(css, "{;", from);
    if (stop < 0) throw new Error(`No block after: ${css.slice(from).trim()}`);
    if (css[stop] === ";") {
      from = stop + 1; // A statement without a block, such as `@import`.
      continue;
    }
    const prelude = css.slice(from, stop).trim();
    const close = closeOf(css, stop);
    const body = css.slice(stop + 1, close);
    if (indexOfTop(body, "{") >= 0) {
      if (!prelude.startsWith("@"))
        throw new Error(`Nested style rule: ${prelude}`);
      parseInto(body, [...conditions, normalizeCondition(prelude)], rules);
    } else {
      const selectors = splitTop(collapse(prelude), ",");
      rules.push({
        selectors,
        declarations: parseDeclarations(body),
        conditions,
      });
    }
    from = close + 1;
  }
}

/** Returns the CSS in the `<style>` elements of an `.astro` source, joined by line breaks. */
export function cssOfAstro(source: string): string {
  return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join("\n");
}

/**
 * Returns the rules of `css` in source order, including those nested in `@media`, `@supports`
 * and other block at-rules. Fails on a block that is not closed and on a style rule nested in
 * a style rule, rather than reading it wrongly.
 */
export function parseCss(css: string): CssRule[] {
  const rules: CssRule[] = [];
  parseInto(stripComments(css), [], rules);
  return rules;
}

/** Returns the rules that have `selector` among their selectors, in source order. */
export function rulesFor(rules: CssRule[], selector: string): CssRule[] {
  const wanted = collapse(selector);
  return rules.filter((rule) => rule.selectors.includes(wanted));
}

/** Returns whether `rule` is nested in the at-rule `condition`, e.g. `@media screen`. */
export function hasCondition(rule: CssRule, condition: string): boolean {
  return rule.conditions.includes(normalizeCondition(condition));
}

/** Returns the value `rule` ends up with for `property` (its last declaration), if any. */
export function valueIn(rule: CssRule, property: string): string | undefined {
  return rule.declarations.findLast((d) => d.property === property)?.value;
}
