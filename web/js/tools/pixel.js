/* FrameForge · 像素图片的转化和优化（V5 结构对齐原站）
 * Tabs: 像素块风格 / 合并临近色 / 16色像素图 / 完美像素 / 超级完美像素 / 色表对标
 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.pixel = function (query) {
    query = query || {};
    var sk = UI.pageSkeleton("mod.pixel.t", "mod.pixel.d", null);
    var root = sk.root, card = sk.card;

    var state = { orig: null, result: null };

    /* ---------------- 上传区（共享） ---------------- */

    var dz = UI.dropzone({
      accept: "image/*",
      main: t("pixel.drop"),
      hint: t("chroma.hint"),
      onFiles: function (files) { loadFromSrc(files[0], true); }
    });

    function loadFromSrc(src, isFile) {
      var promise = isFile ? UI.fileToImage(src) : new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve({ img: img, release: function () {} }); };
        img.onerror = function () { reject(new Error("image decode failed")); };
        img.src = src;
      });
      promise.then(function (r) {
        state.orig = UI.imageDataFrom(r.img, 2048);
        r.release();
        infoBar.textContent = t("pixel.loaded") + " " + state.orig.width + "×" + state.orig.height;
        applyCurrent();
      }).catch(function (e) { UI.modal("Error", UI.el("p", {}, [String(e.message || e)])); });
    }

    var transfer = sessionStorage.getItem("ff.transfer");
    if (transfer) {
      sessionStorage.removeItem("ff.transfer");
      loadFromSrc(transfer, false);
    }

    var infoBar = UI.el("div", { class: "hint-text mt8" }, []);
    var uploadWrap = UI.el("div", {}, [dz, infoBar]);

    /* ---------------- 结果区（共享） ---------------- */

    var resultBox = UI.el("div", { class: "preview-box mt20" }, []);
    function showResult(im, label) {
      state.result = im;
      resultBox.innerHTML = "";
      resultBox.appendChild(UI.el("div", { class: "pb-title" }, [label || t("common.after")]));
      resultBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(im)));
      var row = UI.el("div", { class: "btn-row mt8" }, []);
      row.appendChild(UI.btn(t("common.download") + " PNG", "btn-primary", function () {
        UI.downloadCanvas(UI.imageDataToCanvas(im), "pixel_output.png");
      }, "download"));
      resultBox.appendChild(row);
    }

    function needOrig() {
      if (!state.orig) { UI.modal(t("common.wasmfail"), UI.el("p", {}, [t("pixel.needupload")])); return false; }
      return true;
    }

    /* ---------------- Tabs ---------------- */

    var tabBar = UI.el("div", { class: "row mb14", style: { gap: "6px" } }, []);
    var paneWrap = UI.el("div", {}, []);
    var panes = [];
    var tabBtns = [];
    var TABS = ["block", "merge", "c16", "perfect", "super", "match"];
    var TAB_NAMES = ["pixel.tab.block", "pixel.tab.merge", "pixel.tab.c16", "pixel.tab.perfect", "pixel.tab.super", "pixel.tab.match"];
    TABS.forEach(function (id, i) {
      var pane = UI.el("div", { style: { display: "none" } }, []);
      panes.push(pane);
      paneWrap.appendChild(pane);
      var btn = UI.btn(t(TAB_NAMES[i]), "btn-outline", function () { show(i); });
      tabBtns.push(btn);
      tabBar.appendChild(btn);
    });
    function show(n) {
      tabBtns.forEach(function (b, i) { b.className = "btn " + (i === n ? "btn-primary" : "btn-outline"); });
      panes.forEach(function (p, i) { p.style.display = i === n ? "" : "none"; });
    }
    function tabPane(id, paramRows) {
      var idx = TABS.indexOf(id);
      paramRows.forEach(function (r) { panes[idx].appendChild(r); });
      return panes[idx];
    }

    /* ========== Tab 1: 像素块风格 ========== */

    var blockSize = UI.slider(t("pixel.block"), 2, 32, 8, {});
    var blockHint = UI.el("div", { class: "hint-text" }, [t("pixel.block.hint")]);
    var blockBtn = UI.btn(t("pixel.go.block"), "btn-primary", function () {
      if (!needOrig()) return;
      FF.Wasm.pixelate(state.orig, blockSize.value).then(function (im) {
        showResult(im, t("pixel.tab.block"));
      });
    });
    tabPane("block", [blockSize.el, blockHint, UI.el("div", { class: "mt14" }, [blockBtn])]);

    /* ========== Tab 2: 合并临近色 ========== */

    var mergeStrength = UI.slider(t("pixel.merge.strength"), 1, 100, 30, {});
    var mergeHint = UI.el("div", { class: "hint-text" }, [t("pixel.merge.hint")]);
    var mergeBtn = UI.btn(t("pixel.go.merge"), "btn-primary", function () {
      if (!needOrig()) return;
      showResult(FF.Lab.mergeSimilar(state.orig, mergeStrength.value), t("pixel.tab.merge"));
    });
    tabPane("merge", [mergeStrength.el, mergeHint, UI.el("div", { class: "mt14" }, [mergeBtn])]);

    /* ========== Tab 3: 16色像素图 ========== */

    var c16Algo = UI.selectRow(t("pixel.c16.algo"), [
      { v: 0, label: "RGB " + t("pixel.c16.rgb") },
      { v: 1, label: t("pixel.c16.lab") }
    ], 1, {});
    var c16Dither = UI.switchRow(t("pixel.dither"), false, function () {});
    var c16Count = UI.slider(t("pixel.c16.count"), 2, 64, 16, {});
    var c16Btn = UI.btn(t("pixel.go.c16"), "btn-primary", function () {
      if (!needOrig()) return;
      FF.Wasm.quantize(state.orig, 9, 100, c16Dither.value ? 1 : 0, Number(c16Algo.value), c16Count.value)
        .then(function (im) { showResult(im, t("pixel.tab.c16")); });
    });
    tabPane("c16", [c16Algo.el, c16Count.el, c16Dither.el, UI.el("div", { class: "mt14" }, [c16Btn])]);

    /* ========== Tab 4: 完美像素 ========== */

    var ppAlgo = UI.selectRow(t("pixel.pp.algo"), [
      { v: "classic", label: t("pixel.pp.classic") },
      { v: "frame", label: t("pixel.pp.frame") + "（" + t("home.wip") + "）" }
    ], "classic", {});
    var ppSample = UI.selectRow(t("pixel.pp.sample"), [
      { v: "center", label: t("pixel.pp.center") },
      { v: "median", label: t("pixel.pp.median") },
      { v: "majority", label: t("pixel.pp.majority") }
    ], "center", {});
    var ppManual = UI.switchRow(t("pixel.pp.manual"), false, function (v) {
      ppGrid.style.display = v ? "" : "none";
    });
    var ppCols = UI.el("input", { type: "number", value: "16", min: "1", max: "512", style: { width: "80px" } });
    var ppRows = UI.el("input", { type: "number", value: "16", min: "1", max: "512", style: { width: "80px" } });
    var ppGrid = UI.el("div", { class: "row mt8", style: { display: "none" } }, [
      ppCols, UI.el("span", { class: "hint-text" }, ["× " + t("sheet.rows")]), ppRows
    ]);
    var ppMinSize = UI.slider(t("pixel.pp.minsize"), 2, 16, 4, {});
    var ppPeak = UI.slider(t("pixel.pp.peak"), 2, 20, 6, {});
    var ppHint = UI.el("div", { class: "hint-text" }, [t("pixel.pp.hint")]);
    var ppBtn = UI.btn(t("pixel.go.perfect"), "btn-primary", function () {
      if (!needOrig()) return;
      try {
        var opts = {
          sampleMethod: ppSample.value,
          minSize: ppMinSize.value,
          peakWidth: ppPeak.value,
          refineIntensity: 0.25,
          fixSquare: true,
          gridSize: ppManual.value ? { cols: Number(ppCols.value), rows: Number(ppRows.value) } : null
        };
        showResult(FF.PerfectPixel.getPerfectPixel(state.orig, opts), t("pixel.tab.perfect"));
      } catch (e) {
        UI.modal("Error", UI.el("p", {}, [
          e.message === "ERR_PERFECT_PIXEL_GRID" ? t("pixel.pp.err") : String(e.message || e)
        ]));
      }
    });
    tabPane("perfect", [ppAlgo.el, ppSample.el, ppManual.el, ppGrid, ppMinSize.el, ppPeak.el, ppHint,
      UI.el("div", { class: "mt14" }, [ppBtn])]);

    /* ========== Tab 5: 超级完美像素 ========== */

    var spMode = UI.selectRow(t("pixel.sp.mode"), [
      { v: "auto", label: t("pixel.sp.auto") },
      { v: "spec", label: t("pixel.sp.spec") }
    ], "auto", { onChange: function () { spSpec.style.display = spMode.value === "spec" ? "" : "none"; } });
    var spW = UI.el("input", { type: "number", value: "64", min: "4", max: "1024", style: { width: "80px" } });
    var spH = UI.el("input", { type: "number", value: "64", min: "4", max: "1024", style: { width: "80px" } });
    var spSpec = UI.el("div", { class: "row mt8", style: { display: "none" } }, [
      spW, UI.el("span", { class: "hint-text" }, ["×"]), spH
    ]);
    var spColors = UI.slider(t("pixel.sp.colors"), 2, 64, 16, {});
    var spBtn = UI.btn(t("pixel.go.super"), "btn-primary", function () {
      if (!needOrig()) return;
      try {
        var im = FF.PerfectPixel.getPerfectPixel(state.orig, {
          sampleMethod: "majority",
          gridSize: spMode.value === "spec"
            ? { cols: Math.max(1, Math.round(state.orig.width / Number(spW.value))), rows: Math.max(1, Math.round(state.orig.height / Number(spH.value))) }
            : null,
          minSize: 4, peakWidth: 6, refineIntensity: 0.25, fixSquare: true
        });
        FF.Wasm.quantize(im, 9, 100, 0, 1, spColors.value).then(function (q) {
          showResult(q, t("pixel.tab.super"));
        });
      } catch (e) {
        UI.modal("Error", UI.el("p", {}, [String(e.message || e)]));
      }
    });
    tabPane("super", [spMode.el, spSpec, spColors.el, UI.el("div", { class: "mt14" }, [spBtn])]);

    /* ========== Tab 6: 色表对标 ========== */

    var tplIm = null, srcIm = null;
    var tplBox = UI.el("div", { class: "preview-box" }, []);
    var srcBox = UI.el("div", { class: "preview-box" }, []);
    var tplDz = UI.dropzone({
      accept: "image/*", main: t("pixel.match.tpl"), hint: t("chroma.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          tplIm = UI.imageDataFrom(r.img, 2048); r.release();
          tplBox.innerHTML = "";
          tplBox.appendChild(UI.el("div", { class: "pb-title" }, [t("pixel.match.tpl")]));
          tplBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(tplIm)));
          matchTry();
        });
      }
    });
    var srcDz = UI.dropzone({
      accept: "image/*", main: t("pixel.match.src"), hint: t("chroma.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          srcIm = UI.imageDataFrom(r.img, 2048); r.release();
          srcBox.innerHTML = "";
          srcBox.appendChild(UI.el("div", { class: "pb-title" }, [t("pixel.match.src")]));
          srcBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(srcIm)));
          matchTry();
        });
      }
    });
    var matchHint = UI.el("div", { class: "hint-text mt8" }, []);
    function matchTry() {
      var n1 = tplIm ? 1 : 0, n2 = srcIm ? 1 : 0;
      matchHint.textContent = t("pixel.match.status").replace("{a}", n1).replace("{b}", n2);
    }
    var matchBtn = UI.btn(t("pixel.go.match"), "btn-primary", function () {
      if (!tplIm || !srcIm) { UI.modal("Error", UI.el("p", {}, [t("pixel.match.err")])); return; }
      var palette = FF.Lab.extractPalette(tplIm, 256);
      showResult(FF.Lab.mapToPalette(srcIm, palette), t("pixel.tab.match") + " · " + palette.length + " colors");
    });
    panes[TABS.indexOf("match")].appendChild(UI.el("div", { class: "preview-wrap cols2" }, [
      (function () { tplBox.appendChild(tplDz); return tplBox; })(),
      (function () { srcBox.appendChild(srcDz); return srcBox; })()
    ]));
    panes[TABS.indexOf("match")].appendChild(matchHint);
    panes[TABS.indexOf("match")].appendChild(UI.el("div", { class: "mt14" }, [matchBtn]));

    /* ---------------- 组装 ---------------- */

    card.appendChild(uploadWrap);
    card.appendChild(tabBar);
    card.appendChild(paneWrap);
    card.appendChild(resultBox);
    show(0);
    matchTry();

    return { root: root, onPaste: function (u) { loadFromSrc(u, false); }, onDrop: function (u) { loadFromSrc(u, false); } };
  };
})();
