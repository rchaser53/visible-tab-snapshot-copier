chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "copy-snapshot") return undefined;

  fetch(message.dataUrl)
    .then((response) => response.blob())
    .then((imageBlob) => navigator.clipboard.write([
      new ClipboardItem({ "image/png": imageBlob })
    ]))
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.error("Snapshot copy failed", error);
      sendResponse({ ok: false });
    });

  return true;
});
