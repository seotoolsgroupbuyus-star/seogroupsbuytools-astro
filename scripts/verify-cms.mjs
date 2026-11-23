import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import renderPage from '../src/lib/render.js';
const files=['content/homepage.json',...['products','pages'].flatMap(dir=>fs.readdirSync('content/'+dir).filter(x=>x.endsWith('.json')).map(f=>'content/'+dir+'/'+f))];
const site=JSON.parse(fs.readFileSync('content/settings.json','utf8'));
const totals={pages:0,groups:0,outsideGroups:0,editableText:0,buttons:0,cards:0,images:0,prices:0,seo:0,hero:0,global:0,products:0,productFields:0,labels:0,offsets:0,nested:0,duplicates:0,inlineFormatting:0,assetPaths:0};
for (const file of files) {
  const page=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(renderPage(page,site),page.html,'Unedited page HTML changed: '+file);
  if(file==='content/homepage.json'){
    const extraNav=structuredClone(site);
    extraNav.siteChrome.headerLinks.push({text:'CMS ADDED MENU LINK',url:'/cms-new-nav/'});
    extraNav.siteChrome.footerLinks.push({text:'CMS ADDED FOOTER LINK',url:'/cms-footer/'});
    const edited=renderPage(page,extraNav);
    for(const marker of ['CMS ADDED MENU LINK','/cms-new-nav/','CMS ADDED FOOTER LINK','/cms-footer/'])
      assert.ok(edited.includes(marker),'CMS header/footer add link: '+marker);
  }

  const newSection=structuredClone(page);
  newSection.extraSections=[{heading:'CMS ADDED SECTION TEST',description:'CMS custom description',
    buttonText:'CMS section button',buttonUrl:'/cms-example/',
    cards:[{title:'CMS custom card',description:'CMS card description',image:'/assets/images/cms-card.webp',imageAlt:'CMS image alt',buttonText:'CMS card link',buttonUrl:'/cms-card/'}]}];
  const added=renderPage(newSection,site);
  for(const text of ['CMS ADDED SECTION TEST','CMS custom description','CMS custom card','CMS card description','CMS section button','/cms-example/','/cms-card/','cms-card.webp'])
    assert.ok(added.includes(text),file+' extraSections CMS rendering: '+text);

  assert.ok(Array.isArray(page.outsideGroups), 'Missing outside CMS groups: '+file);
  assert.ok(Array.isArray(page.contentGroups), 'Missing CMS groups: '+file);
  for (const group of [...page.contentGroups,...page.outsideGroups]) {
    if(group.headingSource) {
      const edited=structuredClone(page);
      const target=[...edited.contentGroups,...edited.outsideGroups].find(g=>g.headingSource===group.headingSource);
      assert.ok(target,file+' missing heading');
      target.heading='CMS HEADING VALIDATION';
      assert.ok(renderPage(edited).includes('CMS HEADING VALIDATION'),file+' heading edit');
    }
    for (const item of group.items) {
      assert.ok(item.text && item.source && page.html.includes(item.source),file+' empty CMS field');
    }
  }
  const item=[...page.contentGroups,...page.outsideGroups].flatMap(g=>g.items).find(e=>e.source && e.text);
  if(item) {
    const edit=structuredClone(page);
    [...edit.contentGroups,...edit.outsideGroups].flatMap(g=>g.items).find(e=>e.source===item.source).text='CMS PARAGRAPH VALIDATION';
    assert.ok(renderPage(edit).includes('CMS PARAGRAPH VALIDATION'),file+' text edit');
  }
  if(file.startsWith('content/products/')) {
    const h=page.productHero;
    assert.ok(h&&h.name&&h.description&&h.buttonUrl, file+' missing product details');
    for(const [field,marker] of [['name','CMS PRODUCT NAME'],['description','CMS PRODUCT SUMMARY'],['price','CMS PRODUCT PRICE'],['buttonLabel','CMS BUY BUTTON'],['buttonUrl','/cms-product-checkout/'],['image','/assets/images/cms-product.png']]){
      const edit=structuredClone(page);
      edit.productHero[field]=marker;
      assert.ok(renderPage(edit,site).includes(marker),file+' '+field+' edit');
      totals.productFields++;
    }
    if(h.features?.length){
      const edit=structuredClone(page);
      edit.productHero.features[0].text='CMS FEATURE VALIDATION';
      assert.ok(renderPage(edit,site).includes('CMS FEATURE VALIDATION'),file+' feature edit');
      totals.productFields++;
    }
    totals.products++;
  }
  if (page.buttons?.length) {
    const edit=structuredClone(page);
    edit.buttons[0].url='/cms-link-validation/';
    assert.ok(renderPage(edit).includes('href="/cms-link-validation/"'),file+' link edit');
    totals.buttons+=page.buttons.length;
  }
  if (page.cardLinks?.length) {
    const edit=structuredClone(page);
    edit.cardLinks[0].url='/cms-card-validation/';
    assert.ok(renderPage(edit,site).includes('href="/cms-card-validation/"'),file+' card edit');
    totals.cards+=page.cardLinks.length;
  }
  if (page.mediaImages?.length) {
    const edit=structuredClone(page);
    edit.mediaImages[0].src='/assets/images/cms-image-validation.png';
    assert.ok(renderPage(edit).includes('src="/assets/images/cms-image-validation.png"'),file+' image edit');
    totals.images+=page.mediaImages.length;
  }
  if(page.labelTexts?.length) {
    for(const label of page.labelTexts) {
      assert.equal(page.html.slice(label.sourceOffset,label.sourceOffset+label.source.length),label.source,file+' badge mapped incorrectly');
    }
    const target=page.labelTexts.find(label=>label.text && label.sourceOffset>=0);
    if(target) {
      const edit=structuredClone(page);
      edit.labelTexts.find(l=>l.sourceOffset===target.sourceOffset).text='CMS BADGE VALIDATION';
      assert.ok(renderPage(edit,site).includes('CMS BADGE VALIDATION'),file+' badge edit');
    }
    totals.labels+=page.labelTexts.length;
  }
  if (page.priceValues?.length) {
    const edit=structuredClone(page);
    edit.priceValues[0].value='$98765';
    assert.ok(renderPage(edit).includes('$98765'),file+' price edit');
    totals.prices+=page.priceValues.length;
  }
  // Every editable field must point at its own exact original HTML tag,
  // not the first matching tag on the page.
  const mapped=[
    ...[...page.contentGroups,...page.outsideGroups].flatMap(g=>[
      ...(g.headingSource?[{source:g.headingSource,sourceOffset:g.sourceOffset}]:[]),
      ...g.items
    ]),
    ...(page.buttons||[]),...(page.cardLinks||[]),...(page.mediaImages||[]),
    ...(page.priceValues||[]),...(page.labelTexts||[]),
    ...(page.productHero?[
      {source:page.productHero.nameSource,sourceOffset:page.productHero.nameOffset},
      {source:page.productHero.descriptionSource,sourceOffset:page.productHero.descriptionOffset},
      {source:page.productHero.priceSource,sourceOffset:page.productHero.priceOffset},
      {source:page.productHero.imageSource,sourceOffset:page.productHero.imageOffset},
      {source:page.productHero.buttonSource,sourceOffset:page.productHero.buttonOffset},
      ...page.productHero.features
    ]:[])
  ].filter(x=>x.source);
  for(const entry of mapped) {
    assert.ok(Number.isInteger(entry.sourceOffset),file+' missing exact offset for '+entry.source.slice(0,45));
    assert.equal(page.html.slice(entry.sourceOffset,entry.sourceOffset+entry.source.length),entry.source,file+' wrong source offset');
    totals.offsets++;
  }
  const bySource=new Map();
  for(const entry of [...page.contentGroups,...page.outsideGroups].flatMap(g=>g.items))
    if(entry.source) {
      const list=bySource.get(entry.source)||[];
      list.push(entry);
      bySource.set(entry.source,list);
    }
  for(const pair of bySource.values()) {
    const unique=[...new Set(pair.map(e=>e.sourceOffset))];
    if(pair.length>=2 && unique.length>=2) {
      const target=pair.find(e=>e.sourceOffset===unique[1]);
      const edit=structuredClone(page);
      const record=[...edit.contentGroups,...edit.outsideGroups].flatMap(g=>g.items).find(e=>e.sourceOffset===target.sourceOffset&&e.source===target.source);
      record.text='CMS SECOND DUPLICATE VALIDATION';
      const out=renderPage(edit,site);
      assert.ok(out.includes('CMS SECOND DUPLICATE VALIDATION'),file+' repeated text not updated');
      const first=pair[0];
      assert.ok(out.slice(first.sourceOffset,first.sourceOffset+first.source.length).includes(first.originalText.slice(0,Math.min(8,first.originalText.length))) || out.includes(first.source),file+' repeated first item changed');
      totals.duplicates++;
      break;
    }
  }
  const nestedCard=(page.cardLinks||[]).find(card=>(page.mediaImages||[]).some(img=>img.sourceOffset>card.sourceOffset && img.sourceOffset+img.source.length<=card.sourceOffset+card.source.length));
  if(nestedCard) {
    const img=page.mediaImages.find(i=>i.sourceOffset>nestedCard.sourceOffset&&i.sourceOffset+i.source.length<=nestedCard.sourceOffset+nestedCard.source.length);
    const edit=structuredClone(page);
    edit.cardLinks.find(c=>c.sourceOffset===nestedCard.sourceOffset).url='/cms-nested-card-validation/';
    edit.mediaImages.find(i=>i.sourceOffset===img.sourceOffset).src='/assets/images/cms-nested-image-validation.png';
    const out=renderPage(edit,site);
    assert.ok(out.includes('href="/cms-nested-card-validation/"')&&out.includes('src="/assets/images/cms-nested-image-validation.png"'),file+' nested card and image failed');
    totals.nested++;
  }

  const formatted=[...page.contentGroups,...page.outsideGroups].flatMap(g=>g.items).find(item=>item.source.includes('<strong>') && item.text.includes('$5/month'));
  if(formatted) {
    const edit=structuredClone(page);
    const target=[...edit.contentGroups,...edit.outsideGroups].flatMap(g=>g.items).find(x=>x.sourceOffset===formatted.sourceOffset && x.source===formatted.source);
    target.text=target.text.replace('$5/month','$9/month');
    const out=renderPage(edit,site);
    assert.ok(out.includes('<strong>$9/month</strong>'),file+' lost bold inline formatting');
    totals.inlineFormatting++;
  }
  for(const img of [...(page.mediaImages||[]),...(page.productHero?[{src:page.productHero.image}]:[])]) {
    if(typeof img.src==='string'&&img.src.startsWith('/assets/images/')) {
      assert.ok(fs.existsSync('public'+img.src),file+' missing image '+img.src);
      totals.assetPaths++;
    }
  }
  if (page.html.includes('<title>')) {
    const edit=structuredClone(page);
    edit.seoTitle='CMS SEO TITLE VALIDATION';
    assert.ok(renderPage(edit).includes('<title>CMS SEO TITLE VALIDATION</title>'),file+' SEO title');
    totals.seo++;
  }
  if (page.hero && page.originalHero) {
    const edit=structuredClone(page);
    edit.hero.headingHighlight='CMS HERO VALIDATION';
    assert.ok(renderPage(edit).includes('CMS HERO VALIDATION'),file+' hero edit');
    totals.hero++;
  }
  if (page.html.includes('<header') && site.siteChrome?.headerLinks?.length) {
    const edited=structuredClone(site);
    edited.siteChrome.headerLinks[0].text='CMS MENU VALIDATION';
    assert.ok(renderPage(page,edited).includes('CMS MENU VALIDATION'),file+' menu edit');
    totals.global++;
  }
  if (page.html.includes('<footer') && site.siteChrome?.footerText) {
    const edited=structuredClone(site);
    edited.siteChrome.footerText='CMS FOOTER VALIDATION';
    assert.ok(renderPage(page,edited).includes('CMS FOOTER VALIDATION'),file+' footer edit');
  }
  if(page.html.includes('rel="canonical"')) {
    const edited=structuredClone(page);
    edited.seoCanonical='https://seogroupsbuytools.com/cms-test/';
    assert.ok(renderPage(edited,site).includes('rel="canonical" href="https://seogroupsbuytools.com/cms-test/"'),file+' canonical CMS edit');
  }
  if(page.html.includes('name="robots"')) {
    const edited=structuredClone(page);
    edited.seoRobots='noindex,follow';
    assert.ok(renderPage(edited,site).includes('name="robots" content="noindex,follow"'),file+' robots CMS edit');
  }
  if(page.html.includes('</head>')) {
    const edited=structuredClone(page);
    edited.seoSocialImage='/assets/images/cms-social.png';
    assert.ok(renderPage(edited,site).includes('cms-social.png'),file+' social image CMS edit');
    const settings=structuredClone(site);
    settings.faviconUrl='/assets/images/cms-favicon.png';
    if(page.html.includes('rel="icon"'))
      assert.ok(renderPage(page,settings).includes('cms-favicon.png'),file+' favicon CMS edit');
  }
  totals.pages++;
  totals.groups+=page.contentGroups.length+page.outsideGroups.length;
  totals.outsideGroups+=page.outsideGroups.length;
  totals.editableText+=[...page.contentGroups,...page.outsideGroups].reduce((n,g)=>n+g.items.length+(g.headingSource?1:0),0);
}
assert.equal(totals.pages,72);
assert.equal(totals.products,30);
assert.ok(totals.productFields>=180);
console.log('CMS field diagnostics:',JSON.stringify(totals));
for(const [name,min] of Object.entries({offsets:2000,duplicates:0,nested:0,inlineFormatting:0,assetPaths:200})) assert.ok(totals[name]>min,`CMS ${name}: expected >${min}, observed ${totals[name]}`);
assert.ok(totals.groups>100 && totals.outsideGroups>20 && totals.editableText>500 && totals.buttons>100 && totals.cards>50 && totals.images>50 && totals.prices>10 && totals.labels>20);
assert.ok(site.siteChrome?.headerLinks.length>5 && site.siteChrome?.footerLinks.length>5);
for(const file of ['content/homepage.json','content/pages/pricing.json','content/products/seo-tools__ahrefs.json']){
  assert.ok(JSON.parse(fs.readFileSync(file,'utf8')).priceValues.length>0,'Pricing fields missing: '+file);
}
const cms=fs.readFileSync('.pages.yml','utf8');
assert.ok(!cms.includes('Section ID')&&!cms.includes('Original HTML')&&!cms.includes('editorContent'));
assert.ok(cms.includes('summary: "{heading}"') && cms.includes('name: priceValues') && cms.includes('name: cardLinks') && cms.includes('name: outsideGroups') && cms.includes('name: productHero') && cms.includes('name: labelTexts'));
console.log('CMS validated:',JSON.stringify(totals));