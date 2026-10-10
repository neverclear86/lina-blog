import { bech32 } from "@scure/base";

/** Largest `kind`: NIP-19 stores it as 4 bytes, big endian. */
const MAX_KIND = 0xffffffff;

/** Longest `d` tag in bytes: the length of a TLV value is 1 byte. */
const MAX_IDENTIFIER_BYTES = 255;

/** Bytes of a public key. */
const PUBKEY_BYTES = 32;

/** TLV types of an `naddr` (NIP-19). Type 1, the relay hint, is not used. */
const TLV_IDENTIFIER = 0;
const TLV_AUTHOR = 2;
const TLV_KIND = 3;

/**
 * Builds the NIP-19 `naddr` of an addressable event: the address of the latest event of a kind
 * by a public key with a `d` tag, for example a kind 30023 (NIP-23) article.
 *
 * The TLV entries are in the order of their types (the `d` tag, the public key, the kind), as
 * in go-nostr, so the result is the same string as theirs. It has no relay hints, because the
 * relays an event is published to are not known when the site is built.
 *
 * @param options.npub The public key of the author in bech32 (`npub1…`).
 * @param options.kind The kind of the event, an integer from 0 to 4294967295.
 * @param options.identifier The value of the `d` tag of the event, at most 255 bytes in UTF-8.
 * @returns The `naddr` in bech32 (`naddr1…`).
 * @throws RangeError `Invalid npub` when `npub` is not an `npub` of a 32 bytes public key (a
 *   wrong checksum, another kind of NIP-19 string such as an `nsec`, or a `nostr:` prefix).
 *   The message does not include `npub`, which may be a secret key by mistake.
 * @throws RangeError `Invalid kind: <kind>` when `kind` is not an integer from 0 to 4294967295.
 * @throws RangeError `Identifier is longer than 255 bytes` when `identifier` is longer.
 */
export function buildNaddr(options: {
  npub: string;
  kind: number;
  identifier: string;
}): string {
  const { npub, kind, identifier } = options;
  const pubkey = decodeNpub(npub);
  if (!Number.isInteger(kind) || kind < 0 || kind > MAX_KIND) {
    throw new RangeError(`Invalid kind: ${kind}`);
  }
  const identifierBytes = new TextEncoder().encode(identifier);
  if (identifierBytes.length > MAX_IDENTIFIER_BYTES) {
    throw new RangeError(
      `Identifier is longer than ${MAX_IDENTIFIER_BYTES} bytes`,
    );
  }
  const kindBytes = new Uint8Array(4);
  new DataView(kindBytes.buffer).setUint32(0, kind);
  const data = new Uint8Array([
    TLV_IDENTIFIER,
    identifierBytes.length,
    ...identifierBytes,
    TLV_AUTHOR,
    pubkey.length,
    ...pubkey,
    TLV_KIND,
    kindBytes.length,
    ...kindBytes,
  ]);
  return bech32.encode("naddr", bech32.toWords(data), false);
}

/**
 * Reads an `npub`.
 *
 * @param npub A string that should be an `npub`.
 * @returns The 32 bytes of the public key.
 * @throws RangeError `Invalid npub` when `npub` is not an `npub` of a 32 bytes public key.
 */
function decodeNpub(npub: string): Uint8Array {
  try {
    const { prefix, words } = bech32.decode(
      npub as `${string}1${string}`,
      false,
    );
    const pubkey = bech32.fromWords(words);
    if (prefix === "npub" && pubkey.length === PUBKEY_BYTES) {
      return pubkey;
    }
  } catch {
    // Falls through to the error below, which does not repeat `npub`.
  }
  throw new RangeError("Invalid npub");
}

/** Kind of a long-form article (NIP-23). */
const LONG_FORM_KIND = 30023;

/**
 * Returns the address on njump, a web gateway of Nostr, of the kind 30023 (NIP-23) article of a
 * blog post: `https://njump.me/<naddr>`. The `naddr` ({@link buildNaddr}) has the `d` tag of the
 * article, which is the slug of the post.
 *
 * @param options.npub The public key of the author in bech32 (`npub1…`).
 * @param options.slug The slug of the post.
 * @returns The URL of the article on njump.
 * @throws RangeError The errors of {@link buildNaddr}.
 */
export function nostrArticleUrl(options: {
  npub: string;
  slug: string;
}): string {
  const naddr = buildNaddr({
    npub: options.npub,
    kind: LONG_FORM_KIND,
    identifier: options.slug,
  });
  return `https://njump.me/${naddr}`;
}
