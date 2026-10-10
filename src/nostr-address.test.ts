import { decode, npubEncode, nsecEncode } from "nostr-tools/nip19";
import { describe, expect, it } from "vitest";
import { buildNaddr, nostrArticleUrl } from "./nostr-address";

/** The same string as the Nostr npub of `src/profile-links.ts`. */
const OFFICIAL_NPUB =
  "npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz";

/** The example of the NIP-19 specification. */
const SPEC_NPUB =
  "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg";
const SPEC_PUBKEY =
  "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e";

/** Made by go-nostr v0.52.3 (`nip19.EncodeEntity`) and by a Python encoder written from BIP-173. */
const OFFICIAL_NADDR =
  "naddr1qqf8xctdwpkx2ttpwf6xjcmvv5knqvp3qgsvcradcnlxwgrvadffq48hustfclurgrwxu59y283p8jfr2yyx9ncrqsqqqa28fefm2p";
const SPEC_NADDR =
  "naddr1qqrxyctwv9hxzq3q0elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qxpqqqp65wlnvkm4";

/** Reads an `naddr` with nostr-tools, which accepts the entries in any order. */
function decodeNaddr(naddr: string) {
  const result = decode(naddr);
  if (result.type !== "naddr") {
    throw new Error(`Not an naddr: ${result.type}`);
  }
  return result.data;
}

describe("buildNaddr", () => {
  it("公式の npub と kind 30023 と slug から、別の実装で作った naddr と同じ値を返す", () => {
    expect(
      buildNaddr({
        npub: OFFICIAL_NPUB,
        kind: 30023,
        identifier: "sample-article-001",
      }),
    ).toBe(OFFICIAL_NADDR);
  });

  it("別の npub と d タグでも、別の実装で作った naddr と同じ値を返す", () => {
    expect(
      buildNaddr({ npub: SPEC_NPUB, kind: 30023, identifier: "banana" }),
    ).toBe(SPEC_NADDR);
  });

  it("relay の情報を持たない", () => {
    expect(
      decode(
        buildNaddr({ npub: SPEC_NPUB, kind: 30023, identifier: "banana" }),
      ),
    ).toEqual({
      type: "naddr",
      data: {
        identifier: "banana",
        pubkey: SPEC_PUBKEY,
        kind: 30023,
        relays: [],
      },
    });
  });

  it("kind の上限の 4294967295 を 4 バイトで符号化する", () => {
    const naddr = buildNaddr({
      npub: SPEC_NPUB,
      kind: 4294967295,
      identifier: "banana",
    });
    expect(decodeNaddr(naddr).kind).toBe(4294967295);
  });

  it("kind 0 を符号化できる", () => {
    const naddr = buildNaddr({ npub: SPEC_NPUB, kind: 0, identifier: "" });
    expect(decodeNaddr(naddr).kind).toBe(0);
  });

  it.each([-1, 1.5, 4294967296, Number.NaN, Number.POSITIVE_INFINITY])(
    "kind が %s のとき RangeError を投げる",
    (kind) => {
      expect(() =>
        buildNaddr({ npub: SPEC_NPUB, kind, identifier: "banana" }),
      ).toThrow(new RangeError(`Invalid kind: ${kind}`));
    },
  );

  it("d タグが 255 バイトまでなら符号化し、その値に戻る", () => {
    const identifier = "あ".repeat(85);
    const naddr = buildNaddr({ npub: SPEC_NPUB, kind: 30023, identifier });
    expect(decodeNaddr(naddr).identifier).toBe(identifier);
  });

  it("d タグが 256 バイトになると文字数でなくバイト数で数えて RangeError を投げる", () => {
    expect(() =>
      buildNaddr({
        npub: SPEC_NPUB,
        kind: 30023,
        identifier: `${"あ".repeat(85)}a`,
      }),
    ).toThrow(new RangeError("Identifier is longer than 255 bytes"));
  });

  it.each([
    ["空文字", ""],
    ["checksum の違う npub", `${OFFICIAL_NPUB.slice(0, -1)}q`],
    ["nostr: が前に付いた npub", `nostr:${OFFICIAL_NPUB}`],
    ["32 バイトでない公開鍵の npub", npubEncode("ab".repeat(20))],
    ["nsec", nsecEncode(new Uint8Array(32).fill(1))],
    ["naddr", SPEC_NADDR],
    ["64 桁の 16 進数", "7e".repeat(32)],
  ])("npub が %s のとき RangeError を投げる", (_name, npub) => {
    expect(() =>
      buildNaddr({ npub, kind: 30023, identifier: "banana" }),
    ).toThrow(new RangeError("Invalid npub"));
  });

  it("エラーの文に渡された文字列を含めない", () => {
    const nsec = nsecEncode(new Uint8Array(32).fill(1));
    let message = "";
    try {
      buildNaddr({ npub: nsec, kind: 30023, identifier: "banana" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(nsec);
  });
});

describe("nostrArticleUrl", () => {
  it("公式の npub と slug から、kind 30023 の naddr を開く njump の URL を返す", () => {
    expect(
      nostrArticleUrl({ npub: OFFICIAL_NPUB, slug: "sample-article-001" }),
    ).toBe(`https://njump.me/${OFFICIAL_NADDR}`);
  });

  it("不正な npub では buildNaddr と同じ RangeError を投げる", () => {
    expect(() =>
      nostrArticleUrl({ npub: `nostr:${OFFICIAL_NPUB}`, slug: "banana" }),
    ).toThrow(new RangeError("Invalid npub"));
  });
});
