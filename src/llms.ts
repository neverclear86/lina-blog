/**
 * Builds `/llms.txt`, a Markdown summary of the site for LLMs (https://llmstxt.org/).
 * `src/pages/llms.txt.ts` calls it when `/llms.txt` is rendered, so every build writes the file
 * from the locales in `src/i18n/locales.ts` and the Japanese labels of `PROFILE_LINKS` in
 * `src/profile-links.ts`.
 */
import { LOCALES, type Locale } from "./i18n/locales";
import { PROFILE_LINKS } from "./profile-links";

/** Link text of each locale's top page. The type requires one for every locale. */
const TOP_PAGE_LABELS: Record<Locale, string> = {
  ja: "トップ（日本語）",
  en: "トップ（英語）",
};

/**
 * Returns the `/llms.txt` text: the site name, a quoted summary, the top page of each locale
 * as an absolute URL under `site`, and the profile links, ending with one newline.
 *
 * @param site Astro's `site`, the origin of the absolute URLs.
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function buildLlmsTxt(site: URL | undefined): string {
  if (site === undefined) {
    throw new Error(
      "llms.txt needs `site` in astro.config.mjs for absolute URLs",
    );
  }
  return [
    "# ikili.pro",
    "",
    "> 創好リナ（Tsukusu Lina）の個人サイト兼ブログ。創好リナはバーチャルイキリプログラマで、ITで遊ぶ動画と配信を、Resoniteを中心に届けている。",
    "",
    "名前の由来はLinux。配信もするし、開発もする。サイトは日本語と英語で公開している。",
    "",
    "## ページ",
    "",
    ...LOCALES.map(
      (locale) =>
        `- [${TOP_PAGE_LABELS[locale]}](${new URL(`/${locale}/`, site).toString()})`,
    ),
    "",
    "## リンク",
    "",
    ...PROFILE_LINKS.map(
      ({ label, url, note }) => `- [${label.ja}](${url}): ${note.ja}`,
    ),
    "",
  ].join("\n");
}
