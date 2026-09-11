(function () {
  "use strict";

  const SAMPLE_IDS = ["sample1", "sample2", "sample3", "sample4", "sample5"];
  const SAMPLE_KEY = "jigsaw_sample_images";
  const HIDDEN_KEY = "jigsaw_hidden_samples";
  const BACKUP_KEY = "jigsaw_hidden_samples_before_sample_off";

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

  function refreshSampleToggle(uploadedCount) {
    const toggle = document.getElementById("setting-sample-images");
    if (!toggle) return;

    const enabled = getBool(SAMPLE_KEY, true);
    const canToggle = uploadedCount > 0;
    const strong = toggle.querySelector("strong");
    if (strong) strong.textContent = enabled ? "ON" : "OFF";
    toggle.classList.toggle("off", !enabled);
    toggle.classList.toggle("disabled", !canToggle);
    toggle.disabled = !canToggle;
  }

  window.JigsawSettings = {
    getBool,
    setBool,
    getHiddenSamples,
    setHiddenSamples,
    getBackupHiddenSamples,
    setBackupHiddenSamples,
    setSampleEnabled,
    refreshSampleToggle,
    isSampleEnabled: () => getBool(SAMPLE_KEY, true),
    sampleIds: SAMPLE_IDS.slice(),
  };

  function install() {
    const toggle = document.getElementById("setting-sample-images");
    if (toggle) {
      toggle.addEventListener("click", () => {
        if (toggle.disabled) return;
        setSampleEnabled(!getBool(SAMPLE_KEY, true));
        const grid = document.getElementById("uploaded-grid");
        const count = grid ? grid.querySelectorAll(".image-thumb").length : 0;
        refreshSampleToggle(count);
      });
    }

    const openSettings = document.getElementById("btn-open-settings");
    if (openSettings) {
      openSettings.addEventListener("click", () => {
        const grid = document.getElementById("uploaded-grid");
        const count = grid ? grid.querySelectorAll(".image-thumb").length : 0;
        setTimeout(() => refreshSampleToggle(count), 0);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
