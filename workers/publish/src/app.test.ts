import { describe, expect, it } from "vitest";
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
    expect(await res.json()).toEqual({ error: "unauthorized" });
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
    expect(await res.json()).toEqual({ error: "misconfigured" });
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
