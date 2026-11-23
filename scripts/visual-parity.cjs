const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const LIVE = 'https://seogroupsbuytools.com';
const PREVIEW = 'https://seogroupsbuytools-astro.oldbilalfadi.workers.dev';
const routes = [...new Set(JSON.parse(fs.readFileSync('migration/url-map.json','utf8')).map(r=>r.route).filter(r=>r!='/404/'))].sort();
const screenshotRoutes=new Set(['/', '/seo-tools/', '/seo-tools/ahrefs/', '/seo-tools/semrush/', '/design-tools/', '/design-tools/canva-pro/', '/pricing/', '/faq/', '/how-it-works/']);
const sizes = [{name:'desktop', width:1440, height:900}, {name:'mobile', width:390, height:844}];
const out = 'audit-results/visual';
fs.mkdirSync(out,{recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true});
  const results = [];
  const issues=[];
  const warnings=[];
  for (const size of sizes) {
    const context = await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:1, reducedMotion:'reduce'});
    for (const route of routes) {
      const name = (route==='/'?'home':route.replace(/^\/|\/$/g,'').replace(/\//g,'--'));
      const entry = {route,viewport:size.name};
      for (const [label,base] of [['live',LIVE],['preview',PREVIEW]]) {
        const page = await context.newPage();
        const failures = [];
        page.on('pageerror', e => failures.push(e.message));
        try {
          const response = await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
          await page.evaluate(() => document.fonts.ready);
          if(screenshotRoutes.has(route)) {
            await page.waitForTimeout(300);
            await page.screenshot({path:path.join(out,`${name}-${size.name}-${label}.png`),fullPage:true,animations:'disabled'});
          }
          entry[label] = {status:response?.status(),title:await page.title(),h1:await page.locator('h1').allTextContents(),bodyHeight:await page.evaluate(()=>document.documentElement.scrollHeight),scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),viewportWidth:await page.evaluate(()=>document.documentElement.clientWidth),buttons:await page.locator('button').count(),forms:await page.locator('form').count(),overflowElements:await page.evaluate(()=>{const width=document.documentElement.clientWidth;return [...document.querySelectorAll('body *')].filter(el=>{const rect=el.getBoundingClientRect();return rect.right>width+3&&rect.width>10&&getComputedStyle(el).position!=='fixed'}).slice(0,12).map(el=>({tag:el.tagName,cls:String(el.className||'').slice(0,100),width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)}))}),errors:failures};
        } catch(e) {entry[label] = {error:String(e)}}
        await page.close();
      }
      results.push(entry);
      const a=entry.live||{},b=entry.preview||{};
      if(a.error||b.error)issues.push({route,viewport:size.name,problem:'Browser navigation error',live:a.error,preview:b.error});
      else {
        if(a.status!==b.status)issues.push({route,viewport:size.name,problem:'HTTP status mismatch',live:a.status,preview:b.status});
        if(a.title!==b.title)issues.push({route,viewport:size.name,problem:'Title mismatch',live:a.title,preview:b.title});
        if(JSON.stringify(a.h1)!==JSON.stringify(b.h1))issues.push({route,viewport:size.name,problem:'H1 mismatch',live:a.h1,preview:b.h1});
        if(b.errors?.length)issues.push({route,viewport:size.name,problem:'Preview JavaScript errors',errors:b.errors});
        if(b.scrollWidth>b.viewportWidth+2){
          const detail={route,viewport:size.name,problem:'Horizontal overflow',scrollWidth:b.scrollWidth,viewportWidth:b.viewportWidth,elements:b.overflowElements,liveScrollWidth:a.scrollWidth,liveOverflowElements:a.overflowElements};
          if(a.scrollWidth>b.viewportWidth+2 && Math.abs(a.scrollWidth-b.scrollWidth)<=2)
            warnings.push({...detail,problem:'Same horizontal overflow exists on original live website'});
          else issues.push({...detail,problem:'Preview-only horizontal overflow'});
        }
        if(a.bodyHeight&&b.bodyHeight&&Math.abs(a.bodyHeight-b.bodyHeight)/Math.max(a.bodyHeight,b.bodyHeight)>0.2)
          warnings.push({route,viewport:size.name,problem:'Page height differs by over 20%',live:a.bodyHeight,preview:b.bodyHeight});
      }
      console.log(size.name,route,JSON.stringify({live:entry.live?.status,preview:entry.preview?.status,liveHeight:entry.live?.bodyHeight,previewHeight:entry.preview?.bodyHeight}));
    }
    await context.close();
  }
  await browser.close();
  const summary={checkedPages:routes.length,viewports:sizes.length,comparedViews:results.length,criticalIssues:issues.length,heightWarnings:warnings.length,screenshotRoutes:[...screenshotRoutes]};
  fs.writeFileSync('audit-results/visual-results.json',JSON.stringify({summary,issues,warnings,results},null,2));
  console.log('FULL BROWSER AUDIT',JSON.stringify({summary,issues:issues.slice(0,20),warnings:warnings.slice(0,10)}));
  if(issues.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
