#!/usr/bin/env python3
"""Read-only production vs Astro preview parity audit. Python standard library only."""
import concurrent.futures
import difflib
import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

LIVE = os.environ.get("LIVE_URL", "https://seogroupsbuytools.com").rstrip("/")
PREVIEW = os.environ.get("PREVIEW_URL", "https://seogroupsbuytools-astro.oldbilalfadi.workers.dev").rstrip("/")
HEADERS = {"User-Agent": "AstroMigrationParityAudit/1.0"}
OUT = Path("audit-results")
OUT.mkdir(exist_ok=True)

class Inspector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.in_title = False
        self.tags = {}
        self.meta = {}
        self.canonical = []
        self.alternates = []
        self.images = []
        self.scripts = []
        self.styles = []
        self.links = []
        self.jsonld = []
        self.in_ld = False
        self.ld = ""
        self.text = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags[tag] = self.tags.get(tag, 0) + 1
        if tag == "title": self.in_title = True
        if tag in ("script", "style"): self.skip += 1
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_ld = True
            self.ld = ""
        if tag == "meta":
            key = (attrs.get("name") or attrs.get("property") or attrs.get("http-equiv") or "").lower()
            if key: self.meta.setdefault(key, []).append(attrs.get("content", ""))
        if tag == "link":
            rel = attrs.get("rel", "")
            if "canonical" in rel: self.canonical.append(attrs.get("href", ""))
            if "alternate" in rel: self.alternates.append((attrs.get("hreflang", ""), attrs.get("href", "")))
            if "stylesheet" in rel: self.styles.append(attrs.get("href", ""))
        if tag == "img": self.images.append((attrs.get("src", ""), attrs.get("alt", ""), attrs.get("loading", "")))
        if tag == "script" and attrs.get("src"): self.scripts.append(attrs["src"])
        if tag == "a": self.links.append(attrs.get("href", ""))
    def handle_endtag(self, tag):
        if tag == "title": self.in_title = False
        if tag == "script" and self.in_ld:
            self.jsonld.append(self.ld.strip())
            self.in_ld = False
        if tag in ("script", "style"): self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.in_ld: self.ld += data
        if not self.skip and data.strip(): self.text.append(data.strip())
    def result(self):
        return {
            "title": self.title.strip(), "meta": self.meta, "canonical": self.canonical,
            "alternates": self.alternates, "headings": {k:self.tags.get(k,0) for k in ("h1","h2","h3","h4")},
            "images": self.images, "scripts": self.scripts, "stylesheets": self.styles,
            "links": self.links, "jsonld": self.jsonld,
            "text": " ".join(self.text), "image_count": len(self.images)
        }

def fetch(base, route):
    url = base + route
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = response.read(3_000_000)
            return {"status": response.status, "final_url": response.url, "headers": dict(response.headers), "body": data.decode("utf-8", "replace")}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "final_url": e.url, "headers": dict(e.headers), "body": e.read(300_000).decode("utf-8", "replace")}
    except Exception as e:
        return {"error": str(e)}

def normalize_url(s):
    if not s: return s
    for base in (LIVE, PREVIEW):
        if s.startswith(base): return "{{SITE}}" + s[len(base):]
    return s

def check(route):
    a, b = fetch(LIVE, route), fetch(PREVIEW, route)
    result = {"route": route, "live_status": a.get("status"), "preview_status": b.get("status"), "issues": []}
    if "error" in a or "error" in b:
        result["issues"].append({"field":"request","live":a.get("error"),"preview":b.get("error")})
        return result
    if a["status"] != b["status"]:
        result["issues"].append({"field":"http_status","live":a["status"],"preview":b["status"]})
    if a["status"] != 200 or b["status"] != 200: return result
    pa, pb = Inspector(), Inspector()
    pa.feed(a["body"]); pb.feed(b["body"])
    x, y = pa.result(), pb.result()
    for field in ("title", "headings", "images", "scripts", "stylesheets", "links", "jsonld", "alternates", "text"):
        left, right = x[field], y[field]
        if field in ("scripts", "stylesheets", "links"):
            left, right = [normalize_url(v) for v in left], [normalize_url(v) for v in right]
        if left != right:
            issue = {"field":field}
            if field == "text":
                live_words, preview_words = left.split(), right.split()
                matcher = difflib.SequenceMatcher(None, live_words, preview_words, autojunk=False)
                changes = []
                for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                    if tag != "equal":
                        changes.append({"type": tag, "live_word_range": [i1+1, i2], "preview_word_range": [j1+1, j2], "live_words": live_words[i1:i2], "preview_words": preview_words[j1:j2]})
                issue.update({"live_length":len(left),"preview_length":len(right),"live_word_count":len(live_words),"preview_word_count":len(preview_words),"word_changes":changes})
            else: issue.update({"live":str(left)[:700],"preview":str(right)[:700]})
            result["issues"].append(issue)
    for field in ("canonical",):
        left, right = [normalize_url(v) for v in x[field]], [normalize_url(v) for v in y[field]]
        if left != right: result["issues"].append({"field":field,"live":left,"preview":right})
    keys = set(x["meta"]) | set(y["meta"])
    for key in sorted(keys):
        if x["meta"].get(key) != y["meta"].get(key):
            result["issues"].append({"field":"meta:"+key,"live":x["meta"].get(key),"preview":y["meta"].get(key)})
    return result

def routes_from_content():
    routes = set()
    for file in Path("content").rglob("*.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("route"), str):
                routes.add(data["route"])
        except (OSError, ValueError):
            pass
    return sorted(routes | {"/"})

routes = routes_from_content()
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(check, routes))
for extra in ("/robots.txt", "/sitemap.xml", "/sitemap-index.xml", "/favicon.ico"):
    a,b = fetch(LIVE, extra),fetch(PREVIEW,extra)
    results.append({"route":extra,"live_status":a.get("status"),"preview_status":b.get("status"),"issues":([{"field":"asset_status","live":a.get("status",a.get("error")),"preview":b.get("status",b.get("error"))}] if a.get("status") != b.get("status") else [])})
summary = {"live":LIVE,"preview":PREVIEW,"total_checked":len(results),"matching":sum(not r["issues"] for r in results),"mismatching":sum(bool(r["issues"]) for r in results),"issues_by_field":{}}
for result in results:
    for issue in result["issues"]:
        field = issue["field"]
        summary["issues_by_field"][field] = summary["issues_by_field"].get(field,0)+1
report = {"summary":summary,"results":results}
(OUT/"parity-report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
lines = ["# Production vs Astro preview parity report","",f"- Live: {LIVE}",f"- Preview: {PREVIEW}",f"- Routes/assets checked: {summary['total_checked']}",f"- Exact checks passed: {summary['matching']}",f"- Differences/errors: {summary['mismatching']}","","## Differences by field"]
lines += [f"- {k}: {v}" for k,v in sorted(summary["issues_by_field"].items(),key=lambda x:-x[1])]
lines += ["","## Pages with differences"]
for r in results:
    if r["issues"]: lines.append(f"- {r['route']} (live {r.get('live_status')}, preview {r.get('preview_status')}): "+", ".join(i["field"] for i in r["issues"]))
for r in results:
    for issue in r["issues"]:
        if issue["field"] == "text":
            lines.append("")
            lines.append("### Full word changes: "+r["route"])
            lines.append(f"Original words: {issue['live_word_count']}; preview words: {issue['preview_word_count']}")
            for change in issue["word_changes"]:
                lines.append("- "+change["type"]+" original="+json.dumps(" ".join(change["live_words"]), ensure_ascii=False)+" preview="+json.dumps(" ".join(change["preview_words"]), ensure_ascii=False))
(OUT/"parity-report.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
print("\n".join(lines))
# Audit is informational while parity is being fixed. Reports are uploaded as artifacts.
