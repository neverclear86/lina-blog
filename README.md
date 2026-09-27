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
│   ├── contact.ts        # Contact form input validation, unit-tested
│   ├── api.ts            # Hono routes handled by the Worker (/, /api/*), unit-tested
│   ├── blog-schema.ts    # Frontmatter schema of blog posts (no astro:content), unit-tested
│   ├── cloudflare-workers.d.ts # Types of env from cloudflare:workers (bindings and secrets)
│   ├── contact-mail.ts   # Builds the contact notification mail for the send_email binding
│   ├── content.config.ts # blog collection: src/content/blog/ (and blog-dev/ in astro dev), checked by blog-schema.ts
│   ├── fetch.ts          # Worker entry (advanced routing): api.ts, then the Astro handlers
│   ├── turnstile.ts      # Turnstile token check with siteverify (injectable fetch), unit-tested
│   ├── assets/           # Images processed by astro:assets
│   │   ├── logo-black.png  # Logo for the light theme, optimized by astro:assets
│   │   ├── logo-light.png  # Logo (light theme); the favicons are generated from it in Layout.astro
│   │   └── logo-white.png  # Logo for the dark theme
│   ├── components/
│   │   └── Logo.astro      # Switches the logo with the theme
│   ├── content/
│   │   └── blog-dev/     # Posts for checking how pages look; loaded by astro dev only
│   ├── i18n/
│   │   ├── locales.ts    # Locales (ja, en) and the default, also read by astro.config.mjs
│   │   ├── negotiate.ts  # Picks the locale for / from Accept-Language, unit-tested
│   │   ├── paths.ts      # Path of the same page in another locale, unit-tested
│   │   └── ui.ts         # UI strings per locale, unit-tested
│   ├── layouts/
│   │   └── Layout.astro       # <head> with the <Font /> tags; imports tokens.css and global.css; sets --font-body on html
│   ├── pages/
│   │   └── [lang]/
│   │       └── index.astro   # /ja/ and /en/
│   └── styles/
│       ├── global.css    # body colors and the grid backgrounds (.grid, .cgrid)
│       └── tokens.css    # Color tokens; the theme is the data-theme attribute on <html>
├── workers/
│   └── publish/          # Publish Worker, separate from the site and deployed on its own
│       ├── src/
│       │   ├── app.ts               # Hono app and Worker entry; every route needs the shared secret
│       │   ├── auth.ts              # Bearer auth with a constant-time comparison
│       │   ├── content-hash.ts      # Content hash of an article (SHA-256 of its markdown)
│       │   ├── env.ts               # Bindings (PUBLISH_TOKEN, GITHUB_TOKEN, GITHUB_API_URL)
│       │   ├── errors.ts            # Error body shared by every error response
│       │   └── published-record.ts  # Reads src/content/published.json on GitHub for GET /articles
│       ├── .dev.vars.example
│       └── wrangler.jsonc
├── astro.config.mjs      # Cloudflare adapter, self-hosted fonts; pages are prerendered by default
├── biome.json
├── wrangler.jsonc
└── package.json
```

Pages are prerendered unless they export `prerender = false`. The Worker runs first only for `/` (`assets.run_worker_first` in `wrangler.jsonc`); other static files are served from Workers Static Assets. `/` has no page: the route in `src/api.ts` redirects it to `/en/` when `Accept-Language` prefers English over Japanese and to `/ja/` otherwise, with `Vary: Accept-Language`. Do not add `src/pages/index.astro`, because the adapter serves a prerendered page before the Hono app sees the request. Routes that no page matches, such as `/api/*`, fall through to the Hono app in `src/fetch.ts`, which serves the routes in `src/api.ts`. Astro calls that app with the request only, so `src/fetch.ts` passes the Worker's bindings and secrets (`env` from `cloudflare:workers`) to it.

Pages that exist in every language go in `src/pages/[lang]/` and are generated once for each locale in `src/i18n/locales.ts` (`/ja/`, `/en/`); their UI strings come from `src/i18n/ui.ts`. Pages outside `[lang]/`, such as the Japanese-only blog under `/blog/`, have no language prefix. Astro's `i18n()` handler in `src/fetch.ts` is never reached, so `astro build` warns that the project does not call it; running it would answer 404 for those unprefixed paths. The layout links every page to the same path in the other locales (`src/i18n/paths.ts`); a page without a language prefix links to the other locale's top page.

Blog posts are Markdown files in `src/content/blog/`, committed by the publishing Worker. Posts for checking how pages look go in `src/content/blog-dev/`: `astro dev` loads them into the same `blog` collection and checks them with the same schema, and `astro build` leaves them out, so they never reach `dist/`.

Unit tests (`*.test.ts` next to the code) cover logic such as the Hono routes and the blog frontmatter schema; `src/api.ts` and
`workers/publish/src/app.ts` are tested with `app.request()`. Pages are checked with screenshots instead: `node .claude/scripts/screenshot.mjs --root . --port 4611 --out /tmp/shots /` serves `dist/` without building it, so run `bun run build` first. It uses Playwright's Chromium (`bunx playwright install chromium` if it is not installed yet).

Colors are tested the same way. `src/styles/tokens.test.ts` checks that every foreground and background token pair used for text reaches 4.5:1 (WCAG AA) in both themes, and `src/styles/hardcoded-colors.test.ts` fails when a color value (`#rrggbb`, `rgb()`, `hsl()` and the like) is written in a `.css` file other than `src/styles/tokens.css`, or in a `<style>` element or a `style`, `fill`, `stroke`, `stop-color` or `color` attribute of an `.astro` file. Use the tokens (`var(--fg)` and so on) instead; inline SVG takes `currentColor`.

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🎨 CSS

CSS is plain CSS: a few global files in `src/styles/` and a scoped `<style>` in each component.
`src/layouts/Layout.astro` imports the global files, so they apply to every page.

| File         | Holds                                                                      |
| :----------- | :------------------------------------------------------------------------- |
| `tokens.css` | Color tokens (CSS variables) for the light and dark themes                 |
| `global.css` | Styles of `body` and decorations used across pages, such as `.grid` and `.cgrid` |
| `shapes.css` | Shared shapes used by several components, such as the notched corner and the hard shadow (not created yet) |
| `motion.css` | Shared animations (`@keyframes`), stopped under `prefers-reduced-motion: reduce` (not created yet) |

A global file holds only what several components share.
Styles that belong to one component go in that component's scoped `<style>`.
Color values are written only in `tokens.css`; other CSS, global or scoped, uses the tokens with `var(--…)`.
A component that must style an element outside its own markup, such as `<html data-theme>`,
wraps only that selector in `:global()`.

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
