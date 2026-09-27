import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { blogSchema } from "./blog-schema";
import { workSchema } from "./work-schema";

/**
 * Blog posts: Markdown files under `src/content/blog/`. The glob loader uses a post's `slug`
 * frontmatter as its entry id.
 *
 * `astro dev` also loads `src/content/blog-dev/`, posts for checking how pages look. They are
 * checked by the same schema, and `astro build` leaves them out.
 */
const blog = defineCollection({
  loader: glob({
    pattern: import.meta.env.DEV
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
