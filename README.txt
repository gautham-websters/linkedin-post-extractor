LinkedIn Search Post Extractor - repost fix v1.5.0

Replace the v1.4.0 files with:
- content.js
- page_bridge.js
- manifest.json

Keep your existing popup.html / popup JS / CSS / minixlsx.js / icons.

Repost handling
---------------
- Keeps the OUTER repost author and repost time/date as the main row.
- Captures personal profile URLs in "Posted By URL".
- Adds Post Type, Reposted From, Reposted From URL and Original Post URL.
- Supports activity, ugcPost and share feed/update URNs.
- Tries to resolve the OUTER repost permalink first.
- If LinkedIn does not expose that outer permalink, Post URL falls back to the embedded original post URL instead of being blank.
- Reposts are not deduplicated against their original post when fallback URLs match.

Reload the extension at chrome://extensions and refresh the LinkedIn search page before testing.
