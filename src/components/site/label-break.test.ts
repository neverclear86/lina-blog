import { describe, expect, it } from "vitest";
import { labelSegments } from "./label-break";

describe("labelSegments", () => {
  it("括弧の無いラベルは 1 つのまま返す", () => {
    expect(labelSegments("YouTube")).toEqual(["YouTube"]);
  });

  it("日本語の Twitter のラベルを括弧の前で分ける", () => {
    expect(labelSegments("Twitter(自称X)")).toEqual(["Twitter", "(自称X)"]);
  });

  it("英語の Twitter のラベルを空白の後、括弧の前で分ける", () => {
    expect(labelSegments("Twitter (self-proclaimed X)")).toEqual([
      "Twitter ",
      "(self-proclaimed X)",
    ]);
  });

  it("先頭が括弧のラベルは分けない", () => {
    expect(labelSegments("(beta)")).toEqual(["(beta)"]);
  });
});
