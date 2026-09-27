import { describe, expect, it } from "vitest";
import api from "./api";

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
