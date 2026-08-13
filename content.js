(() => {
  'use strict';

  const STATE_KEY = 'liExtractorStateV1';
  const MAX_STALE_ROUNDS = 8;
  const LOAD_WAIT_MS = 1800;
  const EXTRA_WAIT_MS = 2200;

  let runner = null;

  const defaultState = () => ({
    status: 'idle',
    target: 200,
    unique: 0,
    duplicates: 0,
    scrolls: 0,
    startedAt: null,
    endedAt: null,
    keyword: getKeyword(),
    searchUrl: location.href,
    message: 'Ready'
  });

  function getKeyword() {
    try {
      return new URL(location.href).searchParams.get('keywords') || '';
    } catch { return ''; }
  }

  function cleanText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function absoluteUrl(href) {
    if (!href) return '';
    try { return new URL(href, location.origin).href.split('?')[0]; }
    catch { return href; }
  }

  function getRootComponentKey(root) {
    const candidates = [root, ...root.querySelectorAll('[componentkey]')];
    for (const el of candidates) {
      const value = el.getAttribute?.('componentkey') || '';
      let m = value.match(/^expanded(.+?)FeedType_FLAGSHIP_SEARCH$/);
      if (m) return m[1];
      // LinkedIn also repeats the raw feed key on an inner wrapper.
      if (value && !/^auto-component-/i.test(value) && value.length > 25 && !value.includes('Ref')) {
        const menu = root.querySelector('button[aria-label^="Open control menu for post by "]');
        if (menu && value === menu.closest('[componentkey]')?.getAttribute('componentkey')) continue;
      }
    }
    const expanded = root.getAttribute?.('componentkey') || '';
    const m = expanded.match(/^expanded(.+?)FeedType_FLAGSHIP_SEARCH$/);
    return m ? m[1] : '';
  }

  function pageSourceText() {
    // LinkedIn's new SDUI search cards do not expose the activity URN on the
    // rendered card.  The URN is, however, present in the embedded page state.
    return document.documentElement.innerHTML || '';
  }

  function activityIdFromComponentKey(componentKey) {
    if (!componentKey) return '';
    const source = pageSourceText();
    const escaped = componentKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`TranslationState-null${escaped}[\\s\\S]{0,1600}?reactionState-urn:li:activity:(\\d+)`, 'i'),
      new RegExp(`reactionState-urn:li:activity:(\\d+)[\\s\\S]{0,1600}?UpdateState${escaped}`, 'i'),
      new RegExp(`${escaped}[\\s\\S]{0,2200}?urn:li:activity:(\\d+)`, 'i')
    ];
    for (const re of patterns) {
      const m = source.match(re);
      if (m) return m[1];
    }
    return '';
  }

  function extractActivityId(root) {
    const attrs = ['data-urn', 'data-chameleon-result-urn', 'data-id'];
    const nodes = [root, ...root.querySelectorAll('[data-urn],[data-chameleon-result-urn],[data-id]')];
    for (const n of nodes) {
      for (const a of attrs) {
        const v = n.getAttribute?.(a) || '';
        const m = v.match(/urn:li:(?:activity|share):(\d+)/i) || v.match(/(?:activity|share)[^\d]*(\d{8,})/i);
        if (m) return m[1];
      }
    }
    const links = [...root.querySelectorAll('a[href]')];
    for (const a of links) {
      const h = a.href || '';
      const m = h.match(/(?:activity|urn:li:activity:)(\d{8,})/i) || h.match(/posts\/[^?]*-(\d{8,})-[^/?#]+/i);
      if (m) return m[1];
    }

    // 2026 LinkedIn search UI fallback: map the SDUI component key to the
    // activity URN stored in the page's serialized state.
    return activityIdFromComponentKey(getRootComponentKey(root));
  }

  function findPostUrl(root, activityId) {
    const anchors = [...root.querySelectorAll('a[href]')];
    const preferred = anchors.find(a => /\/feed\/update\/urn:li:(?:activity|share):\d+/i.test(a.href || ''))
      || anchors.find(a => /linkedin\.com\/posts\//i.test(a.href || ''));
    if (preferred) return absoluteUrl(preferred.href);
    if (activityId) return `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
    return '';
  }

  function firstText(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      const t = cleanText(el?.innerText || el?.textContent);
      if (t) return t;
    }
    return '';
  }

  function extractAuthor(root) {
    // The new LinkedIn search UI gives us a stable accessible label here.
    const menu = root.querySelector('button[aria-label^="Open control menu for post by "]');
    let name = cleanText(menu?.getAttribute('aria-label')).replace(/^Open control menu for post by\s+/i, '');

    if (!name) {
      name = firstText(root, [
        '.update-components-actor__name',
        '.update-components-actor__title span[aria-hidden="true"]',
        '.feed-shared-actor__name',
        '.entity-result__title-text a span[aria-hidden="true"]',
        '[data-view-name="feed-actor-name"]',
        'a[href*="/in/"] span[aria-hidden="true"]',
        'a[href*="/company/"] span[aria-hidden="true"]',
        'a[href*="/in/"] p',
        'a[href*="/company/"] p'
      ]);
    }
    name = name.replace(/\s*•\s*\d+(?:st|nd|rd|th)?\s*$/i, '').trim();

    // Prefer the author links near the beginning of the card.  Mentioned people
    // and companies inside post text can otherwise be mistaken for the author.
    const profileLinks = [...root.querySelectorAll('a[href*="linkedin.com/in/"],a[href^="/in/"]')];
    const companyLinks = [...root.querySelectorAll('a[href*="linkedin.com/company/"],a[href^="/company/"]')];
    const profile = profileLinks[0];
    const company = companyLinks.find(a => /\/posts\/?(?:\?|$)/i.test(a.getAttribute('href') || a.href || '')) || companyLinks[0];

    let posterType = '';
    if (company && /\/posts\/?(?:\?|$)/i.test(company.getAttribute('href') || company.href || '')) posterType = 'Company';
    else if (profile) posterType = 'Person';
    else if (company) posterType = 'Company';

    return { name, posterType, profileUrl: absoluteUrl(profile?.href), companyUrl: absoluteUrl(company?.href) };
  }

  function extractTime(root) {
    const selectors = [
      '.update-components-actor__sub-description span[aria-hidden="true"]',
      '.feed-shared-actor__sub-description span[aria-hidden="true"]',
      'time',
      'a[href*="/feed/update/"] span[aria-hidden="true"]'
    ];
    for (const sel of selectors) {
      const items = [...root.querySelectorAll(sel)];
      for (const el of items) {
        const t = cleanText(el.innerText || el.textContent);
        const m = t.match(/(?:^|\s)(\d+\s*(?:s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks|mo|mos|yr|yrs))(?:\s|$|•)/i);
        if (m) return m[1].replace(/\s+/g, '');
        if (el.tagName === 'TIME' && t) return t;
      }
    }

    // New SDUI search result cards render e.g. "1h •" as ordinary paragraph text.
    const text = cleanText(root.innerText || root.textContent);
    const m = text.match(/(?:^|\s)(\d+\s*(?:s|m|h|d|w|mo|yr))\s*•/i)
      || text.match(/(?:^|\s)(\d+\s*(?:s|m|h|d|w|mo|yr))(?:\s|$)/i);
    return m ? m[1].replace(/\s+/g, '') : '';
  }

  function extractPostText(root) {
    return firstText(root, [
      '[data-testid="expandable-text-box"]',
      '.update-components-text',
      '.feed-shared-update-v2__description',
      '.feed-shared-text',
      '[data-view-name="feed-commentary"]',
      '.break-words'
    ]);
  }

  function extractSecondary(root) {
    return firstText(root, [
      '.update-components-actor__description',
      '.feed-shared-actor__description',
      '.entity-result__primary-subtitle'
    ]);
  }

  function isFeedPostRoot(el) {
    if (!el) return false;
    if (el.matches?.('[role="listitem"]')) {
      if (el.querySelector('[data-testid="expandable-text-box"]')) return true;
      if (el.querySelector('button[aria-label^="Open control menu for post by "]')) return true;
      const heading = cleanText(el.querySelector('h2')?.innerText || el.querySelector('h2')?.textContent);
      if (/^Feed post$/i.test(heading)) return true;
    }
    return false;
  }

  function candidateRoots() {
    const set = new Set();

    // Current (2026) LinkedIn SDUI search markup.
    document.querySelectorAll('[role="listitem"]').forEach(el => {
      if (isFeedPostRoot(el)) set.add(el);
    });

    // Older LinkedIn feed/search markup fallbacks.
    const direct = document.querySelectorAll([
      'div[data-urn^="urn:li:activity:"]',
      'div[data-chameleon-result-urn^="urn:li:activity:"]',
      '.feed-shared-update-v2',
      '[data-view-name="feed-full-update"]'
    ].join(','));
    direct.forEach(el => set.add(el));

    document.querySelectorAll('a[href*="/feed/update/urn:li:activity:"],a[href*="linkedin.com/posts/"]').forEach(a => {
      const root = a.closest('[role="listitem"], div[data-urn], div[data-chameleon-result-urn], .feed-shared-update-v2, li.reusable-search__result-container, [data-view-name="search-entity-result-universal-template"], li') || a.parentElement;
      if (root) set.add(root);
    });

    return [...set].filter(el => {
      const rect = el.getBoundingClientRect();
      const text = cleanText(el.innerText || el.textContent);
      return rect.height > 80 && text.length > 20;
    });
  }

  function scrapeVisible() {
    const roots = candidateRoots();
    const out = [];
    for (const root of roots) {
      const activityId = extractActivityId(root);
      const postUrl = findPostUrl(root, activityId);
      const author = extractAuthor(root);
      const postText = extractPostText(root);
      const time = extractTime(root);
      const secondary = extractSecondary(root);
      const componentKey = getRootComponentKey(root);

      // The new search UI may briefly render a card before its state payload is
      // available.  In that case use a deterministic card fingerprint so the
      // post can still be captured rather than silently discarded.
      const fingerprint = [componentKey, author.name, time, postText.slice(0, 240)].filter(Boolean).join('|');
      const key = activityId || postUrl || fingerprint;
      if (!key || !postText) continue;

      out.push({
        key,
        activityId,
        postedBy: author.name,
        posterType: author.posterType,
        authorProfileUrl: author.profileUrl,
        companyPageUrl: author.companyUrl,
        subtitle: secondary,
        postedTime: time,
        postText,
        postUrl,
        searchKeyword: getKeyword(),
        collectedAt: new Date().toISOString()
      });
    }
    return out;
  }

  function getScrollTarget() {
    const seed = document.querySelector('[data-testid="lazy-column"]') || document.querySelector('main#workspace') || document.body;
    let el = seed;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      const oy = style.overflowY;
      if (/(auto|scroll)/.test(oy) && el.scrollHeight > el.clientHeight + 120) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function scrollMetrics(target) {
    const docScroll = target === document.scrollingElement || target === document.documentElement || target === document.body;
    return {
      height: docScroll ? document.documentElement.scrollHeight : target.scrollHeight,
      top: docScroll ? (window.scrollY || document.documentElement.scrollTop || 0) : target.scrollTop,
      client: docScroll ? window.innerHeight : target.clientHeight
    };
  }

  function scrollByTarget(target, amount) {
    const docScroll = target === document.scrollingElement || target === document.documentElement || target === document.body;
    if (docScroll) window.scrollBy({ top: amount, behavior: 'smooth' });
    else target.scrollBy({ top: amount, behavior: 'smooth' });
  }

  function scrollToBottom(target) {
    const docScroll = target === document.scrollingElement || target === document.documentElement || target === document.body;
    if (docScroll) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    else target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
  }

  async function saveState(patch) {
    const state = { ...(await chrome.storage.local.get(STATE_KEY))[STATE_KEY], ...patch };
    await chrome.storage.local.set({ [STATE_KEY]: state });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitForGrowth(scrollTarget, beforeHeight, beforeCount) {
    const started = Date.now();
    return new Promise(resolve => {
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
        const grew = scrollMetrics(scrollTarget).height > beforeHeight + 100 || candidateRoots().length > beforeCount;
        if (grew) finish(true);
        else if (Date.now() - started > LOAD_WAIT_MS) finish(false);
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setInterval(check, 250);
      const hardStop = setTimeout(() => finish(false), LOAD_WAIT_MS + 500);
    });
  }

  function downloadWorkbook(posts, meta) {
    const headers = [
      '#','Activity ID','Posted By','Poster Type','Author Profile URL','Company Page URL',
      'Job Title / Subtitle','Posted Time','Post Text','Post URL','Search Keyword','Collected At'
    ];
    const rows = [headers, ...posts.map((p, i) => [
      i + 1, p.activityId, p.postedBy, p.posterType, p.authorProfileUrl, p.companyPageUrl,
      p.subtitle, p.postedTime, p.postText, p.postUrl, p.searchKeyword, p.collectedAt
    ])];
    const info = [
      ['Field','Value'],
      ['Search Keyword', meta.keyword],
      ['Search URL', meta.searchUrl],
      ['Requested Posts', meta.target],
      ['Extracted Unique Posts', posts.length],
      ['Duplicates Skipped', meta.duplicates],
      ['Scrolls Completed', meta.scrolls],
      ['Scrape Started', meta.startedAt],
      ['Scrape Finished', meta.endedAt],
      ['Stop Reason', meta.message]
    ];

    const blob = MiniXLSX.writeWorkbook([
      { name: 'Posts', rows },
      { name: 'Scrape Info', rows: info }
    ]);
    const safeKeyword = (meta.keyword || 'LinkedIn_Search').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'LinkedIn_Search';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 13);
    const filename = `LinkedIn_${safeKeyword}_${stamp}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function runScrape(target) {
    const token = { cancelled: false, paused: false, posts: [], seen: new Set(), duplicates: 0, scrolls: 0 };
    runner = token;
    const startedAt = new Date().toISOString();
    await saveState({ ...defaultState(), status: 'running', target, startedAt, keyword: getKeyword(), searchUrl: location.href, message: 'Scraping…' });

    let staleRounds = 0;
    while (!token.cancelled && token.posts.length < target) {
      while (token.paused && !token.cancelled) await sleep(300);
      if (token.cancelled) break;

      const batch = scrapeVisible();
      let added = 0;
      for (const p of batch) {
        if (token.posts.length >= target) break;
        if (token.seen.has(p.key)) { token.duplicates++; continue; }
        token.seen.add(p.key);
        token.posts.push(p);
        added++;
      }

      await saveState({ unique: token.posts.length, duplicates: token.duplicates, scrolls: token.scrolls, status: token.paused ? 'paused' : 'running', message: batch.length ? `Collected ${token.posts.length} of ${target}` : 'No post cards detected on this pass; scrolling for more…' });
      if (token.posts.length >= target) break;

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
        grew = scrollMetrics(scrollTarget).height > beforeHeight + 100 || candidateRoots().length > beforeCount;
      }

      staleRounds = (added === 0 && !grew) ? staleRounds + 1 : 0;
      if (staleRounds >= MAX_STALE_ROUNDS) break;
      await sleep(450);
    }

    const endedAt = new Date().toISOString();
    const reason = token.cancelled ? 'Stopped by user' : token.posts.length >= target ? 'Target reached' : 'No additional posts loaded';
    const finalState = {
      status: 'exported', target, unique: token.posts.length, duplicates: token.duplicates, scrolls: token.scrolls,
      startedAt, endedAt, keyword: getKeyword(), searchUrl: location.href, message: reason
    };
    await saveState(finalState);
    downloadWorkbook(token.posts, finalState);
    runner = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg?.type === 'LIEX_START') {
        if (runner) return sendResponse({ ok: false, error: 'A scrape is already running.' });
        const target = Math.max(1, Math.min(5000, Number(msg.target) || 200));
        runScrape(target).catch(async err => {
          await saveState({ status: 'error', message: err?.message || String(err), endedAt: new Date().toISOString() });
          runner = null;
        });
        return sendResponse({ ok: true });
      }
      if (msg?.type === 'LIEX_PAUSE') {
        if (runner) runner.paused = true;
        await saveState({ status: runner ? 'paused' : 'idle', message: runner ? 'Paused' : 'Nothing is running' });
        return sendResponse({ ok: true });
      }
      if (msg?.type === 'LIEX_RESUME') {
        if (runner) runner.paused = false;
        await saveState({ status: runner ? 'running' : 'idle', message: runner ? 'Resumed' : 'Nothing is running' });
        return sendResponse({ ok: true });
      }
      if (msg?.type === 'LIEX_STOP') {
        if (runner) runner.cancelled = true;
        return sendResponse({ ok: true });
      }
      if (msg?.type === 'LIEX_PING') {
        return sendResponse({ ok: true, keyword: getKeyword(), url: location.href });
      }
    })();
    return true;
  });

  chrome.storage.local.get(STATE_KEY).then(obj => {
    if (!obj[STATE_KEY]) chrome.storage.local.set({ [STATE_KEY]: defaultState() });
  });
})();
