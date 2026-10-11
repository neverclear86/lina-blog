/**
 * Splits a label where a line break may go, for the label of Twitter (self-proclaimed X) in the
 * share button at the end of a post and in the DM line of the contact page and the contact band.
 */

/**
 * Returns `label` split before its first "(", or `[label]` when it has no "(" or starts with
 * one. `ArticleEnd`, the contact page and `ContactBand` put a `<wbr>` between the parts, so that
 * "Twitter(自称X)" can wrap as "Twitter" and "(自称X)"; a space before "(" stays in the first
 * part.
 */
export function labelSegments(label: string): string[] {
  const index = label.indexOf("(");
  if (index <= 0) {
    return [label];
  }
  return [label.slice(0, index), label.slice(index)];
}
