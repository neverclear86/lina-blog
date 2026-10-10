import { readFileSync } from "node:fs";
import { verifyEvent } from "nostr-tools/pure";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleEventTemplate } from "./article-event";
import {
  AUTHOR_PUBKEY,
  BUNKER_RELAY,
  BUNKER_URL,
  CLIENT_KEY,
  FakeNostrSocket,
  nostr,
  SIGNER_PUBKEY,
  WRITE_RELAYS,
} from "./fake-nostr";
import {
  fitsBunkerRequest,
  NOSTR_MAX_RELAYS,
  type NostrConfig,
  publishToNostr,
  readNostrConfig,
} from "./nostr-publish";

const NOW = new Date(1_700_000_000_999);

const TEMPLATE: ArticleEventTemplate = {
  kind: 30023,
  created_at: 1_700_000_000,
  tags: [
    ["d", "hello"],
    ["published_at", "1699999000"],
  ],
  content: "body",
};

const INDEX_RELAYS = ["wss://index-a.example", "wss://index-b.example"];

/** The config that {@link readNostrConfig} makes from the fake bunker's URL. */
function configOf(indexRelays?: string): NostrConfig {
  const result = readNostrConfig({
    NOSTR_CLIENT_KEY: CLIENT_KEY,
    NOSTR_BUNKER_URL: BUNKER_URL,
    NOSTR_INDEX_RELAYS: indexRelays ?? INDEX_RELAYS.join(","),
  });
  if (!result.ok) throw new Error(result.message);
  return result.config;
}

beforeEach(() => {
  nostr.reset();
  vi.stubGlobal("WebSocket", FakeNostrSocket);
});

describe("readNostrConfig", () => {
  it("bunker URL の公開鍵・リレー・secret から設定を作る", () => {
    const config = configOf();

    expect(config.session.signerPubkey).toBe(SIGNER_PUBKEY);
    expect(config.bunkerRelays).toEqual([BUNKER_RELAY]);
    expect(config.secret).toBe("s3cret");
    expect(config.indexRelays).toEqual(INDEX_RELAYS);
  });

  it("NOSTR_INDEX_RELAYS の先頭の NOSTR_MAX_RELAYS 本だけを読み出し先にする", () => {
    const many = Array.from(
      { length: NOSTR_MAX_RELAYS + 2 },
      (_, i) => `wss://index-${i}.example`,
    );

    expect(configOf(many.join(",")).indexRelays).toEqual(
      many.slice(0, NOSTR_MAX_RELAYS),
    );
  });

  it.each([
    {
      name: "bunker URL が無い",
      env: { NOSTR_CLIENT_KEY: CLIENT_KEY },
      message: "The bunker URL is not set.",
    },
    {
      name: "bunker URL の形が違う",
      env: {
        NOSTR_CLIENT_KEY: CLIENT_KEY,
        NOSTR_BUNKER_URL: "bunker://s3cret",
      },
      message: "The bunker URL must have a public key",
    },
    {
      name: "クライアント鍵が無い",
      env: { NOSTR_BUNKER_URL: BUNKER_URL },
      message: "NOSTR_CLIENT_KEY is not set.",
    },
    {
      name: "クライアント鍵の形が違う",
      env: { NOSTR_CLIENT_KEY: "s3cret", NOSTR_BUNKER_URL: BUNKER_URL },
      message: "Client key is not 64 lowercase hex characters",
    },
  ])("$name なら秘密を含まない message で失敗する", ({ env, message }) => {
    const result = readNostrConfig(env);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(message);
    expect(result.message).not.toContain("s3cret");
  });

  it(".dev.vars.example の NOSTR_* で readNostrConfig が成功する", () => {
    const text = readFileSync(
      new URL("../.dev.vars.example", import.meta.url),
      "utf8",
    );
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const match = /^(NOSTR_[A-Z_]+)=(.*)$/.exec(line);
      if (match) env[match[1]] = match[2];
    }

    expect(readNostrConfig(env).ok).toBe(true);
  });
});

describe("publishToNostr", () => {
  it("get_public_key の公開鍵の write リレーに投稿し、1 本の受理で ID を返す（署名者と投稿者の鍵が違う）", async () => {
    nostr.accepts = { [WRITE_RELAYS[0]]: false };
    const result = await publishToNostr(TEMPLATE, configOf(), NOW);

    expect(AUTHOR_PUBKEY).not.toBe(SIGNER_PUBKEY);
    expect(nostr.methods).toEqual(["get_public_key", "sign_event"]);
    expect(nostr.queries.map((query) => query.filter.authors)).toEqual([
      [AUTHOR_PUBKEY],
      [AUTHOR_PUBKEY],
    ]);
    expect(nostr.posted.map((post) => post.relay)).toEqual(WRITE_RELAYS);
    const [{ event }] = nostr.posted;
    expect(verifyEvent(event)).toBe(true);
    expect(event.pubkey).toBe(AUTHOR_PUBKEY);
    expect(event.tags).toEqual(TEMPLATE.tags);
    expect(result).toEqual({ ok: true, eventId: event.id });
    expect(nostr.open).toBe(0);
  });

  it("署名者が知らない client なら、公開と取り下げの両方の署名の権限で connect を送る", async () => {
    nostr.known = false;

    const result = await publishToNostr(TEMPLATE, configOf(), NOW);

    expect(result.ok).toBe(true);
    expect(nostr.connects).toEqual([
      [SIGNER_PUBKEY, "s3cret", "sign_event:30023,sign_event:5"],
    ]);
  });

  it("write リレーが NOSTR_MAX_RELAYS を超えても先頭のその本数にだけ送り、同時接続は 6 以下", async () => {
    nostr.writeRelays = Array.from(
      { length: NOSTR_MAX_RELAYS + 3 },
      (_, i) => `wss://write-${i}.example`,
    );
    const many = Array.from(
      { length: NOSTR_MAX_RELAYS + 3 },
      (_, i) => `wss://index-${i}.example`,
    );

    const result = await publishToNostr(
      TEMPLATE,
      configOf(many.join(",")),
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(nostr.posted.map((post) => post.relay)).toEqual(
      nostr.writeRelays.slice(0, NOSTR_MAX_RELAYS),
    );
    expect(nostr.queries.map((query) => query.relay)).toEqual(
      many.slice(0, NOSTR_MAX_RELAYS),
    );
    expect(nostr.peak).toBeLessThanOrEqual(6);
  });

  it("署名できなければ失敗にし、リレーの一覧を読まない", async () => {
    nostr.signError = "denied";

    const result = await publishToNostr(TEMPLATE, configOf(), NOW);

    expect(result).toEqual({
      ok: false,
      message: "Signing failed: sign_event: denied",
    });
    expect(nostr.urls).toEqual([BUNKER_RELAY]);
  });

  it("リレーの一覧が無ければ失敗", async () => {
    nostr.writeRelays = null;

    const result = await publishToNostr(TEMPLATE, configOf(), NOW);

    expect(result).toEqual({
      ok: false,
      message: `No relay list (kind 10002) found for ${AUTHOR_PUBKEY}.`,
    });
    expect(nostr.posted).toEqual([]);
  });

  it("write リレーが無ければ失敗にし、投稿しない", async () => {
    nostr.writeRelays = [];

    const result = await publishToNostr(TEMPLATE, configOf(), NOW);

    expect(result).toEqual({
      ok: false,
      message: `The relay list of ${AUTHOR_PUBKEY} has no write relay.`,
    });
    expect(nostr.posted).toEqual([]);
  });

  it("どのリレーも受理しなければ、リレーごとの理由（100 文字まで）を添えて失敗", async () => {
    nostr.accepts = { [WRITE_RELAYS[0]]: false, [WRITE_RELAYS[1]]: false };
    nostr.okMessages = {
      [WRITE_RELAYS[0]]: "blocked: not allowed",
      [WRITE_RELAYS[1]]: "x".repeat(150),
    };

    const result = await publishToNostr(TEMPLATE, configOf(), NOW);

    expect(result).toEqual({
      ok: false,
      message: `No relay accepted the event. ${WRITE_RELAYS[0]}: blocked: not allowed; ${WRITE_RELAYS[1]}: ${"x".repeat(100)}`,
    });
  });
});

describe("fitsBunkerRequest", () => {
  it("1 つの NIP-46 要求に収まる記事は真を返す", () => {
    expect(
      fitsBunkerRequest({ ...TEMPLATE, content: "x".repeat(60_000) }),
    ).toBe(true);
  });

  it('本文の " が 2 重に逃がされて 65535 バイトを超える記事は偽を返す', () => {
    const content = '"'.repeat(20_000);

    expect(content.length).toBeLessThan(65_535);
    expect(fitsBunkerRequest({ ...TEMPLATE, content })).toBe(false);
  });
});
