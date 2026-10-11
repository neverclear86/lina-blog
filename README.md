# lina-blog

The repository of [ikili.pro](https://ikili.pro), the personal site and blog of Tsukusu Lina, a self-proclaimed virtual ikiri programmer.
Astro 7 prerenders almost every page, and Cloudflare Workers serves them from Workers Static Assets, with a Hono app in `src/fetch.ts` for the routes that run on the Worker, such as the contact form and the text version of the site for curl.
Articles are published by a separate Worker (`workers/publish/`, also Hono).

## 🚀 Project Structure

```text
/
├── docs/               # Documents: how to write an article body, the API contract between the article sync script and the publishing Worker, and how to write articles in the Vault
├── public/             # Static files copied as they are, with `_headers`, the security headers of the static files (the Worker sends the same values)
│   └── favicon/        # Favicons from the brand kit, unchanged: the mark /li on ink as SVG, and PNGs of 32, 180 and 192 pixels
├── scripts/            # Scripts that run outside the site build
│   ├── a11y/           # `bun run a11y`: axe and a screenshot contrast check
│   ├── audit/          # Audit scripts run by hand: what still moves under `prefers-reduced-motion: reduce`, and the links that leave the site
│   ├── avatars/        # Makes the avatar images in `src/assets/` from the v2.1 originals (`bun run import:avatars`)
│   ├── lighthouse/     # Job summary table of the Lighthouse CI scores
│   └── sync/           # Article sync script for the publish Worker (`bun run sync`, run by Hermes)
├── src/                # The site; a module in this directory has its unit test `<name>.test.ts` beside it, and `fetch.ts` is the Worker entry
│   ├── assets/         # Images processed by astro:assets: the nine v2.1 avatars, made by `scripts/avatars/` (see “Images and caching”)
│   │   ├── icon/       # Face mark and avatar SVGs of the brand kit (regular and small versions), used as they are by FaceIcon
│   │   └── name-logo/  # Name logo of the brand kit, kept as it is and drawn by `og-image.ts`
│   ├── components/     # Astro components, in a directory for each part of the site; the `.ts` modules of a part and their tests are in the same directory (the tests that read several parts are directly in `components/`)
│   │   ├── article/    # A post's page: head, body, table of contents, reading progress, end window, the links to the next posts and the PR notice
│   │   ├── blog/       # The blog pages (the list with the tag filter) and the window of post rows
│   │   ├── contact/    # The contact form and its states
│   │   ├── home/       # The top page: hero, About, Latest, the three views of the avatar and the contact band
│   │   ├── icons/      # Service icons for HeroAccount; sources and terms in icons/README.md
│   │   └── site/       # What more than one kind of page uses: header, footer, skip link, page head, section title, name logo, face mark, theme switch, breadcrumb and the note on a link that leaves the site
│   ├── content/        # The `blog` collection and `published.json`, the record of which posts are on Nostr, written by the publishing Worker
│   │   ├── blog/       # Posts committed by the publishing Worker
│   │   └── blog-dev/   # Posts for checking how pages look, and published.json, their published record; loaded by astro dev (or with LINA_DEV_PAGES=1)
│   ├── dev/            # The dev pages, added in astro dev (or with LINA_DEV_PAGES=1): /dev/components/, samples of the plan A styles, components and avatar images, and /dev/markdown/, a sample article with every supported Markdown syntax
│   │   └── sections/   # A section of /dev/components/ in each file, with the classes only that section uses
│   ├── i18n/           # Locales (ja, en), the locale picked for /, the path of the same page in another locale, canonical and hreflang URLs, and the UI strings per locale
│   ├── layouts/        # The layout of every page: `<head>` with its meta tags, the skip link, the site header and the site footer
│   ├── markdown/       # Markdown rendering with Sätteri: its plugins, the highlighting of code blocks, the CSS of an article and of its code blocks, and the sample article shown at /dev/markdown/
│   ├── pages/          # A file for each URL, prerendered unless it exports `prerender = false`; a directory is a part of the path
│   │   ├── [lang]/     # The pages that exist in every language, generated once for each locale in `src/i18n/locales.ts` (/ja/, /en/)
│   │   ├── ansi/       # /ansi/color.txt and /ansi/plain.txt: the avatar main-visual as text art
│   │   ├── blog/       # /blog/, the posts at /blog/<slug>/ and the tag pages
│   │   ├── og/         # /og/images.json: the OGP images to draw, read and deleted by `astro.config.mjs` after the build
│   │   └── text/       # /text/ja.txt and /text/en.txt: the text version of the site
│   ├── styles/         # The global CSS (see “CSS”)
│   └── test/           # Helpers for the tests, and the test that checks this tree
└── workers/            # Workers that are not part of the site
    └── publish/        # Publish Worker, separate from the site and deployed on its own
        └── src/        # The Hono app and Worker entry (every route needs the shared secret) and what its routes call: checking an article, writing files to GitHub, images in R2, posting to Nostr through the bunker (NIP-46), Zenn and withdrawal; each module has its unit test beside it
```

The tree names directories only, so that it does not repeat the comment at the top of each file. `src/test/readme-tree.test.ts` fails when the tree names a directory that does not exist or leaves out one that holds files; `src/content/blog/`, where the publishing Worker commits posts, is listed even while it is empty, and below `src/pages/<name>/` a directory is a part of a URL and is not listed.

Pages are prerendered unless they export `prerender = false`. The Worker runs first only for `/` and `/api/*` (`assets.run_worker_first` in `wrangler.jsonc`); other static files are served from Workers Static Assets, and a `GET` for a path with no file gets `/404.html` (`src/pages/404.astro`) with status 404 without starting the Worker (`assets.not_found_handling`), so a page that exports `prerender = false` must also be added to `assets.run_worker_first`. `/` has no page: the route in `src/api.ts` answers command-line clients such as curl (`src/user-agent.ts`) with `text/plain`, and redirects other clients to `/en/` when `Accept-Language` prefers English over Japanese and to `/ja/` otherwise. The text is the text art `/ansi/color.txt`, a blank line and the text version `/text/en.txt` or `/text/ja.txt`, chosen by `Accept-Language` in the same way, which the Worker fetches through the `ASSETS` binding (`assets.binding` in `wrangler.jsonc`). Without the text art it is the text version alone; without the text version it is a short notice with the top page's URL and status 503. All three responses carry `Vary: User-Agent, Accept-Language`. Every response of `/` and `/api/*` also carries the security headers of Hono's `secureHeaders()`, added by middleware in `src/api.ts`, because a `_headers` file applies to static assets only and not to responses from the Worker. `Content-Security-Policy` (`frame-ancestors 'none'` only), `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy` and `Strict-Transport-Security` take the values of the `/*` rule in `public/_headers`, and `src/api.test.ts` checks that both agree; the other headers, such as `Cross-Origin-Opener-Policy`, keep Hono's defaults. Do not add `src/pages/index.astro`, because the adapter serves a prerendered page before the Hono app sees the request. Requests to `/` and `/api/*` go to the Hono app in `src/fetch.ts`, which serves the routes in `src/api.ts`; a request that no route matches, such as `/api/nope` or a `POST` to `/`, gets the same 404 page from Astro's handlers. Astro calls that app with the request only, so `src/fetch.ts` passes the Worker's bindings and secrets (`env` from `cloudflare:workers`) to it.

Pages that exist in every language go in `src/pages/[lang]/` and are generated once for each locale in `src/i18n/locales.ts` (`/ja/`, `/en/`); their UI strings come from `src/i18n/ui.ts`. Pages outside `[lang]/`, such as the Japanese-only blog under `/blog/`, have no language prefix. Astro's `i18n()` handler in `src/fetch.ts` is never reached, so `astro build` warns that the project does not call it; running it would answer 404 for those unprefixed paths. The layout links every page to the same path in the other locales (`src/i18n/paths.ts`); a page without a language prefix links to the other locale's top page. Every page also has a canonical link and hreflang alternates, as absolute URLs under `site` in `astro.config.mjs` (`canonicalUrl` and `alternateLinks` in `src/i18n/paths.ts`): a page under `[lang]/` lists itself in each locale and `x-default` pointing to `/`, and a page without a language prefix lists only itself, in Japanese.

Blog posts are Markdown files in `src/content/blog/`, committed by the publishing Worker. Posts for checking how pages look go in `src/content/blog-dev/`: `astro dev` loads them into the same `blog` collection and checks them with the same schema. `astro build` leaves them out unless `LINA_DEV_PAGES=1` is set (see “CSS”); with it they reach `dist/` like other posts, in `/blog/`, the tag pages, their own pages `/blog/<slug>/`, the latest posts on the home page, `/rss.xml`, the text version and the OGP images `/og/blog/<slug>.png`, so that build is only for screenshots and is never deployed.

Whether a post is on Nostr is decided at build time from `src/content/published.json`, the published record that the publishing Worker writes (`docs/publish-api.md`): a post is on Nostr when the record has an entry for its slug whose `hash` is not `null`. `astro.config.mjs` reads the record in Node and exports the slugs as the virtual module `virtual:lina-published-slugs`, which pages can import; `isNostrPublished` in `src/published-articles.ts` looks a slug up. The page of a post that is on Nostr has the link `nostr ↗` (`mirror`) in the row of the date and the author, to its article on njump, `https://njump.me/<naddr>` (`nostrArticleUrl` in `src/nostr-address.ts`, with the npub of `src/profile-links.ts`), which opens in a new tab. A missing file means that no post is on Nostr, and a record in another form fails the build. The sample posts have their own record, `src/content/blog-dev/published.json`, read only when the sample posts are: `dev-preview-sample` is on Nostr, `dev-preview-newer` has an entry with `hash: null`, and the other sample posts have no entry. A change to a record is picked up by restarting `astro dev`.

Markdown is rendered by Sätteri with the plugins in `src/markdown/`. `/dev/markdown/`, a dev page (see “CSS”), shows `src/markdown/sample.md`, a sample article with every supported syntax. Code blocks are highlighted at build time by `src/markdown/highlight.ts`, which gives tokens role classes such as `hl-keyword` instead of inline styles; `markdown.syntaxHighlight` is off so Astro's own Shiki does not run. A paragraph that holds only a YouTube video URL (`https://youtu.be/<ID>` or `https://www.youtube.com/watch?v=<ID>`) becomes a lazily loaded `youtube-nocookie.com` player. An accordion is written as raw HTML (`<details>` and `<summary>`), and how to write one is in `docs/markdown.md`. An `<aside class="note">` or `<aside class="warning">` written as raw HTML in an article is styled as a message box (`docs/markdown.md` shows how to write one). The checkbox of a task list item gets an `aria-label` with the text of the item, and every table gets `tabindex="0"` so that a table wider than the article can be scrolled with the keyboard (`src/markdown/a11y.ts`). A link in an article to another site opens in a new tab and ends with an arrow `↗` and a hidden text that says so; a link of only images has no arrow, and a link in a heading or written as raw HTML is left as it is (`src/markdown/external-links.ts`).

`astro build` also writes the text version of the site for command-line clients to `/text/ja.txt` and `/text/en.txt` (`src/pages/text/[lang].txt.ts`, built by `src/text-site.ts`): the about text, the five latest posts, the profile links and how to get in touch (the contact form and a DM on Twitter (self-proclaimed X)), with every line in 80 terminal columns. The profile links come from `src/profile-links.ts`, which `/llms.txt`, the Latest section of the home page, the account window of the hero, the links column of the site footer, the contact band of the top page and the contact page use as well.

Unit tests (`*.test.ts` next to the code) cover logic such as the Hono routes, the blog frontmatter schema, the RSS items and the Markdown plugins; `src/api.ts` and
`workers/publish/src/app.ts` are tested with `app.request()`, and the plugins in `src/markdown/` with Sätteri's `markdownToHtml()`. `src/test/css-source.ts` reads the CSS of a `.css` file or of the `<style>` of an `.astro` file as rules with their `@media` and `@supports` conditions (`parseCss` and the other functions), so that a test can ask which rules set a property under which condition instead of matching the text of the CSS. Pages are checked with screenshots instead: `node .claude/scripts/screenshot.mjs --root . --port 4611 --out /tmp/shots /` serves `dist/` without building it, so run `bun run build` first. It uses Playwright's Chromium (`bunx playwright install chromium` if it is not installed yet). What still moves under `prefers-reduced-motion: reduce` is measured the same way: `node scripts/audit/reduced-motion.mjs --root . --port 4612` opens every page in `dist/client` and `/404` at 1440px and 390px in both themes, counts the running animations and transitions after the page opens, a Tab, hovers, a scroll and clicks, and exits with 1 when any is left (build with `LINA_DEV_PAGES=1` to include the sample posts and the dev pages); `--motion no-preference` only lists them. `src/styles/reduced-motion.test.ts` fails when a rule outside `@media (prefers-reduced-motion: reduce)` in a `.css` file or in a `<style>` element of an `.astro` file under `src/` sets `transition` or a `transition-*` property to a value other than `none`, and one of its selectors is in no rule after it in the same source that is directly in `@media (prefers-reduced-motion: reduce)` and sets `transition: none`. `node scripts/audit/external-links.mjs dist/client` reads every HTML file in headless Chromium and exits with 1 when a link to another host lacks `target="_blank"`, `rel="noopener"` or the note that says it opens in a new tab, or when a link on the site has `target="_blank"` or the note; `--skip <css>` leaves out the links inside the elements it matches. It does not run in CI.

Colors are tested the same way. `src/styles/tokens.test.ts` checks that the plan A tokens have the values of the design, that every foreground and background token pair used for text (a translucent background is laid over each fill that can come under it) reaches 4.5:1 (WCAG AA) in both themes and that every icon color reaches 3:1 on `--panel`, `--bg` and `--bg2`, `--focus-ring` on the page backgrounds, every diff bar of a code block on its line and the focus ring of a code block on `--code`, and `src/styles/hardcoded-colors.test.ts` fails when a color value (`#rrggbb`, `rgb()`, `hsl()` and the like) is written in a `.css` file other than `src/styles/tokens.css`, or in a `<style>` element or a `style`, `fill`, `stroke`, `stop-color` or `color` attribute of an `.astro` file. Use the tokens (`var(--text)` and so on) instead; inline SVG takes `currentColor`. The service icons in `src/components/icons/` are also checked by `icons.test.ts`: their `fill` and `stroke` are only `currentColor` or `none`, because named colors such as `black` pass the check above. `src/styles/token-references.test.ts` fails when a `var(--name)` without a fallback in an `.astro`, `.css` or `.ts` file under `src/` reads a custom property that no file under `src/` defines (`--font-body` and `--font-mono-latin`, which the Fonts API defines, count as defined), because a browser does not report such a read and the property falls back to its inherited or initial value.

`bun run a11y` audits the built site in headless Chromium: every page of `dist/client/` at 1440px and 390px in both themes. It fails on an axe result with `serious` or `critical` impact or any `color-contrast` result. Axe cannot decide the contrast of some text, for example over a gradient, an image, a pseudo-element or another element, so `scripts/a11y/run.ts` measures that text on a screenshot with the glyphs hidden and fails under 4.5:1 (3:1 for large text). Run `LINA_DEV_PAGES=1 bun run build` first to include the posts and the dev pages; it does not run in CI. It opens the pages without their Content Security Policy (Playwright's `bypassCSP`), which would block the style tag that hides the glyphs for the contrast check. Pass paths, `--widths` or `--themes` to narrow it.

## 🎨 CSS

CSS is plain CSS: a few global files in `src/styles/` and a scoped `<style>` in each component.
`src/layouts/Layout.astro` imports the global files, so they apply to every page.

| File         | Holds                                                                      |
| :----------- | :------------------------------------------------------------------------- |
| `tokens.css` | Color tokens (CSS variables): the plan A tokens for the light and dark themes, the icon colors of the services and the colors that stay the same in both themes |
| `global.css` | The frame of the page (`html`, `body` and `.site-content`: no margin, the full height, and the footer at the bottom of a short page), the side padding of the page (`--page-gutter`: 16px, 20px from 768px and 64px from 900px) and the width of its content (`.page-width`: at most 1440px including the padding, centered, with `--page-gutter` on both sides, for the header, the footer and the body of a page; `sizes` in `LatestVideoFeature.astro` repeats the same paddings, so change it together with `--page-gutter`), the font and the variables of `html` (`--font-mono`, `--header-h`, the height of the sticky header, `--ease-out`, the easing of the movements, and `font-synthesis-weight`), the colors of `body` (which switch with the theme at once), the links (with `.link-title`, the title of a card link that the light theme underlines), the keyboard focus outline (none on `<main tabindex="-1">`, which the skip link focuses) and the scroll padding of the page (at the top the height of the sticky header and a gap, 8px at the bottom), which the anchors, `#main` and the focused element stop inside, and the classes that hide text from the eyes: `.sr-only`, `.sr-only-focusable` (hidden until it has the focus, for the skip link) and `.sr-only-narrow` (hidden below 768px) |
| `controls.css` | Buttons (`.btn`, `.btn-acc`, `.btn-ink`, `.btn-ghost`), icon links (`.sq`, `.iconbtn`, `.iconbtn-acc`) and page switch links (`.ws`, `.ws.on`) of plan A |
| `window.css` | Plan A windows (`.win`, `.article-body details` and an article's message boxes; a link window turns its border on hover, and an accordion while its `<summary>` is hovered or focused), the title row of a window (`.win-title`), the `<summary>` of an accordion (`details.win` and `.article-body details`, a plus while closed and a minus while open), corner ticks (`.ticks`, and `.ticks-acc` inside an `.acct`), the grid background (`.gridbg`) and the stripe band (`.stripes`, flowing right) and the avatar shadow (`.av-shadow`). The turn of the border and the spread of the ticks stop their transitions, and the flow of `.stripes` stops, under `prefers-reduced-motion: reduce` |
| `labels.css` | Labels of plan A: the caption `.label` (whose declarations the labels of an article's message boxes share), the bordered tag `.tag` and the orange category chip `.chip-acc` |
| `motion.css` | The animations a page uses: the blinking cursor of the name logo (`.blink-on`) and the appearance when the page opens (`.rv`, and the keyframes `band-in` that `Hero.astro` plays). Both are stopped under `prefers-reduced-motion: reduce` |

A global file holds only what several components share.
Styles that belong to one component go in that component's scoped `<style>`.
Color values are written only in `tokens.css`; other CSS, global or scoped, uses the tokens with `var(--…)`. The one exception is `black` in the masks of `window.css`, which sets only the opacity and is never drawn.
A component that must style an element outside its own markup, such as `<html data-theme>`,
wraps only that selector in `:global()`, as in `:global(:root[data-theme="dark"]) .x`.
It does so for `:root` and `html` too, although Astro adds no scope attribute to them either way.
The elements that rendered Markdown outputs are styled by plain CSS files in `src/markdown/`: `article.css`, whose rules sit under `.article-body` instead of in `:global()`, and `highlight.css` for the windows of code blocks.

The inline script in the `<head>` of `src/layouts/Layout.astro` (`THEME_SCRIPT` in `src/theme.ts`) sets `<html data-theme>` before the first paint.
It sets the light theme when `localStorage` holds `light` under the key `theme`, and the dark theme in every other case: nothing saved, any other value, or `localStorage` throwing. It does not read `prefers-color-scheme` and does not follow changes of the OS setting.
Without JavaScript, the page keeps the dark theme that `Layout.astro` renders.
`src/components/site/ThemeToggle.astro` switches the theme with `toggleTheme` and saves it under the same key; when saving throws, the switch lasts only until the next page.

Breakpoints are the widths of the viewport at which a layout changes.
In `@media`, `sizes` and `matchMedia`, write the wide side of a width N as `min-width: N` and the narrow side as `max-width: N-1`, without decimals such as `767.98px`, so that a viewport of exactly N px is on the wide side. `src/styles/breakpoints.test.ts` fails on a `min-width` or `max-width` of any other value.
A container query (`@container` in `HeroAccount.astro` and `ContactForm.astro`) switches on the width of its component, not of the viewport, and is not in the table.

| Width    | From this width (`min-width: N`) |
| :------- | :------------------------------- |
| `360px`  | The contact band (`ContactBand.astro`) shows its image; below, the pose table of the hero (`HeroPoses.astro`) starts 48px from the top |
| `600px`  | The contact page and its form (`contact/index.astro`, `ContactForm.astro`) have more padding |
| `768px`  | The sides of a page are 20px instead of 16px, a section heading is 40px, and the hero leaves the stacked layout of the phone |
| `900px`  | The sides of a page are 64px, a section heading is 52px, the hero is in two columns, a post row has four columns and the figures of the three-view are 440px high |
| `1024px` | The bar of the header holds the navigation, the language switch and the contact button instead of the menu button, the footer has three columns, and an article has the column of its table of contents |
| `1200px` | The three views of the avatar (`AvatarThreeView.astro`) stand in a row instead of being switched as tabs |
| `1280px` | The windows of the top page (`LatestSection.astro`) are in two columns, and the title and the end of an article lose the rules for the narrower widths |

`src/dev/components.astro` shows the plan A styles, the components and the avatar images on one page, with a file for each section in `src/dev/sections/` and the data of the samples in `src/dev/samples.ts`, and `src/dev/markdown.astro` shows `src/markdown/sample.md` the way articles are rendered.
`astro dev` serves them at `/dev/components/` and `/dev/markdown/`, and `astro build` leaves them out of `dist/` unless `LINA_DEV_PAGES=1` is set.
Add `?theme=dark` or `?theme=light` to the URL of `/dev/components/` to see that theme whatever is saved.
To capture them with `.claude/scripts/screenshot.mjs`, which serves `dist/`, build with `LINA_DEV_PAGES=1 bun run build`.
That build also loads the posts in `src/content/blog-dev/` (see “Project Structure”), so pages that list posts, such as `/blog/`, and the page of a post, such as `/blog/dev-preview-sample/` with an older and a newer post beside it, can be captured with posts in them.
A new component adds a section file to `src/dev/sections/` and lists it in `src/dev/components.astro`, and a new Markdown syntax adds its examples to `src/markdown/sample.md`.

## 🔤 Fonts

Fonts are self-hosted with the Astro Fonts API (`fonts` in `astro.config.mjs`). `astro build`
downloads them from Google Fonts, and pages load them from `/_astro/fonts/`, never from a font
CDN. `src/layouts/Layout.astro` emits the `@font-face` rules on every page and sets `--font-body`
on `html`; `src/styles/global.css` builds `--font-mono` there from `--font-mono-latin`
(JetBrains Mono) and `--font-body`. No font file is preloaded.

| CSS variable     | Font                                                  | Weights       | Used for                                                                                                              |
| :--------------- | :---------------------------------------------------- | :------------ | :-------------------------------------------------------------------------------------------------------------------- |
| `--font-body`    | Zen Kaku Gothic New                                   | 400, 700, 900 | Everything by default: Japanese and body text, headings, navigation, buttons                                          |
| `--font-mono`    | JetBrains Mono, then Zen Kaku Gothic New for Japanese | 400-800       | Labels, numbers, dates and code                                                                                       |

Components use these variables and never name a font. Form controls (`button`, `input`,
`select`, `textarea`) do not inherit `font-family` from `html`, so components set
`font: inherit` on them. Zen Kaku Gothic New 500 in the design is written as `font-weight: 400`,
because 500 is not loaded. `font-synthesis-weight: none` on `html` keeps the browser from
faking a weight that is not loaded.

The files that the Fonts API downloads are WOFF2 split into unicode-range chunks, which image
renderers such as Satori cannot read. `src/og-font.ts` downloads Zen Kaku Gothic New 900, the
weight of the headings, and JetBrains Mono 400 and 700, the weights of the labels, as one
TrueType file each from the same Google Fonts CSS API, in Node. Nothing is written to the
repository or to `dist/`.

## 🖼️ Images and caching

Raster images in `src/assets/` are rendered with `Picture` from `astro:assets` on the pages.
`astro build` converts them once (`imageService: "compile"`), so no image is transformed at
request time. The avatars are offered as AVIF and WebP at several widths or densities.
The favicons are files of the brand kit in `public/favicon/`, copied without changes, so their
URLs do not change between builds.
The face icons in `src/assets/icon/` are the SVG files of the brand kit, kept as they are:
`FaceIcon` uses their URLs in `<img>` elements, and `astro build` only gives the files hashed
names.

`src/og-image.ts` draws an OGP image from a title, a language, a category and a sponsor with
Satori and sharp, in Node: the ink ground and grid of plan A in the dark colors of
`src/styles/tokens.css`, the orange band, the category chip and the name logo
`src/assets/name-logo/t3_full_for-dark.svg` of the brand kit, kept as it is. A sponsored post
also has a "PR" chip and a row with the sponsor's name. A title is cut after three lines with an
ellipsis, and a sponsor's name after one.

`astro build` writes the OGP images to `dist/client/og/`: `/og/ja.png` and `/og/en.png` for the
top pages and `/og/blog/<slug>.png` for every post (`src/og-pages.ts` gives the paths and what
each image says). They are drawn in Node, because sharp cannot be loaded in workerd, where the
pages are prerendered. The endpoint `src/pages/og/images.json.ts` lists the images, and the
`ogImages()` integration in `astro.config.mjs` draws them with `renderOgImage()` and the fonts of
`src/og-font.ts` when the build is done, then deletes the list. The build downloads the fonts, so
it needs the network, as the Fonts API already makes it. `astro dev` does not draw the images.

The avatar `src/assets/main-visual.webp` (the fourth pose of the Hero) is also turned into text art
for terminals. The `linaAnsiArt()` Vite plugin in `astro.config.mjs` calls `decodeAnsiArtSource()`
in `src/ansi-art-source.ts`, which resizes it with sharp to 80 pixels wide, and the endpoints in
`src/pages/ansi/` are prerendered to `/ansi/color.txt` (24-bit color) and `/ansi/plain.txt` (no
escape sequences) in `dist/client/`. The pose is centred in a transparent frame, so the figure is
indented by blank cells. Every line fits in 80 columns.

The avatars of the character are cut from v2.1, a set of transparent PNGs of 2160 × 3840,
3840 × 2160 and 4320 × 7680 pixels that is kept outside the repository (`~/Pictures/v2.1.zip`).
Unzip the set into a new empty directory and run `bun run import:avatars <directory>/v2.1` to
write nine lossless WebP files to `src/assets/`: the poses `rohan`, `lgtm-fullbody`,
`happy-fullbody` and `main-visual` (1356 × 2390, centred in a frame of the ratio 851:1500), the
three views `threeview-front`, `threeview-side` and `threeview-back` (459 × 1100, 316 × 1100 and
597 × 1100, the sizes of the annotation lines of the design), `lgtm-bastup` (748 × 600) and
`hate` (145 × 192). `scripts/avatars/avatars.ts` crops each original to the bounds of its
non-transparent pixels and shrinks it to at least twice the largest size it is shown at, which is
why the originals are not committed. `lgtm-bastup` is twice the 374px of the contact band; the
end of a post shows it up to 400px wide below 768px, a little more than half its width. The
output is the same on every run.

`src/avatar-images.ts` holds what a component needs to show the nine avatars with `Picture`: the
imported image, the key of its alt text in `src/i18n/ui.ts`, the candidate `widths`, the `sizes`
and `priority`. The four Hero poses are decorative, so their `alt` is empty, and only the first
(`rohan`) has `priority`, which turns off lazy loading and raises the fetch priority. A component
passes these values to `Picture` with `formats={["avif", "webp"]}` and `fallbackFormat="webp"`,
takes the `alt` from `avatarAlt(avatar, lang)`, and changes `widths` and `sizes` in the module
when a display size changes. `/dev/components/` shows all nine; they are written to `dist/`
only while a page uses them, so build with `LINA_DEV_PAGES=1` to see them.

Every file whose name carries a content hash, images and fonts included, is written to
`/_astro/`. `astro build` copies `public/_headers` to `dist/client/_headers`, and the
Cloudflare adapter puts its `/_astro/*` rule before the rules of that file. `public/_headers`
sets only security headers, on `/*` (see Project Structure), so `Cache-Control` comes from the
adapter's rule and from the Workers Static Assets default.

| Path        | `Cache-Control`                         | Set by                                  |
| :---------- | :-------------------------------------- | :-------------------------------------- |
| `/_astro/*` | `public, max-age=31536000, immutable`   | The Cloudflare adapter (`dist/client/_headers`) |
| HTML pages  | `public, max-age=0, must-revalidate`    | The Workers Static Assets default (with an `ETag`) |
| `/favicon/*` | `public, max-age=0, must-revalidate`   | The Workers Static Assets default (with an `ETag`) |

HTML is revalidated on every request, so a deploy shows up at once and a page never points
at hashed files that the deploy removed. The adapter skips its rule when a `_headers` file in
`public/` already sets `Cache-Control` on a rule that matches `/_astro/*`, such as `/*`.
`public/_headers` must therefore not set `Cache-Control` on `/*`, or the hashed files lose
their long cache; a test in `src/api.test.ts` fails when it does.

Article images are not build output. The publish Worker stores them in the R2 bucket
`lina-blog-images` under a content-hash name with `public, max-age=31536000, immutable`, and
they are served from `https://img.ikili.pro` (`docs/publish-api.md`).

## 🔎 Sitemap and robots.txt

`astro build` writes `/sitemap-index.xml` and the sitemap it lists with `@astrojs/sitemap` (`sitemap()` in `astro.config.mjs`).
The sitemap lists the pages of `src/pages/[lang]/` in every locale, and each entry links the same page in the other locales and `/` as `x-default` (`xhtml:link`).
`src/sitemap.ts` leaves out the dev pages under `/dev/` and every URL that does not end with `/`, such as `/llms.txt` and `/rss.xml`; the integration leaves out the 404 page.
`/robots.txt` (`src/pages/robots.txt.ts`) is prerendered like `/llms.txt`.
It allows every crawler, AI crawlers such as GPTBot and ClaudeBot included, and points to the sitemap with an absolute URL.

Cloudflare can block AI crawlers in front of the Worker and rewrite `/robots.txt`.
Before the site goes public, open the `ikili.pro` zone in the Cloudflare dashboard and turn these off:

1. Security > Settings, filtered by "Bot traffic": turn off "Set your preference to block training in robots.txt" (managed robots.txt, which prepends rules that disallow AI crawlers to `/robots.txt`). See https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/.
2. On the same page, allow every category in "Configure AI bot policies", and turn off the older "Block AI bots" if it is still shown (https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/).
3. In AI Crawl Control, set the action of every crawler that shows Block to Allow (https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/).
4. Check that `curl -fsS https://ikili.pro/robots.txt` prints the same text as `dist/client/robots.txt`.

## 🔒 Content Security Policy

`security.csp` in `astro.config.mjs` makes `astro build` write each page's Content Security
Policy into a `<meta http-equiv="content-security-policy">` at the end of `<head>`. Astro fills
`script-src` and `style-src` with the hashes of the scripts and styles it bundles and adds
`font-src 'self'` for the fonts. The config adds the rest:

| Directive    | Value set in `astro.config.mjs`                                         | For                                  |
| :----------- | :---------------------------------------------------------------------- | :----------------------------------- |
| `img-src`    | `'self' https://img.ikili.pro https://i.ytimg.com`                      | Article images and YouTube thumbnails |
| `script-src` | `'self' https://challenges.cloudflare.com` and the hash of `THEME_SCRIPT` | Turnstile's `api.js` and the theme script |
| `frame-src`  | `https://challenges.cloudflare.com https://www.youtube-nocookie.com`    | The Turnstile widget and article videos |

`THEME_SCRIPT` (`src/theme.ts`) is rendered with `is:inline`, which Astro does not hash, so
`astro.config.mjs` computes its SHA-256 hash from the constant instead of writing the value.
The script comes before the `<meta>`, which applies only to what follows it, so the hash has no
effect while the policy is a `<meta>`; it is there so that the same policy also works as a
header. The `slot="head"` script of `/dev/components/` is before the `<meta>` too.

No element has a `style` attribute, and the policy allows none: `styleDirective` is not set,
so `style-src` holds only `'self'` and the hashes of `<style>` elements. Pass values with classes
instead.
`src/styles/style-attributes.test.ts` fails when an `.astro` file has a `style` attribute or
`define:vars`, which Astro renders as `style` attributes.

`frame-ancestors` has no effect in a `<meta>`, so `public/_headers` and `src/api.ts` send it as
the `Content-Security-Policy` header, which holds nothing else. The header and the `<meta>`
therefore never need the same hashes.

To check the policy, build and capture pages with `.claude/scripts/screenshot.mjs`: each line
of its output lists the violations the page reported (`violations`). Turnstile loads only when
focus first enters the contact form or at the first submission, so a capture does not load it.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command               | Action                                              |
| :-------------------- | :-------------------------------------------------- |
| `bun install`         | Installs dependencies                               |
| `bun dev`             | Starts local dev server at `localhost:4321`         |
| `bun run build`       | Builds the site to `./dist/`                        |
| `bun preview`         | Previews the build locally in `workerd`             |
| `bun run preview:wrangler` | Builds, then serves the Worker with `wrangler dev` |
| `bun run dev:publish` | Serves the publish Worker with `wrangler dev` (secret from `workers/publish/.dev.vars`) |
| `bun run format`      | Formats files with Biome                            |
| `bun run lint`        | Lints files with Biome                              |
| `bun run check`       | Runs Biome formatting, lint and import checks       |
| `bun run test`        | Runs unit tests with Vitest                         |
| `bun run sync -- --vault <path>` | Syncs the Vault's articles to the publish Worker (`PUBLISH_URL`, `PUBLISH_TOKEN`); `--dry-run` only compares |
| `bun run a11y [path...]` | Audits `dist/client/` with axe and a contrast check (build with `LINA_DEV_PAGES=1` first) |
| `bun run lighthouse`  | Measures four pages of `./dist/` with Lighthouse CI (see "CI and deployment") |
| `bun run import:avatars <dir>` | Makes the nine avatar images in `src/assets/` from the v2.1 originals in `<dir>` |
| `bun astro ...`       | Runs CLI commands like `astro add`, `astro check`   |

Biome does not report the indentation inside the expressions of an `.astro` file (`{items.map((item) => (…))}`): `biome ci`, `biome check` and `biome format` leave it as written.
Only `biome check --write` re-prints each top-level expression (one that is not inside another expression), as if it began in column 0 of the file instead of at its `{`.
It indents the elements by 2 spaces per level from column 0 and puts the closing `))}` of the top-level expression in column 0; an expression nested inside it is indented by its level, and its `))}` lines up with the line that opens it.
It also joins an expression that fits on one line, and puts sibling elements that do not fit on one line on separate lines.
Write expressions in that form:

```astro
<ul>
  {items.map((item) => (
  <li>
    <a href={item.href}>{item.label}</a>
  </li>
))}
</ul>
```

The Claude Code hook (`.claude/hooks/biome-check.sh`) and the implementer of the issue workflow run `biome check --write` on the files they change, so any other form is rewritten the next time a file is edited.

## 🚢 CI and deployment

GitHub Actions runs four workflows:

- `.github/workflows/ci.yml` runs on every pull request: `biome ci`, `astro check`, `bun run test` and `bun run build`.
- `.github/workflows/lighthouse.yml` runs on every pull request: it builds the site with
  `LINA_DEV_PAGES=1`, measures `/ja/`, `/en/`, `/blog/` and `/blog/dev-preview-sample/` served
  by `wrangler dev` with Lighthouse CI as mobile (three runs each, set in `lighthouserc.cjs`) and
  writes the scores of Performance, Accessibility, Best Practices and SEO to the job summary
  (Actions > the run > Summary). A Performance score under the page's target in
  `lighthouserc.cjs` fails the job: the target of `/blog/` is 95 and those of `/ja/`, `/en/` and
  `/blog/dev-preview-sample/` are lower. A score of another category under 95 only makes a
  warning in the log.
- `.github/workflows/deploy.yml` builds the site and runs `wrangler deploy`. For now it only runs when started manually (Actions > Deploy > Run workflow); it will run on every push to `main` once the site is ready to go public. A running deploy always finishes; if several runs are queued meanwhile, only the latest waiting run is kept.
- `.github/workflows/deploy-publish.yml` runs `wrangler deploy` for the publish Worker in
  `workers/publish/`. Like the site deploy, it only runs when started manually for now (Actions >
  Deploy publish Worker > Run workflow).

Until then, check the Worker locally with `bun run preview:wrangler`, which builds the site and serves `dist/` with `wrangler dev` (static pages, `/api/*` and the other Hono routes).

Check the publish Worker locally by copying `workers/publish/.dev.vars.example` to
`workers/publish/.dev.vars` and running `bun run dev:publish`. Every route needs
`Authorization: Bearer <PUBLISH_TOKEN>`; without it the Worker answers 401.
`GET /articles` reads `src/content/published.json` on GitHub with `GITHUB_TOKEN`. To try it
without GitHub, add `GITHUB_API_URL=http://127.0.0.1:<port>` to `.dev.vars` and serve a
directory with `python3 -m http.server <port>`: the list is empty until the directory has
`repos/neverclear86/lina-blog/contents/src/content/published.json`.
`HEAD` and `PUT /images/<sha256>.<ext>` use a local R2 bucket that `wrangler dev` keeps in
`workers/publish/.wrangler/state`.
`PUT /articles/<slug>` checks the article, looks up its `image:` references in that bucket,
commits the article and `src/content/published.json` to `main` with `GITHUB_TOKEN`, and posts
its Nostr event signed by the bunker of `NOSTR_BUNKER_URL`; with `.dev.vars.example` no bunker
answers, so it ends with 502 (`step: "nostr"`) after the commit. A mock at `GITHUB_API_URL`
must then also answer the Git database API (`git/ref`, `git/commits`, `git/trees`,
`git/refs`), which `python3 -m http.server` cannot. An article with the tag 技術 is also
written to `articles/<slug>.md` on `master` of `neverclear86/zenn-contents`, so the mock must
answer the same API for `repos/neverclear86/zenn-contents` too.
`DELETE /articles/<slug>` reads the published record with `GITHUB_TOKEN`, posts a deletion
request (kind 5) signed by the bunker of `NOSTR_BUNKER_URL`, sets the article's file in
zenn-contents to `published: false`, deletes the images that only this article uses from that
bucket, and commits the removal to `main`. With `.dev.vars.example`
alone GitHub answers 401 (`step: "record"`); with a mock at `GITHUB_API_URL` that also serves
`repos/neverclear86/lina-blog/git/ref/heads/main`, it ends with 502 (`step: "nostr"`) after
reading the record.

Run Lighthouse CI locally with `LINA_DEV_PAGES=1 bun run build` and then `bun run lighthouse`,
which starts `wrangler dev` itself (on port 4321, or on `LHCI_PORT`; the inspector uses the next
port) and keeps the reports in `.lighthouseci/`, which git ignores. Set `CHROME_PATH` if Chrome
is not found.
`bun scripts/lighthouse/report.ts` prints the table that the workflow writes to the job summary.

Both deploy workflows need the same two repository secrets:

1. In the Cloudflare dashboard, create an API token from the "Edit Cloudflare Workers" template, limited to this account (at minimum `Account` > `Workers Scripts` > `Edit`).
2. Copy the account ID from the Workers & Pages overview.
3. Register both secrets:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

The publish Worker also needs four secrets on Cloudflare, each set once: its shared secret
(`bunx wrangler secret put PUBLISH_TOKEN -c workers/publish/wrangler.jsonc`), a GitHub token
with read and write access to the contents of this repository and of `neverclear86/zenn-contents`
(fine-grained: "Contents: Read and write" on both)
(`bunx wrangler secret put GITHUB_TOKEN -c workers/publish/wrangler.jsonc`), the private key
(64 hex digits) of its NIP-46 client
(`bunx wrangler secret put NOSTR_CLIENT_KEY -c workers/publish/wrangler.jsonc`), and the bunker
URL issued by nostr-no-su, `bunker://<pubkey>?relay=...&secret=...`, which contains a secret and
is never committed
(`bunx wrangler secret put NOSTR_BUNKER_URL -c workers/publish/wrangler.jsonc`).

It also stores images in the R2 bucket `lina-blog-images`, created once with
`bunx wrangler r2 bucket create lina-blog-images`. Connect `img.ikili.pro` to the bucket as a
custom domain (R2 > lina-blog-images > Settings > Custom Domains) and leave the `r2.dev` URL
disabled; it is rate-limited and meant for development.

## 🛡️ Turnstile

`src/turnstile.ts` checks Turnstile tokens with Cloudflare's siteverify API. The secret key is a Worker secret named `TURNSTILE_SECRET_KEY` and is never committed:

- In production, register it with `bunx wrangler secret put TURNSTILE_SECRET_KEY`.
- Locally, put it in `.dev.vars` at the root of the repository (ignored by git). `wrangler dev`, which `bun run preview:wrangler` runs, reads it and prints `Using secrets defined in .dev.vars` on startup.

The contact form (`src/components/contact/ContactForm.astro`) renders the widget with the site key `TURNSTILE_SITE_KEY`, a public variable declared with `astro:env` in `astro.config.mjs`. Pages are prerendered, so `astro build` reads it from the environment or from `.env` at the root of the repository (ignored by git), not from `.dev.vars`. Without it the build uses Cloudflare's test site key `1x00000000000000000000AA`, whose widget always passes with the dummy token `XXXX.DUMMY.TOKEN.XXXX`. A production secret key rejects that token, so a production build must set the real site key.

Locally, use one of Cloudflare's test secret keys instead of the production key:

| Secret key | siteverify result |
| :-- | :-- |
| `1x0000000000000000000000000000000AA` | Always passes |
| `2x0000000000000000000000000000000AA` | Always fails (`invalid-input-response`) |

For example, `.dev.vars` with the key that always passes:

```sh
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

To see what a test key returns, post the dummy token to siteverify:

```sh
curl -sS -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
  --data-urlencode "secret=1x0000000000000000000000000000000AA" \
  --data-urlencode "response=XXXX.DUMMY.TOKEN.XXXX"
```

The first key answers `"success":true`, and the second answers `"success":false` with `"error-codes":["invalid-input-response"]`.

To check a test key through the contact form route, see the `curl` example in "Contact notifications".

## 📧 Contact notifications

`POST /api/contact` (`src/api.ts`) sends the contact form notification to the site owner
through the `CONTACT_MAIL` binding (`send_email` in `wrangler.jsonc`). The recipient address is
kept out of the repository and is given as the `CONTACT_MAIL_TO` secret.

1. In the Cloudflare dashboard, enable Email Routing for `ikili.pro`. A Worker can only send
   from an address on a domain with Email Routing enabled; the sender is `noreply@ikili.pro`,
   the only address in `allowed_sender_addresses`.
2. In Email Routing > Destination addresses, add the recipient address and open the link in the
   verification mail. The binding only sends to verified destination addresses.
3. Register the recipient as a Worker secret:

   ```sh
   bunx wrangler secret put CONTACT_MAIL_TO
   ```

For local checks, put the address in `.dev.vars` at the repository root (ignored by Git), next
to a Turnstile test secret key (see "Turnstile" above).
`wrangler dev` (`bun run preview:wrangler`) reads it and does not deliver the mail:

```sh
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
CONTACT_MAIL_TO=you@example.com
```

`POST /api/contact` takes the form fields `kind`, `name`, `email`, `message` and
`cf-turnstile-response` as `multipart/form-data` or `application/x-www-form-urlencoded`, and
answers with JSON:

| Status | Body | When |
| :-- | :-- | :-- |
| 200 | `{"ok":true}` | The notification was sent |
| 400 | `{"ok":false,"error":"invalid","fields":{…}}` | `fields` maps each rejected field to `required`, `invalid`, `too_long` or `newline` |
| 403 | `{"ok":false,"error":"turnstile"}` | The Turnstile token is missing or rejected |
| 500 | `{"ok":false,"error":"failed"}` | A secret is not set, or sending failed |
| 503 | `{"ok":false,"error":"failed"}` | siteverify could not be reached |

With the `.dev.vars` above, this request answers 200 and `wrangler dev` prints the mail instead
of sending it. With `TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA` it answers 403:

```sh
curl -sS -X POST http://localhost:8787/api/contact -F kind=work -F name=Lina \
  -F email=you@example.com -F message=Hello -F cf-turnstile-response=XXXX.DUMMY.TOKEN.XXXX
```

## 📚 Docs

- [Publishing Worker API](docs/publish-api.md) (in Japanese): the contract between the article sync script and the publishing Worker, covering authentication, requests and responses, errors, the list of published articles and its content hash, and the processing order and retries.
- [Writing an article body](docs/markdown.md) (in Japanese): the Markdown of an article, the message boxes and the accordion written as raw HTML, and the rules that HTML follows.
- [Vault articles and sync](docs/vault-sync.md) (in Japanese): how to write articles in the Obsidian Vault (files, properties, publishing and taking down, Obsidian syntax, sync errors), the Templater template, the Bases view and the Hermes skill that runs the sync.

## 📄 License

The source code is released under the [MIT License](LICENSE).

The following are not covered by the MIT License. All rights are reserved by Tsukusu Lina:

- The character Tsukusu Lina, and images that depict the character or the ikili.pro brand, such as illustrations, logos and pixel art, wherever they are in this repository (for example `public/` and `src/assets/`)
- Blog posts and other written content published on the site

The service icons in `src/components/icons/` are not covered by the MIT License either. They are trademarks or works of their owners and are used under the terms listed in [src/components/icons/README.md](src/components/icons/README.md).
