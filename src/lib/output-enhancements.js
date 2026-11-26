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
function rewritePaymentAnchors(html,settings){
  const base=String(settings.paymentBaseUrl||'https://pay.seogroupsbuytools.com').replace(/\/$/,'');
  return String(html).replace(/(\bhref\s*=\s*["'])([^"']+)(["'])/gi,(whole,open,target,close)=>{
    if(/^https?:\/\/(?:www\.)?(?:seogroupsbuy\.com|pay\.seogroupsbuytools\.com|seogroupsbuytools\.com)\/users\/(?:login|signup|cart\/)/i.test(target)
      || /^https?:\/\/pay\.seogroupsbuytools\.com(?:\/.*)?$/i.test(target))
      return open+base+close;
    return whole;
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
