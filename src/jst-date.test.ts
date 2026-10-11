import { describe, expect, it } from "vitest";
import { formatJstDate } from "./jst-date";

describe("formatJstDate", () => {
  it("日本時間の日付を YYYY.MM.DD で返す", () => {
    expect(formatJstDate(new Date("2026-09-27T15:30:00Z"))).toBe("2026.09.28");
  });

  it("1 桁の月と日を 0 で埋める", () => {
    expect(formatJstDate(new Date("2026-01-04T00:00:00+09:00"))).toBe(
      "2026.01.04",
    );
  });
});
