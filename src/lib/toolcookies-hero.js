/** Approved ToolCookies markup, restyled to SEOGroupsBuyTools palette.
 * Applies only to homepage, after Pages CMS has rendered editable fields.
 * Leaves page title, SEO tags, other sections, links, and content JSON untouched.
 */
const SOURCE=`
<div aria-hidden="true" class="hero__bg"><span class="blob blob--1"></span><span class="blob blob--2"></span></div>
<div class="hero__stage">
<div aria-hidden="true" class="float float--l1" style="--d:0.0s"><span aria-hidden="true" class="ti" style="--x:2;--y:7"></span><span><b>SEMrush</b><small>SEO research</small></span></div><div aria-hidden="true" class="float float--l2" style="--d:-1.1s"><span aria-hidden="true" class="ti" style="--x:1;--y:1"></span><span><b>Canva Pro</b><small>Creative design</small></span></div><div aria-hidden="true" class="float float--l3" style="--d:-2.2s"><span aria-hidden="true" class="ti" style="--x:4;--y:1"></span><span><b>ChatGPT</b><small>AI writing</small></span></div><div aria-hidden="true" class="float float--r1" style="--d:-3.3000000000000003s"><span aria-hidden="true" class="ti" style="--x:1;--y:0"></span><span><b>Ahrefs</b><small>Backlink analysis</small></span></div><div aria-hidden="true" class="float float--r2" style="--d:-4.4s"><span aria-hidden="true" class="ti" style="--x:11;--y:1"></span><span><b>Envato Elements</b><small>Design assets</small></span></div><div aria-hidden="true" class="float float--r3" style="--d:-5.5s"><span aria-hidden="true" class="ti" style="--x:9;--y:10"></span><span><b>Claude AI</b><small>AI assistance</small></span></div>
<div class="wrap hero__in">
<a class="pill pill--live" href="/seo-tools/"><span class="dot"></span> SEO &amp; digital marketing tool access</a>
<h1 class="display hero__title">__DYNAMIC_TITLE__</h1>
<p class="hero__for">Made for <span class="rot"><span style="--i:0">freelancers</span><span style="--i:1">bloggers</span><span style="--i:2">designers</span><span style="--i:3">YouTubers</span><span style="--i:4">students</span><span style="--i:5">agencies</span></span></p>
<p class="lead hero__lead">__DYNAMIC_DESC__</p>
<div class="hero__cta">__DYNAMIC_CTAS__</div>
<form action="/seo-tools/" class="search" data-hero-search="" method="get" role="search"><span aria-hidden="true" class="search-icon">⌕</span>
<input aria-label="Search tools" autocomplete="off" data-search-input="" name="q" placeholder="Search Ahrefs, SEMrush, Canva and more…" type="search"/>
<div class="sres sres--drop" data-lenis-prevent="" data-search-results="" hidden=""></div>
<button class="search__submit" type="submit">Search →</button></form>
<ul class="hero__trust"><li><span aria-hidden="true" class="trust-check">✓</span> Tool access in one place</li><li><span aria-hidden="true" class="trust-check">✓</span> Research, content &amp; design</li><li><span aria-hidden="true" class="trust-check">✓</span> Support available</li></ul>
</div>
</div>


`;
const attr=s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const plain=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function animatedWords(heading){
  // Preserve text exactly, including any CMS edits. Highlight only existing original emphasis.
  let index=0;
  return String(heading).replace(/(<[^>]+>)|([^\s<>]+)|\s+/g,(part,tag,word)=>{
    if(tag)return tag;
    if(!word)return part;
    return '<span class="w" style="--i:'+index+++'">'+word+'</span>';
  });
}
export function replaceHomepageHero(html){
 const start=html.match(/<section\b[^>]*class="[^"]*\bhero-live\b[^"]*"[^>]*>/i);
 if(!start) return html;
 const from=start.index;
 const stop=html.indexOf('</section>',from);
 if(stop<0)return html;
 const original=html.slice(from,stop+10);
 const title=original.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
 const desc=original.match(/<p\b[^>]*class="[^"]*\bhero-live-desc\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1];
 const cta=original.match(/<div class="hero-live-cta">([\s\S]*?)<\/div>/i)?.[1];
 if(!title||!desc||!cta)return html;
 // Existing editable CTA markup: retain every configured URL and label.
 const links=[...cta.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
 const makeCta=(m,i)=>{
   const href=m[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2]||'#';
   const target=m[1].match(/\btarget\s*=\s*(["'])(.*?)\1/i)?.[2];
   const rel=m[1].match(/\brel\s*=\s*(["'])(.*?)\1/i)?.[2];
   return '<a class="btn '+(i===0?'btn--brand':'btn--ghost')+' btn--lg" href="'+attr(href)+'"'+(target?' target="'+attr(target)+'"':'')+(rel?' rel="'+attr(rel)+'"':'')+'>'+m[2]+'</a>';
 };
 const buttons=links.slice(0,2).map(makeCta).join('');
 if(!buttons)return html;
 const transformed=SOURCE.replace('__DYNAMIC_TITLE__',animatedWords(title))
   .replace('__DYNAMIC_DESC__',desc).replace('__DYNAMIC_CTAS__',buttons);
 return html.slice(0,from)+'<link rel="stylesheet" href="/assets/tc-hero.css">'
   +'<section class="tc-hero" id="home-hero">'+transformed+'</section>'
   +'<script defer src="/assets/tc-hero.js"></script>'+html.slice(stop+10);
}