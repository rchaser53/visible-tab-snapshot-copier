let captureInProgress = false;
const DEFAULT_TARGET_URL = "https://chatgpt.com/";

function normalizeTargetUrl(value) {
  const url = new URL(value || DEFAULT_TARGET_URL);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("対象URLにはhttpまたはhttpsを指定してください。");
  }
  return url;
}

async function getStoredTargetUrl() {
  const { targetUrl } = await chrome.storage.local.get("targetUrl");
  try {
    return normalizeTargetUrl(targetUrl).toString();
  } catch {
    return DEFAULT_TARGET_URL;
  }
}

async function openTargetTab(targetUrl = null) {
  const configuredUrl = normalizeTargetUrl(targetUrl || await getStoredTargetUrl());
  const tabs = await chrome.tabs.query({});
  const targetTab = tabs.find((tab) => {
    if (tab.id === undefined || !tab.url) return false;
    try {
      return new URL(tab.url).origin === configuredUrl.origin;
    } catch {
      return false;
    }
  });

  if (targetTab) {
    await chrome.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId !== undefined) {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: configuredUrl.toString() });
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
    await openTargetTab();
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
  openTargetTab(message.targetUrl).catch((error) => {
    console.error("Could not open ChatGPT tab", error);
  });
  return false;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-snapshot") captureAndCopy();
});
