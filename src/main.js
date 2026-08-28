import { cutOutSticker } from "./cutout.js";
import { listStickers, saveSticker } from "./library.js";
import "./style.css";

const A2HS_KEY = "pastely-a2hs-dismissed";

const cameraScreen = document.querySelector("#camera");
const libraryScreen = document.querySelector("#library");
const tabs = document.querySelectorAll("[data-screen]");
const takePhoto = document.querySelector("#take-photo");
const choosePhotos = document.querySelector("#choose-photos");
const inputCamera = document.querySelector("#input-camera");
const inputGallery = document.querySelector("#input-gallery");
const cameraError = document.querySelector("#camera-error");
const processing = document.querySelector("#processing");
const processingCopy = document.querySelector("#processing-copy");
const preview = document.querySelector("#preview");
const previewImg = document.querySelector("#preview-img");
const previewError = document.querySelector("#preview-error");
const keepBtn = document.querySelector("#keep");
const retakeBtn = document.querySelector("#retake");
const libraryEmpty = document.querySelector("#library-empty");
const libraryGrid = document.querySelector("#library-grid");
const a2hs = document.querySelector("#a2hs");
const a2hsDismiss = document.querySelector("#a2hs-dismiss");

let previewUrl = null;
let previewBlob = null;
let gridUrls = [];

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function showA2hs() {
  if (!isIos() || isStandalone()) return;
  if (localStorage.getItem(A2HS_KEY)) return;
  a2hs.hidden = false;
}

function showScreen(name) {
  const camera = name === "camera";
  cameraScreen.hidden = !camera;
  libraryScreen.hidden = camera;
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.screen === name);
  });
}

function setCameraError(message) {
  cameraError.hidden = !message;
  cameraError.textContent = message ?? "";
}

function setPreviewError(message) {
  previewError.hidden = !message;
  previewError.textContent = message ?? "";
}

function closePreview() {
  preview.hidden = true;
  keepBtn.disabled = false;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  previewBlob = null;
  previewImg.removeAttribute("src");
  setPreviewError("");
}

function showProcessing(copy = "Cutting out sticker...") {
  processingCopy.textContent = copy;
  processing.hidden = false;
}

function hideProcessing() {
  processing.hidden = true;
}

async function renderLibrary() {
  gridUrls.forEach((url) => URL.revokeObjectURL(url));
  gridUrls = [];
  libraryGrid.replaceChildren();

  const stickers = await listStickers();
  libraryEmpty.hidden = stickers.length > 0;

  for (const sticker of stickers) {
    const url = URL.createObjectURL(sticker.blob);
    gridUrls.push(url);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Saved sticker";
    img.className = "sticker";
    libraryGrid.append(img);
  }
}

function isPhoto(file) {
  if (!file) return false;
  if (!file.type) return true;
  return file.type.startsWith("image/");
}

async function onFile(file) {
  if (!isPhoto(file)) {
    setCameraError("That file is not a photo.");
    return;
  }

  closePreview();
  setCameraError("");
  showProcessing("Cutting out sticker...");

  try {
    const blob = await cutOutSticker(file, (_key, current, total) => {
      const pct = Math.round((current / total) * 100);
      processingCopy.textContent =
        pct < 100 ? `Cutting out sticker... ${pct}%` : "Cutting out sticker...";
    });
    hideProcessing();
    previewBlob = blob;
    previewUrl = URL.createObjectURL(blob);
    previewImg.src = previewUrl;
    preview.hidden = false;
  } catch (err) {
    hideProcessing();
    setCameraError("Cutout failed. Retake or choose from photos.");
    console.error(err);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showScreen(tab.dataset.screen));
});

takePhoto.addEventListener("click", () => {
  setCameraError("");
  inputCamera.value = "";
  inputCamera.click();
});

choosePhotos.addEventListener("click", () => {
  setCameraError("");
  inputGallery.value = "";
  inputGallery.click();
});

inputCamera.addEventListener("change", () => {
  const file = inputCamera.files?.[0];
  if (file) onFile(file);
});

inputGallery.addEventListener("change", () => {
  const file = inputGallery.files?.[0];
  if (file) onFile(file);
});

keepBtn.addEventListener("click", async () => {
  if (!previewBlob) return;
  keepBtn.disabled = true;
  try {
    await saveSticker(previewBlob);
    closePreview();
    await renderLibrary();
    showScreen("library");
  } catch (err) {
    keepBtn.disabled = false;
    setPreviewError("The sticker was not saved.");
    console.error(err);
  }
});

retakeBtn.addEventListener("click", () => {
  closePreview();
  showScreen("camera");
});

a2hsDismiss.addEventListener("click", () => {
  localStorage.setItem(A2HS_KEY, "1");
  a2hs.hidden = true;
});

showA2hs();
showScreen("camera");
renderLibrary();
