// Pure, deterministic renderer for Pages CMS data; no HTML is rewritten unless a field changed.
const text = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const attr = s => text(s).replace(/"/g,'&quot;');
function innerReplace(source,value) {
  const start=source.indexOf('>')+1,end=source.lastIndexOf('</');
  if (start<1 || end<start) return source;
  return source.slice(0,start)+text(value)+source.slice(end);
}
function preserveInline(source,newPlain,originalPlain) {
  const open=source.indexOf('>')+1,end=source.lastIndexOf('</');
  if(open<1||end<open)return source;
  const inner=source.slice(open,end);
  if(!/<[a-z][^>]*>/i.test(inner))return innerReplace(source,newPlain);
  const before=String(originalPlain??''),after=String(newPlain??'');
  let front=0,back=0;
  while(front<before.length&&front<after.length&&before[front]===after[front])front++;
  while(back<before.length-front&&back<after.length-front&&before[before.length-1-back]===after[after.length-1-back])back++;
  const oldChanged=before.slice(front,before.length-back),newChanged=after.slice(front,after.length-back);
  if(oldChanged) {
    const fragments=inner.split(/(<[^>]*>)/g);
    const matches=[];
    for(let i=0;i<fragments.length;i+=2) {
      let at=fragments[i].indexOf(oldChanged);
      while(at>=0) {
        let score=0;
        while(at-score-1>=0 && front-score-1>=0 &&
          fragments[i][at-score-1]===before[front-score-1])score++;
        let forward=0;
        while(at+oldChanged.length+forward<fragments[i].length &&
          front+oldChanged.length+forward<before.length &&
          fragments[i][at+oldChanged.length+forward]===before[front+oldChanged.length+forward])forward++;
        matches.push([i,at,score+forward]);
        at=fragments[i].indexOf(oldChanged,at+1);
      }
    }
    matches.sort((a,b)=>b[2]-a[2]);
    if(matches.length && (matches.length===1 || matches[0][2]>matches[1][2])) {
      const [i,at]=matches[0];
      fragments[i]=fragments[i].slice(0,at)+text(newChanged)+fragments[i].slice(at+oldChanged.length);
      return source.slice(0,open)+fragments.join('')+source.slice(end);
    }
  }
  // For major rewrites a visual editor can replace all text; the parent tag
  // and its CSS classes are retained. Ordinary small edits preserve inline tags.
  return innerReplace(source,newPlain);
}

function replaceOriginal(html, source, replacement) {
  if (!source || !html.includes(source)) return html;
  return html.replace(source,replacement);
}
function seoMeta(html,name,value,kind='name') {
  const re=new RegExp('(<meta\\s+'+kind+'="'+name+'"\\s+content=")[^"]*(")', 'i');
  return html.replace(re, (_,a,b)=>a+attr(value)+b);
}

const plain = s => String(s ?? '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
function renderChrome(html, settings) {
  const chrome=settings?.siteChrome;
  if (!chrome) return html;
  for(const kind of ['header','footer']) {
    const re = new RegExp('<'+kind+'\\b[^>]*>[\\s\\S]*?<\\/'+kind+'>','i');
    const found=html.match(re);
    if(!found) continue;
    let region=found[0];
    const links=chrome[kind+'Links']||[];
    const matches=[...region.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .filter(m=>plain(m[2])&&!/<(img|svg|div|ul|li|span)\b/i.test(m[2]));
    for(let i=0;i<Math.min(matches.length,links.length);i++) {
      const field=links[i],match=matches[i];
      if(plain(match[2])!==field.originalText) continue;
      if(field.text===field.originalText && field.url===field.originalUrl) continue;
      let edited=match[0];
      if(field.url!==field.originalUrl) edited=edited.replace(/href="[^"]*"/i,'href="'+attr(field.url)+'"');
      if(field.text!==field.originalText) edited=innerReplace(edited,field.text);
      region=region.replace(match[0],edited);
    }
    const key=kind==='header'?'headerLogo':'footerLogo',original=kind==='header'?'originalHeaderLogo':'originalFooterLogo';
    if(chrome[key] && chrome[key]!==chrome[original]) {
      region=region.replace(/(<img\b[^>]*\bsrc=")[^"]*(")/i,(_,a,b)=>a+attr(chrome[key])+b);
    }
    if(kind==='footer' && typeof chrome.footerText==='string' && chrome.footerText!==chrome.originalFooterText) {
      region=region.replace(/<p\b[^>]*>[\s\S]*?<\/p>/i,m=>innerReplace(m,chrome.footerText));
    }
    html=html.replace(found[0],region);
  }
  if(settings.siteName && settings.originalSiteName && settings.siteName!==settings.originalSiteName)
    html=seoMeta(html,'og:site_name',settings.siteName,'property');
  return html;
}

// Resolve all edits against the immutable source positions. Parent links and
// their child images may be edited together, while repeated cards stay distinct.
function applyOperations(html,operations) {
  const valid=operations.filter(op=>Number.isInteger(op.at)&&op.at>=0&&html.slice(op.at,op.at+op.source.length)===op.source)
    .map(op=>({...op,end:op.at+op.source.length,children:[]}));
  valid.sort((a,b)=>a.at-b.at||b.end-a.end);
  const roots=[],stack=[];
  for(const op of valid) {
    while(stack.length && op.at>=stack[stack.length-1].end)stack.pop();
    const parent=stack[stack.length-1];
    if(parent && op.end<=parent.end)parent.children.push(op);
    else if(!parent)roots.push(op);
    else throw new Error('Overlapping CMS editing fields at '+op.at);
    stack.push(op);
  }
  const resolve = op => {
    let source=op.source;
    for(const child of [...op.children].sort((a,b)=>b.at-a.at)) {
      const relative=child.at-op.at;
      source=source.slice(0,relative)+resolve(child)+source.slice(relative+child.source.length);
    }
    return op.edit(source);
  };
  for(const op of roots.sort((a,b)=>b.at-a.at))
    html=html.slice(0,op.at)+resolve(op)+html.slice(op.end);
  return html;
}
export function renderPage(page,settings={}) {
  let html=page.html;
  const ops=[];
  const add=(source,at,edit)=>{
    if(!source)return;
    if(!Number.isInteger(at)||page.html.slice(at,at+source.length)!==source) {
      const first=page.html.indexOf(source);
      if(first<0 || page.html.indexOf(source,first+1)!==-1)return;
      at=first;
    }
    ops.push({source,at,edit});
  };
  if(typeof page.title==='string' && page.originalPageTitle!==undefined && page.title!==page.originalPageTitle) {
    const source=page.html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0];
    if(source)add(source,page.html.indexOf(source),s=>innerReplace(s,page.title));
  }
  for(const group of [...(page.contentGroups||[]),...(page.outsideGroups||[])]) {
    if(group.headingSource && typeof group.heading==='string' && group.heading!==group.originalHeading)
      add(group.headingSource,group.sourceOffset,s=>preserveInline(s,group.heading,group.originalHeading));
    for(const item of group.items||[])
      if(item.source && typeof item.text==='string' && item.text!==item.originalText)
        add(item.source,item.sourceOffset,s=>preserveInline(s,item.text,item.originalText));
  }
  for(const label of page.labelTexts||[])
    if(label.source && typeof label.text==='string' && label.text!==label.originalText)
      add(label.source,label.sourceOffset,s=>innerReplace(s,label.text));
  for(const price of page.priceValues||[])
    if(price.source && price.value!==price.originalValue)
      add(price.source,price.sourceOffset,s=>price.mode==='prefix'
        ?s.replace(price.originalValue,text(price.value)):innerReplace(s,price.value));
  for(const button of page.buttons||[]) {
    if(!button.source || (button.text===button.originalText&&button.url===button.originalUrl))continue;
    add(button.source,button.sourceOffset,s=>{
      if(button.url!==button.originalUrl)s=s.replace(/href="[^"]*"/i,'href="'+attr(button.url)+'"');
      if(button.text!==button.originalText)s=innerReplace(s,button.text);
      return s;
    });
  }
  for(const card of page.cardLinks||[])
    if(card.source && card.url!==card.originalUrl)
      add(card.source,card.sourceOffset,s=>s.replace(/href="[^"]*"/i,'href="'+attr(card.url)+'"'));
  for(const image of page.mediaImages||[]) {
    if(!image.source || (image.src===image.originalSrc&&image.alt===image.originalAlt))continue;
    add(image.source,image.sourceOffset,s=>{
      if(image.src!==image.originalSrc)s=s.replace(/src="[^"]*"/i,'src="'+attr(image.src)+'"');
      if(image.alt!==image.originalAlt){
        if(s.includes('alt="'))s=s.replace(/alt="[^"]*"/i,'alt="'+attr(image.alt)+'"');
        else s=s.replace(/\/?>$/,m=>' alt="'+attr(image.alt)+'"'+m);
      }
      return s;
    });
  }
  if(page.productHero) {
    const h=page.productHero;
    if(h.name!==h.originalName)add(h.nameSource,h.nameOffset,s=>innerReplace(s,h.name));
    if(h.description!==h.originalDescription)add(h.descriptionSource,h.descriptionOffset,s=>innerReplace(s,h.description));
    if(h.price!==h.originalPrice)add(h.priceSource,h.priceOffset,s=>s.replace(h.originalPrice,text(h.price)));
    if(h.image!==h.originalImage || h.imageAlt!==h.originalImageAlt)
      add(h.imageSource,h.imageOffset,s=>{
        if(h.image!==h.originalImage)s=s.replace(/src="[^"]*"/i,'src="'+attr(h.image)+'"');
        if(h.imageAlt!==h.originalImageAlt)s=s.replace(/alt="[^"]*"/i,'alt="'+attr(h.imageAlt)+'"');
        return s;
      });
    if(h.buttonLabel!==h.originalButtonLabel || h.buttonUrl!==h.originalButtonUrl)
      add(h.buttonSource,h.buttonOffset,s=>{
        if(h.buttonUrl!==h.originalButtonUrl)s=s.replace(/href="[^"]*"/i,'href="'+attr(h.buttonUrl)+'"');
        if(h.buttonLabel!==h.originalButtonLabel)s=innerReplace(s,h.buttonLabel);
        return s;
      });
    for(const feature of h.features||[])
      if(feature.source && feature.text!==feature.originalText)
        add(feature.source,feature.sourceOffset,s=>innerReplace(s,feature.text));
  }
  if(page.route==='/' && page.hero && page.originalHero) {
    const h=page.hero,o=page.originalHero;
    if(h.headingBefore!==o.headingBefore||h.headingHighlight!==o.headingHighlight||h.headingAfter!==o.headingAfter) {
      const source=page.html.match(/<h1>[\s\S]*?<\/h1>/i)?.[0];
      const heading=text(h.headingBefore)+'<span class="hero-highlight">'+text(h.headingHighlight)+'</span>'+text(h.headingAfter);
      if(source)add(source,page.html.indexOf(source),s=>s.replace(/(<h1>)[\s\S]*?(<\/h1>)/i,(_,a,b)=>a+heading+b));
    }
    if(h.description!==o.description) {
      const source=page.html.match(/<p class="hero-live-desc">[\s\S]*?<\/p>/i)?.[0];
      if(source)add(source,page.html.indexOf(source),s=>innerReplace(s,h.description));
    }
  }
  html=applyOperations(html,ops);
  if(page.seoTitle && page.seoTitle!==page.originalSeoTitle) {
    html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+text(page.seoTitle)+'</title>');
    html=seoMeta(html,'og:title',page.seoTitle,'property');
    html=seoMeta(html,'twitter:title',page.seoTitle);
  }
  if(page.seoDescription && page.seoDescription!==page.originalSeoDescription) {
    html=seoMeta(html,'description',page.seoDescription);
    html=seoMeta(html,'og:description',page.seoDescription,'property');
    html=seoMeta(html,'twitter:description',page.seoDescription);
  }
  // Optional SEO fields are omitted until the editor explicitly sets them;
  // an untouched migration remains byte-for-byte equivalent to the source.
  if(page.seoCanonical?.trim()) {
    html=html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i,(_,a,b)=>a+attr(page.seoCanonical.trim())+b);
    html=seoMeta(html,'og:url',page.seoCanonical.trim(),'property');
  }
  if(page.seoRobots?.trim())
    html=seoMeta(html,'robots',page.seoRobots.trim());
  if(page.seoSocialImage?.trim()) {
    const img=attr(page.seoSocialImage.trim());
    for(const name of ['og:image','twitter:image']){
      const property=name.startsWith('og:')?'property':'name';
      const re=new RegExp('<meta\\s+'+property+'="'+name+'"\\s+content="[^"]*"\\s*\\/?>','i');
      if(re.test(html))html=html.replace(re,'<meta '+property+'="'+name+'" content="'+img+'">');
      else html=html.replace('</head>','<meta '+property+'="'+name+'" content="'+img+'"></head>');
    }
  }
  if(settings.faviconUrl?.trim())
    html=html.replace(/(<link\b[^>]*rel="icon"[^>]*href=")[^"]*(")/i,(_,a,b)=>a+attr(settings.faviconUrl.trim())+b);
  return renderChrome(html,settings);
}
export default renderPage;
