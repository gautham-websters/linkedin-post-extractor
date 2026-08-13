let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (contexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["CLIPBOARD"],
    justification: "Read LinkedIn post URLs copied using the Copy link to post action.",
  });

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "LIEX_READ_CLIPBOARD") {
    return;
  }

  (async () => {
    try {
      await ensureOffscreenDocument();

      const response = await chrome.runtime.sendMessage({
        target: "offscreen",
        type: "READ_CLIPBOARD",
      });

      sendResponse(response);
    } catch (error) {
      console.error(
        "[LinkedIn Extractor] Clipboard bridge failed:",
        error,
      );

      sendResponse({
        ok: false,
        text: "",
        error: error?.message || String(error),
      });
    }
  })();

  return true;
});