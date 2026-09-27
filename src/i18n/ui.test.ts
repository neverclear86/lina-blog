import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES } from "./locales";
import { translate, ui } from "./ui";

describe("translate", () => {
  it("日本語を指定すると日本語の文言を返す", () => {
    expect(translate("ja", "home.comingSoon")).toBe("準備中です。");
  });

  it("英語を指定すると英語の文言を返す", () => {
    expect(translate("en", "home.comingSoon")).toBe("Coming soon.");
  });

  it("Twitter のラベルは日本語で Twitter(自称X)、英語で Twitter (self-proclaimed X) になる", () => {
    expect(translate("ja", "social.twitter")).toBe("Twitter(自称X)");
    expect(translate("en", "social.twitter")).toBe(
      "Twitter (self-proclaimed X)",
    );
  });
});

describe("ui", () => {
  it("言語の一覧のすべての言語に既定の言語と同じキーの辞書がある", () => {
    const expected = Object.keys(ui[DEFAULT_LOCALE]).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(ui[locale] ?? {}).sort()).toEqual(expected);
    }
  });
});
