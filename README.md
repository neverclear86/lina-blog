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
├── src/
│   ├── ansi-art.ts       # Pixels to terminal text art (half blocks, 24-bit color), unit-tested
│   ├── contact.ts        # Contact form input validation, unit-tested
│   ├── api.ts            # Hono routes handled by the Worker (/, /api/*), unit-tested
│   ├── blog-rss.ts       # Blog posts to /rss.xml items (【PR】 on sponsored posts), unit-tested
│   ├── blog-schema.ts    # Frontmatter schema of blog posts (no astro:content), unit-tested
│   ├── cloudflare-workers.d.ts # Types of env from cloudflare:workers (bindings and secrets)
│   ├── contact-mail.ts   # Builds the contact notification mail for the send_email binding
│   ├── content.config.ts # blog collection: src/content/blog/ (and blog-dev/ in astro dev), checked by blog-schema.ts
│   ├── fetch.ts          # Worker entry (advanced routing): api.ts, then the Astro handlers
│   ├── llms.ts           # Builds /llms.txt (site summary and links for LLMs), unit-tested
│   ├── lina-ansi-art.d.ts # Types of virtual:lina-ansi-art, the text art built in astro.config.mjs
│   ├── profile-links.ts  # Profile links (label and note per locale), shared by llms.ts and text-site.ts
│   ├── text-site.ts      # Builds the text version of the site for curl (80 columns), unit-tested
│   ├── turnstile.ts      # Turnstile token check with siteverify (injectable fetch), unit-tested
│   ├── user-agent.ts     # Tells curl and other command-line clients from browsers, unit-tested
│   ├── assets/           # Images processed by astro:assets
│   │   ├── logo-black.png  # Logo for the light theme, optimized by astro:assets
│   │   ├── logo-light.png  # Logo (light theme); the favicons are generated from it in Layout.astro
│   │   └── logo-white.png  # Logo for the dark theme
│   ├── components/
│   │   ├── ArticleBody.astro     # Styles rendered Markdown (tables, task lists, footnotes)
│   │   ├── Bubble.astro          # Speech bubble on --blush with a hard shadow
│   │   ├── Logo.astro            # Switches the logo with the theme
│   │   ├── SectionHeading.astro  # ~/label, English display title and subtitle; the level is a prop
│   │   └── TerminalCard.astro    # Terminal window card with a title bar; a link when given href
│   ├── content/
│   │   └── blog-dev/     # Posts for checking how pages look; loaded by astro dev only
│   ├── dev/
│   │   ├── components.astro  # /dev/components/: samples of the shared shapes and components
│   │   ├── dev-pages.ts      # Adds the dev pages in astro dev (or with LINA_DEV_PAGES=1), unit-tested
│   │   └── markdown.astro    # /dev/markdown/: sample article with every supported Markdown syntax
│   ├── i18n/
│   │   ├── locales.ts    # Locales (ja, en) and the default, also read by astro.config.mjs
│   │   ├── negotiate.ts  # Picks the locale for / from Accept-Language, unit-tested
│   │   ├── paths.ts      # Path of the same page in another locale, unit-tested
│   │   └── ui.ts         # UI strings per locale, unit-tested
│   ├── layouts/
│   │   └── Layout.astro       # <head> with the <Font /> tags, the RSS link and a "head" slot; imports tokens.css, global.css and shapes.css; sets --font-body on html
│   ├── markdown/
│   │   ├── sample.md       # Sample article shown at /dev/markdown/
│   │   └── table-align.ts  # Sätteri hast plugin: table alignment as classes, unit-tested
│   ├── pages/
│   │   ├── [lang]/
│   │   │   └── index.astro   # /ja/ and /en/
│   │   ├── ansi/
│   │   │   ├── color.txt.ts  # /ansi/color.txt: the standing illustration as 24-bit color text art
│   │   │   └── plain.txt.ts  # /ansi/plain.txt: the same art without escape sequences
│   │   ├── llms.txt.ts   # /llms.txt, prerendered to dist/client/
│   │   ├── rss.xml.ts    # /rss.xml: prerendered RSS feed with each post's full HTML
│   │   └── text/
│   │       └── [lang].txt.ts # /text/ja.txt and /text/en.txt: prerendered text version of the site
│   └── styles/
│       ├── global.css    # body colors and the grid backgrounds (.grid, .cgrid)
│       ├── shapes.css    # Notched corners, hard shadows, the lift and the focus outline
│       └── tokens.css    # Color tokens; the theme is the data-theme attribute on <html>
├── workers/
│   └── publish/          # Publish Worker, separate from the site and deployed on its own
│       ├── src/
│       │   ├── app.ts               # Hono app and Worker entry; every route needs the shared secret
│       │   ├── article-event.ts     # Builds the unsigned kind 30023 (NIP-23) event of an article
│       │   ├── auth.ts              # Bearer auth with a constant-time comparison
│       │   ├── content-hash.ts      # Content hash of an article (SHA-256 of its markdown)
│       │   ├── env.ts               # Bindings (PUBLISH_TOKEN, GITHUB_TOKEN, GITHUB_API_URL, IMAGES)
│       │   ├── errors.ts            # Error body shared by every error response
│       │   ├── images.ts            # Image names, R2 lookups and uploads for /images/{name}
│       │   ├── nostr-relays.ts      # Reads write relays (kind 10002) and sends events to relays
│       │   └── published-record.ts  # Reads src/content/published.json on GitHub for GET /articles
│       ├── .dev.vars.example
│       └── wrangler.jsonc
├── astro.config.mjs      # Cloudflare adapter, self-hosted fonts, Sätteri Markdown, dev pages, text art plugin; pages are prerendered by default
├── biome.json
├── wrangler.jsonc
└── package.json
```

Pages are prerendered unless they export `prerender = false`. The Worker runs first only for `/` (`assets.run_worker_first` in `wrangler.jsonc`); other static files are served from Workers Static Assets. `/` has no page: the route in `src/api.ts` answers command-line clients such as curl (`src/user-agent.ts`) with a placeholder text as `text/plain`, and redirects other clients to `/en/` when `Accept-Language` prefers English over Japanese and to `/ja/` otherwise. Both responses carry `Vary: User-Agent, Accept-Language`. Every response of `/` also carries the security headers of Hono's `secureHeaders()` with its defaults (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer` and others), added by middleware in `src/api.ts`, because a `_headers` file applies to static assets only and not to responses from the Worker. Do not add `src/pages/index.astro`, because the adapter serves a prerendered page before the Hono app sees the request. Routes that no page matches, such as `/api/*`, fall through to the Hono app in `src/fetch.ts`, which serves the routes in `src/api.ts`. Astro calls that app with the request only, so `src/fetch.ts` passes the Worker's bindings and secrets (`env` from `cloudflare:workers`) to it.

Pages that exist in every language go in `src/pages/[lang]/` and are generated once for each locale in `src/i18n/locales.ts` (`/ja/`, `/en/`); their UI strings come from `src/i18n/ui.ts`. Pages outside `[lang]/`, such as the Japanese-only blog under `/blog/`, have no language prefix. Astro's `i18n()` handler in `src/fetch.ts` is never reached, so `astro build` warns that the project does not call it; running it would answer 404 for those unprefixed paths. The layout links every page to the same path in the other locales (`src/i18n/paths.ts`); a page without a language prefix links to the other locale's top page.

Blog posts are Markdown files in `src/content/blog/`, committed by the publishing Worker. Posts for checking how pages look go in `src/content/blog-dev/`: `astro dev` loads them into the same `blog` collection and checks them with the same schema, and `astro build` leaves them out, so they never reach `dist/`.

Markdown is rendered by Sätteri with the plugins in `src/markdown/`. `/dev/markdown/`, a dev page (see “CSS”), shows `src/markdown/sample.md`, a sample article with every supported syntax.

`astro build` also writes the text version of the site for command-line clients to `/text/ja.txt` and `/text/en.txt` (`src/pages/text/[lang].txt.ts`, built by `src/text-site.ts`): the about text, the works, the five latest posts, the profile links and how to get in touch, with every line in 80 terminal columns. The profile links come from `src/profile-links.ts`, which `/llms.txt` uses as well.

Unit tests (`*.test.ts` next to the code) cover logic such as the Hono routes, the blog frontmatter schema, the RSS items and the Markdown plugins; `src/api.ts` and
`workers/publish/src/app.ts` are tested with `app.request()`, and the plugins in `src/markdown/` with Sätteri's `markdownToHtml()`. Pages are checked with screenshots instead: `node .claude/scripts/screenshot.mjs --root . --port 4611 --out /tmp/shots /` serves `dist/` without building it, so run `bun run build` first. It uses Playwright's Chromium (`bunx playwright install chromium` if it is not installed yet).

Colors are tested the same way. `src/styles/tokens.test.ts` checks that every foreground and background token pair used for text reaches 4.5:1 (WCAG AA) in both themes, and `src/styles/hardcoded-colors.test.ts` fails when a color value (`#rrggbb`, `rgb()`, `hsl()` and the like) is written in a `.css` file other than `src/styles/tokens.css`, or in a `<style>` element or a `style`, `fill`, `stroke`, `stop-color` or `color` attribute of an `.astro` file. Use the tokens (`var(--fg)` and so on) instead; inline SVG takes `currentColor`.

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🎨 CSS

CSS is plain CSS: a few global files in `src/styles/` and a scoped `<style>` in each component.
`src/layouts/Layout.astro` imports the global files, so they apply to every page.

| File         | Holds                                                                      |
| :----------- | :------------------------------------------------------------------------- |
| `tokens.css` | Color tokens (CSS variables) for the light and dark themes                 |
| `global.css` | Styles of `body` and decorations used across pages, such as `.grid` and `.cgrid` |
| `shapes.css` | Notched corners (`.shape`, `.shapeL`, `.shapeS`), hard shadows (`.shadow`, `.shadowF`, `.shadowInk`), the hover lift (`.lift`) and the keyboard focus outline |
| `motion.css` | Shared animations (`@keyframes`), stopped under `prefers-reduced-motion: reduce` (not created yet) |

A global file holds only what several components share.
Styles that belong to one component go in that component's scoped `<style>`.
Color values are written only in `tokens.css`; other CSS, global or scoped, uses the tokens with `var(--…)`.
A component that must style an element outside its own markup, such as `<html data-theme>`,
wraps only that selector in `:global()`.

`src/dev/components.astro` shows the shared shapes and the components on one page, and `src/dev/markdown.astro` shows `src/markdown/sample.md` the way articles are rendered.
`astro dev` serves them at `/dev/components/` and `/dev/markdown/`, and `astro build` leaves them out of `dist/` unless `LINA_DEV_PAGES=1` is set.
Add `?theme=dark` to the URL of `/dev/components/` to see the dark theme.
To capture them with `.claude/scripts/screenshot.mjs`, which serves `dist/`, build with `LINA_DEV_PAGES=1 bun run build`.
A new component adds its samples to `/dev/components/`, and a new Markdown syntax adds its examples to `src/markdown/sample.md`.

## 🔤 Fonts

Fonts are self-hosted with the Astro Fonts API (`fonts` in `astro.config.mjs`). `astro build`
downloads them from Google Fonts, and pages load them from `/_astro/fonts/`, never from a font
CDN. `src/layouts/Layout.astro` emits the `@font-face` rules on every page and sets
`--font-body` on `html`. No font file is preloaded.

| CSS variable     | Font            | Weights  | Used for                                                        |
| :--------------- | :-------------- | :------- | :-------------------------------------------------------------- |
| `--font-body`    | Zen Maru Gothic | 500, 900 | Everything by default: Japanese and body text, navigation, buttons |
| `--font-display` | Saira Condensed | 600, 800 | Large English headings such as LINA and ABOUT (800), TSUKUSU (600) |
| `--font-mono`    | JetBrains Mono  | 400, 500 | Small labels such as `$ whoami`, dates and the terminal bar      |

Components use these variables and never name a font. Form controls (`button`, `input`,
`select`, `textarea`) do not inherit `font-family` from `html`, so components set
`font: inherit` on them. Zen Maru Gothic 700 in the design is written as `font-weight: 900`,
because 700 is not loaded. `font-synthesis-weight: none` on `html` keeps the browser from
faking a weight that is not loaded.

## 🖼️ Images and caching

Images in `src/assets/` are rendered with `Picture` or `getImage` from `astro:assets`.
`astro build` converts them once (`imageService: "compile"`), so no image is transformed at
request time. Photos and the logo are offered as AVIF and WebP at several widths or densities.
The pixel art and the favicons stay PNG at a fixed size, so no pixel is blended.

The standing illustration, `src/assets/lina-standing.webp`, is also turned into text art for
terminals. The `linaAnsiArt()` Vite plugin in `astro.config.mjs` resizes it with sharp to 80
pixels wide, and the endpoints in `src/pages/ansi/` are prerendered to `/ansi/color.txt` (24-bit
color) and `/ansi/plain.txt` (no escape sequences) in `dist/client/`. Every line fits in 80
columns.

Every file whose name carries a content hash, images and fonts included, is written to
`/_astro/`. The repository has no `_headers` file: the Cloudflare adapter writes
`dist/client/_headers` during `astro build` with one rule, and Workers Static Assets serves
the other files with its default.

| Path        | `Cache-Control`                         | Set by                                  |
| :---------- | :-------------------------------------- | :-------------------------------------- |
| `/_astro/*` | `public, max-age=31536000, immutable`   | The Cloudflare adapter (`_headers`)     |
| HTML pages  | `public, max-age=0, must-revalidate`    | The Workers Static Assets default (with an `ETag`) |

HTML is revalidated on every request, so a deploy shows up at once and a page never points
at hashed files that the deploy removed. The adapter skips its rule when a `_headers` file in
`public/` already sets `Cache-Control` on a rule that matches `/_astro/*`, such as `/*`. A
`public/_headers` added later must therefore not set `Cache-Control` on `/*`, or the hashed
files lose their long cache.

Article images are not build output. The publish Worker stores them in the R2 bucket
`lina-blog-images` under a content-hash name with `public, max-age=31536000, immutable`, and
they are served from `https://img.ikili.pro` (`docs/publish-api.md`).

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

- The character Tsukusu Lina, and images that depict the character or the ikili.pro brand, such as illustrations, logos and pixel art, wherever they are in this repository (for example `design/assets/`, `public/` and `src/assets/`)
- Blog posts and other written content published on the site

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
