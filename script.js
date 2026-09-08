(function () {
  "use strict";

  /* ============================================================
     0. 設定・定数
     ============================================================ */

  // レベル定義（ピース数・グリッドは今後のピース生成ステップで実際に使用）
  const LEVELS = {
    KIDS:   { label: "KIDS",   pieces: 6,  cols: 3,  rows: 2 },
    EASY:   { label: "EASY",   pieces: 12, cols: 4,  rows: 3 },
    NORMAL: { label: "NORMAL", pieces: 35, cols: 7,  rows: 5 },
    HARD:   { label: "HARD",   pieces: 96, cols: 12, rows: 8 },
  };
  const LEVEL_ORDER = ["KIDS", "EASY", "NORMAL", "HARD"];

  // サンプル画像（同梱のオリジナルイラスト）
  const SAMPLE_IMAGES = [
    { id: "sample1", src: "assets/images/sample1.svg", name: "山と湖" },
    { id: "sample2", src: "assets/images/sample2.svg", name: "ねこ" },
    { id: "sample3", src: "assets/images/sample3.svg", name: "花畑" },
    { id: "sample4", src: "assets/images/sample4.svg", name: "街なみ" },
    { id: "sample5", src: "assets/images/sample5.svg", name: "宇宙" },
  ];

  // アップロード画像（現時点ではメモリ上のみで管理。
  // TODO: 次のステップで IndexedDB による永続化に置き換える）
  let uploadedImages = []; // { id, src(dataURL), name }
  let uploadIdCounter = 1;

  /* ============================================================
     1. 状態管理
     ============================================================ */

  const state = {
    selectedLevel: "EASY",
    currentImage: null,   // { id, src, name }
    startTimestamp: 0,    // ゲーム開始（再開）時刻
    elapsedBeforePause: 0,// ポーズ前までに経過していた時間(ms)
    timerHandle: null,
    isPaused: false,
    isRunning: false,
  };

  /* ============================================================
     2. DOM参照
     ============================================================ */

  const $ = (id) => document.getElementById(id);

  const screens = {
    title: $("screen-title"),
    level: $("screen-level"),
    imageselect: $("screen-imageselect"),
    game: $("screen-game"),
    clear: $("screen-clear"),
  };

  const modals = {
    pause: $("modal-pause"),
    uploadMenu: $("modal-upload-menu"),
    uploadList: $("modal-upload-list"),
  };

  const el = {
    bestTimesList: $("best-times-list"),
    levelGrid: $("level-grid"),
    imageSelectGrid: $("image-select-grid"),
    uploadedGrid: $("uploaded-grid"),
    uploadedEmpty: $("uploaded-empty"),
    gameLevelTag: $("game-level-tag"),
    gameTimer: $("game-timer"),
    gameCanvas: $("game-canvas"),
    clearTime: $("clear-time"),
    clearBestTag: $("clear-best-tag"),
    fileInput: $("file-input"),
  };

  const ctx = el.gameCanvas.getContext("2d");

  /* ============================================================
     3. 画面切り替え
     ============================================================ */

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
  }

  function showModal(modal) { modal.classList.remove("hidden"); }
  function hideModal(modal) { modal.classList.add("hidden"); }

  /* ============================================================
     4. ベストタイム（localStorage / レベルごと）
     ============================================================ */

  function bestTimeKey(level) { return "jigsaw_best_" + level; }

  function getBestTime(level) {
    const v = localStorage.getItem(bestTimeKey(level));
    return v ? parseFloat(v) : null;
  }

  function trySaveBestTime(level, seconds) {
    const current = getBestTime(level);
    if (current === null || seconds < current) {
      try { localStorage.setItem(bestTimeKey(level), String(seconds)); } catch (e) {}
      return true; // 新記録
    }
    return false;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    const cs = Math.floor((totalSeconds * 100) % 100); // 1/100秒
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }

  function renderBestTimes() {
    el.bestTimesList.innerHTML = "";
    LEVEL_ORDER.forEach((lvl) => {
      const best = getBestTime(lvl);
      const row = document.createElement("div");
      row.className = "best-time-row";
      row.innerHTML = `<span class="lvl">${lvl}</span><span class="val">${best !== null ? formatTime(best) : "--:--"}</span>`;
      el.bestTimesList.appendChild(row);
    });
  }

  /* ============================================================
     5. レベル選択画面
     ============================================================ */

  function renderLevelGrid() {
    el.levelGrid.innerHTML = "";
    LEVEL_ORDER.forEach((lvl) => {
      const cfg = LEVELS[lvl];
      const btn = document.createElement("button");
      btn.className = "level-btn" + (lvl === state.selectedLevel ? " active" : "");
      btn.innerHTML = `<span class="lvl-name">${cfg.label}</span><span class="lvl-pieces">${cfg.pieces}ピース</span>`;
      btn.addEventListener("click", () => {
        state.selectedLevel = lvl;
        renderLevelGrid();
      });
      el.levelGrid.appendChild(btn);
    });
  }

  /* ============================================================
     6. 画像プール・選択
     ============================================================ */

  function getImagePool() {
    return [...SAMPLE_IMAGES, ...uploadedImages];
  }

  function pickRandomImage() {
    const pool = getImagePool();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function renderImageSelectGrid() {
    el.imageSelectGrid.innerHTML = "";
    getImagePool().forEach((img) => {
      const cell = document.createElement("div");
      cell.className = "image-thumb";
      cell.innerHTML = `<img src="${img.src}" alt="${img.name}"><div class="thumb-label">${img.name}</div>`;
      cell.addEventListener("click", () => {
        state.currentImage = img;
        startGame();
      });
      el.imageSelectGrid.appendChild(cell);
    });
  }

  /* ============================================================
     7. アップロード画像の管理（現状はメモリ上のみ）
     ============================================================ */

  function renderUploadedGrid() {
    el.uploadedGrid.innerHTML = "";
    if (uploadedImages.length === 0) {
      el.uploadedEmpty.classList.remove("hidden");
      return;
    }
    el.uploadedEmpty.classList.add("hidden");
    uploadedImages.forEach((img) => {
      const cell = document.createElement("div");
      cell.className = "image-thumb";
      cell.innerHTML = `
        <img src="${img.src}" alt="${img.name}">
        <button class="thumb-delete" aria-label="削除">✕</button>
      `;
      cell.querySelector(".thumb-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        uploadedImages = uploadedImages.filter((u) => u.id !== img.id);
        renderUploadedGrid();
      });
      el.uploadedGrid.appendChild(cell);
    });
  }

  function handleFileSelected(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // TODO: 次のステップでリサイズ（長辺800px程度）＆IndexedDB保存に置き換える
      const dataUrl = e.target.result;
      uploadedImages.push({
        id: "upload" + (uploadIdCounter++),
        src: dataUrl,
        name: "マイ画像" + uploadedImages.length,
      });
      renderUploadedGrid();
    };
    reader.readAsDataURL(file);
  }

  /* ============================================================
     8. タイマー
     ============================================================ */

  function currentElapsedSeconds() {
    const running = state.isPaused ? 0 : (Date.now() - state.startTimestamp);
    return (state.elapsedBeforePause + running) / 1000;
  }

  function updateTimerDisplay() {
    el.gameTimer.textContent = formatTime(currentElapsedSeconds()).slice(0, 5); // mm:ss だけ表示
  }

  function startTimer() {
    state.elapsedBeforePause = 0;
    state.startTimestamp = Date.now();
    state.isPaused = false;
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = setInterval(updateTimerDisplay, 100);
    updateTimerDisplay();
  }

  function pauseTimer() {
    state.elapsedBeforePause += Date.now() - state.startTimestamp;
    state.isPaused = true;
  }

  function resumeTimer() {
    state.startTimestamp = Date.now();
    state.isPaused = false;
  }

  function stopTimer() {
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  /* ============================================================
     9. ゲーム画面（現段階は土台のみ。ピース生成は次のステップ）
     ============================================================ */

  function resizeGameCanvas() {
    const rect = el.gameCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.gameCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    el.gameCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGamePlaceholder();
  }
  window.addEventListener("resize", resizeGameCanvas);
  window.addEventListener("orientationchange", () => setTimeout(resizeGameCanvas, 150));

  // 画像はロード済みのものをキャッシュして使い回す
  const imageCache = {};
  function loadImage(src, onLoad) {
    if (imageCache[src] && imageCache[src].complete) {
      onLoad(imageCache[src]);
      return;
    }
    const img = new Image();
    img.onload = () => onLoad(img);
    img.src = src;
    imageCache[src] = img;
  }

  // TODO: この関数はピース生成・ドラッグ＆ドロップ実装時に置き換える。
  // 現段階では「組み立てエリア」に完成図のヒントを薄く表示し、
  // 「トレイエリア」は空の状態を示すだけの土台。
  function drawGamePlaceholder() {
    const w = el.gameCanvas.clientWidth;
    const h = el.gameCanvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const boardH = h * 0.62;
    const trayH = h - boardH;

    // 組み立てエリア背景
    ctx.fillStyle = "#f7f2e6";
    ctx.fillRect(0, 0, w, boardH);

    // 完成図ヒント（薄く表示）
    if (state.currentImage) {
      loadImage(state.currentImage.src, (img) => {
        // 現在描画中のcanvasサイズが変わっている可能性があるため再取得
        const curW = el.gameCanvas.clientWidth;
        const curBoardH = el.gameCanvas.clientHeight * 0.62;
        const margin = 20;
        const areaW = curW - margin * 2;
        const areaH = curBoardH - margin * 2;
        const scale = Math.min(areaW / img.width, areaH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (curW - dw) / 2;
        const dy = (curBoardH - dh) / 2;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();

        // 枠線
        ctx.strokeStyle = "rgba(107,107,120,0.5)";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);
        ctx.setLineDash([]);
      });
    }

    // 境界線
    ctx.strokeStyle = "#d8cfb8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, boardH);
    ctx.lineTo(w, boardH);
    ctx.stroke();

    // トレイエリア
    ctx.fillStyle = "#efe7d3";
    ctx.fillRect(0, boardH, w, trayH);
    ctx.fillStyle = "rgba(107,107,120,0.6)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ピースはここに表示されます（次のステップで実装）", w / 2, boardH + trayH / 2);
    ctx.textAlign = "left";
  }

  function startGame() {
    showScreen("game");
    const cfg = LEVELS[state.selectedLevel];
    el.gameLevelTag.textContent = `${cfg.label} (${cfg.pieces}ピース)`;
    resizeGameCanvas();
    startTimer();
    state.isRunning = true;
  }

  /* ============================================================
     10. クリア画面
     ============================================================ */

  function goToClear() {
    stopTimer();
    state.isRunning = false;
    const seconds = currentElapsedSeconds();
    const isNewRecord = trySaveBestTime(state.selectedLevel, seconds);

    el.clearTime.textContent = formatTime(seconds);
    el.clearBestTag.textContent = isNewRecord ? "🎉 ベストタイム更新！" : "";

    showScreen("clear");
  }

  /* ============================================================
     11. イベント登録：画面遷移
     ============================================================ */

  // タイトル → レベル選択
  $("btn-start").addEventListener("click", () => {
    renderLevelGrid();
    showScreen("level");
  });

  // レベル選択 → タイトル
  $("btn-level-back").addEventListener("click", () => {
    renderBestTimes();
    showScreen("title");
  });

  // レベル選択 → ランダムで遊ぶ
  $("btn-play-random").addEventListener("click", () => {
    state.currentImage = pickRandomImage();
    startGame();
  });

  // レベル選択 → 画像を選んで遊ぶ
  $("btn-play-choose").addEventListener("click", () => {
    renderImageSelectGrid();
    showScreen("imageselect");
  });

  // 画像選択 → レベル選択へ戻る
  $("btn-imageselect-back").addEventListener("click", () => {
    showScreen("level");
  });

  // ポーズボタン
  $("btn-pause").addEventListener("click", () => {
    if (!state.isRunning) return;
    pauseTimer();
    showModal(modals.pause);
  });
  $("btn-resume").addEventListener("click", () => {
    resumeTimer();
    hideModal(modals.pause);
  });
  $("btn-pause-title").addEventListener("click", () => {
    stopTimer();
    state.isRunning = false;
    hideModal(modals.pause);
    renderBestTimes();
    showScreen("title");
  });

  // クリア画面
  $("btn-clear-retry").addEventListener("click", () => {
    // レベルは維持、画像は再抽選（画像選択から来た場合も含め常にランダム）
    state.currentImage = pickRandomImage();
    startGame();
  });
  $("btn-clear-title").addEventListener("click", () => {
    renderBestTimes();
    showScreen("title");
  });

  /* ============================================================
     12. 画像アップロード関連
     ============================================================ */

  $("btn-open-upload").addEventListener("click", () => showModal(modals.uploadMenu));
  $("btn-upload-menu-close").addEventListener("click", () => hideModal(modals.uploadMenu));

  $("btn-upload-new").addEventListener("click", () => {
    el.fileInput.click();
  });
  el.fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    handleFileSelected(file);
    e.target.value = ""; // 同じファイルを連続選択できるようにリセット
    hideModal(modals.uploadMenu);
  });

  $("btn-upload-list").addEventListener("click", () => {
    hideModal(modals.uploadMenu);
    renderUploadedGrid();
    showModal(modals.uploadList);
  });
  $("btn-uploaded-close").addEventListener("click", () => hideModal(modals.uploadList));

  /* ============================================================
     13. 開発用デバッグ機能（本番実装が完成したら削除する）
     ============================================================ */

  // ピース生成・ドラッグ＆ドロップがまだ無いため、画面遷移の動作確認用に
  // ゲーム画面をダブルタップ／ダブルクリックするとクリア扱いにする。
  let lastTapTime = 0;
  el.gameCanvas.addEventListener("pointerdown", () => {
    const now = Date.now();
    if (now - lastTapTime < 350) {
      goToClear();
    }
    lastTapTime = now;
  });

  /* ============================================================
     14. 初期化
     ============================================================ */

  renderBestTimes();
  showScreen("title");
})();
