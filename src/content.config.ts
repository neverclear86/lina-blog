import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { blogSchema } from "./blog-schema";
import { devPagesEnabled } from "./dev/dev-pages";
import { workSchema } from "./work-schema";

/**
 * Blog posts: Markdown files under `src/content/blog/`. The glob loader uses a post's `slug`
 * frontmatter as its entry id.
 *
 * `astro dev` also loads `src/content/blog-dev/`, posts for checking how pages look, and so does
 * `astro build` when `LINA_DEV_PAGES` is `1` (the same switch as the dev pages, `devPagesEnabled`).
 * They are checked by the same schema. In that build they also reach `/blog/`, the tag pages,
 * the pages of the posts (`/blog/<slug>/`), the latest posts on the home page, `/rss.xml`, the
 * text version and the OGP images of the posts (`/og/blog/<slug>.png`); without the variable
 * `astro build` leaves them out.
 */
const blog = defineCollection({
  loader: glob({
    pattern: devPagesEnabled(import.meta.env.DEV ? "dev" : "build", process.env)
      ? ["blog/**/*.md", "blog-dev/**/*.md"]
      : "blog/**/*.md",
    base: "./src/content",
  }),
  schema: blogSchema,
});

/**
 * Works: one YAML file per work under `src/content/works/`, with the Japanese and English text
 * in the same entry. The glob loader uses a work's `slug` as its entry id. A thumbnail path is
 * resolved relative to the YAML file, and a missing image fails `astro build`.
 */
const works = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/works" }),
  schema: ({ image }) => workSchema(image()),
});

export const collections = { blog, works };
