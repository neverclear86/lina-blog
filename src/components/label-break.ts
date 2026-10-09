/**
 * Splits a label where a line break may go, for the labels of the icon links and of the share
 * button of Twitter (self-proclaimed X) at the end of a post.
 */

/**
 * Returns `label` split before its first "(", or `[label]` when it has no "(" or starts with
 * one. `IconLink` and `ArticleEnd` put a `<wbr>` between the parts, so that "Twitter(自称X)"
 * can wrap as "Twitter" and "(自称X)"; a space before "(" stays in the first part.
 */
export function labelSegments(label: string): string[] {
  const index = label.indexOf("(");
  if (index <= 0) {
    return [label];
  }
  return [label.slice(0, index), label.slice(index)];
}
