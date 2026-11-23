// End-to-end static build regression: simulated CMS saves -> Astro files.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sample = [
  ['content/homepage.json',p=>{p.hero.headingHighlight='CMS HOME HERO VALIDATION';}],
  ['content/products/seo-tools__ahrefs.json',p=>{
    p.productHero.name='CMS EDITED AHREFS';
    p.productHero.price='$12345';
    p.productHero.buttonUrl='/cms-checkout-validation/';
  }],
  ['content/pages/pricing.json',p=>{
    assert.ok(p.priceValues?.length);
    p.priceValues[0].value='$54321';
  }],
  ['content/pages/faq.json',p=>{
    const item=p.contentGroups.flatMap(g=>g.items).find(i=>i.text?.length);
    assert.ok(item);
    item.text='CMS FAQ VALIDATION';
  }],
  ['content/settings.json',p=>{
    p.siteChrome.footerText='CMS FOOTER VALIDATION';
  }]
];
const mode=process.argv[2];
if (mode==='apply') {
  for (const [file,change] of sample) {
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    change(data);
    fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  }
  console.log('Applied isolated sample CMS edits to GitHub Actions worktree only.');
} else if(mode==='check') {
  const checks=[
    ['dist/index.html','CMS HOME HERO VALIDATION'],
    ['dist/seo-tools/ahrefs/index.html','$12345'],
    ['dist/seo-tools/ahrefs/index.html','CMS EDITED AHREFS'],
    ['dist/seo-tools/ahrefs/index.html','/cms-checkout-validation/'],
    ['dist/pricing/index.html','$54321'],
    ['dist/faq/index.html','CMS FAQ VALIDATION'],
    ['dist/index.html','CMS FOOTER VALIDATION']
  ];
  for(const [file,needle] of checks) {
    assert.ok(fs.existsSync(file),'Missing generated page: '+file);
    assert.ok(fs.readFileSync(file,'utf8').includes(needle),'CMS edit not reflected in '+file+': '+needle);
  }
  const productHtml=fs.readFileSync('dist/seo-tools/ahrefs/index.html','utf8');
  const schemas=[...productHtml.matchAll(/<script type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>/gi)].map(match=>JSON.parse(match[1]));
  const schema=schemas.find(data=>data['@type']==='Product');
  assert.ok(schema,'Product structured data was not generated after a CMS edit');
  assert.equal(schema.name,'CMS EDITED AHREFS','Product schema must use updated CMS name');
  assert.equal(schema.offers?.price,'12345','Product schema must use updated CMS price');
  assert.equal(schema.url,'https://seogroupsbuytools.com/seo-tools/ahrefs/');
  console.log('CMS save -> Astro HTML and product schema checks passed.');
} else throw new Error('Usage: node scripts/verify-build-output.mjs apply|check');
