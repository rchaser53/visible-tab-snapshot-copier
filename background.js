let captureInProgress = false;

async function openChatGptTab() {
  const tabs = await chrome.tabs.query({ url: ["https://chatgpt.com/*"] });
  const chatGptTab = tabs.find((tab) => tab.id !== undefined);

  if (chatGptTab) {
    await chrome.tabs.update(chatGptTab.id, { active: true });
    if (chatGptTab.windowId !== undefined) {
      await chrome.windows.update(chatGptTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: "https://chatgpt.com/" });
}

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
    await openChatGptTab();
  } catch (error) {
    console.error("Snapshot capture failed", error);
  } finally {
    captureInProgress = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "open-chatgpt-tab") return undefined;

  // ポップアップはタブ切り替えと同時に閉じるため、先に応答して処理を継続する。
  sendResponse({ ok: true });
  openChatGptTab().catch((error) => {
    console.error("Could not open ChatGPT tab", error);
  });
  return false;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-snapshot") captureAndCopy();
});
