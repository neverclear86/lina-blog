import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { blogSchema } from "./blog-schema";

/**
 * Blog posts: Markdown files under `src/content/blog/`. The glob loader uses a post's `slug`
 * frontmatter as its entry id.
 */
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: blogSchema,
});

export const collections = { blog };
