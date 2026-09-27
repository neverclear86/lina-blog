import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { blogSchema } from "./blog-schema";

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

export const collections = { blog };
