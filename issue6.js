(function () {
  "use strict";

  const SAMPLE_IDS = ["sample1", "sample2", "sample3", "sample4", "sample5"];
  const SAMPLE_KEY = "jigsaw_sample_images";
  const HIDDEN_KEY = "jigsaw_hidden_samples";
  const BACKUP_KEY = "jigsaw_hidden_samples_before_sample_off";
  const DB_NAME = "jigsaw_puzzle_db";
  const DB_VERSION = 1;
  const DB_STORE = "images";

  function getBool(key, fallback) {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  }

  function setBool(key, value) {
    try { localStorage.setItem(key, value ? "1" : "0"); } catch (e) {}
  }

  function getHiddenSamples() {
    try {
      const v = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function setHiddenSamples(ids) {
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids)); } catch (e) {}
  }

  function getBackupHiddenSamples() {
    try {
      const v = JSON.parse(localStorage.getItem(BACKUP_KEY) || "null");
      return Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }

  function setBackupHiddenSamples(ids) {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(ids)); } catch (e) {}
  }

  function setSampleEnabled(enabled) {
    const currentlyEnabled = getBool(SAMPLE_KEY, true);
    if (enabled === currentlyEnabled) return;

    if (!enabled) {
      setBackupHiddenSamples(getHiddenSamples());
      setHiddenSamples(Array.from(new Set([...getHiddenSamples(), ...SAMPLE_IDS])));
      setBool(SAMPLE_KEY, false);
    } else {
      const backup = getBackupHiddenSamples();
      if (backup) setHiddenSamples(backup);
      setBool(SAMPLE_KEY, true);
    }
  }

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

  async function refreshSampleToggle() {
    const toggle = document.getElementById("setting-sample-images");
    if (!toggle) return;
    const uploadedCount = await getUploadedCountFromDB();
    if (uploadedCount === 0 && !getBool(SAMPLE_KEY, true)) {
      setSampleEnabled(true);
    }
    const enabled = getBool(SAMPLE_KEY, true);
    const canToggle = uploadedCount > 0;
    const strong = toggle.querySelector("strong");
    if (strong) strong.textContent = enabled ? "ON" : "OFF";
    toggle.classList.toggle("off", !enabled);
    toggle.classList.toggle("disabled", !canToggle);
    toggle.disabled = !canToggle;
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
      if (previousUploadedDomCount > 0 && count === 0 && !getBool(SAMPLE_KEY, true) && !deletionAlertShown) {
        deletionAlertShown = true;
        setSampleEnabled(true);
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
    const toggle = document.getElementById("setting-sample-images");
    const openSettings = document.getElementById("btn-open-settings");
    const resetSamples = document.getElementById("btn-reset-samples");
    const fileInput = document.getElementById("file-input");
    const randomButton = document.getElementById("btn-play-random");
    const chooseButton = document.getElementById("btn-play-choose");

    if (toggle) {
      toggle.addEventListener("click", () => {
        if (toggle.disabled) return;
        setSampleEnabled(!getBool(SAMPLE_KEY, true));
        refreshSampleToggle();
      });
    }

    if (openSettings) {
      openSettings.addEventListener("click", () => setTimeout(refreshSampleToggle, 0));
    }

    if (resetSamples) {
      resetSamples.addEventListener("click", () => {
        setBackupHiddenSamples([]);
        setSampleEnabled(true);
        setTimeout(refreshSampleToggle, 0);
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", () => setTimeout(refreshSampleToggle, 100));
    }

    const guardNoImages = (e) => {
      getUploadedCountFromDB().then((uploadedCount) => {
        const samplesEnabled = getBool(SAMPLE_KEY, true);
        const visibleSamples = samplesEnabled ? getHiddenSamples().filter((id) => !SAMPLE_IDS.includes(id)).length : 0;
        if (uploadedCount === 0 && (!samplesEnabled || visibleSamples > 0)) {
          setSampleEnabled(true);
          if (!samplesEnabled) alert("使用する画像が無くなったため、サンプル画像を有効にします");
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
