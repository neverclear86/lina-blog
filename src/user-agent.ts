/**
 * Tells command-line HTTP clients from browsers by the `User-Agent` request header.
 */

/** Product names, in lower case, that command-line HTTP clients send first in `User-Agent`. */
const COMMAND_LINE_CLIENTS = ["curl", "wget", "httpie", "xh"];

/**
 * Returns whether `userAgent` comes from a command-line HTTP client: curl, Wget, HTTPie or xh.
 *
 * Only the first product of the header is compared: its whole name before the first `/`,
 * ignoring case. So `curl/8.22.0`, `CURL/8.22.0` and `curl` match, but `curlx/1.0`,
 * `PycURL/7.45.3 libcurl/8.5.0` and browsers do not. A missing or empty header does not match.
 */
export function isCommandLineClient(userAgent: string | undefined): boolean {
  const product = (userAgent ?? "").split("/", 1)[0].toLowerCase();
  return COMMAND_LINE_CLIENTS.includes(product);
}
