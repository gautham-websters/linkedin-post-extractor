# LinkedIn Search Post Extractor

A user-triggered Chrome Manifest V3 extension for collecting posts from a LinkedIn **content search results** page and exporting each run to a brand-new `.xlsx` file.

## Features

- Target count from 1 to 5,000 posts
- Automatic incremental scrolling after the user presses **Start Scrape**
- Deduplication within the current scrape using LinkedIn activity/share IDs, with post URL fallback
- Pause / Resume
- Stop & Export at any point
- Automatic stop when the requested target is reached or no more posts appear
- Every scrape creates a new timestamped XLSX file
- Two worksheets: `Posts` and `Scrape Info`
- No server and no LinkedIn credentials are stored

## Install

1. Unzip the folder.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `linkedin-post-extractor` folder.
6. Open or reload a LinkedIn content search page, for example a URL under:
   `https://www.linkedin.com/search/results/content/`
7. Click the extension icon.
8. Enter the target number of posts and click **Start Scrape**.

## Exported columns

- #
- Activity ID
- Posted By
- Poster Type
- Author Profile URL
- Company Page URL
- Job Title / Subtitle
- Posted Time
- Post Text
- Post URL
- Search Keyword
- Collected At

## Important notes

LinkedIn changes its page structure regularly. The extractor uses several selector fallbacks instead of relying on one class name, but selectors may still need maintenance after a LinkedIn UI change.

The extension only starts after a user action. Keep the LinkedIn search tab open while it runs. Very large targets depend on how many results LinkedIn actually makes available to the signed-in user.

LinkedIn's terms and help materials restrict scraping/automation tools. Use this extension only in a way that complies with the rules and permissions applicable to your account and data.


## Version 1.1
Updated for LinkedIn's 2026 SDUI content-search markup (`role="listitem"`, `data-testid="expandable-text-box"`). Activity IDs are mapped from LinkedIn's embedded page state so canonical `/feed/update/urn:li:activity:.../` links can be exported even when the search card does not directly contain them.
