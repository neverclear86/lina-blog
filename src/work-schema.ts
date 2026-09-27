import { z } from "astro/zod";

/** A related video or making-of post of a work. */
const workLink = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  // The title of the video or post. Omitted when the URL is enough.
  name: z.string().min(1).optional(),
});

/**
 * Data of a work in `src/content/works/`, one YAML file per work.
 *
 * `src/content.config.ts` gives this schema to the `works` collection, so a work that does not
 * match it fails `astro build`. zod comes from `astro/zod`, not from the `astro:content` virtual
 * module, so code outside Astro's build can import it.
 *
 * `image` is the schema of a thumbnail path. The collection passes Astro's `image()`, which
 * resolves the path relative to the YAML file and fails the build when the file is missing. A
 * test can pass a plain zod schema instead.
 *
 * One entry holds both languages: `description` has `ja` and `en`, and the other fields are
 * shared. Unlike `blogSchema`, a key that the schema does not list is rejected, since the data
 * is written for this site only and such a key is a typo.
 */
export const workSchema = <I extends z.ZodType>(image: I) =>
  z.strictObject({
    // The name of the work in Latin letters, shared by both languages, such as `ikili.pro`.
    title: z.string().min(1),
    // Lowercase letters and digits joined by single hyphens, such as `ikili-pro`. The glob
    // loader uses it as the entry id.
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.strictObject({
      ja: z.string().min(1),
      en: z.string().min(1),
    }),
    // Languages, frameworks and services, such as `astro`.
    tech: z.array(z.string().min(1)).default([]),
    // `logo` for the site's logo, or the path of an image. An image is 16:9 and at least 1600px
    // wide, with its subject near the center so that it can be cropped to other ratios.
    // Omitted when the work has no thumbnail.
    thumbnail: z.union([z.literal("logo"), image]).optional(),
    links: z
      .strictObject({
        demo: z.url({ protocol: /^https?$/ }).optional(),
        repo: z.url({ protocol: /^https?$/ }).optional(),
        videos: z.array(workLink).default([]),
        posts: z.array(workLink).default([]),
      })
      // `.default({})` would skip the defaults of `videos` and `posts`.
      .prefault({}),
    // Sort key of the works, smaller first. Give each work a different value.
    order: z.number().int(),
    // Whether the work has a page of its own.
    hasPage: z.boolean().default(false),
    // The command shown with the work, such as `$ npm run deploy`.
    label: z.string().min(1).default("$ cat README.md"),
    // Whether a text cursor follows the label.
    cursor: z.boolean().default(false),
  });
