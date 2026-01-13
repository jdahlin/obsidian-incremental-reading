#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "browser_cookie3"]
# ///

import re
import requests
import browser_cookie3

# Get session
session = requests.Session()
cj = browser_cookie3.brave(domain_name='.gu.se')
for c in cj:
    session.cookies.set(c.name, c.value, domain=c.domain)

entry_id = "0_1hmyjk3h"

# Get KS from embed page
url = f"https://play.gu.se/embed/secure/iframe/entryId/{entry_id}/uiConfId/23450401"
resp = session.get(url, allow_redirects=True)
print(f"Embed page status: {resp.status_code}")

ks_match = re.search(r'flashvars\[ks\]=([^&"\']+)', resp.text)
if ks_match:
    ks = ks_match.group(1)
    print(f"KS token: {ks[:50]}...")
else:
    print("No KS token found!")
    exit(1)

# Try different manifest URLs
manifests = [
    f"https://api.kaltura.nordu.net/p/302/sp/30200/playManifest/entryId/{entry_id}/format/applehttp/protocol/https/ks/{ks}/manifest.m3u8",
    f"https://vod-cache.kaltura.nordu.net/p/302/sp/30200/playManifest/entryId/{entry_id}/format/applehttp/protocol/https/ks/{ks}/manifest.m3u8",
    f"https://api.kaltura.nordu.net/p/302/sp/30200/playManifest/entryId/{entry_id}/format/url/protocol/https/ks/{ks}",
]

for manifest_url in manifests:
    print(f"\nTrying: {manifest_url[:80]}...")
    resp = session.get(manifest_url)
    print(f"  Status: {resp.status_code}")
    if resp.ok:
        print(f"  Content length: {len(resp.text)}")
        print(f"  First 200 chars: {resp.text[:200]}")
