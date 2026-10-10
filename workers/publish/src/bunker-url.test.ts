import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBunkerUrl } from "./bunker-url";

const PUBKEY = `${"a".repeat(63)}b`;
const RELAY = "wss://relay.example.com";

describe("parseBunkerUrl", () => {
  it("公開鍵とリレーと secret を返す", () => {
    expect(
      parseBunkerUrl(`bunker://${PUBKEY}?relay=${RELAY}&secret=s3cret`),
    ).toEqual({
      ok: true,
      pubkey: PUBKEY,
      relays: [RELAY],
      secret: "s3cret",
    });
  });

  it("パーセントエンコードされたリレーを復号し、ws:// も受ける", () => {
    const result = parseBunkerUrl(
      `bunker://${PUBKEY}?relay=wss%3A%2F%2Frelay.example.com&relay=ws://127.0.0.1:8080`,
    );
    expect(result).toMatchObject({
      ok: true,
      relays: [RELAY, "ws://127.0.0.1:8080"],
    });
  });

  it("リレーは並びを保ち、重複を一度だけ残す", () => {
    const result = parseBunkerUrl(
      `bunker://${PUBKEY}?relay=wss://b.example&relay=wss://a.example&relay=wss://b.example`,
    );
    expect(result).toMatchObject({
      ok: true,
      relays: ["wss://b.example", "wss://a.example"],
    });
  });

  it("secret が無いか空のときは undefined にする", () => {
    for (const url of [
      `bunker://${PUBKEY}?relay=${RELAY}`,
      `bunker://${PUBKEY}?relay=${RELAY}&secret=`,
    ]) {
      expect(parseBunkerUrl(url)).toMatchObject({
        ok: true,
        secret: undefined,
      });
    }
  });

  it("前後の空白と、知らないパラメーターを無視する", () => {
    expect(
      parseBunkerUrl(`  bunker://${PUBKEY}?name=x&relay=${RELAY}\n`),
    ).toEqual({ ok: true, pubkey: PUBKEY, relays: [RELAY], secret: undefined });
  });

  const NOT_SET = "not set";
  const SCHEME = "must start with bunker://";
  const KEY = "public key";
  const NO_RELAY = "must have a relay";
  const BAD_RELAY = "wss:// or ws://";

  it.each([
    ["未設定", undefined, NOT_SET],
    ["空", "  ", NOT_SET],
    [
      "スキームが違う（nostrconnect://）",
      `nostrconnect://${PUBKEY}?relay=${RELAY}`,
      SCHEME,
    ],
    ["スキームが違う（https://）", `https://${PUBKEY}?relay=${RELAY}`, SCHEME],
    ["公開鍵が 63 桁", `bunker://${"a".repeat(63)}?relay=${RELAY}`, KEY],
    ["公開鍵が 65 桁", `bunker://${"a".repeat(65)}?relay=${RELAY}`, KEY],
    ["公開鍵が hex でない", `bunker://${"g".repeat(64)}?relay=${RELAY}`, KEY],
    ["公開鍵が大文字", `bunker://${"A".repeat(64)}?relay=${RELAY}`, KEY],
    ["公開鍵が無い", `bunker://?relay=${RELAY}`, KEY],
    ["relay が無い", `bunker://${PUBKEY}?secret=s3cret`, NO_RELAY],
    ["クエリが無い", `bunker://${PUBKEY}`, NO_RELAY],
    ["relay が空", `bunker://${PUBKEY}?relay=`, BAD_RELAY],
    [
      "relay が https://",
      `bunker://${PUBKEY}?relay=https://relay.example.com`,
      BAD_RELAY,
    ],
    ["relay が wss:// だけ", `bunker://${PUBKEY}?relay=wss://`, BAD_RELAY],
    [
      "relay の 1 件が wss:// でも ws:// でもない",
      `bunker://${PUBKEY}?relay=${RELAY}&relay=http://relay.example.com`,
      BAD_RELAY,
    ],
  ])("失敗を返す: %s", (_name, value, message) => {
    const result = parseBunkerUrl(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(message);
  });

  it("失敗の message に secret と URL を含めない", () => {
    const value = `bunker://${PUBKEY}?relay=http://relay.example.com&secret=s3cret`;
    const result = parseBunkerUrl(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("s3cret");
      expect(result.message).not.toContain(PUBKEY);
      expect(result.message).not.toContain("relay.example.com");
    }
  });

  it(".dev.vars.example の NOSTR_BUNKER_URL を解析できる", () => {
    const example = readFileSync(
      new URL("../.dev.vars.example", import.meta.url),
      "utf8",
    );
    const value = /^NOSTR_BUNKER_URL=(.*)$/m.exec(example)?.[1];
    expect(parseBunkerUrl(value)).toMatchObject({
      ok: true,
      relays: ["ws://127.0.0.1:7777"],
      secret: "local-dev-bunker-secret",
    });
  });
});
