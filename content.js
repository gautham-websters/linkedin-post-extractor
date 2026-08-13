(() => {
  "use strict";

  const STATE_KEY = "liExtractorStateV1";
  const MAX_STALE_ROUNDS = 8;
  const LOAD_WAIT_MS = 1800;
  const EXTRA_WAIT_MS = 2200;

  let runner = null;

  const defaultState = () => ({
    status: "idle",
    target: 200,
    unique: 0,
    duplicates: 0,
    scrolls: 0,
    startedAt: null,
    endedAt: null,
    keyword: getKeyword(),
    searchUrl: location.href,
    message: "Ready",
  });

  function getKeyword() {
    try {
      return new URL(location.href).searchParams.get("keywords") || "";
    } catch {
      return "";
    }
  }

  function cleanText(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function absoluteUrl(href) {
    if (!href) return "";

    try {
      return new URL(href, location.origin).href.split("?")[0];
    } catch {
      return href;
    }
  }

  function firstText(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      const t = cleanText(el?.innerText || el?.textContent);

      if (t) return t;
    }

    return "";
  }

  function extractAuthor(root) {
    const menu = root.querySelector(
      'button[aria-label^="Open control menu for post by "]',
    );

    let name = cleanText(menu?.getAttribute("aria-label"))
      .replace(/^Open control menu for post by\s+/i, "")
      .trim();

    if (!name) {
      name = firstText(root, [
        ".update-components-actor__name",
        ".feed-shared-actor__name",
        '[data-view-name="feed-actor-name"]',
      ]);
    }

    const postTextElement = root.querySelector(
      '[data-testid="expandable-text-box"]',
    );

    const allCompanyLinks = [
      ...root.querySelectorAll(
        'a[href*="linkedin.com/company/"], a[href^="/company/"]',
      ),
    ];

    const authorCompanyLink = allCompanyLinks.find((link) => {
      if (!postTextElement) return true;

      return Boolean(
        link.compareDocumentPosition(postTextElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    let companyUrl = absoluteUrl(authorCompanyLink?.href || "");

    companyUrl = companyUrl.replace(/\/posts\/?$/i, "/");

    return {
      name,
      companyUrl,
    };
  }

  function extractTime(root) {
    const selectors = [
      '.update-components-actor__sub-description span[aria-hidden="true"]',
      '.feed-shared-actor__sub-description span[aria-hidden="true"]',
      "time",
      'a[href*="/feed/update/"] span[aria-hidden="true"]',
    ];

    for (const sel of selectors) {
      const items = [...root.querySelectorAll(sel)];

      for (const el of items) {
        const t = cleanText(el.innerText || el.textContent);

        const m = t.match(
          /(?:^|\s)(\d+\s*(?:s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks|mo|mos|yr|yrs))(?:\s|$|•)/i,
        );

        if (m) {
          return m[1].replace(/\s+/g, "");
        }

        if (el.tagName === "TIME" && t) {
          return t;
        }
      }
    }

    const text = cleanText(root.innerText || root.textContent);

    const m =
      text.match(/(?:^|\s)(\d+\s*(?:s|m|h|d|w|mo|yr))\s*•/i) ||
      text.match(/(?:^|\s)(\d+\s*(?:s|m|h|d|w|mo|yr))(?:\s|$)/i);

    return m ? m[1].replace(/\s+/g, "") : "";
  }

  function relativeTimeToDate(relativeTime) {
    if (!relativeTime) return null;

    const now = new Date();
    const value = cleanText(relativeTime).toLowerCase();

    const match = value.match(
      /^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks|mo|mos|yr|yrs)$/,
    );

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2];

    const result = new Date(now);

    if (["s", "sec", "secs"].includes(unit)) {
      result.setSeconds(result.getSeconds() - amount);
    } else if (["m", "min", "mins"].includes(unit)) {
      result.setMinutes(result.getMinutes() - amount);
    } else if (["h", "hr", "hrs"].includes(unit)) {
      result.setHours(result.getHours() - amount);
    } else if (["d", "day", "days"].includes(unit)) {
      result.setDate(result.getDate() - amount);
    } else if (["w", "wk", "wks"].includes(unit)) {
      result.setDate(result.getDate() - amount * 7);
    } else if (["mo", "mos"].includes(unit)) {
      result.setMonth(result.getMonth() - amount);
    } else if (["yr", "yrs"].includes(unit)) {
      result.setFullYear(result.getFullYear() - amount);
    }

    return result;
  }

  function formatPostedDate(date) {
    if (!date) return "";

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatPostedTime(date) {
    if (!date) return "";

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  // async function waitForCopyLinkMenuItem(timeout = 2500) {
  //   const started = Date.now();

  //   while (Date.now() - started < timeout) {
  //     const candidates = [
  //       ...document.querySelectorAll(
  //         '[role="menuitem"], button, div[role="button"], li',
  //       ),
  //     ];

  //     const item = candidates.find((el) => {
  //       const label = cleanText(
  //         el.innerText || el.textContent || el.getAttribute("aria-label"),
  //       ).toLowerCase();

  //       return label.includes("copy link to post");
  //     });

  //     if (item) return item;

  //     await sleep(100);
  //   }

  //   return null;
  // }

  // async function extractPostUrlFromMenu(root) {
  //   const menuButton = root.querySelector(
  //     'button[aria-label^="Open control menu for post by "]',
  //   );

  //   if (!menuButton) {
  //     return "";
  //   }

  //   try {
  //     root.scrollIntoView({
  //       behavior: "instant",
  //       block: "center",
  //     });

  //     await sleep(150);

  //     menuButton.click();

  //     const copyItem = await waitForCopyLinkMenuItem();

  //     if (!copyItem) {
  //       try {
  //         document.body.click();
  //       } catch {}

  //       return "";
  //     }

  //     copyItem.click();

  //     await sleep(500);

  //     const response = await chrome.runtime.sendMessage({
  //       type: "LIEX_READ_CLIPBOARD",
  //     });

  //     if (!response?.ok) {
  //       console.warn(
  //         "[LinkedIn Extractor] Clipboard bridge failed:",
  //         response?.error || "Unknown clipboard error",
  //       );

  //       return "";
  //     }

  //     const url = cleanText(response.text);

  //     if (
  //       /^https:\/\/www\.linkedin\.com\//i.test(url) &&
  //       (url.includes("/posts/") ||
  //         url.includes("/feed/update/") ||
  //         url.includes("urn:li:"))
  //     ) {
  //       return url;
  //     }

  //     return "";
  //   } catch (error) {
  //     console.warn("[LinkedIn Extractor] Could not extract post link:", error);

  //     try {
  //       document.body.click();
  //     } catch {}

  //     return "";
  //   }
  // }

  function extractPostText(root) {
    return firstText(root, [
      '[data-testid="expandable-text-box"]',
      ".update-components-text",
      ".feed-shared-update-v2__description",
      ".feed-shared-text",
      '[data-view-name="feed-commentary"]',
      ".break-words",
    ]);
  }

  function getPostComponentKey(root) {
    if (!root) return "";

    /*
     * New LinkedIn SDUI cards look like:
     *
     * expandedSoPMDy9IEHmkT11d7zqF5dvlZ3J1MiYG-RPK5c_PDm4FeedType_FLAGSHIP_SEARCH
     *
     * The useful key is:
     *
     * SoPMDy9IEHmkT11d7zqF5dvlZ3J1MiYG-RPK5c_PDm4
     */

    const candidates = [
      root.getAttribute("componentkey"),
      root.id,
      ...[...root.querySelectorAll("[componentkey]")]
        .slice(0, 20)
        .map((el) => el.getAttribute("componentkey")),
    ].filter(Boolean);

    /*
     * First preference:
     * the outer search-result component key.
     */
    for (const candidate of candidates) {
      const match = String(candidate).match(
        /^expanded(.+?)FeedType_FLAGSHIP_SEARCH$/,
      );

      if (match?.[1]) {
        return match[1];
      }
    }

    /*
     * Second preference:
     * LinkedIn's raw long SDUI key.
     *
     * Avoid UUID component keys.
     */
    for (const candidate of candidates) {
      const value = String(candidate);

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        );

      if (
        !isUuid &&
        value.length >= 25 &&
        !value.includes("auto-component") &&
        !value.includes("SearchResults_") &&
        !value.includes("replaceableComment")
      ) {
        return value;
      }
    }

    return "";
  }

  function findNearestActivityUrn(source, componentKey) {
    if (!source || !componentKey) {
      return "";
    }

    /*
     * The same component key can appear multiple times in LinkedIn's
     * hydrated page state, so inspect every occurrence and choose
     * the nearest activity URN.
     */
    const keyPositions = [];

    let position = source.indexOf(componentKey);

    while (position !== -1) {
      keyPositions.push(position);

      position = source.indexOf(componentKey, position + componentKey.length);
    }

    if (!keyPositions.length) {
      return "";
    }

    let bestUrn = "";
    let bestDistance = Infinity;

    for (const keyPosition of keyPositions) {
      /*
       * Large enough to contain the corresponding LinkedIn state
       * object without accidentally searching the entire page.
       */
      const radius = 15000;

      const start = Math.max(0, keyPosition - radius);

      const end = Math.min(
        source.length,
        keyPosition + componentKey.length + radius,
      );

      const chunk = source.slice(start, end);

      const localKeyPosition = keyPosition - start;

      /*
       * Normal unescaped activity URNs.
       */
      const activityRegex = /urn:li:activity:\d+/g;

      let match;

      while ((match = activityRegex.exec(chunk)) !== null) {
        const distance = Math.abs(match.index - localKeyPosition);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestUrn = match[0];
        }
      }

      /*
       * Occasionally LinkedIn state can contain URL encoded URNs.
       */
      const encodedRegex = /urn%3Ali%3Aactivity%3A\d+/gi;

      while ((match = encodedRegex.exec(chunk)) !== null) {
        const distance = Math.abs(match.index - localKeyPosition);

        if (distance < bestDistance) {
          bestDistance = distance;

          try {
            bestUrn = decodeURIComponent(match[0]);
          } catch {
            // Ignore malformed encoded values.
          }
        }
      }
    }

    return bestUrn;
  }

  function extractActivityUrn(root) {
    /*
     * Method 1:
     * Older LinkedIn layouts expose the activity URN directly.
     */
    const directUrn =
      root.getAttribute("data-urn") ||
      root.getAttribute("data-chameleon-result-urn") ||
      "";

    const directMatch = String(directUrn).match(/urn:li:activity:\d+/);

    if (directMatch) {
      return directMatch[0];
    }

    /*
     * Method 2:
     * Sometimes a direct feed/update anchor exists.
     */
    const directLink = root.querySelector(
      'a[href*="/feed/update/urn:li:activity:"]',
    );

    if (directLink?.href) {
      const match = directLink.href.match(/urn:li:activity:\d+/);

      if (match) {
        return match[0];
      }
    }

    /*
     * Method 3:
     * Current 2026 LinkedIn SDUI search results.
     *
     * Match the rendered result's component key to the activity
     * URN stored in LinkedIn's hydrated page state.
     */
    const componentKey = getPostComponentKey(root);

    if (!componentKey) {
      console.warn(
        "[LinkedIn Extractor] No component key found for post:",
        root,
      );

      return "";
    }

    /*
     * innerHTML includes LinkedIn's hydration/state scripts.
     */
    const source = document.documentElement.innerHTML;

    const activityUrn = findNearestActivityUrn(source, componentKey);

    if (!activityUrn) {
      console.warn(
        "[LinkedIn Extractor] No activity URN mapped for component:",
        componentKey,
      );
    }

    return activityUrn;
  }

  function buildPostUrl(root) {
    const activityUrn = extractActivityUrn(root);

    if (!activityUrn) {
      return "";
    }

    return "https://www.linkedin.com/feed/update/" + activityUrn + "/";
  }

  function isFeedPostRoot(el) {
    if (!el) return false;

    if (el.matches?.('[role="listitem"]')) {
      if (el.querySelector('[data-testid="expandable-text-box"]')) {
        return true;
      }

      if (
        el.querySelector('button[aria-label^="Open control menu for post by "]')
      ) {
        return true;
      }

      const heading = cleanText(
        el.querySelector("h2")?.innerText ||
          el.querySelector("h2")?.textContent,
      );

      if (/^Feed post$/i.test(heading)) {
        return true;
      }
    }

    return false;
  }

  function candidateRoots() {
    const set = new Set();

    document.querySelectorAll('[role="listitem"]').forEach((el) => {
      if (isFeedPostRoot(el)) {
        set.add(el);
      }
    });

    const direct = document.querySelectorAll(
      [
        'div[data-urn^="urn:li:activity:"]',
        'div[data-chameleon-result-urn^="urn:li:activity:"]',
        ".feed-shared-update-v2",
        '[data-view-name="feed-full-update"]',
      ].join(","),
    );

    direct.forEach((el) => set.add(el));

    document
      .querySelectorAll(
        'a[href*="/feed/update/urn:li:activity:"], a[href*="linkedin.com/posts/"]',
      )
      .forEach((a) => {
        const root =
          a.closest(
            [
              '[role="listitem"]',
              "div[data-urn]",
              "div[data-chameleon-result-urn]",
              ".feed-shared-update-v2",
              "li.reusable-search__result-container",
              '[data-view-name="search-entity-result-universal-template"]',
              "li",
            ].join(", "),
          ) || a.parentElement;

        if (root) {
          set.add(root);
        }
      });

    return [...set].filter((el) => {
      const rect = el.getBoundingClientRect();

      const text = cleanText(el.innerText || el.textContent);

      return rect.height > 80 && text.length > 20;
    });
  }

  async function scrapeVisible(seenCards = new Set()) {
    const roots = candidateRoots();

    const out = [];

    for (const root of roots) {
      const author = extractAuthor(root);

      const relativeTime = extractTime(root);

      const calculatedDate = relativeTimeToDate(relativeTime);

      /*
       * Used internally only.
       *
       * Post text is NOT exported.
       */
      const internalPostText = extractPostText(root);

      const componentKey = getPostComponentKey(root);

      /*
       * Prefer LinkedIn's internal component key to identify
       * the rendered card.
       *
       * Fall back to author + time + content if necessary.
       */
      const fallbackCardKey = [
        author.companyUrl || author.name,

        relativeTime,

        internalPostText.slice(0, 500),
      ]
        .filter(Boolean)
        .join("|");

      const cardKey = componentKey || fallbackCardKey;

      if (!cardKey) {
        continue;
      }

      /*
       * Only stops us from processing the exact same rendered
       * search result repeatedly while scrolling.
       */
      if (seenCards.has(cardKey)) {
        continue;
      }

      seenCards.add(cardKey);

      /*
       * NO CLIPBOARD.
       * NO THREE-DOT MENU.
       * NO USER FOCUS REQUIRED.
       */
      const postUrl = buildPostUrl(root);

      console.log(
        "[LinkedIn Extractor]",
        author.name,
        "→",
        postUrl || "POST URL NOT FOUND",
      );

      out.push({
        cardKey,

        postedBy: author.name,

        companyPageUrl: author.companyUrl,

        postedDate: formatPostedDate(calculatedDate),

        postedTime: formatPostedTime(calculatedDate),

        postUrl,

        searchKeyword: getKeyword(),

        collectedAt: new Date().toLocaleString(),
      });
    }

    return out;
  }

  function getScrollTarget() {
    const seed =
      document.querySelector('[data-testid="lazy-column"]') ||
      document.querySelector("main#workspace") ||
      document.body;

    let el = seed;

    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);

      const oy = style.overflowY;

      if (/(auto|scroll)/.test(oy) && el.scrollHeight > el.clientHeight + 120) {
        return el;
      }

      el = el.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  function scrollMetrics(target) {
    const docScroll =
      target === document.scrollingElement ||
      target === document.documentElement ||
      target === document.body;

    return {
      height: docScroll
        ? document.documentElement.scrollHeight
        : target.scrollHeight,

      top: docScroll
        ? window.scrollY || document.documentElement.scrollTop || 0
        : target.scrollTop,

      client: docScroll ? window.innerHeight : target.clientHeight,
    };
  }

  function scrollByTarget(target, amount) {
    const docScroll =
      target === document.scrollingElement ||
      target === document.documentElement ||
      target === document.body;

    if (docScroll) {
      window.scrollBy({
        top: amount,
        behavior: "smooth",
      });
    } else {
      target.scrollBy({
        top: amount,
        behavior: "smooth",
      });
    }
  }

  function scrollToBottom(target) {
    const docScroll =
      target === document.scrollingElement ||
      target === document.documentElement ||
      target === document.body;

    if (docScroll) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,

        behavior: "smooth",
      });
    } else {
      target.scrollTo({
        top: target.scrollHeight,

        behavior: "smooth",
      });
    }
  }

  async function saveState(patch) {
    const current = await chrome.storage.local.get(STATE_KEY);

    const state = {
      ...current[STATE_KEY],
      ...patch,
    };

    await chrome.storage.local.set({
      [STATE_KEY]: state,
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForGrowth(scrollTarget, beforeHeight, beforeCount) {
    const started = Date.now();

    return new Promise((resolve) => {
      let done = false;

      const finish = (grew) => {
        if (done) return;

        done = true;

        observer.disconnect();

        clearInterval(timer);

        clearTimeout(hardStop);

        resolve(grew);
      };

      const check = () => {
        const grew =
          scrollMetrics(scrollTarget).height > beforeHeight + 100 ||
          candidateRoots().length > beforeCount;

        if (grew) {
          finish(true);
        } else if (Date.now() - started > LOAD_WAIT_MS) {
          finish(false);
        }
      };

      const observer = new MutationObserver(check);

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      const timer = setInterval(check, 250);

      const hardStop = setTimeout(() => finish(false), LOAD_WAIT_MS + 500);
    });
  }

  function downloadWorkbook(posts, meta) {
    const headers = [
      "#",
      "Posted By",
      "Company Page URL",
      "Posted Date",
      "Posted Time",
      "Post URL",
      "Search Keyword",
      "Collected At",
    ];

    const rows = [
      headers,

      ...posts.map((p, i) => [
        i + 1,
        p.postedBy,
        p.companyPageUrl,
        p.postedDate,
        p.postedTime,
        p.postUrl,
        p.searchKeyword,
        p.collectedAt,
      ]),
    ];

    const info = [
      ["Field", "Value"],

      ["Search Keyword", meta.keyword],

      ["Search URL", meta.searchUrl],

      ["Requested Posts", meta.target],

      ["Extracted Unique Posts", posts.length],

      ["Duplicates Skipped", meta.duplicates],

      ["Scrolls Completed", meta.scrolls],

      ["Scrape Started", meta.startedAt],

      ["Scrape Finished", meta.endedAt],

      ["Stop Reason", meta.message],
    ];

    const blob = MiniXLSX.writeWorkbook([
      {
        name: "Posts",
        rows,
      },

      {
        name: "Scrape Info",
        rows: info,
      },
    ]);

    const safeKeyword =
      (meta.keyword || "LinkedIn_Search")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "LinkedIn_Search";

    const now = new Date();

    const stamp = [
      now.getFullYear(),

      String(now.getMonth() + 1).padStart(2, "0"),

      String(now.getDate()).padStart(2, "0"),

      "_",

      String(now.getHours()).padStart(2, "0"),

      String(now.getMinutes()).padStart(2, "0"),
    ].join("");

    const filename = `LinkedIn_${safeKeyword}_${stamp}.xlsx`;

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = filename;

    a.style.display = "none";

    document.documentElement.appendChild(a);

    a.click();

    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function runScrape(target) {
    const token = {
      cancelled: false,
      paused: false,

      posts: [],

      /*
       * Prevents reprocessing the same visible LinkedIn card
       * while scrolling.
       */
      seenCards: new Set(),

      /*
       * Actual post deduplication.
       *
       * Two different people/companies posting identical content
       * will have different URLs and will BOTH be exported.
       */
      seenPostUrls: new Set(),

      duplicates: 0,
      scrolls: 0,
    };

    runner = token;

    const startedAt = new Date().toISOString();

    await saveState({
      ...defaultState(),

      status: "running",

      target,

      startedAt,

      keyword: getKeyword(),

      searchUrl: location.href,

      message: "Scraping…",
    });

    let staleRounds = 0;

    while (!token.cancelled && token.posts.length < target) {
      while (token.paused && !token.cancelled) {
        await sleep(300);
      }

      if (token.cancelled) {
        break;
      }

      /*
       * IMPORTANT:
       *
       * Use seenCards here.
       *
       * Your current file incorrectly still uses token.seen,
       * even though token.seen no longer exists.
       */
      const batch = await scrapeVisible(token.seenCards);

      let added = 0;

      for (const p of batch) {
        if (token.posts.length >= target) {
          break;
        }

        /*
         * Actual duplicate detection is by LinkedIn post URL.
         */
        if (p.postUrl) {
          if (token.seenPostUrls.has(p.postUrl)) {
            token.duplicates++;

            continue;
          }

          token.seenPostUrls.add(p.postUrl);
        }

        token.posts.push(p);

        added++;
      }

      await saveState({
        unique: token.posts.length,

        duplicates: token.duplicates,

        scrolls: token.scrolls,

        status: token.paused ? "paused" : "running",

        message: batch.length
          ? `Collected ${token.posts.length} of ${target}`
          : "No new post cards detected on this pass; scrolling for more…",
      });

      if (token.posts.length >= target) {
        break;
      }

      const scrollTarget = getScrollTarget();

      const beforeMetrics = scrollMetrics(scrollTarget);

      const beforeHeight = beforeMetrics.height;

      const beforeCount = candidateRoots().length;

      scrollByTarget(scrollTarget, Math.max(beforeMetrics.client * 0.88, 650));

      token.scrolls++;

      let grew = await waitForGrowth(scrollTarget, beforeHeight, beforeCount);

      if (!grew) {
        scrollToBottom(scrollTarget);

        await sleep(EXTRA_WAIT_MS);

        grew =
          scrollMetrics(scrollTarget).height > beforeHeight + 100 ||
          candidateRoots().length > beforeCount;
      }

      staleRounds = added === 0 && !grew ? staleRounds + 1 : 0;

      if (staleRounds >= MAX_STALE_ROUNDS) {
        break;
      }

      await sleep(450);
    }

    const endedAt = new Date().toISOString();

    const reason = token.cancelled
      ? "Stopped by user"
      : token.posts.length >= target
        ? "Target reached"
        : "No additional posts loaded";

    const finalState = {
      status: "exported",

      target,

      unique: token.posts.length,

      duplicates: token.duplicates,

      scrolls: token.scrolls,

      startedAt,

      endedAt,

      keyword: getKeyword(),

      searchUrl: location.href,

      message: reason,
    };

    await saveState(finalState);

    downloadWorkbook(token.posts, finalState);

    runner = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg?.type === "LIEX_START") {
        if (runner) {
          return sendResponse({
            ok: false,

            error: "A scrape is already running.",
          });
        }

        const target = Math.max(1, Math.min(5000, Number(msg.target) || 200));

        runScrape(target).catch(async (err) => {
          await saveState({
            status: "error",

            message: err?.message || String(err),

            endedAt: new Date().toISOString(),
          });

          runner = null;
        });

        return sendResponse({
          ok: true,
        });
      }

      if (msg?.type === "LIEX_PAUSE") {
        if (runner) {
          runner.paused = true;
        }

        await saveState({
          status: runner ? "paused" : "idle",

          message: runner ? "Paused" : "Nothing is running",
        });

        return sendResponse({
          ok: true,
        });
      }

      if (msg?.type === "LIEX_RESUME") {
        if (runner) {
          runner.paused = false;
        }

        await saveState({
          status: runner ? "running" : "idle",

          message: runner ? "Resumed" : "Nothing is running",
        });

        return sendResponse({
          ok: true,
        });
      }

      if (msg?.type === "LIEX_STOP") {
        if (runner) {
          runner.cancelled = true;
        }

        return sendResponse({
          ok: true,
        });
      }

      if (msg?.type === "LIEX_PING") {
        return sendResponse({
          ok: true,

          keyword: getKeyword(),

          url: location.href,
        });
      }
    })();

    return true;
  });

  chrome.storage.local.get(STATE_KEY).then((obj) => {
    if (!obj[STATE_KEY]) {
      chrome.storage.local.set({
        [STATE_KEY]: defaultState(),
      });
    }
  });
})();
