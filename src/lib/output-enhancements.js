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
export function enhanceOutput(html,page,settings={}){
  if(linkSources.has(page.route)){
    html=html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi,(full,before,url,after)=>{
      const target=fixedLinks.get(url);
      return target ? before+target+after : full;
    });
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
