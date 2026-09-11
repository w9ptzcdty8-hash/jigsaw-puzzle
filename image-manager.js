(function () {
  "use strict";

  const DB_NAME = "jigsaw_puzzle_db";
  const DB_VERSION = 1;
  const DB_STORE = "images";

  function getUploadedCountFromDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(document.querySelectorAll("#uploaded-grid .image-thumb").length);
        return;
      }
      let settled = false;
      const fallback = () => {
        if (!settled) {
          settled = true;
          resolve(document.querySelectorAll("#uploaded-grid .image-thumb").length);
        }
      };
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = fallback;
        req.onupgradeneeded = () => {};
        req.onsuccess = (e) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
              db.close();
              fallback();
              return;
            }
            const tx = db.transaction(DB_STORE, "readonly");
            const getReq = tx.objectStore(DB_STORE).getAll();
            getReq.onerror = fallback;
            getReq.onsuccess = () => {
              if (!settled) {
                settled = true;
                resolve((getReq.result || []).length);
              }
            };
          } catch (err) {
            fallback();
          }
        };
      } catch (err) {
        fallback();
      }
    });
  }

  function refreshSampleToggle() {
    getUploadedCountFromDB().then((uploadedCount) => {
      if (uploadedCount === 0 && !window.JigsawSettings.isSampleEnabled()) {
        window.JigsawSettings.setSampleEnabled(true);
      }
      window.JigsawSettings.refreshSampleToggle(uploadedCount);
    });
  }

  function removeSelectionDeleteButtons() {
    document.querySelectorAll("#image-select-grid .sample-delete, #image-select-grid .thumb-delete").forEach((button) => button.remove());
  }

  let previousUploadedDomCount = 0;
  let deletionAlertShown = false;

  function watchUploadedGrid() {
    const grid = document.getElementById("uploaded-grid");
    if (!grid) return;
    const observer = new MutationObserver(() => {
      const count = grid.querySelectorAll(".image-thumb").length;
      if (previousUploadedDomCount > 0 && count === 0 && !window.JigsawSettings.isSampleEnabled() && !deletionAlertShown) {
        deletionAlertShown = true;
        window.JigsawSettings.setSampleEnabled(true);
        alert("使用する画像が無くなったため、サンプル画像を有効にします");
      }
      if (count > 0) deletionAlertShown = false;
      previousUploadedDomCount = count;
      refreshSampleToggle();
    });
    observer.observe(grid, { childList: true, subtree: true });
    previousUploadedDomCount = grid.querySelectorAll(".image-thumb").length;
  }

  function watchImageSelection() {
    const grid = document.getElementById("image-select-grid");
    if (!grid) return;
    const observer = new MutationObserver(removeSelectionDeleteButtons);
    observer.observe(grid, { childList: true, subtree: true });
    removeSelectionDeleteButtons();
  }

  function install() {
    const fileInput = document.getElementById("file-input");
    const randomButton = document.getElementById("btn-play-random");
    const chooseButton = document.getElementById("btn-play-choose");

    if (fileInput) {
      fileInput.addEventListener("change", () => setTimeout(refreshSampleToggle, 100));
    }

    const guardNoImages = () => {
      getUploadedCountFromDB().then((uploadedCount) => {
        const samplesEnabled = window.JigsawSettings.isSampleEnabled();
        const hidden = window.JigsawSettings.getHiddenSamples();
        const visibleSamples = samplesEnabled
          ? window.JigsawSettings.sampleIds.filter((id) => !hidden.includes(id)).length
          : 0;
        if (uploadedCount === 0 && (!samplesEnabled || visibleSamples > 0)) {
          window.JigsawSettings.setSampleEnabled(true);
          if (!samplesEnabled) {
            alert("使用する画像が無くなったため、サンプル画像を有効にします");
          }
        }
      });
    };

    if (randomButton) randomButton.addEventListener("click", guardNoImages, true);
    if (chooseButton) chooseButton.addEventListener("click", guardNoImages, true);

    watchUploadedGrid();
    watchImageSelection();
    refreshSampleToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
