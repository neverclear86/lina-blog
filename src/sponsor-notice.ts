/**
 * The notice above the body of a sponsored blog post's page: a "PR" label and a sentence that
 * names the sponsor, so readers see that the post is an advertisement before they read it.
 */
import type { BlogFrontmatter } from "./blog-schema";

/** Link to the sponsor's site from its name in the notice. */
export interface SponsorLink {
  /** URL of the sponsor's site, as the post's `sponsor.url` gives it. */
  href: string;
  /** Marks the link as paid, for search engines. */
  rel: "sponsored";
}

/** What the notice shows, in Japanese: the post pages are in Japanese only. */
export interface SponsorNotice {
  /** Text of the chip in front of the sentence. */
  label: string;
  /** The sentence up to the sponsor's name. */
  before: string;
  /** The sponsor's name, as the post's `sponsor.name` gives it. */
  name: string;
  /** The link on the name. Absent when the post gives no `sponsor.url`. */
  link?: SponsorLink;
  /** The sentence after the sponsor's name. */
  after: string;
}

/**
 * Returns the notice of a post with `sponsor`, or `undefined` for a post without one. The name
 * links to `sponsor.url` with `rel="sponsored"` when the post gives the URL.
 */
export function sponsorNotice(
  sponsor: BlogFrontmatter["sponsor"],
): SponsorNotice | undefined {
  if (!sponsor) return undefined;
  return {
    label: "PR",
    before: "この記事は ",
    name: sponsor.name,
    link: sponsor.url ? { href: sponsor.url, rel: "sponsored" } : undefined,
    after: " の提供による PR 記事です。",
  };
}
