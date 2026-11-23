// Cloudflare Pages deployment: serve the existing custom error document with
// a real 404 status instead of the 200 returned by some static-asset fallbacks.
// A Workers Static Assets deployment also needs assets.not_found_handling=404-page.
export async function onRequestGet({ request, env }) {
  const assetUrl = new URL('/404.html', request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  const headers = new Headers(assetResponse.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.delete('Location');
  return new Response(await assetResponse.text(), { status: 404, headers });
}
