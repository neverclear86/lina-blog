/**
 * The color theme of every page: the `data-theme` attribute on `<html>`, "light" or "dark".
 *
 * `THEME_SCRIPT` runs in the `<head>` of `src/layouts/Layout.astro` before the first paint. It
 * sets "light" when `localStorage` holds "light" under `THEME_STORAGE_KEY`, and "dark" in every
 * other case, including when reading `localStorage` throws. It does not read the OS setting
 * (`prefers-color-scheme`) and does not follow changes of it. Without JavaScript, `<html>` keeps
 * the dark theme that the layout renders.
 *
 * `toggleTheme` is what the theme toggle (`src/components/ThemeToggle.astro`) runs on a click:
 * it switches `<html data-theme>` and saves the new theme under the same key.
 */

/** Key of the saved theme in `localStorage`. With no valid value, the theme is dark. */
export const THEME_STORAGE_KEY = "theme";

/** Values of `<html data-theme>` and of the saved theme. */
export const THEMES = ["light", "dark"] as const;

/** One of `THEMES`. */
export type Theme = (typeof THEMES)[number];

/**
 * Returns the theme for a saved value: "light" when it is "light", and "dark" for no value, for
 * "dark" and for any other value. `THEME_SCRIPT` applies the same rule, and `theme.test.ts`
 * checks that the two agree.
 */
export function resolveTheme(stored: string | null): Theme {
  return stored === "light" ? "light" : "dark";
}

/**
 * Source of the inline script that sets `<html data-theme>`. `src/layouts/Layout.astro` renders
 * it as is before any stylesheet, so the first paint already has the theme. It applies the rule
 * of `resolveTheme` to the value under `THEME_STORAGE_KEY`, reading none when `localStorage`
 * throws.
 *
 * It is a plain string rather than the source of a function, so the page carries exactly this
 * text and its CSP hash can be computed from this constant.
 */
export const THEME_SCRIPT = `(() => {
  const key = ${JSON.stringify(THEME_STORAGE_KEY)};
  let value = null;
  try {
    value = localStorage.getItem(key);
  } catch {}
  document.documentElement.dataset.theme = value === "light" ? "light" : "dark";
})();`;

/**
 * Switches `<html data-theme>` to the other theme and saves the new one under
 * `THEME_STORAGE_KEY`. The new theme is "light" when the current value is "dark", and "dark"
 * for "light" or any other value. When getting the storage or writing to it throws, the page
 * still switches but nothing is saved, so the next page goes back to the rule of `resolveTheme`.
 * Returns the new theme.
 */
export function toggleTheme(
  root: { dataset: { theme?: string } },
  storage: () => Pick<Storage, "setItem">,
): Theme {
  const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    storage().setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Not saved: the theme stays switched on this page only.
  }
  return next;
}
