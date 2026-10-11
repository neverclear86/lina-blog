import { describe, expect, it } from "vitest";
import { buildTextSite } from "../text-site";
import { DEFAULT_LOCALE, LOCALES } from "./locales";
import { translate, type UiKey, ui, useTranslations } from "./ui";

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

  it("お問い合わせの JS が無いときの文言は日本語と英語で対になる", () => {
    expect(translate("ja", "contact.noscript")).toBe(
      "送信には JavaScript が必要です。",
    );
    expect(translate("en", "contact.noscript")).toBe(
      "Sending requires JavaScript.",
    );
  });

  it("お問い合わせの DM の案内は、リンクの前後の文言が日本語と英語で決めた文になる", () => {
    expect(translate("ja", "contact.dm.before")).toBe("フォームのほか、");
    expect(translate("ja", "contact.dm.after")).toBe(
      " の DM でも受け付けています。",
    );
    expect(translate("en", "contact.dm.before")).toBe(
      "You can also send me a DM on ",
    );
    expect(translate("en", "contact.dm.after")).toBe(".");
  });

  it("お問い合わせの「ソッコー確認するね」は日本語にも英語にも無い", () => {
    for (const locale of LOCALES) {
      const entries = Object.entries(ui[locale]);
      expect(entries.map(([key]) => key)).not.toContain("contact.note");
      for (const [, text] of entries) {
        expect(text).not.toMatch(/ソッコー|right away/);
      }
    }
  });

  it("記事が 0 件のときの文言は、テキスト版の記事が 0 件のときの行と同じになる", () => {
    for (const locale of LOCALES) {
      const lines = buildTextSite(
        locale,
        [],
        new URL("https://example.com"),
      ).split("\n");
      expect(lines).toContain(translate(locale, "latest.blog.noPosts"));
    }
  });
});

describe("useTranslations", () => {
  it("日本語を指定すると、キーから日本語の文言を返す関数になる", () => {
    const t = useTranslations("ja");
    expect(t("home.comingSoon")).toBe("準備中です。");
    expect(t("nav.top")).toBe("トップ");
  });

  it("英語を指定すると、キーから英語の文言を返す関数になる", () => {
    const t = useTranslations("en");
    expect(t("home.comingSoon")).toBe("Coming soon.");
    expect(t("nav.top")).toBe("Top");
  });

  it("言語ごとの関数を続けて作っても、それぞれの言語の文言を返す", () => {
    const tJa = useTranslations("ja");
    const tEn = useTranslations("en");
    expect(tJa("nav.blog")).toBe("ブログ");
    expect(tEn("nav.blog")).toBe("Blog");
  });

  it("すべての言語のすべてのキーで translate と同じ文言を返す", () => {
    const keys = Object.keys(ui[DEFAULT_LOCALE]) as UiKey[];
    for (const locale of LOCALES) {
      const t = useTranslations(locale);
      for (const key of keys) {
        expect(t(key)).toBe(translate(locale, key));
      }
    }
  });
});

describe("コードのコピーのボタン", () => {
  it("コードのコピーのボタンの名前は日本語が「コードをコピー」で、英語は見える文字 copy を含む", () => {
    expect(translate("ja", "code.copy.name")).toBe("コードをコピー");
    expect(translate("en", "code.copy.name").toLowerCase()).toContain(
      translate("en", "code.copy.idle"),
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
