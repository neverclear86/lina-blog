import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_INDEX_RELAYS,
  fetchWriteRelays,
  parseRelayUrls,
  publishToRelays,
} from "./nostr-relays";

type RelayHandler = (request: unknown[], socket: FakeRelaySocket) => void;

/**
 * Stand-in for the global `WebSocket` that never reaches the network. A relay answers through
 * the handler registered for its URL in `relays`. A URL containing `broken` fails with `error`,
 * and one containing `closing` is closed by the relay before it opens.
 */
class FakeRelaySocket extends EventTarget {
  static relays = new Map<string, RelayHandler>();
  static sockets: FakeRelaySocket[] = [];
  static openCount = 0;
  static peak = 0;

  readonly url: string;
  readonly sent: unknown[][] = [];
  closed = false;

  constructor(url: string) {
    super();
    if (!/^wss?:\/\//.test(url)) {
      throw new SyntaxError(`Invalid URL: ${url}`);
    }
    this.url = url;
    FakeRelaySocket.sockets.push(this);
    FakeRelaySocket.openCount += 1;
    FakeRelaySocket.peak = Math.max(
      FakeRelaySocket.peak,
      FakeRelaySocket.openCount,
    );
    queueMicrotask(() => {
      if (url.includes("broken")) {
        this.dispatchEvent(new Event("error"));
      } else if (url.includes("closing")) {
        this.dispatchEvent(new Event("close"));
      } else {
        this.dispatchEvent(new Event("open"));
      }
    });
  }

  send(data: string): void {
    const request = JSON.parse(data) as unknown[];
    this.sent.push(request);
    FakeRelaySocket.relays.get(this.url)?.(request, this);
  }

  reply(message: unknown): void {
    this.replyRaw(JSON.stringify(message));
  }

  replyRaw(data: string): void {
    queueMicrotask(() => {
      if (!this.closed) {
        this.dispatchEvent(new MessageEvent("message", { data }));
      }
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    FakeRelaySocket.openCount -= 1;
  }

  static reset(): void {
    FakeRelaySocket.relays = new Map();
    FakeRelaySocket.sockets = [];
    FakeRelaySocket.openCount = 0;
    FakeRelaySocket.peak = 0;
  }
}

const PUBKEY = "a".repeat(64);

/** Relay list (kind 10002) of {@link PUBKEY}. */
function relayList(
  tags: unknown[],
  createdAt = 100,
  id = "1".repeat(64),
): Record<string, unknown> {
  return { id, pubkey: PUBKEY, created_at: createdAt, kind: 10002, tags };
}

/** Makes `url` answer a `REQ` with `events` followed by `EOSE`. */
function serveRelayList(url: string, ...events: unknown[]): void {
  FakeRelaySocket.relays.set(url, (request, socket) => {
    for (const event of events) {
      socket.reply(["EVENT", request[1], event]);
    }
    socket.reply(["EOSE", request[1]]);
  });
}

/** Makes `url` answer an `EVENT` with `OK`. */
function answerOk(url: string, accepted: boolean, message = ""): void {
  FakeRelaySocket.relays.set(url, (request, socket) => {
    const event = request[1] as { id: string };
    socket.reply(["OK", event.id, accepted, message]);
  });
}

/** Returns the sockets opened to `url`. */
function socketsTo(url: string): FakeRelaySocket[] {
  return FakeRelaySocket.sockets.filter((socket) => socket.url === url);
}

const EVENT = { id: "e".repeat(64), kind: 30023, content: "" };

beforeEach(() => {
  FakeRelaySocket.reset();
  vi.stubGlobal("WebSocket", FakeRelaySocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseRelayUrls", () => {
  it.each([undefined, "", " , "])("%j なら既定の読み出し先を返す", (value) => {
    expect(parseRelayUrls(value)).toEqual(DEFAULT_INDEX_RELAYS);
  });

  it("カンマで区切り、前後の空白と空の項目を落とす", () => {
    expect(parseRelayUrls(" wss://a.example ,,wss://b.example ")).toEqual([
      "wss://a.example",
      "wss://b.example",
    ]);
  });
});

describe("fetchWriteRelays", () => {
  it.each(["EOSE", "CLOSED"])(
    "kind 10002 と公開鍵で REQ を送り、%s で閉じる",
    async (end) => {
      const url = "wss://index.example";
      FakeRelaySocket.relays.set(url, (request, socket) => {
        socket.reply([
          "EVENT",
          request[1],
          relayList([["r", "wss://write.example"]]),
        ]);
        socket.reply([end, request[1]]);
      });

      const result = await fetchWriteRelays(PUBKEY, [url]);

      expect(result).toEqual({ ok: true, relays: ["wss://write.example"] });
      const [socket] = socketsTo(url);
      expect(socket.sent).toEqual([
        [
          "REQ",
          expect.any(String),
          { kinds: [10002], authors: [PUBKEY], limit: 1 },
        ],
      ]);
      expect(socket.closed).toBe(true);
    },
  );

  it("r タグの第 3 要素が無いか write のものだけを、重複を除いて返す", async () => {
    serveRelayList(
      "wss://index.example",
      relayList([
        ["r", "wss://a.example"],
        ["r", "wss://read.example", "read"],
        ["r", "ws://c.example", "write"],
        ["r", "wss://a.example", "write"],
        ["r", "https://x.example/wss://"],
        ["p", "wss://p.example"],
      ]),
    );

    const result = await fetchWriteRelays(PUBKEY, ["wss://index.example"]);

    expect(result).toEqual({
      ok: true,
      relays: ["wss://a.example", "ws://c.example"],
    });
  });

  it("複数のリレーのうち created_at が最も新しいイベントを使う", async () => {
    serveRelayList(
      "wss://first.example",
      relayList([["r", "wss://old.example"]], 100),
    );
    serveRelayList(
      "wss://second.example",
      relayList([["r", "wss://new.example"]], 200),
    );

    const result = await fetchWriteRelays(PUBKEY, [
      "wss://first.example",
      "wss://second.example",
    ]);

    expect(result).toEqual({ ok: true, relays: ["wss://new.example"] });
    expect(FakeRelaySocket.peak).toBe(2);
  });

  it("created_at が同じなら id の小さいイベントを使う", async () => {
    serveRelayList(
      "wss://index.example",
      relayList([["r", "wss://two.example"]], 100, "2".repeat(64)),
      relayList([["r", "wss://one.example"]], 100, "1".repeat(64)),
    );

    const result = await fetchWriteRelays(PUBKEY, ["wss://index.example"]);

    expect(result).toEqual({ ok: true, relays: ["wss://one.example"] });
  });

  it("kind や公開鍵の違うイベントは無視する", async () => {
    serveRelayList(
      "wss://index.example",
      relayList([["r", "wss://ok.example"]], 100),
      { ...relayList([["r", "wss://kind.example"]], 200), kind: 3 },
      {
        ...relayList([["r", "wss://pubkey.example"]], 300),
        pubkey: "b".repeat(64),
      },
    );

    const result = await fetchWriteRelays(PUBKEY, ["wss://index.example"]);

    expect(result).toEqual({ ok: true, relays: ["wss://ok.example"] });
  });

  it.each([
    ["null", null],
    ["id が数", { ...relayList([["r", "wss://bad.example"]], 200), id: 1 }],
    [
      "created_at が文字列",
      { ...relayList([["r", "wss://bad.example"]]), created_at: "200" },
    ],
    [
      "tags が配列でない",
      { ...relayList([], 200), tags: { r: "wss://bad.example" } },
    ],
  ])("形の違う kind 10002（%s）は無視する", async (_, malformed) => {
    serveRelayList(
      "wss://index.example",
      relayList([["r", "wss://ok.example"]], 100),
      malformed,
    );

    const result = await fetchWriteRelays(PUBKEY, ["wss://index.example"]);

    expect(result).toEqual({ ok: true, relays: ["wss://ok.example"] });
  });

  it("配列でない tags の要素と URL が文字列でない r タグは読み飛ばす", async () => {
    serveRelayList(
      "wss://index.example",
      relayList([
        null,
        ["r"],
        ["r", ["wss://arr.example"]],
        ["r", "wss://ok.example"],
      ]),
    );

    const result = await fetchWriteRelays(PUBKEY, ["wss://index.example"]);

    expect(result).toEqual({ ok: true, relays: ["wss://ok.example"] });
  });

  it("write の r タグが無ければ成功と空の一覧を返す", async () => {
    serveRelayList(
      "wss://index.example",
      relayList([["r", "wss://read.example", "read"]]),
    );

    const result = await fetchWriteRelays(PUBKEY, ["wss://index.example"]);

    expect(result).toEqual({ ok: true, relays: [] });
  });

  it("どのリレーにも kind 10002 が無ければ失敗を返す", async () => {
    serveRelayList("wss://empty.example");

    const result = await fetchWriteRelays(PUBKEY, [
      "wss://empty.example",
      "wss://broken.example",
    ]);

    expect(result).toEqual({
      ok: false,
      message: `No relay list (kind 10002) found for ${PUBKEY}.`,
    });
  });

  it("応答しないリレーは時間の上限で閉じ、他のリレーの結果を使う", async () => {
    vi.useFakeTimers();
    serveRelayList(
      "wss://index.example",
      relayList([["r", "wss://write.example"]]),
    );

    const pending = fetchWriteRelays(PUBKEY, [
      "wss://index.example",
      "wss://silent.example",
    ]);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result).toEqual({ ok: true, relays: ["wss://write.example"] });
    expect(socketsTo("wss://silent.example")[0].closed).toBe(true);
    expect(FakeRelaySocket.openCount).toBe(0);
  });

  it("EOSE を返さないリレーからも時間の上限までに届いたイベントを使う", async () => {
    vi.useFakeTimers();
    FakeRelaySocket.relays.set("wss://index.example", (request, socket) => {
      socket.reply([
        "EVENT",
        request[1],
        relayList([["r", "wss://write.example"]]),
      ]);
    });

    const pending = fetchWriteRelays(PUBKEY, ["wss://index.example"]);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result).toEqual({ ok: true, relays: ["wss://write.example"] });
    expect(FakeRelaySocket.openCount).toBe(0);
  });
});

describe("publishToRelays", () => {
  it("EVENT を送り、OK の真偽と文をリレーごとに入力の順で返す", async () => {
    answerOk("wss://a.example", true);
    answerOk("wss://b.example", false, "blocked: spam");
    answerOk("wss://c.example", true, "duplicate: already have this event");

    const result = await publishToRelays(EVENT, [
      "wss://a.example",
      "wss://b.example",
      "wss://c.example",
    ]);

    expect(result).toEqual({
      ok: true,
      results: [
        { relay: "wss://a.example", accepted: true, message: "" },
        { relay: "wss://b.example", accepted: false, message: "blocked: spam" },
        {
          relay: "wss://c.example",
          accepted: true,
          message: "duplicate: already have this event",
        },
      ],
    });
    expect(socketsTo("wss://a.example")[0].sent).toEqual([["EVENT", EVENT]]);
  });

  it("1 つも受理されなければ失敗を返す", async () => {
    answerOk("wss://reject.example", false, "blocked: spam");

    const result = await publishToRelays(EVENT, [
      "wss://reject.example",
      "wss://broken.example",
      "wss://closing.example",
      "https://not-a-relay.example",
    ]);

    expect(result).toEqual({
      ok: false,
      message: "No relay accepted the event.",
      results: [
        {
          relay: "wss://reject.example",
          accepted: false,
          message: "blocked: spam",
        },
        {
          relay: "wss://broken.example",
          accepted: false,
          message: "Connection failed.",
        },
        {
          relay: "wss://closing.example",
          accepted: false,
          message: "Connection closed.",
        },
        {
          relay: "https://not-a-relay.example",
          accepted: false,
          message: "Invalid relay URL.",
        },
      ],
    });
  });

  it("投稿先が無ければ失敗を返す", async () => {
    const result = await publishToRelays(EVENT, []);

    expect(result).toEqual({
      ok: false,
      message: "No relay accepted the event.",
      results: [],
    });
  });

  it("違う id の OK と配列でない応答は無視して待つ", async () => {
    FakeRelaySocket.relays.set("wss://a.example", (_, socket) => {
      socket.replyRaw("not json");
      socket.reply(null);
      socket.reply(["OK", "f".repeat(64), false, "other event"]);
      socket.reply(["OK", EVENT.id, true, "saved"]);
    });

    const result = await publishToRelays(EVENT, ["wss://a.example"]);

    expect(result).toEqual({
      ok: true,
      results: [{ relay: "wss://a.example", accepted: true, message: "saved" }],
    });
  });

  it("OK を返さないリレーは時間の上限で閉じ、受理されなかったとする", async () => {
    vi.useFakeTimers();
    answerOk("wss://a.example", true);

    const pending = publishToRelays(EVENT, [
      "wss://a.example",
      "wss://silent.example",
    ]);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;

    expect(result).toEqual({
      ok: true,
      results: [
        { relay: "wss://a.example", accepted: true, message: "" },
        {
          relay: "wss://silent.example",
          accepted: false,
          message: "Timed out after 5000 ms.",
        },
      ],
    });
    expect(socketsTo("wss://silent.example")[0].closed).toBe(true);
    expect(FakeRelaySocket.openCount).toBe(0);
  });

  it("上限を渡すと先頭のその件数のリレーにだけ送る", async () => {
    const relays = Array.from(
      { length: 8 },
      (_, index) => `wss://r${index}.example`,
    );
    for (const relay of relays) answerOk(relay, true);

    const result = await publishToRelays(EVENT, relays, 3);

    expect(result.results.map((entry) => entry.relay)).toEqual(
      relays.slice(0, 3),
    );
    expect(FakeRelaySocket.peak).toBe(3);
    expect(FakeRelaySocket.sockets).toHaveLength(3);
  });

  it("上限を渡さなければ先頭の 5 件にだけ送る", async () => {
    const relays = Array.from(
      { length: 8 },
      (_, index) => `wss://r${index}.example`,
    );
    for (const relay of relays) answerOk(relay, true);

    await publishToRelays(EVENT, relays);

    expect(FakeRelaySocket.sockets.map((socket) => socket.url)).toEqual(
      relays.slice(0, 5),
    );
  });
});
