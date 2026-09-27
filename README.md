# Astro Starter Kit: Basics

```sh
bun create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── contact.ts        # Contact form input validation, unit-tested
│   ├── api.ts            # Hono routes handled by the Worker (/api/*), unit-tested
│   ├── fetch.ts          # Worker entry (advanced routing): api.ts, then the Astro handlers
│   ├── turnstile.ts      # Turnstile token check with siteverify (injectable fetch), unit-tested
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── astro.config.mjs      # Cloudflare adapter; pages are prerendered by default
├── biome.json
├── wrangler.jsonc
└── package.json
```

Pages are prerendered unless they export `prerender = false`. The Worker runs first only for `/` (`assets.run_worker_first` in `wrangler.jsonc`); other static files are served from Workers Static Assets. Routes that no page matches, such as `/api/*`, fall through to the Hono app in `src/fetch.ts`, which serves the routes in `src/api.ts`.

Unit tests (`*.test.ts` next to the code) cover logic such as the Hono routes; `src/api.ts` is tested with `app.request()`. Pages are checked with screenshots instead: `node .claude/scripts/screenshot.mjs --root . --port 4611 --out /tmp/shots /` serves `dist/` without building it, so run `bun run build` first. It uses Playwright's Chromium (`bunx playwright install chromium` if it is not installed yet).

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command               | Action                                              |
| :-------------------- | :-------------------------------------------------- |
| `bun install`         | Installs dependencies                               |
| `bun dev`             | Starts local dev server at `localhost:4321`         |
| `bun run build`       | Builds the site to `./dist/`                        |
| `bun preview`         | Previews the build locally in `workerd`             |
| `bun run preview:wrangler` | Builds, then serves the Worker with `wrangler dev` |
| `bun run format`      | Formats files with Biome                            |
| `bun run lint`        | Lints files with Biome                              |
| `bun run check`       | Runs Biome formatting, lint and import checks       |
| `bun run test`        | Runs unit tests with Vitest                         |
| `bun astro ...`       | Runs CLI commands like `astro add`, `astro check`   |

## 🚢 CI and deployment

GitHub Actions runs two workflows:

- `.github/workflows/ci.yml` runs on every pull request: `biome ci`, `astro check`, `bun run test` and `bun run build`.
- `.github/workflows/deploy.yml` builds the site and runs `wrangler deploy`. For now it only runs when started manually (Actions > Deploy > Run workflow); it will run on every push to `main` once the site is ready to go public. A running deploy always finishes; if several runs are queued meanwhile, only the latest waiting run is kept.

Until then, check the Worker locally with `bun run preview:wrangler`, which builds the site and serves `dist/` with `wrangler dev` (static pages, `/api/*` and the other Hono routes).

The deploy workflow needs two repository secrets:

1. In the Cloudflare dashboard, create an API token from the "Edit Cloudflare Workers" template, limited to this account (at minimum `Account` > `Workers Scripts` > `Edit`).
2. Copy the account ID from the Workers & Pages overview.
3. Register both secrets:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

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

## 📄 License

The source code is released under the [MIT License](LICENSE).

The following are not covered by the MIT License. All rights are reserved by Tsukusu Lina:

- The character Tsukusu Lina, and images that depict the character or the ikili.pro brand, such as illustrations, logos and pixel art, wherever they are in this repository (for example `design/assets/`, `public/` and `src/assets/`)
- Blog posts and other written content published on the site

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
