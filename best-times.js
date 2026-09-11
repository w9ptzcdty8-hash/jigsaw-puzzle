(function () {
  "use strict";

  window.JigsawModules = window.JigsawModules || {};
  window.JigsawModules.bestTimes = function (app) {
    function bestTimeKey(level) { return "jigsaw_best_" + level; }

    function getBestTime(level) {
      const v = localStorage.getItem(bestTimeKey(level));
      return v ? parseFloat(v) : null;
    }

    function trySaveBestTime(level, seconds) {
      const current = getBestTime(level);
      if (current === null || seconds < current) {
        try { localStorage.setItem(bestTimeKey(level), String(seconds)); } catch (e) {}
        return true;
      }
      return false;
    }

    function formatTime(totalSeconds) {
      const m = Math.floor(totalSeconds / 60);
      const s = Math.floor(totalSeconds % 60);
      const cs = Math.floor((totalSeconds * 100) % 100);
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    }

    function renderBestTimes() {
      app.el.bestTimesList.innerHTML = "";
      app.LEVEL_ORDER.forEach((lvl) => {
        const best = getBestTime(lvl);
        const row = document.createElement("div");
        row.className = "best-time-row";
        row.innerHTML = `<span class="lvl">${lvl}</span><span class="val">${best !== null ? formatTime(best) : "--:--"}</span>`;
        app.el.bestTimesList.appendChild(row);
      });
    }

    app.bestTimes = { getBestTime, trySaveBestTime, formatTime, renderBestTimes };
  };
})();
