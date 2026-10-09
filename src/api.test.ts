import { readFileSync } from "node:fs";
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

/**
 * Headers that `secureHeaders()` in `src/api.ts` adds, keyed by lower-case name: Hono's
 * defaults, with `Referrer-Policy` and `X-Frame-Options` set to the values of `public/_headers`.
 */
const SECURITY_HEADERS = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-dns-prefetch-control": "off",
  "x-download-options": "noopen",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
  "x-xss-protection": "0",
};

/**
 * Returns an `ASSETS` binding that serves `files` by path, answers 404 for other paths, and
 * throws for the paths in `broken`.
 */
function assetsWith(
  files: Record<string, string>,
  broken: string[] = [],
): { fetch: Mock<(input: URL) => Promise<Response>> } {
  return {
    fetch: vi.fn(async (input: URL) => {
      if (broken.includes(input.pathname)) {
        throw new TypeError("fetch failed");
      }
      const body = files[input.pathname];
      return body === undefined
        ? new Response(null, { status: 404 })
        : new Response(body);
    }),
  };
}

/** Headers of the `/*` rule in `public/_headers`, keyed by lower-case name. */
function staticHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  let inRule = false;
  for (const line of readFileSync("public/_headers", "utf8").split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inRule = line.trim() === "/*";
      continue;
    }
    if (!inRule) continue;
    const colon = line.indexOf(":");
    headers[line.slice(0, colon).trim().toLowerCase()] = line
      .slice(colon + 1)
      .trim();
  }
  return headers;
}

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
    expect(res.headers.get("Vary")).toBe("User-Agent, Accept-Language");
  });

  it("GET / は Accept-Language が無ければ /ja/ にリダイレクトする", async () => {
    const res = await api.request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/ja/");
    expect(res.headers.get("Vary")).toBe("User-Agent, Accept-Language");
  });

  it("GET / はブラウザの User-Agent なら Accept-Language の言語にリダイレクトする", async () => {
    const res = await api.request("/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "Accept-Language": "en",
      },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/en/");
    expect(res.headers.get("Vary")).toBe("User-Agent, Accept-Language");
  });

  it.each([
    ["ja", "/ja/"],
    ["en", "/en/"],
  ])(
    "GET / は Accept-Language が %s のリダイレクトにもセキュリティヘッダーを付ける",
    async (lang, location) => {
      const res = await api.request("/", {
        headers: { "Accept-Language": lang },
      });
      expect(res.headers.get("Location")).toBe(location);
      expect(Object.fromEntries(res.headers)).toMatchObject(SECURITY_HEADERS);
    },
  );

  it("/api/* の応答にもセキュリティヘッダーを付ける", async () => {
    const res = await api.request("/api/health");
    expect(Object.fromEntries(res.headers)).toMatchObject(SECURITY_HEADERS);
  });

  it("public/_headers の /* は 6 つのセキュリティヘッダーだけを付け、Cache-Control を付けない", () => {
    expect(staticHeaders()).toEqual({
      "content-security-policy": "frame-ancestors 'none'",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "permissions-policy":
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
      "strict-transport-security": "max-age=15552000; includeSubDomains",
    });
  });

  it.each<[string, string, RequestInit]>([
    ["GET /", "/", {}],
    ["GET / (curl)", "/", { headers: { "User-Agent": "curl/8.22.0" } }],
    ["GET /api/health", "/api/health", {}],
    ["GET /api/unknown", "/api/unknown", {}],
    [
      "POST /api/contact",
      "/api/contact",
      { method: "POST", body: new FormData() },
    ],
  ])(
    "%s の応答は public/_headers の /* と同じ値を付ける",
    async (_name, path, init) => {
      const res = await api.request(path, init, {
        ASSETS: assetsWith({ "/text/ja.txt": "x" }),
        CONTACT_MAIL: { send: vi.fn() },
      });
      const headers = Object.fromEntries(res.headers);
      for (const [name, value] of Object.entries(staticHeaders())) {
        expect(headers[name], name).toBe(value);
      }
    },
  );
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
      ASSETS: assetsWith({}),
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

describe("GET / のコマンドラインのクライアント向けの応答", () => {
  const FILES: Record<string, string> = {
    "/ansi/color.txt": "ART\n",
    "/text/ja.txt": "日本語\n",
    "/text/en.txt": "English\n",
  };

  async function get(
    assets: ApiEnv["Bindings"]["ASSETS"],
    lang?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = { "User-Agent": "curl/8.22.0" };
    if (lang !== undefined) {
      headers["Accept-Language"] = lang;
    }
    return await api.request(
      "/",
      { headers },
      { ASSETS: assets, CONTACT_MAIL: { send: vi.fn() } },
    );
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ANSI アート、空行、テキスト版の順に text/plain の 200 で返す", async () => {
    const res = await get(assetsWith(FILES), "ja");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")?.toLowerCase()).toBe(
      "text/plain; charset=utf-8",
    );
    expect(res.headers.get("Vary")).toBe("User-Agent, Accept-Language");
    expect(await res.text()).toBe("ART\n\n日本語\n");
  });

  it("Accept-Language が無ければ日本語のテキスト版を返す", async () => {
    const res = await get(assetsWith(FILES));
    expect(await res.text()).toBe("ART\n\n日本語\n");
  });

  it("Accept-Language が en なら英語のテキスト版を返す", async () => {
    const res = await get(assetsWith(FILES), "en-US,en;q=0.9");
    expect(await res.text()).toBe("ART\n\nEnglish\n");
  });

  it("アセットは要求と同じオリジンから取得する", async () => {
    const assets = assetsWith(FILES);
    await get(assets, "en");
    expect(assets.fetch.mock.calls.map(([input]) => input.href)).toEqual([
      "http://localhost/ansi/color.txt",
      "http://localhost/text/en.txt",
    ]);
  });

  it("ANSI アートが 404 ならテキスト版だけを 200 で返す", async () => {
    const { "/ansi/color.txt": _, ...texts } = FILES;
    const res = await get(assetsWith(texts), "ja");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("日本語\n");
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["root: /ansi/color.txt answered 404"],
    ]);
  });

  it("ANSI アートの取得が例外ならテキスト版だけを 200 で返す", async () => {
    const res = await get(assetsWith(FILES, ["/ansi/color.txt"]), "ja");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("日本語\n");
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["root: /ansi/color.txt failed (TypeError)"],
    ]);
  });

  it("テキスト版が 404 なら 503 でブラウザで開く案内を返す", async () => {
    const { "/text/ja.txt": _, ...rest } = FILES;
    const res = await get(assetsWith(rest), "ja");
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(
      "ikili.pro\nテキスト版を表示できませんでした。ブラウザで http://localhost/ja/ を開いてください。\n",
    );
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["root: /text/ja.txt answered 404"],
    ]);
  });

  it("英語のテキスト版の取得が例外なら 503 で英語の案内を返す", async () => {
    const res = await get(assetsWith(FILES, ["/text/en.txt"]), "en");
    expect(res.status).toBe(503);
    expect(res.headers.get("Vary")).toBe("User-Agent, Accept-Language");
    expect(await res.text()).toBe(
      "ikili.pro\nThe text version is unavailable. Open http://localhost/en/ in a browser.\n",
    );
    expect(vi.mocked(console.error).mock.calls).toEqual([
      ["root: /text/en.txt failed (TypeError)"],
    ]);
  });
});
