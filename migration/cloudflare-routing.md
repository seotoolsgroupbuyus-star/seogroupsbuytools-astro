# Cloudflare routing after Astro migration

The repository is preservation-first and has no tracked Wrangler deployment configuration. The live comparison currently uses `https://seogroupsbuytools-astro.oldbilalfadi.workers.dev`. Do not switch the live domain until preview edge behavior is confirmed.

## Completed in the repository

- The generated Astro articles now point seven previously broken internal references to existing destinations.
- `public/_redirects` provides ten 301 rules (five legacy destinations, with and without trailing slash) **for Cloudflare Pages deployments**.
- `functions/404/index.js` returns the existing `404.html` document with HTTP 404 and `X-Robots-Tag: noindex, nofollow` **when Cloudflare Pages Functions are deployed**.
- `scripts/verify-edge.mjs` validates these definitions on CI.

## Workers Static Assets deployment

A `*.workers.dev` preview is not necessarily a Pages deployment. Pages Functions and Pages `_redirects` are not automatically active in Workers Static Assets deployments. If the preview deploy is using Workers Static Assets, configure its existing Wrangler assets settings with:

```json
"assets": {
  "directory": "./dist",
  "not_found_handling": "404-page"
}
```

Keep the rest of the existing Worker config and bindings unchanged. Configure the five legacy redirects through the existing Worker route handler or a Cloudflare Bulk Redirect list; do not replace an existing Worker script just to implement redirects.

## Verify after deployment

- `GET /404/` must return HTTP **404**, not 200.
- `GET /this-page-does-not-exist/` must also return **404**, with custom 404 content if configured.
- `GET /amazon/`, `/content/`, `/ppc/`, `/guides/`, `/design/` should return permanent redirects to the mapped published categories/guides.
- Published pages must continue returning 200 and carry canonical/indexing metadata.

These edge checks need to run against the actual deployment: passing local Node tests alone does **not** prove the deployed Worker is using these rules.
