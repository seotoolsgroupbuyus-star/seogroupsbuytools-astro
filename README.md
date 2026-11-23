# SEO Group Buy Tools — Astro 5 static migration

Source website: https://seogroupsbuytools.com/ (Next.js)  
Astro preview used for automated comparison: https://seogroupsbuytools-astro.oldbilalfadi.workers.dev

This repository preserves original page content and design in `content/**/*.json`, and renders static routes with Astro. The original HTML is retained as an internal source snapshot for accurate migration, not exposed as a normal CMS editing field.

## Pages CMS

Configured in `.pages.yml`: **Homepage, Products (30), Pages and Guides, Blog Posts, Site Settings**.

Pages CMS exposes human-readable content and controls without requiring raw HTML editing:
- Section headings, paragraphs, card content, prices, labels and CTA destinations.
- Product names, descriptions, prices, key features, images and buy-button links.
- Page images/alt text, SEO titles and descriptions.
- Global navigation, footer and logos, plus rich-text blog posts.

The source-position editor in `src/lib/render.js` updates selected fields while retaining original markup/layout. The Astro rendering pipeline adds Product structured data and repairs audited legacy links without changing the CMS source snapshots.

## How editing is verified

`.github/workflows/verify-cms.yml` validates all 72 original content records, including duplicates, nested card/image edits, modified prices, SEO fields, site chrome and a temporary blog entry. It then builds a temporary CMS edit and verifies the output, including Product JSON-LD. This workflow does **not** prove that an actual Pages CMS account has been connected, that a user can authenticate in its browser UI, or that GitHub publishing permissions are configured.

For build / SEO / routing checks, see:
- `scripts/verify-migration.mjs`
- `scripts/visual-parity.cjs`
- `scripts/interactive-audit.cjs`
- `scripts/verify-edge.mjs`
- `migration/cloudflare-routing.md`

## Local usage

```sh
npm install
npm run build
npm run preview
npm run audit
```

## Deployment warning

GitHub build success does not confirm that the Cloudflare preview is running the newest commit. The strict live/preview parity workflow checks for updated Product schemas and repaired URLs and may fail until the Cloudflare Worker is redeployed. Keep the original live Next.js domain unchanged until deployment and edge responses are verified.
