const captureButton = document.querySelector("#capture");
const saveButton = document.querySelector("#save");
const savePathInput = document.querySelector("#save-path");
const statusElement = document.querySelector("#status");

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

async function captureSnapshot() {
  return chrome.tabs.captureVisibleTab(null, { format: "png" });
}

async function captureAndCopy() {
  captureButton.disabled = true;
  setStatus("撮影しています…");

  try {
    const dataUrl = await captureSnapshot();
    const response = await fetch(dataUrl);
    const imageBlob = await response.blob();

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": imageBlob })
    ]);

    setStatus("コピーしました。貼り付けできます。");
    // コピー完了をユーザーが確認できるよう、少しだけポップアップを残す。
    setTimeout(() => window.close(), 600);
  } catch (error) {
    console.error("Snapshot capture failed", error);
    setStatus("撮影またはコピーに失敗しました。", true);
    captureButton.disabled = false;
  }
}

function getSafeSavePath() {
  const path = savePathInput.value.trim()
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  return path.split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

async function captureAndSave() {
  captureButton.disabled = true;
  saveButton.disabled = true;
  setStatus("保存しています…");

  try {
    const dataUrl = await captureSnapshot();
    const folder = getSafeSavePath();
    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    const filename = `${folder ? `${folder}/` : ""}snapshot-${timestamp}.png`;

    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    await chrome.storage.local.set({ savePath: folder });
    setStatus("PNGを保存しました。");
    setTimeout(() => window.close(), 600);
  } catch (error) {
    console.error("Snapshot save failed", error);
    setStatus("PNGの保存に失敗しました。", true);
    captureButton.disabled = false;
    saveButton.disabled = false;
  }
}

chrome.storage.local.get("savePath").then(({ savePath }) => {
  if (typeof savePath === "string") savePathInput.value = savePath;
});

captureButton.addEventListener("click", captureAndCopy);
saveButton.addEventListener("click", captureAndSave);
