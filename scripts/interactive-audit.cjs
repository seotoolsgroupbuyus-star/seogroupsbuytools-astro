const { chromium } = require('playwright');
const fs = require('node:fs');
const sites={live:'https://seogroupsbuytools.com',preview:'https://seogroupsbuytools-astro.oldbilalfadi.workers.dev'};
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[],issues=[];
 for(const [label,base] of Object.entries(sites)){
  for(const route of ['/','/seo-tools/','/seo-tools/ahrefs/','/pricing/','/faq/']){
   const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
   const row={site:label,route,checks:{}}, errors=[];
   page.on('pageerror',e=>errors.push(String(e.message)));
   try{
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
    row.status=response?.status();
    await page.waitForTimeout(250);
    const nav=page.locator('.nav-toggle');
    const menu=page.locator('.nav-menu');
    if(await nav.count()&&await menu.count()){
     const before=await nav.getAttribute('aria-expanded');
     await nav.click({timeout:5000});
     const opened=await nav.getAttribute('aria-expanded');
     const hasClass=await menu.evaluate(el=>el.classList.contains('open'));
     row.checks.mobileNav={before,opened,hasClass,passed:opened==='true'&&hasClass};
     if(!row.checks.mobileNav.passed)issues.push({site:label,route,check:'Mobile menu opens'});
     await nav.click({timeout:5000});
     const closed=await nav.getAttribute('aria-expanded');
     row.checks.mobileNav.closes=closed==='false';
     if(closed!=='false')issues.push({site:label,route,check:'Mobile menu closes'});
    }else{
     row.checks.mobileNav={present:false};
     issues.push({site:label,route,check:'Mobile menu toggle missing'});
    }
    if(route==='/'){
     const filters=page.locator('.hero-cat-filter button'),cards=page.locator('.js-resource-card');
     const filterCount=await filters.count(),cardCount=await cards.count();
     row.checks.homeFilter={filterCount,cardCount};
     if(filterCount>1&&cardCount){
      await filters.nth(1).click({timeout:5000});
      const hidden=await cards.evaluateAll(elements=>elements.filter(el=>el.classList.contains('is-hidden')).length);
      row.checks.homeFilter.hiddenAfterFilter=hidden;
      row.checks.homeFilter.passed=hidden>0;
      if(!row.checks.homeFilter.passed)issues.push({site:label,route,check:'Homepage category filter changes cards'});
     }else issues.push({site:label,route,check:'Homepage filters/cards missing'});
    }
    row.jsErrors=errors;
    if(errors.length)issues.push({site:label,route,check:'Browser JavaScript errors',errors});
   }catch(e){row.error=String(e);issues.push({site:label,route,check:'Interaction execution',error:String(e)})}
   results.push(row);await page.close();
  }
 }
 await browser.close();
 const summary={sites:Object.keys(sites).length,routesPerSite:5,checks:results.length,issues:issues.length};
 fs.mkdirSync('audit-results',{recursive:true});
 fs.writeFileSync('audit-results/interactive-results.json',JSON.stringify({summary,issues,results},null,2));
 console.log('INTERACTIVE AUDIT',JSON.stringify({summary,issues,results},null,2));
 // Compare preview-specific regressions while retaining findings from original site.
 const regressions=issues.filter(i=>i.site==='preview'&&!issues.some(x=>x.site==='live'&&x.route===i.route&&x.check===i.check));
 if(regressions.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
