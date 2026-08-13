chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== "offscreen") {
    return;
  }

  if (message?.type === "READ_CLIPBOARD") {
    (async () => {
      try {
        const text = await navigator.clipboard.readText();

        sendResponse({
          ok: true,
          text: text || "",
        });
      } catch (error) {
        console.error(
          "[LinkedIn Extractor] Offscreen clipboard read failed:",
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
  }
});