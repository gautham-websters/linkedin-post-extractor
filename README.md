LinkedIn Search Post Extractor - Post URL Fix (v1.4.0)

Replace/add these files in your existing extension folder:
1. Replace content.js with the supplied content.js.
2. Replace manifest.json with the supplied manifest.json.
3. Add the new page_bridge.js beside content.js.
4. Keep your existing popup.html, popup JS/CSS, minixlsx.js, icons, and any other extension files unchanged.

Then in Chrome:
1. Open chrome://extensions
2. Turn on Developer mode if needed.
3. Click Reload on the extension.
4. Refresh the LinkedIn search page (important: content scripts only reload into the page after refresh).
5. Run a small test first, e.g. 10 posts.
6. In the exported XLSX, check the Post URL column.

URL resolution order:
- Direct LinkedIn /posts/ permalink already present in the card
- LinkedIn embedded postSlugUrl matched to the card's SDUI component key
- MAIN-world React props/fiber bridge (handles cases where hydration state was consumed/removed)
- Direct /feed/update/ permalink
- Activity URN -> /feed/update/ permalink

This version does not use the clipboard and does not click LinkedIn's three-dot menus.
