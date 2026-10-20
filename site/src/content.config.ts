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
// The browser guides also carry the hub's quick-answer fields: `answer` is
// the built-in method in one or two plain sentences, and `builtIn`, `output`,
// `limit` fill one row of the hub's comparison table. The hub shows those
// sections only when every guide in the locale has them.
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    published: isoDate,
    updated: isoDate.optional(),
    answer: z.string().optional(),
    builtIn: z.string().optional(),
    output: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const collections = { blog, guides };
