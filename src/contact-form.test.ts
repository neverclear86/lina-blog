import { describe, expect, it } from "vitest";
import {
  type ContactFormState,
  contactFieldMessage,
  contactStateBeforeSend,
  contactStateFromFetch,
  contactStateMessage,
  turnstileSize,
} from "./contact-form";

/** A fetch result whose body is `body` (a string is sent as is, anything else as JSON). */
function json(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("contactStateFromFetch", () => {
  it('200 の {"ok":true} は完了になる', async () => {
    expect(await contactStateFromFetch(json(200, { ok: true }))).toEqual({
      state: "sent",
    });
  });

  it("400 の fields は項目ごとの符号を持つ入力の誤りになる", async () => {
    const fields = {
      kind: "required",
      name: "newline",
      email: "invalid",
      message: "too_long",
    };
    expect(
      await contactStateFromFetch(
        json(400, { ok: false, error: "invalid", fields }),
      ),
    ).toEqual({ state: "invalid", fields });
  });

  it("400 の fields のうち知らない項目と符号は捨てる", async () => {
    expect(
      await contactStateFromFetch(
        json(400, {
          ok: false,
          error: "invalid",
          fields: { email: "invalid", phone: "required", name: "bogus" },
        }),
      ),
    ).toEqual({ state: "invalid", fields: { email: "invalid" } });
  });

  it("400 の fields に使える項目が無ければ送信の失敗になる", async () => {
    expect(
      await contactStateFromFetch(
        json(400, { ok: false, error: "invalid", fields: {} }),
      ),
    ).toEqual({ state: "failed" });
  });

  it("400 に fields が無ければ送信の失敗になる", async () => {
    expect(
      await contactStateFromFetch(json(400, { ok: false, error: "invalid" })),
    ).toEqual({ state: "failed" });
  });

  it("403 は Turnstile のやり直しになる", async () => {
    expect(
      await contactStateFromFetch(json(403, { ok: false, error: "turnstile" })),
    ).toEqual({ state: "turnstile" });
  });

  it('500 の {"error":"failed"} は送信の失敗になる', async () => {
    expect(
      await contactStateFromFetch(json(500, { ok: false, error: "failed" })),
    ).toEqual({ state: "failed" });
  });

  it('503 の {"error":"failed"} は送信の失敗になる', async () => {
    expect(
      await contactStateFromFetch(json(503, { ok: false, error: "failed" })),
    ).toEqual({ state: "failed" });
  });

  it("JSON でない応答は送信の失敗になる", async () => {
    expect(await contactStateFromFetch(json(502, "<html>"))).toEqual({
      state: "failed",
    });
  });

  it("JSON の null は送信の失敗になる", async () => {
    expect(await contactStateFromFetch(json(200, null))).toEqual({
      state: "failed",
    });
  });

  it("fetch が投げたら通信の失敗になる", async () => {
    expect(
      await contactStateFromFetch(
        Promise.reject(new TypeError("Failed to fetch")),
      ),
    ).toEqual({ state: "network" });
  });
});

describe("contactStateMessage", () => {
  it("待機の状態は空の文言になる", () => {
    expect(contactStateMessage("ja", { state: "idle" })).toBe("");
  });

  it.each<[ContactFormState, string]>([
    [{ state: "invalid", fields: {} }, "入力内容を確かめてください。"],
    [
      { state: "waiting" },
      "確認が終わるまで少し待ってから、もう一度送信してください。",
    ],
    [{ state: "sending" }, "送信中…"],
    [{ state: "sent" }, "送信しました。ありがとうございます！"],
    [{ state: "turnstile" }, "確認に失敗しました。もう一度送信してください。"],
    [
      { state: "failed" },
      "送信できませんでした。時間をおいてもう一度お試しください。",
    ],
    [
      { state: "network" },
      "通信できませんでした。接続を確かめてもう一度お試しください。",
    ],
    [
      { state: "unavailable" },
      "確認を読み込めませんでした。ページを再読み込みしてください。",
    ],
  ])("状態ごとの日本語の文言を返す（%o）", (state, expected) => {
    expect(contactStateMessage("ja", state)).toBe(expected);
  });

  it.each<[ContactFormState, string]>([
    [{ state: "invalid", fields: {} }, "Please check the marked fields."],
    [
      { state: "waiting" },
      "Please wait for the verification to finish, then send again.",
    ],
    [{ state: "sending" }, "Sending…"],
    [{ state: "sent" }, "Sent. Thank you!"],
    [{ state: "turnstile" }, "Verification failed. Please send again."],
    [
      { state: "failed" },
      "Couldn't send your message. Please try again later.",
    ],
    [
      { state: "network" },
      "Couldn't reach the server. Check your connection and try again.",
    ],
    [
      { state: "unavailable" },
      "Couldn't load the verification. Please reload the page.",
    ],
  ])("状態ごとの英語の文言を返す（%o）", (state, expected) => {
    expect(contactStateMessage("en", state)).toBe(expected);
  });
});

describe("contactFieldMessage", () => {
  it("ご用件の required は選ぶよう求める", () => {
    expect(contactFieldMessage("ja", "kind", "required")).toBe(
      "選んでください。",
    );
  });

  it("ご用件の required 以外は選択肢から選ぶよう求める", () => {
    for (const code of ["invalid", "too_long", "newline"] as const) {
      expect(contactFieldMessage("ja", "kind", code)).toBe(
        "選択肢から選んでください。",
      );
    }
  });

  it("required は入力を求める", () => {
    expect(contactFieldMessage("ja", "name", "required")).toBe(
      "入力してください。",
    );
  });

  it("メールアドレスの invalid は形式を求める", () => {
    expect(contactFieldMessage("ja", "email", "invalid")).toBe(
      "メールアドレスの形式で入力してください。",
    );
  });

  it("お名前と内容の invalid は汎用の文言になる", () => {
    expect(contactFieldMessage("ja", "message", "invalid")).toBe(
      "正しい形式で入力してください。",
    );
  });

  it("too_long は CONTACT_LIMITS の上限を埋め込む", () => {
    expect(contactFieldMessage("ja", "message", "too_long")).toBe(
      "5000 文字以内で入力してください。",
    );
    expect(contactFieldMessage("en", "name", "too_long")).toBe(
      "Use 100 characters or fewer.",
    );
  });

  it("newline は改行を除くよう求める", () => {
    expect(contactFieldMessage("ja", "name", "newline")).toBe(
      "改行を入れずに入力してください。",
    );
  });

  it.each([
    ["kind", "required", "Please choose one."],
    ["kind", "invalid", "Choose one of the options."],
    ["name", "required", "This field is required."],
    ["email", "invalid", "Enter a valid email address."],
    ["message", "invalid", "Enter a valid value."],
    ["message", "too_long", "Use 5000 characters or fewer."],
    ["email", "newline", "Remove the line breaks."],
  ] as const)(
    "項目ごとの英語の文言を返す（%s、%s）",
    (field, code, expected) => {
      expect(contactFieldMessage("en", field, code)).toBe(expected);
    },
  );
});

describe("contactStateBeforeSend", () => {
  const valid = {
    kind: "work",
    name: "Lina",
    email: "you@example.com",
    message: "Hello",
    "cf-turnstile-response": "token",
  };

  it("入力に誤りがあれば Turnstile の状態によらず項目ごとの符号を持つ入力の誤りになる", () => {
    expect(
      contactStateBeforeSend(
        { ...valid, name: "", email: "lina" },
        { failed: true, token: undefined },
      ),
    ).toEqual({
      state: "invalid",
      fields: { name: "required", email: "invalid" },
    });
  });

  it("Turnstile の読み込みに失敗していれば、トークンが無くても確認の読み込みの失敗になる", () => {
    expect(
      contactStateBeforeSend(valid, { failed: true, token: undefined }),
    ).toEqual({ state: "unavailable" });
  });

  it.each([undefined, ""])("トークンが %j ならトークン待ちになる", (token) => {
    expect(contactStateBeforeSend(valid, { failed: false, token })).toEqual({
      state: "waiting",
    });
  });

  it("入力が正しくトークンがあれば送信中になる", () => {
    expect(
      contactStateBeforeSend(valid, { failed: false, token: "token" }),
    ).toEqual({ state: "sending" });
  });
});

describe("turnstileSize", () => {
  it.each([
    [300, "flexible"],
    [560, "flexible"],
    [299, "compact"],
  ])("幅 %ipx は %s になる", (width, size) => {
    expect(turnstileSize(width)).toBe(size);
  });
});
