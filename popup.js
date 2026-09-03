const captureButton = document.querySelector("#capture");
const saveButton = document.querySelector("#save");
const savePathInput = document.querySelector("#save-path");
const saveWidthInput = document.querySelector("#save-width");
const saveHeightInput = document.querySelector("#save-height");
const keepRatioInput = document.querySelector("#keep-ratio");
const imageSizeHint = document.querySelector("#image-size-hint");
const statusElement = document.querySelector("#status");

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

async function captureSnapshot() {
  return chrome.tabs.captureVisibleTab(null, { format: "png" });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = dataUrl;
  });
}

function positiveInteger(input) {
  if (!input.value.trim()) return null;
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("保存サイズには1以上の整数を指定してください。");
  }
  return value;
}

async function resizePng(dataUrl) {
  const image = await loadImage(dataUrl);
  let width = positiveInteger(saveWidthInput);
  let height = positiveInteger(saveHeightInput);

  if (keepRatioInput.checked) {
    if (width !== null && height === null) height = Math.max(1, Math.round(width * image.height / image.width));
    if (height !== null && width === null) width = Math.max(1, Math.round(height * image.width / image.height));
  }
  width ??= image.width;
  height ??= image.height;

  if (width === image.width && height === image.height) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error("PNGの作成に失敗しました。"));
    }, "image/png");
  });
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
  let downloadUrl = null;

  try {
    const dataUrl = await captureSnapshot();
    downloadUrl = await resizePng(dataUrl);
    const folder = getSafeSavePath();
    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    const filename = `${folder ? `${folder}/` : ""}snapshot-${timestamp}.png`;

    await chrome.downloads.download({
      url: downloadUrl,
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
  } finally {
    if (downloadUrl && downloadUrl.startsWith("blob:")) URL.revokeObjectURL(downloadUrl);
  }
}

function updateImageSizeHint() {
  const width = saveWidthInput.value.trim();
  const height = saveHeightInput.value.trim();
  imageSizeHint.textContent = width || height
    ? "指定したサイズでPNGを保存します。"
    : "未指定の場合は元のサイズで保存します。";
}

saveWidthInput.addEventListener("input", updateImageSizeHint);
saveHeightInput.addEventListener("input", updateImageSizeHint);

chrome.storage.local.get("savePath").then(({ savePath }) => {
  if (typeof savePath === "string") savePathInput.value = savePath;
});

captureButton.addEventListener("click", captureAndCopy);
saveButton.addEventListener("click", captureAndSave);
