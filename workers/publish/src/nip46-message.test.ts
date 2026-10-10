import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44";
import { finalizeEvent, getPublicKey, type NostrEvent } from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";
import { describe, expect, it } from "vitest";
import {
  buildNip46Request,
  fitsNip46Request,
  type Nip46Session,
  openNip46Session,
  readNip46Response,
} from "./nip46-message";

const CLIENT_KEY = "01".repeat(32);
const SIGNER_KEY = "02".repeat(32);
const THIRD_KEY = "03".repeat(32);
const SIGNER_PUBKEY = getPublicKey(hexToBytes(SIGNER_KEY));
const CLIENT_PUBKEY = getPublicKey(hexToBytes(CLIENT_KEY));
const NOW = new Date(1_700_000_000_999);

function session(): Nip46Session {
  const result = openNip46Session(CLIENT_KEY, SIGNER_PUBKEY);
  if (!result.ok) throw new Error(result.message);
  return result.session;
}

function request(params: string[] = [], method = "get_public_key"): NostrEvent {
  const result = buildNip46Request(session(), { id: "7", method, params }, NOW);
  if (!result.ok) throw new Error(result.message);
  return result.event;
}

/** The signer's conversation key with the client, as the signer derives it. */
function signerSide(): Uint8Array {
  return getConversationKey(hexToBytes(SIGNER_KEY), CLIENT_PUBKEY);
}

/** An event the signer's key signs, passed through JSON as a relay would deliver it. */
function reply(
  body: unknown,
  options: { key?: string; kind?: number; content?: string } = {},
): NostrEvent {
  const event = finalizeEvent(
    {
      kind: options.kind ?? 24133,
      created_at: 1_700_000_001,
      tags: [["p", CLIENT_PUBKEY]],
      content: options.content ?? encrypt(JSON.stringify(body), signerSide()),
    },
    hexToBytes(options.key ?? SIGNER_KEY),
  );
  return JSON.parse(JSON.stringify(event));
}

describe("openNip46Session", () => {
  it("クライアントの公開鍵と、署名者の鍵から導いた会話鍵と同じ会話鍵を返す", () => {
    const s = session();
    expect(s.clientPubkey).toBe(CLIENT_PUBKEY);
    expect(s.signerPubkey).toBe(SIGNER_PUBKEY);
    expect(s.conversationKey).toEqual(signerSide());
  });

  it.each([
    [
      "クライアントの鍵が大文字",
      "A".repeat(64),
      SIGNER_PUBKEY,
      "Client key is not 64 lowercase hex characters",
    ],
    [
      "クライアントの鍵が 63 桁",
      "1".repeat(63),
      SIGNER_PUBKEY,
      "Client key is not 64 lowercase hex characters",
    ],
    [
      "クライアントの鍵が 0",
      "00".repeat(32),
      SIGNER_PUBKEY,
      "is not a valid key",
    ],
    [
      "署名者の公開鍵が hex でない",
      CLIENT_KEY,
      "zz".repeat(32),
      "Signer public key is not 64 lowercase hex characters",
    ],
    [
      "署名者の公開鍵が大文字",
      CLIENT_KEY,
      SIGNER_PUBKEY.toUpperCase(),
      "Signer public key is not 64 lowercase hex characters",
    ],
    [
      "署名者の公開鍵が 65 桁",
      CLIENT_KEY,
      `${SIGNER_PUBKEY}0`,
      "Signer public key is not 64 lowercase hex characters",
    ],
    [
      "署名者の公開鍵が曲線上に無い",
      CLIENT_KEY,
      "05".repeat(32),
      "is not a valid key",
    ],
  ])(
    "%s と失敗を返し、メッセージに鍵を含めない",
    (_name, clientKey, signer, message) => {
      const result = openNip46Session(clientKey, signer);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.message).toContain(message);
      expect(result.message).not.toContain(clientKey);
      expect(result.message).not.toContain(signer);
    },
  );
});

describe("buildNip46Request", () => {
  it("p タグ付きの kind 24133 を、クライアントの鍵で署名して作る", () => {
    const event = request();
    expect(event.kind).toBe(24133);
    expect(event.pubkey).toBe(CLIENT_PUBKEY);
    expect(event.tags).toEqual([["p", SIGNER_PUBKEY]]);
    expect(event.created_at).toBe(1_700_000_000);
    expect(JSON.stringify(event)).not.toContain(CLIENT_KEY);
  });

  it("署名者の鍵で復号すると id、method、params が出る", () => {
    const params = ["", "日本語", "🎉", 'a"b\\c\n'];
    const event = request(params, "sign_event");
    expect(JSON.parse(decrypt(event.content, signerSide()))).toEqual({
      id: "7",
      method: "sign_event",
      params,
    });
  });

  it("JSON が 65535 バイトちょうどなら作り、1 バイト超えたら失敗を返す", () => {
    const base = new TextEncoder().encode(
      JSON.stringify({ id: "7", method: "sign_event", params: [""] }),
    ).length;
    const fits = request(["x".repeat(65535 - base)], "sign_event");
    expect(
      JSON.parse(decrypt(fits.content, signerSide())).params[0],
    ).toHaveLength(65535 - base);
    const over = buildNip46Request(
      session(),
      { id: "7", method: "sign_event", params: ["x".repeat(65536 - base)] },
      NOW,
    );
    expect(over).toEqual({
      ok: false,
      message: "Request is 65536 bytes; NIP-44 allows 65535",
    });
  });
});

describe("fitsNip46Request", () => {
  it("JSON が 65535 バイトちょうどなら真、1 バイト超えたら偽を返す", () => {
    const base = new TextEncoder().encode(
      JSON.stringify({ id: "7", method: "sign_event", params: [""] }),
    ).length;
    const of = (length: number) => ({
      id: "7",
      method: "sign_event",
      params: ["x".repeat(length)],
    });

    expect(fitsNip46Request(of(65535 - base))).toBe(true);
    expect(fitsNip46Request(of(65536 - base))).toBe(false);
  });
});

describe("readNip46Response", () => {
  it("result を持つ応答を返す", () => {
    expect(
      readNip46Response(session(), reply({ id: "7", result: "ack" })),
    ).toEqual({
      ok: true,
      response: { id: "7", result: "ack", error: undefined },
    });
  });

  it("error を持つ応答と、null の result を返す", () => {
    expect(
      readNip46Response(
        session(),
        reply({ id: "8", result: null, error: "denied" }),
      ),
    ).toEqual({
      ok: true,
      response: { id: "8", result: undefined, error: "denied" },
    });
  });

  const valid = reply({ id: "7", result: "ack" });
  const tampered = (patch: Partial<NostrEvent>): NostrEvent => ({
    ...valid,
    ...patch,
  });
  const flipped = valid.content.replace(
    /^(.{20})(.)/,
    (_m, head, c) => `${head}${c === "A" ? "B" : "A"}`,
  );

  it.each<[string, unknown, string]>([
    ["オブジェクトでない", "event", "Not a well-formed event"],
    ["null", null, "Not a well-formed event"],
    [
      "kind が違う",
      reply({ id: "7" }, { kind: 1 }),
      "Event is kind 1, not 24133",
    ],
    [
      "署名者以外の公開鍵",
      reply({ id: "7" }, { key: THIRD_KEY }),
      "Event is not from the signer",
    ],
    ["クライアント自身の要求", request(), "Event is not from the signer"],
    [
      "content が長すぎる",
      reply({}, { content: "a".repeat(87473) }),
      "Event content is too long",
    ],
    [
      "署名が壊れている",
      tampered({
        sig: `${valid.sig[0] === "0" ? "1" : "0"}${valid.sig.slice(1)}`,
      }),
      "Event signature is not valid",
    ],
    [
      "content が id と合わない",
      tampered({ content: reply({ id: "9" }).content }),
      "Event signature is not valid",
    ],
    [
      "暗号文が壊れている",
      reply({}, { content: flipped }),
      "Event content is not NIP-44 encrypted JSON",
    ],
    [
      "NIP-04 の暗号文",
      reply({}, { content: "Zm9vYmFy?iv=YmF6cXV4" }),
      "Event content is not NIP-44 encrypted JSON",
    ],
    [
      "別の会話鍵",
      reply(
        {},
        {
          content: encrypt(
            JSON.stringify({ id: "7" }),
            getConversationKey(
              hexToBytes(SIGNER_KEY),
              getPublicKey(hexToBytes(THIRD_KEY)),
            ),
          ),
        },
      ),
      "Event content is not NIP-44 encrypted JSON",
    ],
    [
      "JSON でない",
      reply({}, { content: encrypt("not json", signerSide()) }),
      "Event content is not NIP-44 encrypted JSON",
    ],
    ["JSON が数", reply(1), "Response is not a JSON object"],
    ["JSON が null", reply(null), "Response is not a JSON object"],
    ["JSON が配列", reply([]), "Response has an unexpected shape"],
    ["id が無い", reply({ result: "ack" }), "Response has an unexpected shape"],
    ["id が空", reply({ id: "" }), "Response has an unexpected shape"],
    ["id が数", reply({ id: 7 }), "Response has an unexpected shape"],
    [
      "result が数",
      reply({ id: "7", result: 1 }),
      "Response has an unexpected shape",
    ],
    [
      "error がオブジェクト",
      reply({ id: "7", error: { code: 1 } }),
      "Response has an unexpected shape",
    ],
  ])("%s と失敗を返す", (_name, event, message) => {
    expect(readNip46Response(session(), event)).toEqual({
      ok: false,
      message,
    });
  });
});
