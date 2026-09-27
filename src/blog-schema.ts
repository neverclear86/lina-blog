import { z } from "astro/zod";

/**
 * Exactly one emoji, including flags, keycaps, skin tones and ZWJ sequences.
 *
 * `\p{RGI_Emoji}` needs the `v` flag. It rejects a text-presentation character without
 * `U+FE0F`, such as `❤`.
 */
const SINGLE_EMOJI = /^\p{RGI_Emoji}$/v;

/**
 * Frontmatter of a blog post in `src/content/blog/`.
 *
 * `src/content.config.ts` gives this schema to the `blog` collection, so a post that does not
 * match it fails `astro build`. zod comes from `astro/zod`, a plain re-export of `zod/v4`, and
 * not from the `astro:content` virtual module, so code outside Astro's build can import it.
 *
 * Keys that the schema does not list, such as `published`, are accepted and dropped from the
 * parsed data.
 */
export const blogSchema = z.object({
  title: z.string().min(1),
  // Same rule as Zenn's slug, so a post can keep one slug on both sites.
  slug: z.string().regex(/^[a-z0-9_-]{12,50}$/),
  // A Date (YAML's unquoted date) or an ISO 8601 date, or a date-time with an offset.
  // `z.coerce.date()` alone would turn `null` (an empty `date:`) and `0` into 1970-01-01.
  date: z
    .union([z.date(), z.iso.date(), z.iso.datetime({ offset: true })])
    .pipe(z.coerce.date()),
  tags: z.array(z.enum(["制作記", "技術", "日記"])).min(1),
  emoji: z.string().regex(SINGLE_EMOJI),
  topics: z.array(z.string().min(1)).max(5).optional(),
  sponsor: z
    .object({
      name: z.string().min(1),
      url: z.url({ protocol: /^https?$/ }).optional(),
    })
    .optional(),
  description: z.string().min(1),
});
