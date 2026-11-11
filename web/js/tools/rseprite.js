/* FrameForge · Rseprite 简化版（对齐 frameronin RoninPro·Rseprite）：
 * 多帧时间轴 · 多图层 · 调色板 · 铅笔/橡皮/吸管 · 洋葱皮 · 撤销重做 · 导出 PNG/GIF */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  var PALETTES = {
    "DB16": ["#000000","#222034","#45283c","#663931","#8f563b","#df7126","#d9a066","#eec39a","#fbf236","#99e550","#6abe30","#37946e","#257179","#5ab9f1","#5b6ee1","#d3b8ae"],
    "GB": ["#0f380f","#306230","#8bac0f","#9bbc0f"],
    "PICO8": ["#000000","#1D2B53","#7E2553","#008751","#AB5236","#5F574F","#C2C3C7","#FFF1E8","#FF004D","#FFA300","#FFEC27","#00E436","#29ADFF","#83769C","#FF77A8","#FFCCAA"],
    "NES": ["#000000","#fcfcfc","#f8f8f8","#bcbcbc","#7c7c7c","#a4e4fc","#3cbcfc","#0078f8","#0000fc","#b8b8f8","#6888fc","#0058f8","#0000bc","#d8b8f8","#9878f8","#6844fc"]
  };

  FF.Tools.rseprite = function () {
    var W = 32, H = 32;
    var doc = { frames: [], layers: [], curFrame: 0, curLayer: 0, delay: 100 };
    var undoStack = [], redoStack = [];
    var tool = "pencil";       // pencil | eraser | picker | fill
    var fg = "#df7126", bg = "#222034";
    var brush = 1;
    var onion = false;
    var zoom = 12;

    function newCel() { return new Uint8ClampedArray(W * H * 4); }
    function hex2rgba(hex) {
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
    }
    function addFrame(copyFrom) {
      var f = { cels: doc.layers.map(function (_, li) {
        return copyFrom && doc.frames[doc.curFrame] && doc.frames[doc.curFrame].cels[li]
          ? new Uint8ClampedArray(doc.frames[doc.curFrame].cels[li]) : newCel();
      }), delay: doc.delay };
      doc.frames.splice(doc.curFrame + 1, 0, f);
      doc.curFrame++;
      clearHistory();
    }
    function delFrame() {
      if (doc.frames.length <= 1) return;
      doc.frames.splice(doc.curFrame, 1);
      doc.curFrame = Math.min(doc.curFrame, doc.frames.length - 1);
      clearHistory();
    }
    function addLayer() {
      doc.layers.push({ name: "图层 " + (doc.layers.length + 1), visible: true });
      doc.frames.forEach(function (f) { f.cels.push(newCel()); });
      doc.curLayer = doc.layers.length - 1;
    }
    doc.layers = [{ name: "图层 1", visible: true }];
    doc.frames = [{ cels: [newCel()], delay: 100 }];
    addLayer(); // 默认 2 层
    doc.curLayer = 0;

    /* ---------- 画布 ---------- */
    var cv = UI.makeCanvas(W * zoom, H * zoom);
    cv.style.imageRendering = "pixelated";
    cv.style.background = "repeating-conic-gradient(#c9bfb0 0% 25%, #e4dbcf 0% 50%) 50% / 16px 16px";
    var ctx = cv.getContext("2d");

    function compositeFrame(fi, opts) {
      opts = opts || {};
      var im = new ImageData(W, H);
      for (var li = 0; li < doc.layers.length; li++) {
        var layer = doc.layers[li];
        if (!layer.visible) continue;
        if (opts.skipLayer === li) continue;
        var cel = doc.frames[fi].cels[li];
        for (var i = 0; i < cel.length; i += 4) {
          if (cel[i + 3] === 0) continue;
          im.data[i] = cel[i]; im.data[i + 1] = cel[i + 1]; im.data[i + 2] = cel[i + 2]; im.data[i + 3] = cel[i + 3];
        }
      }
      return im;
    }
    function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      // 洋葱皮
      if (onion) {
        if (doc.curFrame > 0) {
          var prev = compositeFrame(doc.curFrame - 1);
          tintDraw(prev, "rgba(255,0,0,0.35)");
        }
        if (doc.curFrame < doc.frames.length - 1) {
          var next = compositeFrame(doc.curFrame + 1);
          tintDraw(next, "rgba(0,80,255,0.35)");
        }
      }
      var cur = compositeFrame(doc.curFrame);
      // 缓存画布放大绘制
      var tmp = UI.makeCanvas(W, H);
      tmp.getContext("2d").putImageData(cur, 0, 0);
      ctx.drawImage(tmp, 0, 0, W * zoom, H * zoom);
      renderTimeline(); renderLayers();
    }
    function tintDraw(im, color) {
      var tmp = UI.makeCanvas(W, H);
      var tc = tmp.getContext("2d");
      tc.putImageData(im, 0, 0);
      tc.globalCompositeOperation = "source-in";
      tc.fillStyle = color;
      tc.fillRect(0, 0, W, H);
      ctx.drawImage(tmp, 0, 0, W * zoom, H * zoom);
    }

    /* ---------- 绘制 ---------- */
    var drawing = false, lastPt = null;
    function toCell(e) {
      var r = cv.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left) / (r.width / W)), y: Math.floor((e.clientY - r.top) / (r.height / H)) };
    }
    function paintLine(x0, y0, x1, y1) {
      // Bresenham
      var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
      while (true) {
        paint(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        var e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }
    function paint(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      var cel = doc.frames[doc.curFrame].cels[doc.curLayer];
      var rgba = hex2rgba(tool === "eraser" ? "#000000" : (lastPt ? fg : fg));
      for (var dy2 = 0; dy2 < brush; dy2++) {
        for (var dx2 = 0; dx2 < brush; dx2++) {
          var px = x + dx2, py = y + dy2;
          if (px >= W || py >= H) continue;
          var i = (py * W + px) * 4;
          if (tool === "eraser") cel[i + 3] = 0;
          else { cel[i] = rgba[0]; cel[i + 1] = rgba[1]; cel[i + 2] = rgba[2]; cel[i + 3] = 255; }
        }
      }
    }
    function snapshot() {
      undoStack.push(doc.frames.map(function (f) { return f.cels.map(function (c) { return new Uint8ClampedArray(c); }); }));
      if (undoStack.length > 50) undoStack.shift();
      redoStack.length = 0;
    }
    function clearHistory() { undoStack.length = 0; redoStack.length = 0; }
    function undo() {
      if (!undoStack.length) return;
      redoStack.push(doc.frames.map(function (f) { return f.cels.map(function (c) { return new Uint8ClampedArray(c); }); }));
      var s = undoStack.pop();
      s.forEach(function (cels, fi) { if (doc.frames[fi]) doc.frames[fi].cels = cels; });
      draw();
    }
    function redo() {
      if (!redoStack.length) return;
      undoStack.push(doc.frames.map(function (f) { return f.cels.map(function (c) { return new Uint8ClampedArray(c); }); }));
      var s = redoStack.pop();
      s.forEach(function (cels, fi) { if (doc.frames[fi]) doc.frames[fi].cels = cels; });
      draw();
    }

    cv.addEventListener("pointerdown", function (e) {
      var p = toCell(e);
      if (tool === "picker") {
        var cel = compositeFrame(doc.curFrame);
        var i = (p.y * W + p.x) * 4;
        if (cel.data[i + 3] > 0) {
          fg = "#" + [cel.data[i], cel.data[i + 1], cel.data[i + 2]].map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
          fgInput.value = fg;
        }
        return;
      }
      if (tool === "fill") {
        snapshot();
        floodFill(p.x, p.y);
        draw();
        return;
      }
      snapshot();
      drawing = true;
      lastPt = p;
      paint(p.x, p.y);
      draw();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      var p = toCell(e);
      paintLine(lastPt.x, lastPt.y, p.x, p.y);
      lastPt = p;
      draw();
    });
    window.addEventListener("pointerup", function () { drawing = false; lastPt = null; });
    function floodFill(x, y) {
      var cel = doc.frames[doc.curFrame].cels[doc.curLayer];
      var i0 = (y * W + x) * 4;
      var target = [cel[i0], cel[i0 + 1], cel[i0 + 2], cel[i0 + 3]];
      var rgba = hex2rgba(fg);
      if (target[0] === rgba[0] && target[1] === rgba[1] && target[2] === rgba[2] && target[3] === rgba[3]) return;
      var q = [[x, y]];
      while (q.length) {
        var p = q.pop();
        if (p[0] < 0 || p[1] < 0 || p[0] >= W || p[1] >= H) continue;
        var i = (p[1] * W + p[0]) * 4;
        if (cel[i] !== target[0] || cel[i + 1] !== target[1] || cel[i + 2] !== target[2] || cel[i + 3] !== target[3]) continue;
        cel[i] = rgba[0]; cel[i + 1] = rgba[1]; cel[i + 2] = rgba[2]; cel[i + 3] = rgba[3];
        q.push([p[0] - 1, p[1]], [p[0] + 1, p[1]], [p[0], p[1] - 1], [p[0], p[1] + 1]);
      }
    }

    /* ---------- 工具栏 ---------- */
    var fgInput = UI.el("input", { type: "color", value: fg });
    fgInput.addEventListener("input", function () { fg = fgInput.value; });
    var toolRow = UI.el("div", { class: "row", style: { gap: "4px", flexWrap: "wrap" } }, [
      UI.btn(t("rs.pencil"), "btn-outline btn-sm", function () { tool = "pencil"; markTool(); }),
      UI.btn(t("rs.eraser"), "btn-outline btn-sm", function () { tool = "eraser"; markTool(); }),
      UI.btn(t("rs.fill"), "btn-outline btn-sm", function () { tool = "fill"; markTool(); }),
      UI.btn(t("rs.picker"), "btn-outline btn-sm", function () { tool = "picker"; markTool(); })
    ]);
    function markTool() {
      toolRow.querySelectorAll(".btn").forEach(function (b) { b.classList.remove("btn-primary"); b.classList.add("btn-outline"); });
      var idx = { pencil: 0, eraser: 1, fill: 2, picker: 3 }[tool];
      toolRow.querySelectorAll(".btn")[idx].classList.replace("btn-outline", "btn-primary");
    }
    var brushSel = UI.slider(t("rs.brush"), 1, 6, 1, { onInput: function (v) { brush = v; } });
    var onionSw = UI.switchRow(t("rs.onion"), false, function (v) { onion = v; draw(); });
    var undoBtn = UI.btn(t("rs.undo"), "btn-ghost btn-sm", undo);
    var redoBtn = UI.btn(t("rs.redo"), "btn-ghost btn-sm", redo);

    /* 调色板 */
    var palSel = UI.selectRow("调色板", Object.keys(PALETTES).map(function (k) { return { v: k, label: k }; }), "DB16", {
      onChange: function () { renderPal(); }
    });
    var palRow = UI.el("div", { class: "rs-palette" });
    function renderPal() {
      palRow.innerHTML = "";
      PALETTES[palSel.value].forEach(function (c) {
        var sw = UI.el("button", { class: "rs-swatch", title: c });
        sw.style.background = c;
        sw.addEventListener("click", function (e) {
          if (e.shiftKey) { bg = c; bgDot.style.background = c; }
          else { fg = c; fgInput.value = c; }
        });
        palRow.appendChild(sw);
      });
    }
    var bgDot = UI.el("span", { class: "rs-bgdot", title: t("rs.bg") });
    bgDot.style.background = bg;
    renderPal();

    /* ---------- 时间轴 ---------- */
    var timeline = UI.el("div", { class: "rs-timeline" });
    function renderTimeline() {
      timeline.innerHTML = "";
      doc.frames.forEach(function (f, fi) {
        var th = UI.el("div", { class: "rs-thumb" + (fi === doc.curFrame ? " on" : "") });
        var c = UI.makeCanvas(48, 48);
        c.style.imageRendering = "pixelated";
        var im = compositeFrame(fi);
        c.getContext("2d").putImageData(im, 0, 0);
        c.style.width = "40px"; c.style.height = "40px";
        th.appendChild(c);
        th.appendChild(UI.el("div", { class: "rs-t-idx" }, [String(fi + 1)]));
        th.addEventListener("click", function () { doc.curFrame = fi; draw(); });
        timeline.appendChild(th);
      });
      var addB = UI.el("button", { class: "rs-thumb add", title: t("rs.frame.add") }, ["+"]);
      addB.addEventListener("click", function () { addFrame(true); draw(); });
      timeline.appendChild(addB);
    }
    var frameOps = UI.el("div", { class: "row", style: { gap: "4px", flexWrap: "wrap" } }, [
      UI.btn(t("rs.frame.dup"), "btn-ghost btn-sm", function () { addFrame(true); draw(); }),
      UI.btn(t("rs.frame.del"), "btn-ghost btn-sm", function () { delFrame(); draw(); }),
      (function () {
        var wrap = UI.el("label", { class: "param-row", style: { width: "auto" } }, [
          UI.el("span", {}, [t("rs.delay")])
        ]);
        var dIn = UI.el("input", { type: "number", value: String(doc.delay), style: { width: "64px" } });
        dIn.addEventListener("change", function () {
          doc.delay = Math.max(20, +dIn.value | 0);
          doc.frames[doc.curFrame].delay = doc.delay;
        });
        wrap.appendChild(dIn);
        return wrap;
      })()
    ]);

    /* ---------- 图层面板 ---------- */
    var layerPanel = UI.el("div", { class: "rs-layers" });
    function renderLayers() {
      layerPanel.innerHTML = "";
      doc.layers.forEach(function (l, li) {
        var row = UI.el("div", { class: "rs-layer" + (li === doc.curLayer ? " on" : "") }, [
          UI.el("button", { class: "rs-lvis" }, [l.visible ? "👁" : "—"]),
          UI.el("span", { class: "rs-lname" }, [l.name])
        ]);
        row.querySelector(".rs-lvis").addEventListener("click", function (e) {
          e.stopPropagation(); l.visible = !l.visible; draw();
        });
        row.addEventListener("click", function () { doc.curLayer = li; draw(); });
        layerPanel.appendChild(row);
      });
      var addB = UI.btn("+ " + t("rs.layer.add"), "btn-ghost btn-xs", function () { addLayer(); draw(); });
      layerPanel.appendChild(addB);
    }

    /* ---------- 播放 & 导出 ---------- */
    var playing = false, playTimer = null;
    var playBtn = UI.btn(t("common.play"), "btn-outline btn-sm", function () {
      playing = !playing;
      playBtn.querySelector("span").textContent = playing ? t("common.pause") : t("common.play");
      if (playing) {
        var fi = 0;
        playTimer = setInterval(function () {
          doc.curFrame = fi = (fi + 1) % doc.frames.length;
          draw();
        }, doc.delay);
      } else clearInterval(playTimer);
    });
    var sizeRow = UI.el("div", { class: "row", style: { gap: "6px", alignItems: "center" } }, [
      UI.el("span", { class: "hint-text" }, [t("rs.size")]),
      (function () { var i = UI.el("input", { type: "number", value: String(W), min: "8", max: "128", style: { width: "64px" } });
        i.addEventListener("change", function () { resizeDoc(Math.max(8, Math.min(128, +i.value | 0)), H); }); return i; })(),
      UI.el("span", {}, ["×"]),
      (function () { var i = UI.el("input", { type: "number", value: String(H), min: "8", max: "128", style: { width: "64px" } });
        i.addEventListener("change", function () { resizeDoc(W, Math.max(8, Math.min(128, +i.value | 0))); }); return i; })()
    ]);
    function resizeDoc(nw, nh) {
      snapshot();
      doc.frames.forEach(function (f) {
        f.cels = f.cels.map(function (cel) {
          var nc = new Uint8ClampedArray(nw * nh * 4);
          for (var y = 0; y < Math.min(H, nh); y++) {
            for (var x = 0; x < Math.min(W, nw); x++) {
              var si = (y * W + x) * 4, di = (y * nw + x) * 4;
              nc[di] = cel[si]; nc[di + 1] = cel[si + 1]; nc[di + 2] = cel[si + 2]; nc[di + 3] = cel[si + 3];
            }
          }
          return nc;
        });
      });
      W = nw; H = nh;
      cv.width = W * zoom; cv.height = H * zoom;
      draw();
    }
    function exportSheet(scale) {
      var cols = doc.frames.length, rows = 1;
      var out = UI.makeCanvas(cols * W * scale, rows * H * scale);
      var octx = out.getContext("2d");
      doc.frames.forEach(function (f, fi) {
        var im = compositeFrame(fi);
        var tmp = UI.makeCanvas(W, H);
        tmp.getContext("2d").putImageData(im, 0, 0);
        octx.drawImage(tmp, fi * W * scale, 0, W * scale, H * scale);
      });
      UI.downloadCanvas(out, "rseprite_sheet.png");
    }
    function exportGif() {
      var frames = doc.frames.map(function (f, fi) {
        var im = compositeFrame(fi);
        return { w: W, h: H, delay: f.delay || doc.delay, data: new Uint8Array(im.data.buffer) };
      });
      FF.Wasm.gifEncode(frames, W, H, { delays: frames.map(function (f) { return f.delay; }), defaultDelay: doc.delay, repeat: 0 })
        .then(function (out) { UI.download(new Blob([out], { type: "image/gif" }), "rseprite.gif"); })
        .catch(function (e) { FF.Toast.show(String(e.message || e), "err"); });
    }

    var exportRow = UI.el("div", { class: "btn-row mt8" }, [
      UI.btn(t("rs.exportSheet"), "btn-primary", function () { exportSheet(4); }),
      UI.btn(t("rs.exportGif"), "btn-outline", function () { exportGif(); }),
      playBtn
    ]);

    /* ---------- 组装 ---------- */
    var back = UI.el("button", { class: "page-back" }, [UI.icon("back"), UI.el("span", {}, [t("common.backhome")])]);
    back.addEventListener("click", function () { location.hash = "#/"; });

    var left = UI.el("div", { class: "rs-left" }, [
      toolRow, brushSel.el, onionSw.el,
      UI.el("div", { class: "row mt8", style: { gap: "6px", alignItems: "center" } }, [fgInput, bgDot]),
      palSel.el, palRow,
      UI.el("div", { class: "mt8" }, [undoBtn, redoBtn])
    ]);
    var center = UI.el("div", { class: "rs-center" }, [
      UI.el("div", { class: "rs-canvas-wrap" }, [cv]),
      frameOps, timeline, exportRow
    ]);
    var right = UI.el("div", { class: "rs-right" }, [
      UI.el("div", { class: "pb-title" }, [t("rs.layers")]),
      layerPanel,
      UI.el("div", { class: "pb-title mt8" }, [t("rs.size")]),
      sizeRow
    ]);
    var layout = UI.el("div", { class: "rs-layout" }, [left, center, right]);
    var root = UI.el("div", {}, [back, layout]);
    draw();

    var view = {
      root: root,
      cleanup: function () { if (playTimer) clearInterval(playTimer); }
    };
    return view;
  };
})();
