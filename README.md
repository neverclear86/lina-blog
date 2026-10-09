# Astro Starter Kit: Basics

```sh
bun create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

```text
/
├── docs/
│   └── publish-api.md    # API contract between the article sync script and the publishing Worker
├── public/
│   └── favicon/          # Favicons from the brand kit, unchanged: the mark /li on ink as SVG, and PNGs of 32, 180 and 192 pixels
├── scripts/
│   ├── avatars/          # Makes the avatar images in src/assets/ from the v2.1 originals (bun run import:avatars), unit-tested
│   └── sync/             # Article sync script for the publish Worker: Vault scan, images, Markdown, diff and API client, unit-tested
├── src/
│   ├── ansi-art.ts       # Pixels to terminal text art (half blocks, 24-bit color), unit-tested
│   ├── ansi-art-source.ts # The illustration of the text art, decoded and resized to 80 pixels wide, unit-tested
│   ├── contact.ts        # Contact form input validation, unit-tested
│   ├── api.ts            # Hono routes handled by the Worker (/, /api/*), unit-tested
│   ├── avatar-images.ts  # The nine v2.1 avatar images of src/assets/ with their alt keys, widths, sizes and priority, unit-tested
│   ├── blog-pages.ts     # Tag pages of /blog/tags/<slug>/, the heading texts, the breadcrumbs and the tag filter links of the blog pages, unit-tested
│   ├── blog-rss.ts       # Blog posts to /rss.xml items (【PR】 on sponsored posts), unit-tested
│   ├── blog-schema.ts    # Frontmatter schema of blog posts (no astro:content), unit-tested
│   ├── cloudflare-workers.d.ts # Types of env from cloudflare:workers (bindings and secrets)
│   ├── contact-form.ts   # Contact form states before and after sending, their UI strings and the widget size, unit-tested
│   ├── contact-mail.ts   # Builds the contact notification mail for the send_email binding
│   ├── content.config.ts # blog and works collections: src/content/blog/ (and blog-dev/ in astro dev) checked by blog-schema.ts, src/content/works/ checked by work-schema.ts
│   ├── fetch.ts          # Worker entry (advanced routing): api.ts, then the Astro handlers
│   ├── latest-videos.ts  # Splits the YouTube videos into the Latest card and list, JST dates, unit-tested
│   ├── llms.ts           # Builds /llms.txt (site summary and links for LLMs), unit-tested
│   ├── lina-ansi-art.d.ts # Types of virtual:lina-ansi-art, the text art built in astro.config.mjs
│   ├── og-font.ts        # Downloads the OGP fonts (headings and labels) as TrueType from Google Fonts, unit-tested
│   ├── page-meta.ts      # Description (default from ui.ts) and Open Graph tags of a page, unit-tested
│   ├── profile-links.ts  # Profile links (service, label and note per locale), shared by llms.ts, text-site.ts, LatestVideoFeature.astro, LatestVideoList.astro and Hero.astro
│   ├── sitemap.ts        # Sitemap filter and x-default link, and the /robots.txt text, unit-tested
│   ├── text-site.ts      # Builds the text version of the site for curl (80 columns), unit-tested
│   ├── theme.ts          # Theme key and values, the inline script that sets <html data-theme> and the toggle, unit-tested
│   ├── turnstile.ts      # Turnstile token check with siteverify (injectable fetch), unit-tested
│   ├── user-agent.ts     # Tells curl and other command-line clients from browsers, unit-tested
│   ├── work-card.ts      # Order and link target of the work cards on the top page, unit-tested
│   ├── work-pages.ts     # Paths of the pages of works and the rows of their links, unit-tested
│   ├── work-schema.ts    # Schema of the works data (ja and en in one entry, no astro:content), unit-tested
│   ├── youtube-feed.ts   # Channel RSS feed to the newest videos at build time (WebP or JPEG thumbnails), unit-tested
│   ├── assets/           # Images processed by astro:assets
│   │   ├── <avatar>.webp   # Nine avatars of v2.1 (rohan, lgtm-fullbody, happy-fullbody, main-visual, threeview-front/side/back, lgtm-bastup, hate), made by scripts/avatars/ (see "Images and caching")
│   │   ├── icon/           # Face mark and avatar SVGs of the brand kit (regular and small versions), used as they are by FaceIcon
│   │   ├── logo-black.png  # Black logo (light theme, or inverse faces on the dark theme), optimized by astro:assets
│   │   ├── logo-light.png  # Logo (light theme)
│   │   └── logo-white.png  # White logo (dark theme, or inverse faces on the light theme)
│   ├── components/
│   │   ├── About.astro           # About section: heading, lead and three terminal cards
│   │   ├── ArticleBody.astro     # Styles rendered Markdown (body text, headings, lists, quotes, images, tables, task lists, footnotes, inline code, code blocks, code file names, YouTube embeds)
│   │   ├── BlogIndex.astro       # Blog pages: PageHead with the breadcrumb, the h1 and the tag filter (.ws links), and the post cards
│   │   ├── Bubble.astro          # Speech bubble on --blush with a hard shadow
│   │   ├── Button.astro          # Orange main button, as a link or a <button>
│   │   ├── Chip.astro            # Small notched label in pink, orange or neutral, optionally tilted
│   │   ├── ContactSection.astro  # Contact section of the top page: heading, lead and the form in a paper terminal window, sent with Turnstile by its script
│   │   ├── face-icon.ts          # Picks the brand kit files of a face mark or avatar from its size and tone, unit-tested
│   │   ├── FaceIcon.astro        # Face mark or avatar from the brand kit SVGs, switched with the theme; tone="inverse" for the mark on --inv and --cbg faces
│   │   ├── Hero.astro            # Hero of the top page: full-sub name logo with a blinking cursor, tagline chip, intro and profile links
│   │   ├── IconButton.astro      # Square icon-only button, named by an aria-label or a hidden label slot
│   │   ├── IconLink.astro        # Icon square with a label below, for the social links
│   │   ├── Kao.astro             # Three kaomoji switching every 2 seconds; only the first under reduced motion
│   │   ├── label-break.ts        # Splits a label before "(" for a <wbr>, unit-tested
│   │   ├── LatestPosts.astro     # Blog block of the Latest section: newest posts with tag chips
│   │   ├── LatestVideoFeature.astro # Latest section: newest video as a large window with a NEW chip, or a no-signal window that links to the channel
│   │   ├── LatestVideoList.astro # Latest section: the next videos as small windows with JST dates, and the YouTube channel button; hidden below 768px
│   │   ├── Logo.astro            # Switches the logo with the theme; tone="inverse" for --inv faces
│   │   ├── NameLogo.astro        # Name logo of the brand kit as inline SVG: compact, full and full-sub, painted with the --lg-* tokens
│   │   ├── PageHead.astro        # Head of the blog pages: grid background, diagonal band and the slot with an h1
│   │   ├── PostCard.astro        # Blog post card: emoji tile, title, JST date, tag chips and a PR chip; the whole card is a link
│   │   ├── PostList.astro        # Post cards in one column, two from 1024px, or one line when there are none
│   │   ├── SectionHeading.astro  # ~/label, English display title and subtitle; the level and the contact variant are props
│   │   ├── SectionTitle.astro    # Section heading of plan A: number chip, English name, line, path and link, and the Japanese heading; the size is a prop
│   │   ├── site-nav.ts           # Link targets of the header navigation and language switch, unit-tested
│   │   ├── SiteFooter.astro      # Footer on --bg: full name logo, © year and name, curl hint
│   │   ├── SiteHeader.astro      # Site header: compact name logo, navigation, JA / EN, theme switch, contact button, and a popover menu below 1024px
│   │   ├── Tape.astro            # Orange and ink stripes flowing right with transform; stops under reduced motion
│   │   ├── ThemeToggle.astro     # Theme switch: moon or sun, and a name that says the next theme
│   │   ├── TerminalCard.astro    # Terminal window card with a title bar; a link when given href
│   │   ├── WorkTile.astro        # Window tile of a work: ~/works/<title>, a line of description and the technology tags; a link or a plain box
│   │   ├── Works.astro           # Works section of the top page (04 works): the heading and a WorkTile per work, from the works collection
│   │   └── icons/                # Service icons for IconLink; sources and terms in icons/README.md
│   ├── content/
│   │   ├── blog-dev/     # Posts for checking how pages look; loaded by astro dev only
│   │   └── works/        # Works, one YAML file per work (placeholder data), with placeholder.png
│   ├── dev/
│   │   ├── components.astro  # /dev/components/: samples of the shared shapes, animations, components and avatar images
│   │   ├── dev-pages.ts      # Adds the dev pages in astro dev (or with LINA_DEV_PAGES=1), unit-tested
│   │   └── markdown.astro    # /dev/markdown/: sample article with every supported Markdown syntax
│   ├── i18n/
│   │   ├── locales.ts    # Locales (ja, en) and the default, also read by astro.config.mjs
│   │   ├── negotiate.ts  # Picks the locale for / from Accept-Language, unit-tested
│   │   ├── paths.ts      # Path of the same page in another locale, and the canonical and hreflang URLs of a page, unit-tested
│   │   └── ui.ts         # UI strings per locale, unit-tested
│   ├── layouts/
│   │   └── Layout.astro       # <head> with the page title (title prop), the theme script, the <Font /> tags, the RSS link, the canonical and hreflang links (src/i18n/paths.ts), the description and Open Graph tags (description prop, src/page-meta.ts) and a "head" slot; imports tokens.css, global.css, shapes.css, controls.css, window.css, labels.css and motion.css; sets --font-body and --font-mono on html; puts the site header (SiteHeader.astro) at the top of <body> and the site footer at the end of <body>, at the bottom of the viewport on a short page
│   ├── markdown/
│   │   ├── code-filename.ts  # Sätteri mdast plugin: code block file names as <figure>, unit-tested
│   │   ├── highlight.css     # Code block frame and role colors
│   │   ├── highlight.ts      # Shiki highlighting of code blocks with role classes, unit-tested
│   │   ├── sample.md         # Sample article shown at /dev/markdown/
│   │   ├── table-align.ts    # Sätteri hast plugin: table alignment as classes, unit-tested
│   │   └── youtube.ts        # Sätteri hast plugin: YouTube URL paragraphs as iframes, unit-tested
│   ├── pages/
│   │   ├── 404.astro     # /404.html: the 404 page, served for every path with no file
│   │   ├── [lang]/
│   │   │   ├── index.astro   # /ja/ and /en/
│   │   │   └── works/
│   │   │       └── [slug].astro  # /ja/works/<slug>/ and /en/works/<slug>/ for the works with hasPage
│   │   ├── ansi/
│   │   │   ├── color.txt.ts  # /ansi/color.txt: the avatar main-visual as 24-bit color text art
│   │   │   └── plain.txt.ts  # /ansi/plain.txt: the same art without escape sequences
│   │   ├── blog/
│   │   │   ├── index.astro   # /blog/: every post, newest first
│   │   │   └── tags/
│   │   │       └── [tag].astro   # /blog/tags/devlog/, tech/ and diary/: the posts of one tag, built with or without posts
│   │   ├── llms.txt.ts   # /llms.txt, prerendered to dist/client/
│   │   ├── robots.txt.ts # /robots.txt, prerendered to dist/client/
│   │   ├── rss.xml.ts    # /rss.xml: prerendered RSS feed with each post's full HTML
│   │   └── text/
│   │       └── [lang].txt.ts # /text/ja.txt and /text/en.txt: prerendered text version of the site
│   └── styles/
│       ├── controls.css  # Buttons (.btn, .btn-acc, .btn-ghost), icon links (.sq, .iconbtn) and page switch links (.ws) of plan A
│       ├── global.css    # body colors and their fade, the links, the keyboard focus outline, and the grid backgrounds (.grid, .cgrid)
│       ├── labels.css    # Labels of plan A: .label, .tag and the category chip .chip-acc
│       ├── motion.css    # Animations that keep running (.bob, .blink-on, .caret, .a-typeLoop) and the section reveal on scroll (.reveal), stopped under reduced motion
│       ├── shapes.css    # Notched corners, hard shadows and the lift
│       ├── tokens.css    # Color tokens; the theme is the data-theme attribute on <html>, set by src/theme.ts
│       └── window.css    # Windows (.win), corner ticks (.ticks, .ticks-acc), grid and stripe backgrounds and the avatar shadow of plan A
├── workers/
│   └── publish/          # Publish Worker, separate from the site and deployed on its own
│       ├── src/
│       │   ├── app.ts               # Hono app and Worker entry; every route needs the shared secret
│       │   ├── article-event.ts     # Builds the unsigned kind 30023 (NIP-23) event of an article
│       │   ├── article-markdown.ts  # Splits an article's markdown and checks its frontmatter (blog-schema.ts without date)
│       │   ├── auth.ts              # Bearer auth with a constant-time comparison
│       │   ├── content-hash.ts      # Content hash of an article (SHA-256 of its markdown)
│       │   ├── env.ts               # Bindings (PUBLISH_TOKEN, GITHUB_TOKEN, GITHUB_API_URL, IMAGES)
│       │   ├── errors.ts            # Error body shared by every error response
│       │   ├── images.ts            # Image names, R2 lookups and uploads for /images/{name}
│       │   ├── nostr-relays.ts      # Reads write relays (kind 10002) and sends events to relays
│       │   └── published-record.ts  # Reads src/content/published.json on GitHub for GET /articles
│       ├── .dev.vars.example
│       └── wrangler.jsonc
├── astro.config.mjs      # Cloudflare adapter, self-hosted fonts, Sätteri Markdown, dev pages, text art plugin, sitemap; pages are prerendered by default
├── biome.json
├── wrangler.jsonc
└── package.json
```

Pages are prerendered unless they export `prerender = false`. The Worker runs first only for `/` and `/api/*` (`assets.run_worker_first` in `wrangler.jsonc`); other static files are served from Workers Static Assets, and a `GET` for a path with no file gets `/404.html` (`src/pages/404.astro`) with status 404 without starting the Worker (`assets.not_found_handling`), so a page that exports `prerender = false` must also be added to `assets.run_worker_first`. `/` has no page: the route in `src/api.ts` answers command-line clients such as curl (`src/user-agent.ts`) with `text/plain`, and redirects other clients to `/en/` when `Accept-Language` prefers English over Japanese and to `/ja/` otherwise. The text is the text art `/ansi/color.txt`, a blank line and the text version `/text/en.txt` or `/text/ja.txt`, chosen by `Accept-Language` in the same way, which the Worker fetches through the `ASSETS` binding (`assets.binding` in `wrangler.jsonc`). Without the text art it is the text version alone; without the text version it is a short notice with the top page's URL and status 503. All three responses carry `Vary: User-Agent, Accept-Language`. Every response of `/` also carries the security headers of Hono's `secureHeaders()` with its defaults (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer` and others), added by middleware in `src/api.ts`, because a `_headers` file applies to static assets only and not to responses from the Worker. Do not add `src/pages/index.astro`, because the adapter serves a prerendered page before the Hono app sees the request. Requests to `/` and `/api/*` go to the Hono app in `src/fetch.ts`, which serves the routes in `src/api.ts`; a request that no route matches, such as `/api/nope` or a `POST` to `/`, gets the same 404 page from Astro's handlers. Astro calls that app with the request only, so `src/fetch.ts` passes the Worker's bindings and secrets (`env` from `cloudflare:workers`) to it.

Pages that exist in every language go in `src/pages/[lang]/` and are generated once for each locale in `src/i18n/locales.ts` (`/ja/`, `/en/`); their UI strings come from `src/i18n/ui.ts`. Pages outside `[lang]/`, such as the Japanese-only blog under `/blog/`, have no language prefix. Astro's `i18n()` handler in `src/fetch.ts` is never reached, so `astro build` warns that the project does not call it; running it would answer 404 for those unprefixed paths. The layout links every page to the same path in the other locales (`src/i18n/paths.ts`); a page without a language prefix links to the other locale's top page. Every page also has a canonical link and hreflang alternates, as absolute URLs under `site` in `astro.config.mjs` (`canonicalUrl` and `alternateLinks` in `src/i18n/paths.ts`): a page under `[lang]/` lists itself in each locale and `x-default` pointing to `/`, and a page without a language prefix lists only itself, in Japanese.

Blog posts are Markdown files in `src/content/blog/`, committed by the publishing Worker. Posts for checking how pages look go in `src/content/blog-dev/`: `astro dev` loads them into the same `blog` collection and checks them with the same schema, and `astro build` leaves them out, so they never reach `dist/`.

Markdown is rendered by Sätteri with the plugins in `src/markdown/`. `/dev/markdown/`, a dev page (see “CSS”), shows `src/markdown/sample.md`, a sample article with every supported syntax. Code blocks are highlighted at build time by `src/markdown/highlight.ts`, which gives tokens role classes such as `hl-keyword` instead of inline styles; `markdown.syntaxHighlight` is off so Astro's own Shiki does not run. A paragraph that holds only a YouTube video URL (`https://youtu.be/<ID>` or `https://www.youtube.com/watch?v=<ID>`) becomes a lazily loaded `youtube-nocookie.com` player.

`astro build` also writes the text version of the site for command-line clients to `/text/ja.txt` and `/text/en.txt` (`src/pages/text/[lang].txt.ts`, built by `src/text-site.ts`): the about text, the works, the five latest posts, the profile links and how to get in touch, with every line in 80 terminal columns. The profile links come from `src/profile-links.ts`, which `/llms.txt` and the Latest section and the hero of the home page use as well.

Unit tests (`*.test.ts` next to the code) cover logic such as the Hono routes, the blog frontmatter schema, the RSS items and the Markdown plugins; `src/api.ts` and
`workers/publish/src/app.ts` are tested with `app.request()`, and the plugins in `src/markdown/` with Sätteri's `markdownToHtml()`. Pages are checked with screenshots instead: `node .claude/scripts/screenshot.mjs --root . --port 4611 --out /tmp/shots /` serves `dist/` without building it, so run `bun run build` first. It uses Playwright's Chromium (`bunx playwright install chromium` if it is not installed yet).

Colors are tested the same way. `src/styles/tokens.test.ts` checks that the plan A tokens have the values of the design, that every foreground and background token pair used for text (a translucent background is laid over each fill that can come under it) reaches 4.5:1 (WCAG AA) in both themes and that every icon color reaches 3:1 on `--surf`, `--focus-ring` on the page backgrounds, every diff bar of a code block on its line and the focus ring of a code block on `--code`, and `src/styles/hardcoded-colors.test.ts` fails when a color value (`#rrggbb`, `rgb()`, `hsl()` and the like) is written in a `.css` file other than `src/styles/tokens.css`, or in a `<style>` element or a `style`, `fill`, `stroke`, `stop-color` or `color` attribute of an `.astro` file. Use the tokens (`var(--fg)` and so on) instead; inline SVG takes `currentColor`. The service icons in `src/components/icons/` are also checked by `icons.test.ts`: their `fill` and `stroke` are only `currentColor` or `none`, because named colors such as `black` pass the check above.

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🎨 CSS

CSS is plain CSS: a few global files in `src/styles/` and a scoped `<style>` in each component.
`src/layouts/Layout.astro` imports the global files, so they apply to every page.

| File         | Holds                                                                      |
| :----------- | :------------------------------------------------------------------------- |
| `tokens.css` | Color tokens (CSS variables): the plan A tokens for the light and dark themes, the colors that stay the same in both themes, and the legacy tokens (including `--legacy-line`, `--legacy-grid` and `--legacy-ink`) kept until the components of the earlier design are removed |
| `global.css` | Styles of `body` (colors and their fade between the themes), the links, the keyboard focus outline and decorations used across pages, such as `.grid` and `.cgrid` |
| `shapes.css` | Notched corners (`.shape`, `.shapeL`, `.shapeS`), hard shadows (`.shadow`, `.shadowF`, `.shadowInk`) and the hover lift (`.lift`) |
| `controls.css` | Buttons (`.btn`, `.btn-acc`, `.btn-ghost`), icon links (`.sq`, `.iconbtn`, `.iconbtn-acc`) and page switch links (`.ws`, `.ws.on`) of plan A |
| `window.css` | Plan A windows (`.win`; a link window turns its border on hover), corner ticks (`.ticks`, and `.ticks-acc` inside an `.acct`), the grid and stripe backgrounds (`.gridbg`, `.stripes`) and the avatar shadow (`.av-shadow`). The turn of the border and the spread of the ticks stop their transitions under `prefers-reduced-motion: reduce` |
| `labels.css` | Labels of plan A: the caption `.label`, the bordered tag `.tag` and the orange category chip `.chip-acc` |
| `motion.css` | Animations that keep running: the pixel art bob (`.bob`), the blinking cursors (`.caret`, and `.blink-on` for the name logo) and the typed command (`.a-typeLoop`); and the section reveal on scroll (`.reveal`), enabled only inside `@supports (animation-timeline: view())`. All are stopped under `prefers-reduced-motion: reduce` |

A global file holds only what several components share.
Styles that belong to one component go in that component's scoped `<style>`.
Color values are written only in `tokens.css`; other CSS, global or scoped, uses the tokens with `var(--…)`. The one exception is `black` in the masks of `window.css`, which sets only the opacity and is never drawn.
A component that must style an element outside its own markup, such as `<html data-theme>`,
wraps only that selector in `:global()`.

The inline script in the `<head>` of `src/layouts/Layout.astro` (`THEME_SCRIPT` in `src/theme.ts`) sets `<html data-theme>` before the first paint.
It sets the light theme when `localStorage` holds `light` under the key `theme`, and the dark theme in every other case: nothing saved, any other value, or `localStorage` throwing. It does not read `prefers-color-scheme` and does not follow changes of the OS setting.
Without JavaScript, the page keeps the dark theme that `Layout.astro` renders.
`src/components/ThemeToggle.astro` switches the theme with `toggleTheme` and saves it under the same key; when saving throws, the switch lasts only until the next page.

`src/dev/components.astro` shows the shared shapes, the shared animations, the components and the avatar images on one page, and `src/dev/markdown.astro` shows `src/markdown/sample.md` the way articles are rendered.
`astro dev` serves them at `/dev/components/` and `/dev/markdown/`, and `astro build` leaves them out of `dist/` unless `LINA_DEV_PAGES=1` is set.
Add `?theme=dark` or `?theme=light` to the URL of `/dev/components/` to see that theme whatever is saved.
To capture them with `.claude/scripts/screenshot.mjs`, which serves `dist/`, build with `LINA_DEV_PAGES=1 bun run build`.
A new component adds its samples to `/dev/components/`, and a new Markdown syntax adds its examples to `src/markdown/sample.md`.

## 🔤 Fonts

Fonts are self-hosted with the Astro Fonts API (`fonts` in `astro.config.mjs`). `astro build`
downloads them from Google Fonts, and pages load them from `/_astro/fonts/`, never from a font
CDN. `src/layouts/Layout.astro` emits the `@font-face` rules on every page, sets `--font-body` on
`html` and builds `--font-mono` there from `--font-mono-latin` (JetBrains Mono) and
`--font-body`. No font file is preloaded.

| CSS variable     | Font                                                  | Weights       | Used for                                                                                                              |
| :--------------- | :---------------------------------------------------- | :------------ | :-------------------------------------------------------------------------------------------------------------------- |
| `--font-body`    | Zen Kaku Gothic New                                   | 400, 700, 900 | Everything by default: Japanese and body text, headings, navigation, buttons                                          |
| `--font-mono`    | JetBrains Mono, then Zen Kaku Gothic New for Japanese | 400-800       | Labels, numbers, dates and code                                                                                       |
| `--font-display` | Saira Condensed                                       | 600, 800      | Old design only: ABOUT (800) in `SectionHeading.astro`; removed with it                                               |

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

Raster images in `src/assets/` are rendered with `Picture` or `getImage` from `astro:assets`.
`astro build` converts them once (`imageService: "compile"`), so no image is transformed at
request time. Photos and the logo are offered as AVIF and WebP at several widths or densities.
The pixel art stays PNG at a fixed size, so no pixel is blended.
The favicons are files of the brand kit in `public/favicon/`, copied without changes, so their
URLs do not change between builds.
The face icons in `src/assets/icon/` are the SVG files of the brand kit, kept as they are:
`FaceIcon` uses their URLs in `<img>` elements, and `astro build` only gives the files hashed
names.

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
why the originals are not committed. The output is the same on every run.

`src/avatar-images.ts` holds what a component needs to show the nine avatars with `Picture`: the
imported image, the key of its alt text in `src/i18n/ui.ts`, the candidate `widths`, the `sizes`
and `priority`. The four Hero poses are decorative, so their `alt` is empty, and only the first
(`rohan`) has `priority`, which turns off lazy loading and raises the fetch priority. A component
passes these values to `Picture` with `formats={["avif", "webp"]}` and `fallbackFormat="webp"`,
takes the `alt` from `avatarAlt(avatar, lang)`, and changes `widths` and `sizes` in the module
when a display size changes. `/dev/components/` shows all nine; they are written to `dist/`
only while a page uses them, so build with `LINA_DEV_PAGES=1` to see them.

Every file whose name carries a content hash, images and fonts included, is written to
`/_astro/`. The repository has no `_headers` file: the Cloudflare adapter writes
`dist/client/_headers` during `astro build` with one rule, and Workers Static Assets serves
the other files with its default.

| Path        | `Cache-Control`                         | Set by                                  |
| :---------- | :-------------------------------------- | :-------------------------------------- |
| `/_astro/*` | `public, max-age=31536000, immutable`   | The Cloudflare adapter (`_headers`)     |
| HTML pages  | `public, max-age=0, must-revalidate`    | The Workers Static Assets default (with an `ETag`) |
| `/favicon/*` | `public, max-age=0, must-revalidate`   | The Workers Static Assets default (with an `ETag`) |

HTML is revalidated on every request, so a deploy shows up at once and a page never points
at hashed files that the deploy removed. The adapter skips its rule when a `_headers` file in
`public/` already sets `Cache-Control` on a rule that matches `/_astro/*`, such as `/*`. A
`public/_headers` added later must therefore not set `Cache-Control` on `/*`, or the hashed
files lose their long cache.

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
| `bun run import:avatars <dir>` | Makes the nine avatar images in `src/assets/` from the v2.1 originals in `<dir>` |
| `bun astro ...`       | Runs CLI commands like `astro add`, `astro check`   |

## 🚢 CI and deployment

GitHub Actions runs three workflows:

- `.github/workflows/ci.yml` runs on every pull request: `biome ci`, `astro check`, `bun run test` and `bun run build`.
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

Both deploy workflows need the same two repository secrets:

1. In the Cloudflare dashboard, create an API token from the "Edit Cloudflare Workers" template, limited to this account (at minimum `Account` > `Workers Scripts` > `Edit`).
2. Copy the account ID from the Workers & Pages overview.
3. Register both secrets:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

The publish Worker also needs two secrets on Cloudflare, each set once: its shared secret
(`bunx wrangler secret put PUBLISH_TOKEN -c workers/publish/wrangler.jsonc`) and a GitHub token
with read access to this repository's contents
(`bunx wrangler secret put GITHUB_TOKEN -c workers/publish/wrangler.jsonc`).

It also stores images in the R2 bucket `lina-blog-images`, created once with
`bunx wrangler r2 bucket create lina-blog-images`. Connect `img.ikili.pro` to the bucket as a
custom domain (R2 > lina-blog-images > Settings > Custom Domains) and leave the `r2.dev` URL
disabled; it is rate-limited and meant for development.

## 🛡️ Turnstile

`src/turnstile.ts` checks Turnstile tokens with Cloudflare's siteverify API. The secret key is a Worker secret named `TURNSTILE_SECRET_KEY` and is never committed:

- In production, register it with `bunx wrangler secret put TURNSTILE_SECRET_KEY`.
- Locally, put it in `.dev.vars` at the root of the repository (ignored by git). `wrangler dev`, which `bun run preview:wrangler` runs, reads it and prints `Using secrets defined in .dev.vars` on startup.

The contact form (`src/components/ContactSection.astro`) renders the widget with the site key `TURNSTILE_SITE_KEY`, a public variable declared with `astro:env` in `astro.config.mjs`. Pages are prerendered, so `astro build` reads it from the environment or from `.env` at the root of the repository (ignored by git), not from `.dev.vars`. Without it the build uses Cloudflare's test site key `1x00000000000000000000AA`, whose widget always passes with the dummy token `XXXX.DUMMY.TOKEN.XXXX`. A production secret key rejects that token, so a production build must set the real site key.

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

## 📄 License

The source code is released under the [MIT License](LICENSE).

The following are not covered by the MIT License. All rights are reserved by Tsukusu Lina:

- The character Tsukusu Lina, and images that depict the character or the ikili.pro brand, such as illustrations, logos and pixel art, wherever they are in this repository (for example `public/` and `src/assets/`)
- Blog posts and other written content published on the site

The service icons in `src/components/icons/` are not covered by the MIT License either. They are trademarks or works of their owners and are used under the terms listed in [src/components/icons/README.md](src/components/icons/README.md).

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
