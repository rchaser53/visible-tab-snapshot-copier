let captureInProgress = false;

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "撮影した画像をクリップボードへコピーするため"
    });
  }
}

async function captureAndCopy() {
  if (captureInProgress) return;
  captureInProgress = true;

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    await ensureOffscreenDocument();
    const result = await chrome.runtime.sendMessage({ type: "copy-snapshot", dataUrl });
    if (!result?.ok) throw new Error("Clipboard copy was rejected");
  } catch (error) {
    console.error("Snapshot capture failed", error);
  } finally {
    captureInProgress = false;
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-snapshot") captureAndCopy();
});
