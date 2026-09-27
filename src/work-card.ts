/**
 * Picks the order of the works on the top page and the link target of each work's card.
 */
import type { Locale } from "./i18n/locales";

/** Fields of a work in the `works` collection that decide where its card links to. */
export interface WorkCardLinkSource {
  slug: string;
  hasPage: boolean;
  links: { demo?: string; repo?: string };
}

/** Link target of a work card. `external` is true for a URL outside this site. */
export interface WorkCardLink {
  href: string;
  external: boolean;
}

/**
 * Returns where the card of `work` links to on the page in `lang`: the work's own page
 * `/<lang>/works/<slug>/` when `hasPage` is true, otherwise its demo URL, otherwise its
 * repository URL. Returns `undefined` when the work has none of them.
 */
export function workCardLink(
  work: WorkCardLinkSource,
  lang: Locale,
): WorkCardLink | undefined {
  if (work.hasPage) {
    return { href: `/${lang}/works/${work.slug}/`, external: false };
  }
  const url = work.links.demo ?? work.links.repo;
  return url === undefined ? undefined : { href: url, external: true };
}

/** Returns the works sorted by `data.order`, smaller first. `works` is not changed. */
export function worksInOrder<T extends { data: { order: number } }>(
  works: readonly T[],
): T[] {
  return [...works].sort((a, b) => a.data.order - b.data.order);
}
