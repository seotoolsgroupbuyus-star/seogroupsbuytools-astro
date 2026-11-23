// Static SEO and migration coverage audit. Never alters source content.
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
const base='https://seogroupsbuytools.com';
const records=JSON.parse(fs.readFileSync('migration/url-map.json','utf8'));
const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
const robots=fs.readFileSync('public/robots.txt','utf8');
const failures=[],warnings=[],pages=[];
const routeSet=new Set(records.filter(r=>r.route!=='/404/').map(r=>r.route));
const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
const locationSet=new Set(locs);
const localAssets=new Set();
let schemaCount=0, jsonldErrors=0, productCount=0, productSchemaCount=0, imageCount=0, missingAlt=0;
let checkedInternalLinks=0; const unresolvedInternalLinks=new Map();
function extract(html,regex){return html.match(regex)?.[1]||''}
function outputPath(route){return route==='/'?'dist/index.html':path.join('dist',route.slice(1),'index.html')}
for(const item of records){
 if(item.route==='/404/')continue;
 const route=item.route, file=outputPath(route);
 if(!fs.existsSync(file)){failures.push('Missing build output: '+route);continue}
 const html=fs.readFileSync(file,'utf8');
 const title=extract(html,/<title[^>]*>([\s\S]*?)<\/title>/i).trim();
 const description=extract(html,/<meta\s+name=["']description["']\s+content=["']([^"']*)/i);
 const canonical=extract(html,/<link\s+rel=["']canonical["']\s+href=["']([^"']*)/i);
 const robotsMeta=extract(html,/<meta\s+name=["']robots["']\s+content=["']([^"']*)/i);
 const headings=[...html.matchAll(/<h1(?:\s[^>]*)?>/gi)].length;
 const schemas=[...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
 const assets=[...html.matchAll(/<(?:img|script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)].map(m=>m[1]);
 const images=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
 if(!title)failures.push('Missing title: '+route);
 if(!description)failures.push('Missing meta description: '+route);
 if(!canonical)failures.push('Missing canonical: '+route);
 if(canonical!==base+route)warnings.push('Non-self canonical: '+route+' -> '+canonical);
 if(!robotsMeta)failures.push('Missing robots meta: '+route);
 else if(/noindex/i.test(robotsMeta))warnings.push('Noindex published route: '+route);
 if(headings!==1)warnings.push('H1 count '+headings+': '+route);
 if(!locationSet.has(base+route))failures.push('Sitemap missing published route: '+route);
 const validSchemas=[];
 for(const match of schemas){try{const data=JSON.parse(match[1]);validSchemas.push(data);schemaCount++}catch{jsonldErrors++;failures.push('Malformed JSON-LD: '+route)}}
 if(item.content.startsWith('content/products/')){
  const types=validSchemas.flatMap(data=>[data?.['@type'],...(Array.isArray(data?.['@graph'])?data['@graph'].map(node=>node['@type']):[])]).flat().filter(Boolean);
  if(types.includes('Product'))productSchemaCount++;
  else failures.push('Product structured data absent: '+route);
 }
 for(const asset of assets){
  if(!asset.startsWith('/assets/')&&!asset.startsWith('assets/')&&!asset.startsWith('../assets/'))continue;
  let u;try{u=new URL(asset,base+route)}catch{continue}
  if(u.hostname!==new URL(base).hostname)continue;
  if(!localAssets.has(u.pathname)){
   localAssets.add(u.pathname);
   if(!fs.existsSync(path.join('dist',u.pathname.slice(1))))warnings.push('Local media asset not found: '+u.pathname+' on '+route);
  }
 }
 for(const match of html.matchAll(/<a\b[^>]*?\bhref=["']([^"']+)["']/gi)){
  const href=match[1];
  if(!href||href.startsWith('#')||/^(mailto:|tel:|javascript:|data:)/i.test(href))continue;
  let target;try{target=new URL(href,base+route)}catch{continue}
  if(target.origin!==base)continue;
  checkedInternalLinks++;
  if(target.pathname.match(/\.[a-z0-9]{2,8}$/i))continue; // File target, not HTML
  const pathname=target.pathname==='/'?'/':(target.pathname.endsWith('/')?target.pathname:target.pathname+'/');
  if(!routeSet.has(pathname)){
   const key=route+' -> '+pathname;
   unresolvedInternalLinks.set(key,(unresolvedInternalLinks.get(key)||0)+1);
  }
 }
 imageCount+=images.length;
 missingAlt+=images.filter(tag=>!(/\balt\s*=/.test(tag))).length;
 if(item.content.startsWith('content/products/'))productCount++;
 pages.push({route,title,description:!!description,canonical,robots:robotsMeta,h1:headings,jsonld:schemas.length,images:images.length});
}
if(!robots.includes('Sitemap: '+base+'/sitemap.xml'))failures.push('robots.txt missing sitemap directive');
if(!robots.toLowerCase().includes('user-agent:'))failures.push('robots.txt missing user-agent');
for(const loc of locs){try{const u=new URL(loc);if(u.origin===base&&!routeSet.has(u.pathname))warnings.push('Sitemap URL without source page: '+loc)}catch{failures.push('Malformed sitemap URL: '+loc)}}
if(locationSet.size!==locs.length)failures.push('Duplicate URLs in sitemap');
for(const [pair,count] of unresolvedInternalLinks)failures.push('Unresolved internal link ('+count+'): '+pair);
if(productSchemaCount!==productCount)failures.push('Not every product has Product JSON-LD: '+productSchemaCount+'/'+productCount);
const summary={expectedSourceRecords:records.length,publishedRoutes:routeSet.size,verifiedPages:pages.length,productPages:productCount,sitemapUrls:locs.length,structuredDataBlocks:schemaCount,productSchemaCount,malformedStructuredData:jsonldErrors,images:imageCount,imagesWithoutAltAttribute:missingAlt,uniqueReferencedAssets:localAssets.size,checkedInternalLinks,unresolvedInternalLinkPairs:unresolvedInternalLinks.size,failures:failures.length,warnings:warnings.length};
fs.mkdirSync('audit-results',{recursive:true});
fs.writeFileSync('audit-results/static-migration-audit.json',JSON.stringify({summary,failures,warnings,pages},null,2)+'\n');
console.log(JSON.stringify({summary,failures:failures.slice(0,40),warnings:warnings.slice(0,40)},null,2));
if(failures.length)process.exitCode=1;
