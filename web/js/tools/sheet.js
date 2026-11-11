/* FrameForge · Sprite Sheet 拆分 / 合成 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.sheet = function (query) {
    query = query || {};
    var sk = UI.pageSkeleton("mod.sheet.t", "mod.sheet.d", null);
    var root = sk.root, card = sk.card;

    /* ---------------- Tabs ---------------- */

    var tabs = UI.el("div", { class: "row mb14" }, []);
    var tabSplit = UI.btn(t("sheet.tab.split"), "btn-outline", function () { show(0); });
    var tabBuild = UI.btn(t("sheet.tab.build"), "btn-outline", function () { show(1); });
    tabs.appendChild(tabSplit);
    tabs.appendChild(tabBuild);

    var panes = [UI.el("div", {}), UI.el("div", {})];
    function show(n) {
      tabSplit.className = "btn " + (n === 0 ? "btn-primary" : "btn-outline");
      tabBuild.className = "btn " + (n === 1 ? "btn-primary" : "btn-outline");
      panes[0].style.display = n === 0 ? "" : "none";
      panes[1].style.display = n === 1 ? "" : "none";
    }

    /* ============================================================
     * Pane 1: 拆分
     * ============================================================ */

    var s1 = UI.el("div", {});
    var s2 = UI.el("div", { style: { display: "none" } });
    panes[0].appendChild(s1);
    panes[0].appendChild(s2);

    var sheetImg = null;      // 原始 ImageData
    var frames = [];          // {w,h,delay,data}
    var strip = null;
    var animState = { playing: false, idx: 0, timer: null };

    var dzSplit = UI.dropzone({
      accept: "image/*",
      main: t("sheet.s1"),
      hint: t("chroma.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          sheetImg = UI.imageDataFrom(r.img, 4096);
          r.release();
          s2.style.display = "";
          autoGuess();
        }).catch(function (e) { UI.modal("Error", UI.el("p", {}, [String(e.message || e)])); });
      }
    });

    var modeSel = UI.selectRow(t("sheet.mode"), [
      { v: "grid", label: t("sheet.mode.grid") },
      { v: "cell", label: t("sheet.mode.cell") }
    ], "grid", { onChange: gridType });

    var colsIn = UI.el("input", { type: "number", value: "4", min: "1", max: "64", style: { width: "90px" } });
    var rowsIn = UI.el("input", { type: "number", value: "4", min: "1", max: "64", style: { width: "90px" } });
    var cwIn = UI.el("input", { type: "number", value: "64", min: "1", style: { width: "90px" } });
    var chIn = UI.el("input", { type: "number", value: "64", min: "1", style: { width: "90px" } });

    var gridFields = UI.el("div", { class: "row" }, [colsIn, UI.el("span", { class: "hint-text" }, ["× " + t("sheet.rows")]), rowsIn]);
    var cellFields = UI.el("div", { class: "row" }, [cwIn, UI.el("span", { class: "hint-text" }, ["× " + t("sheet.ch")]), chIn]);

    function gridType() {
      var isGrid = modeSel.value === "grid";
      gridFields.style.display = isGrid ? "" : "none";
      cellFields.style.display = isGrid ? "none" : "";
    }

    var skipSw = UI.switchRow(t("sheet.skip"), true, function () {});
    var splitBtn = UI.btn(t("sheet.splitgo"), "btn-primary", doSplit);
    var info = UI.el("div", { class: "hint-text mt8" }, []);

    function autoGuess() {
      // 常见 4x4 / 3x4 / 按最长边整除猜测
      var w = sheetImg.width, h = sheetImg.height;
      var cand = [2, 3, 4, 5, 6, 8];
      var bestC = 4, bestR = 4, bestScore = -1;
      cand.forEach(function (c) {
        cand.forEach(function (r) {
          if (w % c || h % r) return;
          var cell = w / c;
          if (Math.abs(h / r - cell) / cell > 0.35) return;
          var score = (w / c === h / r ? 2 : 1) * c * r;
          if (score > bestScore) { bestScore = score; bestC = c; bestR = r; }
        });
      });
      colsIn.value = bestC; rowsIn.value = bestR;
      cwIn.value = Math.round(w / bestC); chIn.value = Math.round(h / bestR);
      info.textContent = "Sheet " + w + "×" + h;
      gridType();
    }

    function doSplit() {
      var cw, ch;
      if (modeSel.value === "grid") {
        cw = Math.floor(sheetImg.width / Number(colsIn.value));
        ch = Math.floor(sheetImg.height / Number(rowsIn.value));
      } else {
        cw = Number(cwIn.value); ch = Number(chIn.value);
      }
      if (!cw || !ch) return;
      splitBtn.disabled = true;
      FF.Wasm.sheetSplit(sheetImg, cw, ch, skipSw.value).then(function (res) {
        frames = res.frames;
        frames.forEach(function (f) { f.delay = 80; });
        info.textContent = "Sheet " + sheetImg.width + "×" + sheetImg.height + " → " + frames.length + " " + t("video.frames");
        renderFrames();
        splitBtn.disabled = false;
      }).catch(function (e) {
        splitBtn.disabled = false;
        UI.modal("Error", UI.el("p", {}, [String(e.message || e)]));
      });
    }

    var stripWrap = UI.el("div", { class: "mt14" });
    var animBox = UI.el("div", { class: "row mt14", style: { alignItems: "flex-start" } }, []);
    var animCanvas = UI.makeCanvas(1, 1);
    var animFrame = UI.canvasFrame(animCanvas, "preview");
    var animCtrl = UI.el("div", { class: "" }, []);
    var playBtn = UI.btn(t("sheet.preview"), "btn-ghost", togglePlay, "play");
    var animDelay = UI.el("input", { type: "number", value: "80", min: "20", step: "10", style: { width: "90px" } });
    animCtrl.appendChild(playBtn);
    animCtrl.appendChild(UI.el("div", { class: "param-row mt8" }, [UI.el("label", {}, [t("video.delay")]), animDelay]));
    animCtrl.appendChild(UI.el("div", { class: "hint-text mt8" }, [t("sheet.framesel")]));
    animBox.appendChild(animFrame);
    animBox.appendChild(animCtrl);

    var exportRow = UI.el("div", { class: "btn-row mt14" }, []);
    var zipBtn = UI.btn(t("video.zip"), "btn-ghost", exportZip, "download");
    var gifBtn = UI.btn(t("video.mkgif"), "btn-primary", exportGif, "download");
    exportRow.appendChild(zipBtn);
    exportRow.appendChild(gifBtn);
    var gifBg = UI.el("input", { type: "color", value: "#000000" });
    exportRow.appendChild(UI.el("span", { class: "row" }, [UI.el("span", { class: "hint-text" }, [t("video.bg")]), gifBg]));

    function renderFrames() {
      stripWrap.innerHTML = "";
      var canvases = frames.map(function (f) {
        return UI.imageDataToCanvas(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h));
      });
      strip = UI.filmstrip(canvases, {
        selectable: true,
        delayEditable: true,
        onDelay: function (i, ms) { frames[i].delay = ms; animDelay.value = ms; }
      });
      stripWrap.appendChild(strip.el);
      var fw = frames.length ? frames[0].w : 1;
      var fh = frames.length ? frames[0].h : 1;
      var scale = Math.min(2, Math.max(1, Math.floor(160 / Math.max(1, Math.max(fw, fh))))) || 1;
      animCanvas.width = fw; animCanvas.height = fh;
      animCanvas.style.width = (fw * Math.max(1, Math.min(3, Math.floor(240 / fw)))) + "px";
      animCanvas.style.imageRendering = "pixelated";
      drawFrame(0);
      s2.appendChild(stripWrap);
      s2.appendChild(animBox);
      s2.appendChild(exportRow);
    }

    function selectedFrames() {
      if (!strip) return frames;
      var sel = strip.selected;
      var out = frames.filter(function (_, i) { return sel[i]; });
      return out.length ? out : frames;
    }

    function drawFrame(idx) {
      if (!frames.length) return;
      var f = frames[idx % frames.length];
      var ctx = animCanvas.getContext("2d");
      var im = new ImageData(new Uint8ClampedArray(f.data), f.w, f.h);
      ctx.putImageData(im, 0, 0);
    }

    function togglePlay() {
      animState.playing = !animState.playing;
      playBtn.innerHTML = "";
      playBtn.appendChild(UI.icon(animState.playing ? "stop" : "play"));
      playBtn.appendChild(document.createTextNode(animState.playing ? "Stop" : t("sheet.preview")));
      if (animState.playing) tick();
    }

    function tick() {
      if (!animState.playing) return;
      var sel = selectedFrames();
      if (!sel.length) { animState.playing = false; return; }
      var f = sel[animState.idx % sel.length];
      drawFrame(animState.idx % sel.length);
      animState.idx++;
      var delay = Number(animDelay.value) || f.delay || 80;
      animState.timer = setTimeout(tick, delay);
    }

    // A/D 键在已选帧间切换（非输入框聚焦时）
    function onKey(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k !== "a" && k !== "d") return;
      var sel = selectedFrames();
      if (!sel.length) return;
      // 找当前预览帧在已选序列中的位置
      var curIdx = animState.idx % sel.length;
      animState.idx = (curIdx + (k === "d" ? 1 : sel.length - 1)) % sel.length;
      drawFrame(animState.idx);
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);

    async function exportZip() {
      var sel = selectedFrames();
      var cv = UI.makeCanvas(sel[0].w, sel[0].h);
      var ctx = cv.getContext("2d");
      var files = [];
      for (var i = 0; i < sel.length; i++) {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(sel[i].data), sel[i].w, sel[i].h), 0, 0);
        var blob = await new Promise(function (r) { cv.toBlob(r, "image/png"); });
        files.push({ name: "frame_" + String(i + 1).padStart(4, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
      }
      UI.download(FF.Zip.make(files), "sheet_frames.zip");
    }

    async function exportGif() {
      var sel = selectedFrames();
      if (!sel.length) return;
      gifBtn.disabled = true;
      try {
        var bg = [parseInt(gifBg.value.slice(1, 3), 16), parseInt(gifBg.value.slice(3, 5), 16), parseInt(gifBg.value.slice(5, 7), 16)];
        var delays = sel.map(function (f) { return f.delay || Number(animDelay.value) || 80; });
        var out = await FF.Wasm.gifEncode(sel, sel[0].w, sel[0].h, { bg: bg, delays: delays, defaultDelay: 80, repeat: 1 });
        UI.download(new Blob([out], { type: "image/gif" }), "sheet_anim.gif");
      } finally {
        gifBtn.disabled = false;
      }
    }

    s1.appendChild(dzSplit);
    s2.appendChild(UI.el("div", { class: "param-grid" }, [
      modeSel.el,
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("sheet.cols") + "/" + t("sheet.rows") + " / " + t("sheet.cw") + "/" + t("sheet.ch")]), gridFields, cellFields]),
      UI.el("div", { class: "param-row" }, [skipSw.el])
    ]));
    s2.appendChild(UI.el("div", { class: "mt14 btn-row" }, [splitBtn, info]));
    show(query.tab === "split" ? 0 : 0);

    /* ============================================================
     * Pane 2: 合成
     * ============================================================ */

    var imgs = []; // {w,h,data,canvas}
    var bDz = UI.dropzone({
      accept: "image/*",
      multiple: true,
      main: t("sheet.upload.multi"),
      hint: t("chroma.hint"),
      onFiles: function (files) { addImages(files); }
    });
    var bStripWrap = UI.el("div", { class: "mt14" });
    var bStrip = null;
    var bCols = UI.selectRow(t("sheet.buildcols"), [1, 2, 3, 4, 5, 6, 8, 10].map(function (v) { return { v: v, label: v }; }), 4, {});
    var bDelay = UI.el("input", { type: "number", value: "80", min: "20", step: "10", style: { width: "90px" } });
    var bBtn = UI.btn(t("sheet.buildgo"), "btn-primary", buildSheet);
    var bOut = UI.el("div", { class: "mt14" }, []);

    function addImages(files) {
      var jobs = files.filter(function (f) { return /image\//.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name); })
        .map(function (f) { return UI.fileToImage(f); });
      Promise.all(jobs).then(function (rs) {
        rs.forEach(function (r) {
          var w = r.img.naturalWidth, h = r.img.naturalHeight;
          var c = UI.makeCanvas(w, h);
          c.getContext("2d").drawImage(r.img, 0, 0);
          imgs.push({ w: w, h: h, canvas: c });
          r.release();
        });
        renderBuildStrip();
      }).catch(function (e) { UI.modal("Error", UI.el("p", {}, [String(e.message || e)])); });
    }

    function renderBuildStrip() {
      bStripWrap.innerHTML = "";
      bStrip = UI.filmstrip(imgs.map(function (x) { return x.canvas; }), {
        reorderable: true,
        delayEditable: true,
        onReorder: function (from, to) {
          var moved = imgs.splice(from, 1)[0];
          imgs.splice(to, 0, moved);
        }
      });
      bStripWrap.appendChild(bStrip.el);
    }

    async function buildSheet() {
      if (!imgs.length) return;
      bBtn.disabled = true;
      try {
        var fw = Math.max.apply(null, imgs.map(function (x) { return x.w; }));
        var fh = Math.max.apply(null, imgs.map(function (x) { return x.h; }));
        // 统一 cell 居中
        var frames = imgs.map(function (x) {
          var c = UI.makeCanvas(fw, fh);
          var ctx = c.getContext("2d");
          ctx.drawImage(x.canvas, Math.floor((fw - x.w) / 2), Math.floor((fh - x.h) / 2));
          return { w: fw, h: fh, data: new Uint8Array(ctx.getImageData(0, 0, fw, fh).data.buffer) };
        });
        var cols = Math.min(Number(bCols.value), frames.length);
        var out = await FF.Wasm.sheetAssemble(frames, fw, fh, cols);
        var rows = Math.ceil(frames.length / cols);
        var im = new ImageData(new Uint8ClampedArray(out), fw * cols, fh * rows);
        var cv = UI.imageDataToCanvas(im);
        bOut.innerHTML = "";
        bOut.appendChild(UI.el("div", { class: "pb-title" }, ["Sprite Sheet " + fw * cols + "×" + fh * rows]));
        bOut.appendChild(UI.canvasFrame(cv));
        UI.downloadCanvas(cv, "sheet_built.png");

        // 顺便提供 GIF
        var bgc = [0, 0, 0];
        var out2 = await FF.Wasm.gifEncode(frames, fw, fh, { bg: bgc, delay: Number(bDelay.value) || 80, repeat: 1 });
        UI.download(new Blob([out2], { type: "image/gif" }), "sheet_built.gif");
      } finally {
        bBtn.disabled = false;
      }
    }

    panes[1].appendChild(bDz);
    panes[1].appendChild(UI.el("div", { class: "param-grid mt14" }, [
      bCols.el,
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("video.delay")]), bDelay])
    ]));
    panes[1].appendChild(UI.el("div", { class: "mt14" }, [bBtn]));
    panes[1].appendChild(bStripWrap);
    panes[1].appendChild(bOut);

    card.appendChild(tabs);
    card.appendChild(panes[0]);
    card.appendChild(panes[1]);
    show(query && query.tab === "build" ? 1 : 0);

    return {
      root: root,
      cleanup: function () {
        animState.playing = false;
        if (animState.timer) clearTimeout(animState.timer);
        window.removeEventListener("keydown", onKey);
      }
    };
  };
})();
