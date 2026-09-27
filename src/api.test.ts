import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import api, { type ApiEnv } from "./api";
import { type TurnstileVerification, verifyTurnstile } from "./turnstile";

vi.mock("./turnstile", () => ({ verifyTurnstile: vi.fn() }));

describe("api", () => {
  it("GET /api/health は 200 と { ok: true } を返す", async () => {
    const res = await api.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("定義していないパスは 404 を返す", async () => {
    const res = await api.request("/api/unknown");
    expect(res.status).toBe(404);
  });

  it("GET / は Accept-Language が en なら /en/ にリダイレクトする", async () => {
    const res = await api.request("/", {
      headers: { "Accept-Language": "en" },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/en/");
    expect(res.headers.get("Vary")).toBe("Accept-Language");
  });

  it("GET / は Accept-Language が無ければ /ja/ にリダイレクトする", async () => {
    const res = await api.request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/ja/");
    expect(res.headers.get("Vary")).toBe("Accept-Language");
  });
});

describe("POST /api/contact", () => {
  const IP = "203.0.113.7";
  const FIELDS: Record<string, string> = {
    kind: "work",
    name: "創好リナ",
    email: "sender@example.com",
    message: "本文の1行目\n2行目",
    "cf-turnstile-response": "token-xyz",
  };

  let send: Mock<ApiEnv["Bindings"]["CONTACT_MAIL"]["send"]>;

  function envWith(
    overrides: Partial<ApiEnv["Bindings"]> = {},
  ): ApiEnv["Bindings"] {
    return {
      CONTACT_MAIL: { send },
      CONTACT_MAIL_TO: "owner@example.com",
      TURNSTILE_SECRET_KEY: "secret-1",
      ...overrides,
    };
  }

  async function post(
    fields: Record<string, string> = FIELDS,
    env: ApiEnv["Bindings"] = envWith(),
  ): Promise<Response> {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      body.set(key, value);
    }
    return await api.request(
      "/api/contact",
      { method: "POST", body, headers: { "CF-Connecting-IP": IP } },
      env,
    );
  }

  beforeEach(() => {
    send = vi
      .fn<ApiEnv["Bindings"]["CONTACT_MAIL"]["send"]>()
      .mockResolvedValue(undefined);
    vi.mocked(verifyTurnstile).mockReset().mockResolvedValue({ ok: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正しい送信は Turnstile を検証して通知を送り、200 と { ok: true } を返す", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: "token-xyz",
      secret: "secret-1",
      remoteIp: IP,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "owner@example.com",
      subject: "[ikili.pro] お仕事のご相談: 創好リナ",
      replyTo: { name: "創好リナ", email: "sender@example.com" },
    });
  });

  it("不正な入力は Turnstile も送信も行わず、400 と項目ごとのエラーを返す", async () => {
    const res = await post({ ...FIELDS, kind: "spam", email: "x" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid",
      fields: { kind: "invalid", email: "invalid" },
    });
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each<TurnstileVerification>([
    { ok: false, reason: "missing-token" },
    { ok: false, reason: "rejected", errorCodes: ["invalid-input-response"] },
  ])("Turnstile が $reason なら送らずに 403 を返す", async (verification) => {
    vi.mocked(verifyTurnstile).mockResolvedValue(verification);
    const res = await post();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "turnstile" });
    expect(send).not.toHaveBeenCalled();
  });

  it("siteverify に届かなければ送らずに 503 を返す", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });
    const res = await post();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "failed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("送信が失敗すると 500 を返す", async () => {
    send.mockRejectedValue(new Error("x"));
    const res = await post();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "failed" });
  });

  it("CONTACT_MAIL_TO が無ければ送らずに 500 を返す", async () => {
    const res = await post(FIELDS, envWith({ CONTACT_MAIL_TO: undefined }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "failed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("TURNSTILE_SECRET_KEY が無ければ検証も送信もせずに 500 を返す", async () => {
    const res = await post(
      FIELDS,
      envWith({ TURNSTILE_SECRET_KEY: undefined }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "failed" });
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("フォームとして読めない本文は 400 を返す", async () => {
    const res = await api.request(
      "/api/contact",
      {
        method: "POST",
        body: "garbage",
        headers: { "Content-Type": "multipart/form-data; boundary=x" },
      },
      envWith(),
    );
    expect(res.status).toBe(400);
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("トークンが無い送信は token を undefined で渡す", async () => {
    const { "cf-turnstile-response": _, ...withoutToken } = FIELDS;
    await post(withoutToken);
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: undefined,
      secret: "secret-1",
      remoteIp: IP,
    });
  });

  it("ログに送信者の名前、アドレス、本文、IP を残さない", async () => {
    await post(FIELDS, envWith({ TURNSTILE_SECRET_KEY: undefined }));
    vi.mocked(verifyTurnstile).mockResolvedValueOnce({
      ok: false,
      reason: "unavailable",
    });
    await post();
    vi.mocked(verifyTurnstile).mockResolvedValueOnce({
      ok: false,
      reason: "rejected",
      errorCodes: ["invalid-input-response"],
    });
    await post();
    send.mockRejectedValueOnce(new Error("x"));
    await post();

    const calls = (["error", "warn", "log", "info"] as const).flatMap(
      (method) => vi.mocked(console[method]).mock.calls,
    );
    expect(calls.length).toBeGreaterThan(0);
    const logged = JSON.stringify(calls);
    for (const secret of [
      "創好リナ",
      "sender@example.com",
      "本文の1行目",
      IP,
    ]) {
      expect(logged).not.toContain(secret);
    }
  });

  it("ログは 4 か所だけで、文言が固定である", async () => {
    await post({ ...FIELDS, kind: "spam" });
    vi.mocked(verifyTurnstile).mockResolvedValueOnce({
      ok: false,
      reason: "missing-token",
    });
    await post();
    for (const method of ["error", "warn", "log", "info"] as const) {
      expect(console[method]).not.toHaveBeenCalled();
    }

    await post(FIELDS, envWith({ TURNSTILE_SECRET_KEY: undefined }));
    vi.mocked(verifyTurnstile).mockResolvedValueOnce({
      ok: false,
      reason: "unavailable",
    });
    await post();
    vi.mocked(verifyTurnstile).mockResolvedValueOnce({
      ok: false,
      reason: "rejected",
      errorCodes: ["invalid-input-response"],
    });
    await post();
    send.mockRejectedValueOnce(new Error("x"));
    await post();

    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["contact: TURNSTILE_SECRET_KEY is not set"],
      ["contact: siteverify is unavailable"],
      ["contact: send failed (Error)"],
    ]);
    expect(vi.mocked(console.warn).mock.calls).toEqual([
      ["contact: turnstile rejected (invalid-input-response)"],
    ]);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
});
