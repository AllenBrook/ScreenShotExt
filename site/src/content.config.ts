import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One folder per site locale under src/content/blog/; the entry id is
// `<locale>/<slug>`. A translation keeps the en file's slug and frontmatter
// shape, translates title, description, and body, and prefixes internal page
// links with its locale (`/de/docs/`). Files such as `/skills/x.md` keep
// their plain path.
// Dates, written YYYY-MM-DD. YAML parses that as a Date, and pages read the
// ISO day back. `published` is the day the English article went live; a
// translation keeps it. `updated` is the day this file's content last changed
// in substance. Both show on the page and in BlogPosting.
const isoDate = z.date().transform((d) => d.toISOString().slice(0, 10));

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    audience: z.enum(['everyday', 'developers']),
    order: z.number(),
    published: isoDate,
    updated: isoDate.optional(),
  }),
});

// Task and comparison pages, grouped by site section:
// src/content/guides/<section>/<locale>/<slug>.md, served at
// /<section>/<slug>/. Same translation rules as the blog.
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    published: isoDate,
    updated: isoDate.optional(),
  }),
});

export const collections = { blog, guides };
