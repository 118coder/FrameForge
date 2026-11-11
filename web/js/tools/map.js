/* FrameForge · 地图拼接 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.map = function () {
    var sk = UI.pageSkeleton("mod.map.t", "mod.map.d", null);
    var root = sk.root, card = sk.card;

    var BOARD = 4096;
    var tiles = []; // {canvas, x, y, w, h}
    var scale = 0.25, panX = 0, panY = 0;
    var snapOn = true, gridSize = 64;
    var spaceDown = false;

    /* ---------- 画板 ---------- */
    var view = UI.el("div", {
      class: "canvas-frame",
      style: { height: "560px", cursor: "grab", overflow: "hidden", display: "block" }
    });
    var canvas = UI.makeCanvas(1200, 800);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxHeight = "none";
    view.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var dz = UI.dropzone({
      accept: "image/*",
      multiple: true,
      main: t("map.drop"),
      hint: t("map.hint")
    });

    /* ---------- 控件 ---------- */
    var snapSw = UI.switchRow(t("map.snap"), true, function (v) { snapOn = v; });
    var gridIn = UI.el("input", { type: "number", value: "64", min: "4", max: "512", step: "4", style: { width: "80px" } });
    gridIn.addEventListener("change", function () { gridSize = Math.max(4, Number(gridIn.value) || 64); draw(); });
    var zoomLabel = UI.el("span", { class: "tag-chip" }, ["100%"]);
    var zoomIn = UI.btn("+", "btn-ghost btn-sm", function () { setZoom(scale * 1.25, canvas.width / 2, canvas.height / 2); });
    var zoomOut = UI.btn("−", "btn-ghost btn-sm", function () { setZoom(scale / 1.25, canvas.width / 2, canvas.height / 2); });
    var zoomFit = UI.btn("Fit", "btn-ghost btn-sm", fitView);
    var bgSw = UI.switchRow(t("map.transparent"), true, function () { draw(); });
    var trimSw = UI.switchRow(t("map.trim"), true, function () {});
    var clearBtn = UI.btn(t("map.clear"), "btn-ghost btn-sm", function () {
      tiles = [];
      draw();
    });
    var exportBtn = UI.btn(t("map.export"), "btn-primary", exportImage, "download");
    var counter = UI.el("span", { class: "tag-chip" }, ["0 tiles"]);

    function setZoom(s, cx, cy) {
      s = Math.min(4, Math.max(0.05, s));
      // 以 (cx,cy) 为中心缩放（屏幕坐标）
      var wx = (cx - panX) / scale, wy = (cy - panY) / scale;
      scale = s;
      panX = cx - wx * scale;
      panY = cy - wy * scale;
      draw();
    }

    function fitView() {
      if (!tiles.length) { scale = 0.25; panX = 40; panY = 40; draw(); return; }
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      tiles.forEach(function (tl) {
        minX = Math.min(minX, tl.x); minY = Math.min(minY, tl.y);
        maxX = Math.max(maxX, tl.x + tl.w); maxY = Math.max(maxY, tl.y + tl.h);
      });
      var w = maxX - minX, h = maxY - minY;
      scale = Math.min(2, Math.min(canvas.width / (w + 160), canvas.height / (h + 160)));
      panX = canvas.width / 2 - (minX + w / 2) * scale;
      panY = canvas.height / 2 - (minY + h / 2) * scale;
      draw();
    }

    /* ---------- 添加图块 ---------- */

    function addTiles(files) {
      var jobs = Array.from(files).map(function (f) { return UI.fileToImage(f); });
      Promise.all(jobs).then(function (rs) {
        var off = 0;
        rs.forEach(function (r) {
          var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
          c.getContext("2d").drawImage(r.img, 0, 0);
          // 放到当前视口中心，网格吸附
          var cx = (canvas.width / 2 - panX) / scale - c.width / 2;
          var cy = (canvas.height / 2 - panY) / scale - c.height / 2;
          var x = Math.round(cx / gridSize) * gridSize + off;
          var y = Math.round(cy / gridSize) * gridSize + off;
          tiles.push({ canvas: c, x: x, y: y, w: c.width, h: c.height });
          off += gridSize;
          r.release();
        });
        draw();
      });
    }

    dz.addEventListener("drop", function (e) {
      // dropzone 已处理，这里接管多图
    });
    // 让整个画板也接受拖放
    view.addEventListener("dragover", function (e) { e.preventDefault(); });
    view.addEventListener("drop", function (e) {
      e.preventDefault();
      if (e.dataTransfer.files.length) addTiles(e.dataTransfer.files);
    });

    /* ---------- 交互：拖动图块 / 平移 / 缩放 ---------- */

    var dragging = null;   // {tile, dx, dy}
    var panning = null;    // {x, y, panX, panY}

    function screenToWorld(sx, sy) {
      var r = canvas.getBoundingClientRect();
      var px = (sx - r.left) / r.width * canvas.width;
      var py = (sy - r.top) / r.height * canvas.height;
      return { x: (px - panX) / scale, y: (py - panY) / scale, px: px, py: py };
    }

    canvas.addEventListener("pointerdown", function (e) {
      var w = screenToWorld(e.clientX, e.clientY);
      if (spaceDown || e.button === 1) {
        panning = { px: e.clientX, py: e.clientY, panX: panX, panY: panY };
        canvas.style.cursor = "grabbing";
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      // 命中图块（自顶向下）
      for (var i = tiles.length - 1; i >= 0; i--) {
        var tl = tiles[i];
        if (w.x >= tl.x && w.x < tl.x + tl.w && w.y >= tl.y && w.y < tl.y + tl.h) {
          dragging = { tile: tl, dx: w.x - tl.x, dy: w.y - tl.y };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
      // 空白处拖动 = 平移
      panning = { px: e.clientX, py: e.clientY, panX: panX, panY: panY };
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", function (e) {
      if (dragging) {
        var w = screenToWorld(e.clientX, e.clientY);
        var nx = w.x - dragging.dx;
        var ny = w.y - dragging.dy;
        if (snapOn) {
          nx = Math.round(nx / gridSize) * gridSize;
          ny = Math.round(ny / gridSize) * gridSize;
        }
        dragging.tile.x = Math.round(nx);
        dragging.tile.y = Math.round(ny);
        draw();
      } else if (panning) {
        panX = panning.panX + (e.clientX - panning.px);
        panY = panning.panY + (e.clientY - panning.py);
        draw();
      }
    });

    canvas.addEventListener("pointerup", function () {
      dragging = null; panning = null;
      canvas.style.cursor = "grab";
    });

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = canvas.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width * canvas.width;
      var py = (e.clientY - r.top) / r.height * canvas.height;
      setZoom(scale * (e.deltaY < 0 ? 1.12 : 0.89), px, py);
    }, { passive: false });

    window.addEventListener("keydown", function (e) {
      if (e.code === "Space") spaceDown = true;
    });
    window.addEventListener("keyup", function (e) {
      if (e.code === "Space") spaceDown = false;
    });

    /* ---------- 渲染 ---------- */

    function draw() {
      var r = canvas.getBoundingClientRect();
      if (r.width > 1 && (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height))) {
        canvas.width = Math.round(r.width);
        canvas.height = Math.round(r.height);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!bgSw.value) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card-bg2") || "#eee";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // 网格
      if (snapOn) {
        ctx.strokeStyle = "rgba(128,110,80,0.18)";
        ctx.lineWidth = 1;
        var g = gridSize * scale;
        if (g > 6) {
          var startX = panX % g, startY = panY % g;
          ctx.beginPath();
          for (var x = startX; x < canvas.width; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
          for (var y = startY; y < canvas.height; y += g) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
          ctx.stroke();
        }
      }
      ctx.imageSmoothingEnabled = scale < 1;
      tiles.forEach(function (tl) {
        ctx.drawImage(tl.canvas, tl.x * scale + panX, tl.y * scale + panY, tl.w * scale, tl.h * scale);
      });
      // 拖拽中的图块高亮
      if (dragging) {
        var d = dragging.tile;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#b64a2e";
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x * scale + panX, d.y * scale + panY, d.w * scale, d.h * scale);
      }
      zoomLabel.textContent = Math.round(scale * 100) + "%";
      counter.textContent = tiles.length + " tiles";
    }

    var ro = new ResizeObserver(function () { draw(); });
    ro.observe(canvas);

    /* ---------- 导出 ---------- */

    async function exportImage() {
      if (!tiles.length) return;
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      if (trimSw.value) {
        tiles.forEach(function (tl) {
          minX = Math.min(minX, tl.x); minY = Math.min(minY, tl.y);
          maxX = Math.max(maxX, tl.x + tl.w); maxY = Math.max(maxY, tl.y + tl.h);
        });
      } else {
        minX = 0; minY = 0; maxX = BOARD; maxY = BOARD;
      }
      var w = Math.min(BOARD, maxX - minX);
      var h = Math.min(BOARD, maxY - minY);
      var out = UI.makeCanvas(w, h);
      var c = out.getContext("2d");
      if (!bgSw.value) {
        c.fillStyle = "#ffffff";
        c.fillRect(0, 0, w, h);
      }
      tiles.forEach(function (tl) {
        c.drawImage(tl.canvas, tl.x - minX, tl.y - minY);
      });
      UI.downloadCanvas(out, "map_stitched.png");
    }

    /* ---------- 布局 ---------- */

    var layout = UI.el("div", {}, [
      dz,
      UI.el("div", { class: "param-grid mt14" }, [
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("map.snap")]), snapSw.el]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("map.grid")]), gridIn]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("map.bg")]), bgSw.el]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("map.trim")]), trimSw.el])
      ]),
      UI.el("div", { class: "row mt14", style: { gap: "6px" } }, [
        zoomOut, zoomLabel, zoomIn, zoomFit, clearBtn, exportBtn, counter
      ]),
      UI.el("div", { class: "mt14" }, [view]),
      UI.el("div", { class: "hint-text mt8" }, [t("map.hint")])
    ]);

    card.appendChild(layout);
    requestAnimationFrame(function () { fitView(); });

    return {
      root: root,
      cleanup: function () { ro.disconnect(); }
    };
  };
})();
