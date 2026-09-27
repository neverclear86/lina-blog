import { afterEach, describe, expect, it, vi } from "vitest";
import app from "./app";

const env = { PUBLISH_TOKEN: "test-token" };

function withAuthorization(value: string): RequestInit {
  return { headers: { Authorization: value } };
}

describe("publish app", () => {
  it("Authorization の無いリクエストは 401 と WWW-Authenticate: Bearer を返す", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await res.json()).toEqual({
      error: {
        code: "unauthorized",
        message: "Missing or invalid bearer token.",
      },
    });
  });

  it("Bearer 以外の方式は 401 を返す（Basic test-token）", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Basic test-token"),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("方式の無いシークレットだけのヘッダーは 401 を返す（test-token）", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("test-token"),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("値が Bearer だけのヘッダーは 401 を返す（`Bearer `。前後の空白は落ちて `Bearer` になる）", async () => {
    const res = await app.request("/health", withAuthorization("Bearer "), env);
    expect(res.status).toBe(401);
  });

  it("違うシークレットは 401 を返す（Bearer wrong-token）", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Bearer wrong-token"),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("正しいシークレットは通り、GET /health が 200 と { ok: true } を返す", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Bearer test-token"),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("PUBLISH_TOKEN が未設定なら正しい形のヘッダーでも 500 を返す", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Bearer test-token"),
      {},
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "misconfigured", message: "PUBLISH_TOKEN is not set." },
    });
  });

  it("定義していないパスは認証の無いとき 401、正しいシークレットで 404 を返す", async () => {
    const denied = await app.request("/unknown", {}, env);
    expect(denied.status).toBe(401);
    const allowed = await app.request(
      "/unknown",
      withAuthorization("Bearer test-token"),
      env,
    );
    expect(allowed.status).toBe(404);
  });
});

describe("GET /articles", () => {
  const articlesEnv = { ...env, GITHUB_TOKEN: "github-token" };
  const authorized = withAuthorization("Bearer test-token");
  const HASH = "a".repeat(64);

  /** Replaces the global `fetch` with a stub that answers every call with `body`. */
  const stubGlobalFetch = (body: string | null, init?: ResponseInit) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, init));
    vi.stubGlobal("fetch", fetchImpl);
    return fetchImpl;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("認証の無いリクエストは 401 を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGlobalFetch(JSON.stringify({ articles: {} }));

    const res = await app.request("/articles", {}, articlesEnv);

    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("公開の記録の slug と hash を 200 で返す", async () => {
    stubGlobalFetch(
      JSON.stringify({
        articles: { b: { hash: null }, a: { hash: HASH, date: "2026-09-01" } },
      }),
    );

    const res = await app.request("/articles", authorized, articlesEnv);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      articles: [
        { slug: "a", hash: HASH },
        { slug: "b", hash: null },
      ],
    });
  });

  it("GITHUB_API_URL があればその基底 URL の GitHub から読む", async () => {
    const fetchImpl = stubGlobalFetch(JSON.stringify({ articles: {} }));

    await app.request("/articles", authorized, {
      ...articlesEnv,
      GITHUB_API_URL: "http://127.0.0.1:9999",
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:9999/repos/neverclear86/lina-blog/contents/src/content/published.json?ref=main",
    );
  });

  it("GitHub から読めないときは 502 と upstream_error、step: list を返す（GitHub が 503）", async () => {
    stubGlobalFetch("Service Unavailable", { status: 503 });

    const res = await app.request("/articles", authorized, articlesEnv);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "GitHub answered 503 when reading src/content/published.json.",
        step: "list",
      },
    });
  });

  it("GITHUB_TOKEN が未設定なら 500 と misconfigured を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGlobalFetch(JSON.stringify({ articles: {} }));

    const res = await app.request("/articles", authorized, env);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "misconfigured", message: "GITHUB_TOKEN is not set." },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
