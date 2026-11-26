// Enforce the payment-subdomain routing contract in every published HTML file.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const payment='https://pay.seogroupsbuytools.com';
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(entry.name.endsWith('.html'))files.push(file);
  }
}
walk('dist');
assert.ok(files.length>=71,'Expected published pages before checkout verification');
let checked=0;
const issues=[];
const labelRule=/^(?:(?:💬|🛒|🔐)\s*)?(?:buy\s*now(?:\s+on\s+whatsapp)?|sign[\s-]*up|register(?:\s+now)?|log[\s-]*in|login|create\s+(?:an?\s+)?account|checkout|proceed\s+to\s+checkout|get\s+started|start\s+now|join\s+now|purchase\s+now|subscribe\s+now|choose\s+(?:this\s+)?plan|select\s+(?:this\s+)?plan|buy\s+(?:this\s+)?plan)(?:\s*[!→»])?$/i;
const legacyTarget=/^https?:\/\/(?:www\.)?(?:seogroupsbuy\.com|seogroupsbuytools\.com|pay\.seogroupsbuytools\.com)\/users\/(?:cart|signup|login)/i;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  for(const m of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
    const anchor=m[0],href=anchor.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    if(!href)continue;
    const label=anchor.slice(anchor.indexOf('>')+1,anchor.lastIndexOf('</a>')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    // WhatsApp-specific support/contact actions intentionally remain WhatsApp.
    if(/^https?:\/\/(?:wa\.me|(?:api\.)?whatsapp\.com)(?:\/|$)/i.test(href[2]))continue;
    if(labelRule.test(label)||legacyTarget.test(href[2])||href[2].startsWith(payment)){
      checked++;
      if(href[2]!==payment)issues.push({file,label,href:href[2]});
    }
    if(/buy now on whatsapp/i.test(label)&&href[2]===payment)
      issues.push({file,label,reason:'Misleading WhatsApp checkout label'});
  }
}
assert.ok(checked>=70,'Expected payment CTA links throughout published pages; checked '+checked);
assert.deepEqual(issues,[],'Some checkout, registration or login links bypass the configured payment homepage');
console.log('Payment CTA audit PASS:',checked,'links across',files.length,'generated HTML pages →',payment);
