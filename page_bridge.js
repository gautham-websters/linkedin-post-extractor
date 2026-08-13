(() => {
  "use strict";

  /*
   * Runs in Chrome's MAIN execution world.
   *
   * The normal extension content script lives in an isolated world, so it
   * cannot reliably read React's private properties. This tiny bridge only
   * inspects the requested LinkedIn post card and returns a permalink through
   * DOM attributes/events. It does not use Chrome extension APIs.
   */

  const REQUEST_EVENT = "liex-request-post-url";
  const RESPONSE_EVENT = "liex-post-url-ready";

  function normalizeCandidate(value) {
    if (!value) return "";

    const text = String(value)
      .replace(/\\u003a/gi, ":")
      .replace(/\\u002f/gi, "/")
      .replace(/\\u002d/gi, "-")
      .replace(/\\\//g, "/");

    const canonical = text.match(
      /https:\/\/www\.linkedin\.com\/posts\/[^"'\\\s<>]+/i,
    );

    if (canonical?.[0]) {
      return canonical[0].replace(/[\\"'<>),;]+$/g, "").split("?")[0];
    }

    const feed = text.match(
      /https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:activity:\d+\/?/i,
    );

    if (feed?.[0]) {
      return feed[0].replace(/[\\"'<>),;]+$/g, "").split("?")[0];
    }

    const urn = text.match(/urn:li:activity:\d+/i);

    if (urn?.[0]) {
      return "https://www.linkedin.com/feed/update/" + urn[0] + "/";
    }

    return "";
  }

  function candidateRank(url) {
    if (!url) return 0;
    if (/linkedin\.com\/posts\//i.test(url)) return 3;
    if (/linkedin\.com\/feed\/update\/urn:li:activity:/i.test(url)) return 2;
    return 1;
  }

  function inspectValue(value, state, depth = 0) {
    if (value == null || depth > 7 || state.visited > 5000) {
      return;
    }

    if (typeof value === "string") {
      const candidate = normalizeCandidate(value);

      if (candidate && candidateRank(candidate) > candidateRank(state.best)) {
        state.best = candidate;
      }

      return;
    }

    if (
      typeof value !== "object" ||
      value instanceof Node ||
      value instanceof Window
    ) {
      return;
    }

    if (state.seen.has(value)) {
      return;
    }

    state.seen.add(value);
    state.visited++;

    const priorityKeys = [
      "postSlugUrl",
      "url",
      "href",
      "activityUrn",
      "activityId",
      "feedUpdateUrn",
      "updateUrnActivityUrn",
      "messagingFeedUpdateUrn",
      "requestedArguments",
      "payload",
      "triggers",
      "action",
      "actions",
      "children",
    ];

    const keys = Object.keys(value);
    const ordered = [
      ...priorityKeys.filter((key) => keys.includes(key)),
      ...keys.filter((key) => !priorityKeys.includes(key)).slice(0, 80),
    ];

    for (const key of ordered) {
      if (state.best && candidateRank(state.best) === 3) {
        return;
      }

      let child;

      try {
        child = value[key];
      } catch {
        continue;
      }

      if (typeof child === "function") {
        continue;
      }

      inspectValue(child, state, depth + 1);
    }
  }

  function reactKeys(node) {
    try {
      return Object.getOwnPropertyNames(node).filter(
        (key) =>
          key.startsWith("__reactProps$") ||
          key.startsWith("__reactFiber$") ||
          key.startsWith("__reactInternalInstance$"),
      );
    } catch {
      return [];
    }
  }

  function inspectReactNode(node, state) {
    if (!node) return;

    for (const key of reactKeys(node)) {
      let internal;

      try {
        internal = node[key];
      } catch {
        continue;
      }

      if (!internal) continue;

      if (key.startsWith("__reactProps$")) {
        inspectValue(internal, state, 0);
        continue;
      }

      /*
       * For fiber handles, inspect only the props/state on the current fiber
       * and a bounded set of ancestors. We deliberately do not recursively
       * walk child/sibling fibers, which would scan the entire LinkedIn app.
       */
      let fiber = internal;

      for (let i = 0; fiber && i < 18; i++, fiber = fiber.return) {
        try {
          inspectValue(fiber.memoizedProps, state, 0);
          inspectValue(fiber.pendingProps, state, 0);
          inspectValue(fiber.memoizedState, state, 0);
        } catch {
          // Continue to the next ancestor.
        }

        if (state.best && candidateRank(state.best) === 3) {
          return;
        }
      }
    }
  }

  function inspectCard(root) {
    const state = {
      best: "",
      seen: new WeakSet(),
      visited: 0,
    };

    const nodes = [root];

    try {
      nodes.push(
        ...root.querySelectorAll(
          'button, a, time, [role="button"], [componentkey]',
        ),
      );
    } catch {
      // Root alone is still worth inspecting.
    }

    /* Most useful React handles are near the post card; cap work per request. */
    for (const node of nodes.slice(0, 90)) {
      inspectReactNode(node, state);

      if (state.best && candidateRank(state.best) === 3) {
        break;
      }
    }

    return state.best;
  }

  document.addEventListener(REQUEST_EVENT, (event) => {
    const requestId = event?.detail?.requestId;

    if (!requestId || !/^[a-z0-9-]+$/i.test(requestId)) {
      return;
    }

    const root = document.querySelector(
      `[data-liex-request-id="${CSS.escape(requestId)}"]`,
    );

    if (!root) {
      return;
    }

    let url = "";

    try {
      url = inspectCard(root);
    } catch (error) {
      console.debug("[LinkedIn Extractor bridge] React inspection failed", error);
    }

    root.setAttribute("data-liex-post-url", url || "");
    root.dispatchEvent(new CustomEvent(RESPONSE_EVENT));
  });
})();
