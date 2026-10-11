/**
 * The addresses behind the share buttons at the end of an article: the article's own address,
 * and the pages of Twitter (self-proclaimed X) and Nostr that open with a new post that holds
 * the article's title and address.
 */

/**
 * Returns the address of the page of the post `slug`, `/blog/<slug>/` on the origin of `site`.
 * The address has no fragment, so that a link shared from a section of the page does not carry
 * the section.
 */
export function blogPostUrl(slug: string, site: URL): string {
  return new URL(`/blog/${slug}/`, site).href;
}

/**
 * Returns the address of the post form of Twitter (self-proclaimed X), with `title` in the
 * text of the post and `url` as the link of the post.
 */
export function twitterShareUrl(title: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
}

/**
 * Returns the address of the post form of nostter, a web client of Nostr, with the post
 * "`title`, a line break and `url`" filled in. The form takes the whole post in the one query
 * parameter `content`.
 */
export function nostrShareUrl(title: string, url: string): string {
  return `https://nostter.app/post?content=${encodeURIComponent(title)}%0A${encodeURIComponent(url)}`;
}
