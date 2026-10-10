import { describe, expect, it } from "vitest";
import {
  isNostrPublished,
  parseNostrPublishedSlugs,
} from "./published-articles";

const HASH = `${"0".repeat(63)}1`;

function record(articles: unknown): string {
  return JSON.stringify({ articles });
}

describe("parseNostrPublishedSlugs", () => {
  it("hash が有る項目の slug を返す", () => {
    const text = record({
      a: { hash: HASH, date: "2026-01-01T00:00:00Z", images: [] },
      b: { hash: "f".repeat(64), date: "2026-01-02T00:00:00Z", images: [] },
    });
    expect(parseNostrPublishedSlugs(text, "p.json")).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("hash が null の項目の slug は返さない", () => {
    const text = record({ a: { hash: null }, b: { hash: HASH } });
    expect(parseNostrPublishedSlugs(text, "p.json")).toEqual(new Set(["b"]));
  });

  it("項目が無い slug は返さない（空の articles は空の集合）", () => {
    const published = parseNostrPublishedSlugs(
      record({ a: { hash: HASH } }),
      "p.json",
    );
    expect(published.has("missing")).toBe(false);
    expect(parseNostrPublishedSlugs(record({}), "p.json").size).toBe(0);
  });

  it("hash 以外のフィールドは読まない（date と images が無くても通る）", () => {
    const text = record({ a: { hash: HASH }, b: { hash: HASH, date: 1 } });
    expect(parseNostrPublishedSlugs(text, "p.json")).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("__proto__ の slug も項目として扱う", () => {
    const text = `{"articles":{"__proto__":{"hash":"${HASH}"}}}`;
    expect(parseNostrPublishedSlugs(text, "p.json")).toEqual(
      new Set(["__proto__"]),
    );
  });

  it.each([
    ["JSON でない", "{", "is not valid JSON"],
    ["空の文字列", "", "is not valid JSON"],
    ["JSON が null", "null", 'has no "articles" object'],
    ["articles が無い", "{}", 'has no "articles" object'],
    ["articles が配列", '{"articles":[]}', 'has no "articles" object'],
    ["articles が文字列", '{"articles":"a"}', 'has no "articles" object'],
    ["項目が null", record({ a: null }), 'the entry of "a" is not an object'],
    ["項目が配列", record({ a: [] }), 'the entry of "a" is not an object'],
    ["hash が無い", record({ a: {} }), 'the "hash" of "a"'],
    [
      "hash が 63 桁",
      record({ a: { hash: "0".repeat(63) } }),
      'the "hash" of "a"',
    ],
    [
      "hash が 65 桁",
      record({ a: { hash: "0".repeat(65) } }),
      'the "hash" of "a"',
    ],
    ["hash が数値", record({ a: { hash: 1 } }), 'the "hash" of "a"'],
    ["hash が空の文字列", record({ a: { hash: "" } }), 'the "hash" of "a"'],
    [
      "hash が大文字の 16 進",
      record({ a: { hash: "A".repeat(64) } }),
      'the "hash" of "a" is neither 64 lowercase hexadecimal digits',
    ],
  ])("形が違うと理由を述べるエラーを投げる: %s", (_name, text, reason) => {
    expect(() => parseNostrPublishedSlugs(text, "p.json")).toThrow(
      new RegExp(`p\\.json.*${reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  });
});

describe("isNostrPublished", () => {
  it("集合に有る slug は投稿済み、無い slug は投稿済みでない", () => {
    const published = new Set(["a"]);
    expect(isNostrPublished("a", published)).toBe(true);
    expect(isNostrPublished("b", published)).toBe(false);
  });
});
