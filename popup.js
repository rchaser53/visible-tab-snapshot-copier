const captureButton = document.querySelector("#capture");
const statusElement = document.querySelector("#status");

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

async function captureAndCopy() {
  captureButton.disabled = true;
  setStatus("撮影しています…");

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png"
    });
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

captureButton.addEventListener("click", captureAndCopy);
