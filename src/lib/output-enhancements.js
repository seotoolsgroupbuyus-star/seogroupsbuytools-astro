// Enhancements applied only to generated Astro HTML; immutable CMS source is kept intact.
// These routes were audited as unresolved links from the original imported HTML.
const fixedLinks = new Map([
  ['https://seogroupsbuytools.com/amazon', '/ecommerce-tools/'],
  ['https://seogroupsbuytools.com/content', '/ai-writing-tools/'],
  ['https://seogroupsbuytools.com/ppc', '/spy-tools/'],
  ['https://seogroupsbuytools.com/guides', '/guides/keyword-research/'],
  ['https://seogroupsbuytools.com/design', '/design-tools/'],
]);
const linkSources = new Set([
  '/guides/ecommerce-product-research/',
  '/guides/content-optimization/',
  '/guides/ppc-ad-spy-research/',
  '/guides/keyword-research/',
  '/guides/competitor-analysis/',
  '/guides/backlink-analysis/',
  '/compare/seo-vs-design-group-buy/',
]);
export const repairedLinks = Object.fromEntries(fixedLinks);
// All buy/plan/signup/login actions open the payment homepage, without cart or member paths.
// Keep all purchase/account CTAs on the merchant's configured payment homepage.
// Support-only WhatsApp links and navigation to product/pricing articles are untouched.
function rewritePaymentAnchors(html,settings){
  const base=String(settings.paymentBaseUrl||'https://pay.seogroupsbuytools.com').replace(/\/$/,'');
  const paymentTarget=/^https?:\/\/(?:www\.)?(?:seogroupsbuy\.com|pay\.seogroupsbuytools\.com|seogroupsbuytools\.com)\/users\/(?:login|signup|cart(?:\/|$))/i;
  const currentPayment=/^https?:\/\/pay\.seogroupsbuytools\.com(?:[\/?#]|$)/i;
  const relativeAccount=/^\/?users\/(?:login|signup|cart(?:\/|$))/i;
  const actionLabel=/^(?:(?:💬|🛒|🔐)\s*)?(?:buy\s*now(?:\s+on\s+whatsapp)?|sign[\s-]*up|register(?:\s+now)?|log[\s-]*in|login|create\s+(?:an?\s+)?account|checkout|proceed\s+to\s+checkout|get\s+started|get\s+(?:vip\s+)?access|order\s+now|start\s+now|join\s+now|purchase\s+now|subscribe\s+now|choose\s+(?:this\s+)?plan|select\s+(?:this\s+)?plan|buy\s+(?:this\s+)?plan)(?:\s*[!→»])?$/i;
  return String(html).replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,anchor=>{
    const href=anchor.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    if(!href)return anchor;
    const inner=anchor.slice(anchor.indexOf('>')+1,anchor.lastIndexOf('</a>'));
    const label=inner.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    // Explicit WhatsApp links are customer support/contact links, never checkout redirects.
    if(/^https?:\/\/(?:wa\.me|(?:api\.)?whatsapp\.com)(?:\/|$)/i.test(href[2]))return anchor;
    if(!(paymentTarget.test(href[2])||currentPayment.test(href[2])||relativeAccount.test(href[2])||actionLabel.test(label)))
      return anchor;
    let updated=anchor.replace(href[0],href[0].replace(href[2],base));
    // The old button's WhatsApp wording must not misrepresent the payment link.
    if(/^(?:💬\s*)?buy\s+now\s+on\s+whatsapp$/i.test(label))
      updated=updated.replace(/>\s*(?:💬\s*)?Buy\s+Now\s+on\s+WhatsApp\s*<\/a>$/i,'>Buy Now</a>');
    return updated;
  });
}

export function enhanceOutput(html,page,settings={}){
  html=rewritePaymentAnchors(html,settings);
  if(linkSources.has(page.route)){
    html=html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi,(full,before,url,after)=>{
      const target=fixedLinks.get(url);
      return target ? before+target+after : full;
    });
  }
  // The original /is-it-safe/ page overflows on narrow viewports because its
  // single-column CSS grid uses the intrinsic minimum width of a data table.
  // Constrain the grid track while leaving the table horizontally scrollable.
  if(page.route==='/is-it-safe/'){
    // Restrict the grid's min-content sizing and contain the wide data table
    // in a horizontal scroller instead of making the entire document wider.
    const responsive='<style>@media(max-width:640px){.content-layout,.content-layout--full,.content-layout:not(:has(.sidebar)){grid-template-columns:minmax(0,1fr);min-width:0;max-width:100%}.content-layout>.main-content,.content-article,.content-article .content-section,.tables-section,.tables-section .table-wrap{box-sizing:border-box;min-width:0;max-width:100%}.tables-section .table-wrap{display:block;width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}.tables-section .data-table{width:max-content;min-width:600px;max-width:none}}</style>';
    html=html.replace('</head>',responsive+'\n</head>');
  }
  if(!page.productHero)return html;
  const hero=page.productHero;
  const site=(settings.siteUrl||'https://seogroupsbuytools.com').replace(/\/$/,'');
  const product={
    '@context':'https://schema.org',
    '@type':'Product',
    name:String(hero.name||'').trim(),
    url:site+page.route,
    description:String(hero.description||'').trim()
  };
  if(!product.name)return html;
  if(hero.image){
    try { product.image=[new URL(hero.image,site+page.route).href] } catch {}
  }
  const price=String(hero.price||'').trim().match(/^\$([\d,]+(?:\.\d{1,2})?)$/);
  if(price)product.offers={'@type':'Offer',url:site+page.route,priceCurrency:'USD',price:price[1].replaceAll(',','')};
  const script='<script type="application/ld+json">'+JSON.stringify(product).replace(/</g,'\\u003c')+'</script>';
  return html.replace('</head>',script+'\n</head>');
}
