## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Issue workflow

- When asked to work on issues by number, use the `issue-workflow` skill (`.claude/skills/issue-workflow/`).
- The checks to run before opening a PR are listed in `.claude/agents/issue-implementer.md` ("PR を作る前の検査"). Keep them in sync with the scripts in `package.json`.
- `.claude/issue-workflow-kit.json` records how the workflow was installed. Update the workflow with the "更新" procedure of the user-level `issue-workflow-kit` skill instead of editing the generated files by hand.
