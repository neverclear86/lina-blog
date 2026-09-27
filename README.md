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
│   ├── fetch.ts          # Hono app (advanced routing) for the Worker
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── astro.config.mjs      # Cloudflare adapter; pages are prerendered by default
├── biome.json
├── wrangler.jsonc
└── package.json
```

Pages are prerendered unless they export `prerender = false`. The Worker runs first only for `/` (`assets.run_worker_first` in `wrangler.jsonc`); other static files are served from Workers Static Assets. Routes that no page matches, such as `/api/*`, fall through to the Hono app in `src/fetch.ts`.

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command               | Action                                              |
| :-------------------- | :-------------------------------------------------- |
| `bun install`         | Installs dependencies                               |
| `bun dev`             | Starts local dev server at `localhost:4321`         |
| `bun run build`       | Builds the site to `./dist/`                        |
| `bun preview`         | Previews the build locally in `workerd`             |
| `bun run format`      | Formats files with Biome                            |
| `bun run lint`        | Lints files with Biome                              |
| `bun run check`       | Runs Biome formatting, lint and import checks       |
| `bun astro ...`       | Runs CLI commands like `astro add`, `astro check`   |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
