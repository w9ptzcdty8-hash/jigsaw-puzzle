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
     9. サウンド（Web Audio）
     ============================================================ */

  const sound = (function () {
    let actx = null;
    function ensure() {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
      }
      if (actx.state === "suspended") actx.resume();
      return actx;
    }
    function tone(freq, dur, type, gain, delay) {
      try {
        const c = ensure();
        const t0 = c.currentTime + (delay || 0);
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(gain != null ? gain : 0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) {}
    }
    return {
      init() { ensure(); },
      snap() { tone(660, 0.1, "triangle", 0.14); tone(880, 0.12, "triangle", 0.12, 0.06); },
      miss() { tone(190, 0.09, "sine", 0.07); },
      complete() {
        tone(523.25, 0.15, "sine", 0.15, 0);
        tone(659.25, 0.15, "sine", 0.15, 0.12);
        tone(783.99, 0.28, "sine", 0.18, 0.24);
      },
    };
  })();

  /* ============================================================
     10. ピース生成（グリッド分割＋曲線タブ）
     ============================================================ */

  const PIECE_PAD = 3;      // ピース画像の余白（タブのはみ出し・縁取り分）
  const EDGE_SEGMENTS = 26; // 1辺の曲線を近似する点の数

  // 画像の縦横比に応じて、レベルの基本グリッドの行・列を入れ替える
  function computeGrid(level, aspect) {
    const cfg = LEVELS[level];
    let cols = cfg.cols, rows = cfg.rows;
    const gridIsLandscape = cols >= rows;
    const imageIsLandscape = aspect >= 1;
    if (gridIsLandscape !== imageIsLandscape) {
      const t = cols; cols = rows; rows = t;
    }
    return { cols, rows };
  }

  // 元画像を扱いやすい解像度に縮小してオフスクリーンcanvasへ描画
  function buildSourceCanvas(img) {
    const MAX_DIM = 900;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (Math.max(w, h) > MAX_DIM) {
      const s = MAX_DIM / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c;
  }

  // 1辺ぶんの曲線タブ形状を生成（局所座標：u=辺に沿った距離、v=辺に垂直な出っ張り量）
  function generateEdgeCurve(length, tabBase, sign) {
    const tabRatio = 0.18 + Math.random() * 0.08;
    const neckRatio = 0.035 + Math.random() * 0.02;
    const bulgeCenter = 0.46 + Math.random() * 0.08;
    const neck1 = bulgeCenter - 0.16 - Math.random() * 0.03;
    const neck2 = bulgeCenter + 0.16 + Math.random() * 0.03;
    const bulgeHeight = tabBase * tabRatio * sign;
    const neckDepth = tabBase * neckRatio * -sign;

    function bump(t, center, width, height) {
      const d = (t - center) / width;
      if (Math.abs(d) >= 1) return 0;
      return height * (0.5 * (1 + Math.cos(d * Math.PI)));
    }

    const pts = [];
    for (let i = 0; i <= EDGE_SEGMENTS; i++) {
      const t = i / EDGE_SEGMENTS;
      let v = bump(t, bulgeCenter, 0.24, bulgeHeight);
      v += bump(t, neck1, 0.09, neckDepth);
      v += bump(t, neck2, 0.09, neckDepth);
      pts.push({ u: t * length, v: v });
    }
    return pts;
  }

  // 全ての内部境界線（タブ形状）をあらかじめ生成し、隣接ピース同士で共有する
  function buildEdgeGrids(cols, rows, cellW, cellH) {
    const tabBase = Math.min(cellW, cellH);

    // hEdges[i][c]：行i と 行i+1 の間（列c）の境界。+1＝下向きに凸
    const hEdges = [];
    for (let i = 0; i < rows - 1; i++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const sign = Math.random() < 0.5 ? 1 : -1;
        const local = generateEdgeCurve(cellW, tabBase, sign);
        const y = (i + 1) * cellH;
        const x0 = c * cellW;
        row.push(local.map((p) => ({ x: x0 + p.u, y: y + p.v })));
      }
      hEdges.push(row);
    }

    // vEdges[r][j]：列j と 列j+1 の間（行r）の境界。+1＝右向きに凸
    const vEdges = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let j = 0; j < cols - 1; j++) {
        const sign = Math.random() < 0.5 ? 1 : -1;
        const local = generateEdgeCurve(cellH, tabBase, sign);
        const x = (j + 1) * cellW;
        const y0 = r * cellH;
        row.push(local.map((p) => ({ x: x + p.v, y: y0 + p.u })));
      }
      vEdges.push(row);
    }

    return { hEdges, vEdges };
  }

  // 1ピースぶんの輪郭（絶対座標・時計回りの閉ループ）を組み立てる
  function buildPiecePoints(r, c, cols, rows, cellW, cellH, hEdges, vEdges) {
    const topLeft = { x: c * cellW, y: r * cellH };
    const topRight = { x: (c + 1) * cellW, y: r * cellH };
    const bottomRight = { x: (c + 1) * cellW, y: (r + 1) * cellH };
    const bottomLeft = { x: c * cellW, y: (r + 1) * cellH };

    const points = [];

    // 上辺
    if (r === 0) points.push(topLeft, topRight);
    else points.push(...hEdges[r - 1][c]);

    // 右辺
    if (c === cols - 1) points.push(bottomRight);
    else points.push(...vEdges[r][c].slice(1));

    // 下辺（逆順）
    if (r === rows - 1) points.push(bottomLeft);
    else points.push(...hEdges[r][c].slice().reverse().slice(1));

    // 左辺（逆順・始点へ戻る）
    if (c > 0) points.push(...vEdges[r][c - 1].slice().reverse().slice(1));

    return points;
  }

  function computeBBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  // ピースの画像を切り出し、縁取りを付けたオフスクリーンcanvasを生成
  function renderPieceCanvas(points, bbox, sourceCanvas) {
    const w = Math.ceil(bbox.w) + PIECE_PAD * 2;
    const h = Math.ceil(bbox.h) + PIECE_PAD * 2;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const pctx = c.getContext("2d");

    function tracePath() {
      pctx.beginPath();
      points.forEach((p, i) => {
        const x = p.x - bbox.minX + PIECE_PAD;
        const y = p.y - bbox.minY + PIECE_PAD;
        if (i === 0) pctx.moveTo(x, y); else pctx.lineTo(x, y);
      });
      pctx.closePath();
    }

    pctx.save();
    tracePath();
    pctx.clip();
    pctx.drawImage(sourceCanvas, PIECE_PAD - bbox.minX, PIECE_PAD - bbox.minY);
    pctx.restore();

    // ふちどり（形をわかりやすくする）
    tracePath();
    pctx.lineWidth = 4;
    pctx.strokeStyle = "rgba(0,0,0,0.14)";
    pctx.stroke();
    tracePath();
    pctx.lineWidth = 1.4;
    pctx.strokeStyle = "rgba(255,255,255,0.9)";
    pctx.stroke();

    return c;
  }

  // 画像・レベルから、パズル全体のデータ（全ピース）を構築する
  function buildPuzzle(image, level) {
    const sourceCanvas = buildSourceCanvas(image);
    const srcW = sourceCanvas.width, srcH = sourceCanvas.height;
    const aspect = srcW / srcH;
    const { cols, rows } = computeGrid(level, aspect);
    const cellW = srcW / cols, cellH = srcH / rows;
    const { hEdges, vEdges } = buildEdgeGrids(cols, rows, cellW, cellH);

    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const points = buildPiecePoints(r, c, cols, rows, cellW, cellH, hEdges, vEdges);
        const bbox = computeBBox(points);
        const canvas = renderPieceCanvas(points, bbox, sourceCanvas);
        pieces.push({
          row: r, col: c,
          originX: bbox.minX - PIECE_PAD,
          originY: bbox.minY - PIECE_PAD,
          drawW: canvas.width,
          drawH: canvas.height,
          canvas,
          placed: false,
          homeFracX: Math.random(),
          homeFracY: Math.random(),
        });
      }
    }

    // 描画順（＝トレイでの重なり順）をシャッフル
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pieces[i]; pieces[i] = pieces[j]; pieces[j] = t;
    }

    return { cols, rows, srcW, srcH, sourceCanvas, pieces };
  }

  /* ============================================================
     11. ゲーム画面：レイアウト・描画・ドラッグ操作
     ============================================================ */

  let puzzle = null;         // 現在のパズルデータ
  let placedCount = 0;
  let draggingPiece = null;
  let dragOffsetX = 0, dragOffsetY = 0;
  let dragScreenX = 0, dragScreenY = 0;
  let rafId = null;
  let gameSessionId = 0; // 画像読み込み中の画面遷移による競合を防ぐためのガード

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

  function resizeGameCanvas() {
    const rect = el.gameCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.gameCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    el.gameCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderGame();
  }
  window.addEventListener("resize", resizeGameCanvas);
  window.addEventListener("orientationchange", () => setTimeout(resizeGameCanvas, 150));

  // 組み立てエリア／トレイエリアの寸法・拡大率を計算
  function getLayout() {
    const w = el.gameCanvas.clientWidth;
    const h = el.gameCanvas.clientHeight;
    const boardH = h * 0.62;
    const trayY = boardH;
    const trayH = h - boardH;
    let scale = 1, boardOffsetX = 0, boardOffsetY = 0;
    if (puzzle) {
      const margin = 16;
      const areaW = w - margin * 2;
      const areaH = boardH - margin * 2;
      scale = Math.min(areaW / puzzle.srcW, areaH / puzzle.srcH);
      boardOffsetX = margin + (areaW - puzzle.srcW * scale) / 2;
      boardOffsetY = margin + (areaH - puzzle.srcH * scale) / 2;
    }
    return { w, h, boardH, trayY, trayH, scale, boardOffsetX, boardOffsetY };
  }

  function drawPieceOnBoard(p, layout) {
    const x = layout.boardOffsetX + p.originX * layout.scale;
    const y = layout.boardOffsetY + p.originY * layout.scale;
    ctx.drawImage(p.canvas, x, y, p.drawW * layout.scale, p.drawH * layout.scale);
  }

  function drawPieceInTray(p, layout, trayRect) {
    const dw = p.drawW * layout.scale, dh = p.drawH * layout.scale;
    const availW = Math.max(1, trayRect.w - dw);
    const availH = Math.max(1, trayRect.h - dh);
    const x = trayRect.x + p.homeFracX * availW;
    const y = trayRect.y + p.homeFracY * availH;
    p._trayScreenX = x;
    p._trayScreenY = y;
    ctx.drawImage(p.canvas, x, y, dw, dh);
  }

  function renderGame() {
    const layout = getLayout();
    const w = layout.w, h = layout.h;
    ctx.clearRect(0, 0, w, h);

    // 組み立てエリア背景
    ctx.fillStyle = "#f7f2e6";
    ctx.fillRect(0, 0, w, layout.boardH);

    if (puzzle) {
      // 完成図ヒント（薄く表示）
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.drawImage(puzzle.sourceCanvas, layout.boardOffsetX, layout.boardOffsetY, puzzle.srcW * layout.scale, puzzle.srcH * layout.scale);
      ctx.restore();
      ctx.strokeStyle = "rgba(107,107,120,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(layout.boardOffsetX, layout.boardOffsetY, puzzle.srcW * layout.scale, puzzle.srcH * layout.scale);
    } else {
      ctx.fillStyle = "rgba(107,107,120,0.7)";
      ctx.font = "15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("パズルを準備しています…", w / 2, layout.boardH / 2);
      ctx.textAlign = "left";
    }

    // 区切り線
    ctx.strokeStyle = "#d8cfb8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, layout.boardH);
    ctx.lineTo(w, layout.boardH);
    ctx.stroke();

    // トレイエリア背景
    ctx.fillStyle = "#efe7d3";
    ctx.fillRect(0, layout.trayY, w, layout.trayH);

    if (!puzzle) return;

    const trayRect = { x: 10, y: layout.trayY + 10, w: Math.max(10, w - 20), h: Math.max(10, layout.trayH - 20) };

    puzzle.pieces.forEach((p) => { if (p.placed && p !== draggingPiece) drawPieceOnBoard(p, layout); });
    puzzle.pieces.forEach((p) => { if (!p.placed && p !== draggingPiece) drawPieceInTray(p, layout, trayRect); });

    if (draggingPiece) {
      const dw = draggingPiece.drawW * layout.scale, dh = draggingPiece.drawH * layout.scale;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 14;
      ctx.drawImage(draggingPiece.canvas, dragScreenX, dragScreenY, dw, dh);
      ctx.restore();
    }
  }

  function gameLoopTick() {
    renderGame();
    rafId = requestAnimationFrame(gameLoopTick);
  }
  function startGameLoop() { if (!rafId) rafId = requestAnimationFrame(gameLoopTick); }
  function stopGameLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  /* ---- ドラッグ操作 ---- */

  function getCanvasLocalPos(e) {
    const rect = el.gameCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ピース画像のうち透明でない部分をタップしたかどうかで当たり判定する
  function isPointOnPiece(p, localX, localY, scale) {
    const px = Math.floor(localX / scale);
    const py = Math.floor(localY / scale);
    if (px < 0 || py < 0 || px >= p.drawW || py >= p.drawH) return false;
    if (!p._pctx) p._pctx = p.canvas.getContext("2d");
    const data = p._pctx.getImageData(px, py, 1, 1).data;
    return data[3] > 10;
  }

  function findPieceAt(x, y, layout) {
    for (let i = puzzle.pieces.length - 1; i >= 0; i--) {
      const p = puzzle.pieces[i];
      if (p.placed) continue;
      if (p._trayScreenX === undefined) continue;
      if (isPointOnPiece(p, x - p._trayScreenX, y - p._trayScreenY, layout.scale)) return p;
    }
    return null;
  }

  el.gameCanvas.addEventListener("pointerdown", (e) => {
    if (!puzzle || state.isPaused || !state.isRunning) return;
    const pos = getCanvasLocalPos(e);
    const layout = getLayout();
    if (pos.y < layout.boardH) return; // 盤面上の配置済みピースは動かせない

    const piece = findPieceAt(pos.x, pos.y, layout);
    if (!piece) return;

    const idx = puzzle.pieces.indexOf(piece);
    puzzle.pieces.splice(idx, 1);
    puzzle.pieces.push(piece);

    draggingPiece = piece;
    dragOffsetX = pos.x - piece._trayScreenX;
    dragOffsetY = pos.y - piece._trayScreenY;
    dragScreenX = piece._trayScreenX;
    dragScreenY = piece._trayScreenY;
    try { el.gameCanvas.setPointerCapture(e.pointerId); } catch (err) {}
  });

  el.gameCanvas.addEventListener("pointermove", (e) => {
    if (!draggingPiece) return;
    const pos = getCanvasLocalPos(e);
    dragScreenX = pos.x - dragOffsetX;
    dragScreenY = pos.y - dragOffsetY;
  });

  function finishDrag() {
    if (!draggingPiece) return;
    const piece = draggingPiece;
    const layout = getLayout();

    const correctX = layout.boardOffsetX + piece.originX * layout.scale;
    const correctY = layout.boardOffsetY + piece.originY * layout.scale;
    const threshold = Math.min(puzzle.srcW / puzzle.cols, puzzle.srcH / puzzle.rows) * layout.scale * 0.32;

    const dx = dragScreenX - correctX;
    const dy = dragScreenY - correctY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    draggingPiece = null;

    if (dist <= threshold) {
      piece.placed = true;
      sound.snap();
      placedCount++;
      if (placedCount >= puzzle.pieces.length) {
        setTimeout(goToClear, 250);
      }
    } else {
      sound.miss();
      // 何もしなければ、次の描画で自動的にトレイの元の位置(homeFrac)に戻る
    }
  }

  el.gameCanvas.addEventListener("pointerup", finishDrag);
  el.gameCanvas.addEventListener("pointercancel", () => { draggingPiece = null; });

  /* ---- ゲーム開始 ---- */

  function startGame() {
    showScreen("game");
    const cfg = LEVELS[state.selectedLevel];
    el.gameLevelTag.textContent = `${cfg.label} (${cfg.pieces}ピース)`;
    sound.init();

    puzzle = null;
    placedCount = 0;
    draggingPiece = null;
    state.isRunning = false;

    const thisSession = ++gameSessionId;
    const thisLevel = state.selectedLevel;

    resizeGameCanvas();
    startGameLoop();

    loadImage(state.currentImage.src, (img) => {
      // 読み込み中に画面遷移・別ゲーム開始が起きていたら破棄する
      if (thisSession !== gameSessionId) return;
      puzzle = buildPuzzle(img, thisLevel);
      startTimer();
      state.isRunning = true;
    });
  }

  /* ============================================================
     10. クリア画面
     ============================================================ */

  function goToClear() {
    stopTimer();
    stopGameLoop();
    state.isRunning = false;
    sound.complete();

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
    gameSessionId++; // 読み込み中だった場合に備えてセッションを無効化
    stopTimer();
    stopGameLoop();
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
     13. 初期化
     ============================================================ */

  renderBestTimes();
  showScreen("title");
})();
