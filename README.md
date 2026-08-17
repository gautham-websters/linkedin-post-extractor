# LinkedIn Search Post Extractor

A Chrome extension for extracting post details directly from LinkedIn content search results and exporting them to an Excel file.

The extension runs on an open LinkedIn content search page, automatically scrolls through the results, collects post information, removes duplicates, handles reposts, and generates a new `.xlsx` file for every scrape.

>[!WARNING]
>This project is not affiliated with or endorsed by LinkedIn.

---

## Features

* Extract LinkedIn posts directly from content search results
* User-triggered scraping only
* Automatically scroll through search results
* Choose how many posts you want to collect
* Supports large scrapes such as 100, 200+ posts where LinkedIn makes enough results available
* Extract post author or company
* Extract author/company LinkedIn URL
* Extract post date and time
* Extract direct LinkedIn post URL
* Supports regular posts and reposts
* Extract original post details from reposts
* Automatically skip duplicate results
* Export results directly to `.xlsx`
* Creates a new Excel file for every scrape
* No clipboard interaction required
* No external scraping server required

---

## Download

For normal use, **do not download GitHub's Source Code ZIP**.

Go to the repository's **Releases** section and download:

```text
LinkedIn-Post-Extractor-vX.X.zip
```

Then extract the ZIP before installing it in Chrome.

---

## Installation

### 1. Download the extension

Open the latest GitHub Release and download:

```text
LinkedIn-Post-Extractor-vX.X.zip
```

### 2. Extract the ZIP

Extract the downloaded ZIP to a folder on your computer.

For example:

```text
LinkedIn-Post-Extractor-v2.0/
```

### 3. Open Chrome Extensions

In Chrome, open:

```text
chrome://extensions
```

### 4. Enable Developer Mode

Enable **Developer mode** using the toggle in the top-right corner.

### 5. Load the extension

Click:

```text
Load unpacked
```

Select the folder you extracted in Step 2.

The LinkedIn Search Post Extractor should now appear in your extensions list.

You can optionally pin it from Chrome's Extensions menu for easier access.

---

## How to Use

### 1. Log in to LinkedIn

Open LinkedIn normally and make sure you are logged into your account.

### 2. Perform a content search

Search LinkedIn and switch to **Posts**.

For example:

```text
https://www.linkedin.com/search/results/content/?keywords=Stand%20Gastech
```

You can use any LinkedIn content search keyword.

### 3. Open the extension

Click the **LinkedIn Search Post Extractor** icon in Chrome.

### 4. Enter the number of posts

Choose how many posts you want the extension to attempt to collect.

For example:

```text
50
100
200
```

### 5. Start extraction

Start the scraper.

The extension will:

1. Read the currently loaded search results
2. Extract available post information
3. Scroll down automatically
4. Wait for LinkedIn to load more results
5. Continue collecting new posts
6. Skip duplicate posts
7. Stop when the requested number is reached or LinkedIn stops providing additional results
8. Generate an Excel file automatically

---

## Excel Output

Each scrape creates a **new Excel file** rather than modifying a previous export.

Example filename:

```text
LinkedIn_Stand_Gastech_20260817_1030.xlsx
```

The workbook contains the extracted posts along with information about the scrape.

### Post data

Depending on the type of LinkedIn post and the information available in the page, the export can include fields such as:

| Field             | Description                                        |
| ----------------- | -------------------------------------------------- |
| #                 | Sequential result number                           |
| Posted By         | Person or company that published/reposted the post |
| Posted By URL     | LinkedIn profile or company page                   |
| Post Type         | Regular Post or Repost                             |
| Reposted From     | Original author/company for reposted content       |
| Reposted From URL | LinkedIn page of the original author/company       |
| Posted Date       | Calculated post date                               |
| Posted Time       | Calculated post time                               |
| Post URL          | LinkedIn URL for the result                        |
| Original Post URL | Original post URL when the result is a repost      |
| Search Keyword    | Keyword used in the LinkedIn search                |
| Collected At      | Time the result was collected                      |

The exact available fields may vary depending on the LinkedIn post structure.

---

## Repost Support

LinkedIn reposts are structured differently from normal posts.

A repost may contain:

1. An **outer post**, representing the person who reposted it
2. An **embedded original post**, representing the original publisher

The extractor handles these separately.

For example:

```text
Michael Deighton
    ↓ reposted
Kent
    ↓ original post
```

The exported row can therefore contain:

```text
Posted By: Michael Deighton
Post Type: Repost
Reposted From: Kent
Post URL: Michael Deighton's repost URL, when available
Original Post URL: Kent's original post URL
```

If LinkedIn does not expose a usable outer repost permalink, the extension can fall back to the original embedded post URL instead of leaving the result without a link.

Reposts are also handled separately during deduplication so that a repost is not automatically removed simply because it references an original post that was already collected.

---

## Post URL Extraction

LinkedIn does not always render a simple clickable permalink inside search result cards.

The extension therefore uses several methods to resolve post URLs.

Depending on the post structure, it can use:

* Direct LinkedIn `/posts/` URLs
* LinkedIn `postSlugUrl` data
* LinkedIn page state
* LinkedIn's rendered application data
* `/feed/update/` URLs
* Activity URNs
* UGC Post URNs
* Share URNs

Supported LinkedIn identifiers include structures such as:

```text
urn:li:activity:123456789
urn:li:ugcPost:123456789
urn:li:share:123456789
```

These can be converted into usable LinkedIn post URLs when necessary.

---

## Automatic Scrolling

LinkedIn loads search results dynamically.

Instead of only extracting the posts visible when the extension starts, the scraper automatically scrolls through the results.

It waits for additional content to appear before continuing.

The scraper stops when either:

* The requested number of posts has been collected
* The user stops the scrape
* LinkedIn no longer loads additional results

Because LinkedIn controls how many results are available, requesting 200 posts does **not guarantee that 200 posts will be returned**.

---

## Duplicate Handling

LinkedIn may render the same search result multiple times while content is loading or while the page is scrolling.

The extension uses internal identifiers and post URLs to prevent repeated rows from being exported.

Regular posts and reposts are handled separately so legitimate reposts are not incorrectly discarded as duplicates of the original post.

---

## Project Structure

The repository contains the source code for the extension and supporting project files.

```text
.
├── .github/
│   └── workflows/
├── background.js
├── content.js
├── manifest.json
├── minixlsx.js
├── offscreen.html
├── offscreen.js
├── page_bridge.js
├── popup.css
├── popup.html
├── popup.js
├── LICENSE
└── README.md
```

### Main files

**`manifest.json`**

Defines the Chrome extension, permissions, scripts, and supported LinkedIn pages.

**`content.js`**

Contains the main LinkedIn search extraction logic, including:

* Detecting post cards
* Reading authors
* Reading timestamps
* Resolving post URLs
* Detecting reposts
* Deduplication
* Auto-scrolling
* Excel generation

**`page_bridge.js`**

Runs alongside the LinkedIn page and helps retrieve information that may not be directly available to an isolated Chrome content script.

**`popup.html` / `popup.js` / `popup.css`**

Provides the extension interface used to start and control extraction.

**`minixlsx.js`**

Handles creation of the Excel workbook directly in the browser.

**`background.js` / `offscreen.js` / `offscreen.html`**

Provide supporting extension functionality where required by Chrome's extension environment.

---

## Development

Clone the repository:

```bash
git clone https://github.com/YOUR-USERNAME/linkedin-post-extractor.git
```

Enter the directory:

```bash
cd linkedin-post-extractor
```

No build process is required for normal development.

Open:

```text
chrome://extensions
```

Enable **Developer mode**, click **Load unpacked**, and select the repository directory.

After changing the extension source, return to:

```text
chrome://extensions
```

and click **Reload** on the extension.

Refresh the LinkedIn search page before testing the updated code.

---

## Creating a Release

The repository uses GitHub Actions to package releases automatically.

The version in:

```text
manifest.json
```

should match the Git tag being released.

For example:

```json
{
  "version": "2.1"
}
```

Create and push a tag:

```bash
git tag v2.1
git push origin v2.1
```

GitHub Actions will package the required Chrome extension files and create a GitHub Release containing:

```text
LinkedIn-Post-Extractor-v2.1.zip
```

Only the files required to run the extension are included in the release archive.

Repository-only files such as `.github`, `.gitignore`, development documentation, and existing ZIP files are excluded.

---

## GitHub Actions

The release workflow performs two main functions.

### Main branch

A push to `main` creates a packaged extension artifact that can be downloaded from the corresponding GitHub Actions run.

### Version tags

Pushing a version tag such as:

```text
v2.0
v2.1
v3.0
```

creates an official GitHub Release with the installable extension ZIP attached.

Users should download the extension ZIP from **Release Assets**, rather than GitHub's automatically generated Source Code archives.

---

## Permissions

The extension requires access to LinkedIn search pages so it can read the search results currently displayed in the user's browser.

It may also use Chrome extension storage to maintain scraper state while extraction is running.

The extension is intended to operate when manually triggered by the user.

---

## Privacy

Extraction runs locally in the user's browser.

The extension reads information already displayed or loaded by LinkedIn on the active search page and generates the Excel file locally.

The project does not require users to provide their LinkedIn username or password to the extension.

You should always review the source code and extension permissions before installing any unpacked browser extension.

---

## Limitations

LinkedIn is a dynamically rendered website and may change its HTML, internal data structures, or search behaviour at any time.

As a result:

* A future LinkedIn update may temporarily break extraction
* Some post URLs may be represented differently
* Some reposts may expose less information than others
* Relative timestamps are converted based on the time the scrape is performed
* LinkedIn may stop loading additional search results before the requested target is reached
* Search results depend entirely on what LinkedIn makes available to the logged-in user
* Results may vary between LinkedIn accounts, regions, searches, and interface versions

If extraction stops working after a LinkedIn interface update, please open an issue with a description of the problem and, where possible, a sample of the affected post structure.

---

## Troubleshooting

### Extension does not run

Confirm that:

* You are logged into LinkedIn
* You are on a LinkedIn **content/posts search results** page
* The extension is enabled in `chrome://extensions`
* You refreshed LinkedIn after installing or reloading the extension

### Post URLs are missing

LinkedIn exposes post URLs differently depending on the post type.

Make sure you are using the latest release, as the extractor includes several fallback URL-resolution methods.

### Reposts are missing information

Reposts contain both an outer repost and an embedded original post.

The amount of information available depends on what LinkedIn exposes for that specific result.

### Scraper stops before reaching the requested amount

This normally means LinkedIn stopped providing additional search results.

The target represents the maximum number the extension will attempt to collect, not a guarantee that LinkedIn will return that many results.

### Changes are not appearing during development

After changing source files:

1. Open `chrome://extensions`
2. Reload the extension
3. Refresh the LinkedIn search page
4. Start a new scrape

---

## Reporting Issues

If you encounter a problem, open a GitHub Issue and include:

* What you searched for
* Whether the affected result was a normal post or repost
* What field was missing or incorrect
* Chrome version
* Extension version
* Relevant browser console output, if available

Do **not** include passwords, authentication cookies, session tokens, or other sensitive account information.

---

## Disclaimer

This project is an independent tool and is not affiliated with, sponsored by, or endorsed by LinkedIn or Microsoft.

Users are responsible for ensuring that their use of the extension complies with applicable laws, LinkedIn's terms and policies, organisational requirements, and any relevant data-protection obligations.

Use the extension responsibly and only collect information you are permitted to access and use.

---

## License

This project is licensed under the **MIT License**.

See the [`LICENSE`](LICENSE) file for details.
