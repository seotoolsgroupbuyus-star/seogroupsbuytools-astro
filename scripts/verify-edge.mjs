import fs from 'node:fs';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/404/index.js';
const urls=new Set(JSON.parse(fs.readFileSync('migration/url-map.json','utf8')).map(x=>x.route));
const rules=fs.readFileSync('public/_redirects','utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'));
assert.equal(rules.length,10,'Expected redirects for five old links with and without slash');
for(const line of rules){
 const [source,target,status]=line.trim().split(/\s+/);
 assert.equal(status,'301','Redirect must be permanent: '+source);
 assert.ok(urls.has(target),'Redirect destination missing: '+target);
 assert.ok(!urls.has(source),'Do not redirect a published route: '+source);
}
let fetched=false;
const result=await onRequestGet({
 request:new Request('https://example.pages.dev/404/'),
 env:{ASSETS:{fetch:async request=>{
  fetched=true;
  assert.equal(new URL(request.url).pathname,'/404.html');
  return new Response('<h1>Page Not Found</h1>',{status:200,headers:{'Content-Type':'text/html'}});
 }}}
});
assert.ok(fetched,'Custom error asset must be fetched');
assert.equal(result.status,404);
assert.match(await result.text(),/Page Not Found/);
assert.match(result.headers.get('X-Robots-Tag')||'',/noindex/i);
console.log('Validated 10 permanent redirect rules and Cloudflare Pages /404/ response status.');
