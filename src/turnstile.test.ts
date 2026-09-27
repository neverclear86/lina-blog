import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SECRET = "1x0000000000000000000000000000000AA";

/** Returns a `fetch` stub that answers every call with `body` as JSON. */
const stubFetch = (body: unknown, init?: ResponseInit) =>
  vi.fn<typeof fetch>(async () => Response.json(body, init));

/** Returns the form fields sent in the `index`-th call of the stub. */
const sentForm = (fetchImpl: ReturnType<typeof stubFetch>, index = 0) =>
  Object.fromEntries(fetchImpl.mock.calls[index]?.[1]?.body as URLSearchParams);

describe("verifyTurnstile", () => {
  it("siteverify が success: true を返すと成功を返し、secret と response と remoteip を POST で送る", async () => {
    const fetchImpl = stubFetch({ success: true, "error-codes": [] });

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET, remoteIp: "203.0.113.7" },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(SITEVERIFY_URL);
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(sentForm(fetchImpl)).toEqual({
      secret: SECRET,
      response: "token-1",
      remoteip: "203.0.113.7",
    });
  });

  it.each([undefined, ""])(
    "送信元 IP が %j のときは remoteip を送らない",
    async (remoteIp) => {
      const fetchImpl = stubFetch({ success: true });

      await verifyTurnstile(
        { token: "token-1", secret: SECRET, remoteIp },
        fetchImpl,
      );

      expect(sentForm(fetchImpl)).toEqual({
        secret: SECRET,
        response: "token-1",
      });
    },
  );

  it.each([undefined, null, ""])(
    "トークンが %j のときは siteverify を呼ばずに missing-token を返す",
    async (token) => {
      const fetchImpl = stubFetch({ success: true });

      const result = await verifyTurnstile(
        { token, secret: SECRET },
        fetchImpl,
      );

      expect(result).toEqual({ ok: false, reason: "missing-token" });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("siteverify が success: false を返すと rejected とエラーコードを返す", async () => {
    const fetchImpl = stubFetch({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      reason: "rejected",
      errorCodes: ["invalid-input-response"],
    });
  });

  it("error-codes に文字列でない要素があると、文字列の要素だけを errorCodes に残す", async () => {
    const fetchImpl = stubFetch({
      success: false,
      "error-codes": ["invalid-input-response", 1, null],
    });

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      reason: "rejected",
      errorCodes: ["invalid-input-response"],
    });
  });

  it("success が true でなくエラーコードも無い応答は、空のエラーコードで rejected を返す", async () => {
    const fetchImpl = stubFetch({});

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET },
      fetchImpl,
    );

    expect(result).toEqual({ ok: false, reason: "rejected", errorCodes: [] });
  });

  it("siteverify への通信が例外で失敗すると unavailable を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network error");
    });

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET },
      fetchImpl,
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("siteverify が 2xx 以外を返すと unavailable を返す", async () => {
    const fetchImpl = stubFetch({ success: true }, { status: 500 });

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET },
      fetchImpl,
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("siteverify の応答が JSON でないと unavailable を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("<html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );

    const result = await verifyTurnstile(
      { token: "token-1", secret: SECRET },
      fetchImpl,
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
