/* FrameForge · 抠图去背 */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.chroma = function () {
    var sk = UI.pageSkeleton("mod.chroma.t", "mod.chroma.d", ["chroma.s1", "chroma.s2", "chroma.s3"]);
    var root = sk.root, card = sk.card, steps = sk.steps;

    var state = { orig: null /* ImageData */, result: null };

    /* ---------------- Step 1 ---------------- */

    var next1 = UI.btn(t("common.next"), "btn-primary", function () { steps.set(1); });
    next1.disabled = true;

    var dz = UI.dropzone({
      accept: "image/*",
      main: t("chroma.drop"),
      hint: t("chroma.hint"),
      onFiles: function (files) {
        loadFromSrc(files[0], true);
      }
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
        buildPreview();
        next1.disabled = false;
        steps.set(1);
      }).catch(function (e) {
        UI.modal("Error", UI.el("p", {}, [String(e.message || e)]));
      });
    }

    // 从 AI 生图等模块送来的图片
    var transfer = sessionStorage.getItem("ff.transfer");
    if (transfer) {
      sessionStorage.removeItem("ff.transfer");
      loadFromSrc(transfer, false);
    }
    var p1 = steps.panels[0];
    p1.appendChild(dz);
    p1.appendChild(UI.el("div", { class: "mt20" }, [next1]));

    /* ---------------- Step 2: 参数 + 实时预览 ---------------- */

    var modeSel = UI.selectRow(t("chroma.mode"), [
      { v: 0, label: t("chroma.mode.green") },
      { v: 1, label: t("chroma.mode.blue") },
      { v: 2, label: t("chroma.mode.white") },
      { v: 5, label: t("chroma.mode.corner") },
      { v: 3, label: t("chroma.mode.custom") },
      { v: 4, label: t("chroma.mode.dual") },
      { v: "dualbg", label: t("chroma.mode.dualbg") },
      { v: "fx", label: t("chroma.mode.fx") }
    ], 0, {
      onChange: function () {
        // 连通域模式：沿用原站 bpset 蓝图的经典参数 容差80/羽化5
        if (Number(modeSel.value) === 5) { tol.set(80); feather.set(5); }
        applyModeVisibility();
        refreshDebounced();
      }
    });

    var tol = UI.slider(t("chroma.tol"), 5, 100, 35, { onInput: refreshDebounced });
    var feather = UI.slider(t("chroma.feather"), 5, 100, 34, { onInput: refreshDebounced });
    var suppress = UI.slider(t("chroma.suppress"), 5, 100, 75, { onInput: refreshDebounced });
    var erode = UI.slider(t("chroma.erode"), 0, 100, 1, { onInput: refreshDebounced });
    var c1In = UI.el("input", { type: "color", value: "#00ff00" });
    var c2In = UI.el("input", { type: "color", value: "#0000ff" });
    c1In.addEventListener("input", refreshDebounced);
    c2In.addEventListener("input", refreshDebounced);

    var c1Row = UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("chroma.c1")]), c1In]);
    var c2Row = UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("chroma.c2")]), c2In]);

    var previewBox = UI.el("div", { class: "preview-wrap cols2" });
    var leftBox = UI.el("div", { class: "preview-box" }, [UI.el("div", { class: "pb-title" }, [t("common.before")])]);
    var rightBox = UI.el("div", { class: "preview-box" }, [UI.el("div", { class: "pb-title" }, [t("common.after")])]);
    previewBox.appendChild(leftBox);
    previewBox.appendChild(rightBox);
    var eyedropHint = UI.el("div", { class: "hint-text mt8" }, [t("chroma.eyedrop")]);

    function hex2rgb(hex) {
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function visibleColorRows() {
      var m = Number(modeSel.value);
      var isDual = modeSel.value === "dualbg";
      var isFx = modeSel.value === "fx";
      c1Row.style.display = (m === 3 || m === 4) ? "" : "none";
      c2Row.style.display = (m === 4) ? "" : "none";
      suppress.el.style.display = (m <= 1) ? "" : "none";
      erode.el.style.display = isDual || isFx ? "none" : "";
      eyedropHint.style.display = (m === 3 || m === 4) ? "" : "none";
      // 双背景：隐藏单图相关参数，显示两图上传与专用参数
      tol.el.style.display = isDual ? "none" : "";
      feather.el.style.display = isDual ? "none" : "";
      dualParams.style.display = isDual ? "" : "none";
      dualUploads.style.display = isDual ? "" : "none";
      dz.style.display = isDual ? "none" : "";
      previewBox.style.display = isDual ? "none" : "";
      // 半透明特效：隐藏常规参数，显示特效专用参数
      fxParams.style.display = isFx ? "" : "none";
      fxPresetRow.style.display = isFx ? "" : "none";
      if (isFx) { tol.el.style.display = "none"; feather.el.style.display = "none"; dz.style.display = ""; previewBox.style.display = ""; }
    }

    /* ---------- 半透明特效（对齐 frameronin v5.0 wt/Xe 算法） ---------- */

    var fxParams = UI.el("div", { style: { display: "none" } }, []);
    var fxPresetRow = UI.el("div", { style: { display: "none" } }, []);
    var FX_Y = function (v) { return Math.max(0, Math.min(1, v)); };
    // v5.0 ye 初始默认（未选底色）；点底色按钮后切换为 Xe(bg) 预设
    var fxSettings = { model: "color", blackPoint: 0, whitePoint: 100, density: 1, despill: 0 };
    var fxKeyColor = [0, 255, 0];   // 底色（自动取样或预设）
    var FX_BGS = [
      { id: "blue", rgb: [0, 0, 255] }, { id: "green", rgb: [0, 255, 0] },
      { id: "black", rgb: [0, 0, 0] }, { id: "white", rgb: [255, 255, 255] },
      { id: "magenta", rgb: [255, 0, 255] }
    ];
    function fxPresetFor(bg) {
      return {
        model: bg === "black" ? "black" : "color",
        blackPoint: bg === "black" ? 0 : 1,
        whitePoint: 100,
        density: 1,
        despill: ["blue", "green", "magenta"].indexOf(bg) >= 0 ? 20 : 0,
        colorTolerance: bg === "black" ? 0 : 3,
        background: bg
      };
    }
    function fxSyncSliders() {
      fxColorTol.set(fxSettings.colorTolerance);
      fxBlackPt.set(fxSettings.blackPoint);
      fxWhitePt.set(fxSettings.whitePoint);
      fxDensity.set(fxSettings.density);
      fxDespill.set(fxSettings.despill);
      fxUpdateVisibility();
    }
    var fxColorTol = UI.slider(t("fx.tol"), 0, 20, fxSettings.colorTolerance || 0, {
      step: 1, onInput: function (v) { fxSettings.colorTolerance = v; refreshDebounced(); }
    });
    var fxBlackPt = UI.slider(t("fx.blackPt"), 0, 20, fxSettings.blackPoint, {
      step: 0.1, onInput: function (v) { fxSettings.blackPoint = v; refreshDebounced(); }
    });
    var fxWhitePt = UI.slider(t("fx.whitePt"), 50, 100, fxSettings.whitePoint, {
      step: 1, onInput: function (v) { fxSettings.whitePoint = v; refreshDebounced(); }
    });
    var fxDensity = UI.slider(t("fx.density"), 0.2, 3, fxSettings.density, {
      step: 0.05, onInput: function (v) { fxSettings.density = v; refreshDebounced(); }
    });
    var fxDespill = UI.slider(t("fx.despill"), 0, 100, fxSettings.despill, {
      step: 1, onInput: function (v) { fxSettings.despill = v; refreshDebounced(); }
    });
    var fxRowColorTol = UI.el("div", {}, [fxColorTol.el]);
    var fxRowDespill = UI.el("div", {}, [fxDespill.el]);
    fxParams.appendChild(UI.el("div", { class: "param-grid" }, [
      fxRowColorTol, fxBlackPt.el, fxWhitePt.el, fxDensity.el, fxRowDespill
    ]));
    fxParams.appendChild(UI.el("div", { class: "hint-text mt8 fx-algo-hint" }, [t("fx.algo.hint.color")]));

    /** v5.0 Ut：判断像素是否符合底色族特征 */
    function fxBgFamilyMatch(rgb, bg) {
      var r = rgb[0], g = rgb[1], b = rgb[2];
      if (bg === "blue") return b > r + 30 && b > g + 20;
      if (bg === "green") return g > r + 30 && g > b + 20;
      if (bg === "magenta") return r > g + 25 && b > g + 25;
      if (bg === "white") return Math.min(r, g, b) > 210 && (Math.max(r, g, b) - Math.min(r, g, b)) < 25;
      return Math.max(r, g, b) < 32; // black
    }
    /** v5.0 kt：最大桶中值取样（Ct 缩放 ≤512 后调用；d 为 RGBA 数组） */
    function fxAutoSample(d, bg) {
      if (bg === "black") return [0, 0, 0];
      var pxCount = d.length / 4;
      var step = Math.max(1, Math.ceil(pxCount / 20000));
      var buckets = {};
      var sampled = 0;
      for (var i = 0; i < d.length; i += step * 4) {
        if (d[i + 3] < 240) continue;
        sampled++;
        var rgb = [d[i], d[i + 1], d[i + 2]];
        if (!fxBgFamilyMatch(rgb, bg)) continue;
        var key = (rgb[0] >> 3) << 10 | (rgb[1] >> 3) << 5 | (rgb[2] >> 3);
        (buckets[key] = buckets[key] || []).push(rgb);
      }
      var best = null;
      Object.keys(buckets).forEach(function (k) {
        if (!best || buckets[k].length > buckets[best].length) best = k;
      });
      if (!best || buckets[best].length < Math.max(8, sampled * 0.05)) return null;
      var arr = buckets[best];
      return [0, 1, 2].map(function (c) {
        var col = arr.map(function (x) { return x[c]; }).sort(function (a, b) { return a - b; });
        return col[Math.floor(col.length / 2)];
      });
    }
    /** v5.0 Ct：缩到 ≤512 再取样 */
    function fxSampleFromSource(bg) {
      if (!state.orig) return null;
      var s = Math.min(1, 512 / Math.max(state.orig.width, state.orig.height));
      var c = UI.makeCanvas(Math.max(1, Math.round(state.orig.width * s)), Math.max(1, Math.round(state.orig.height * s)));
      c.getContext("2d").drawImage(UI.imageDataToCanvas(state.orig), 0, 0, c.width, c.height);
      return fxAutoSample(c.getContext("2d").getImageData(0, 0, c.width, c.height).data, bg);
    }

    var fxHintLine = UI.el("div", { class: "hint-text mt8" }, [t("fx.bgHint")]);
    FX_BGS.forEach(function (bg) {
      var b = UI.btn(t("fx.bg." + bg.id), "btn-outline btn-sm", function () {
        fxKeyColor = fxSampleFromSource(bg.id) || bg.rgb.slice();
        c1In.value = "#" + fxKeyColor.map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
        fxSettings = fxPresetFor(bg.id);
        fxSyncSliders();
        FX_BGS.forEach(function (g) {
          var gb = fxPresetRow.querySelector("[data-fxbg='" + g.id + "']");
          if (gb) gb.classList.replace("btn-primary", "btn-outline");
        });
        b.classList.replace("btn-outline", "btn-primary");
        refreshDebounced();
      });
      b.dataset.fxbg = bg.id;
      fxPresetRow.appendChild(b);
    });
    var fxResetBtn = UI.btn(t("fx.reset"), "btn-ghost btn-sm", function () {
      var keepModel = fxSettings.model;
      fxSettings = fxSettings.background
        ? Object.assign(fxPresetFor(fxSettings.background), { model: keepModel })
        : { model: keepModel, blackPoint: 0, whitePoint: 100, density: 1, despill: 0, colorTolerance: 0 };
      fxSyncSliders(); refreshDebounced();
    });
    fxPresetRow.appendChild(fxResetBtn);
    // 子页 tab：彩色光效 | 烟雾／薄纱（model==="black" 时隐藏）
    var fxTabRow = UI.el("div", { class: "row mt8", style: { gap: "6px" } }, []);
    [
      { id: "color", label: t("fx.tab.color"), hintKey: "fx.algo.hint.color" },
      { id: "smoke", label: t("fx.tab.smoke"), hintKey: "fx.algo.hint.smoke" }
    ].forEach(function (p) {
      var b = UI.btn(p.label, "btn-outline btn-sm", function () {
        fxSettings.model = p.id;
        fxTabRow.querySelectorAll(".btn").forEach(function (x) { x.classList.replace("btn-primary", "btn-outline"); });
        b.classList.replace("btn-outline", "btn-primary");
        var hint = fxParams.querySelector(".fx-algo-hint");
        if (hint) hint.textContent = t(p.hintKey);
        fxUpdateVisibility();
        refreshDebounced();
      });
      if (p.id === "color") b.classList.replace("btn-outline", "btn-primary");
      fxTabRow.appendChild(b);
    });
    fxPresetRow.appendChild(fxTabRow);
    function fxUpdateVisibility() {
      // v5.0：black 模型隐藏 despill/colorTolerance；white 底隐藏 despill
      fxRowDespill.style.display = (fxSettings.model === "black" || fxSettings.background === "white") ? "none" : "";
      fxRowColorTol.style.display = fxSettings.model === "black" ? "none" : "";
      fxTabRow.style.display = fxSettings.model === "black" ? "none" : "";
    }

    /** v5.0 wt：半透明特效核心（精确复刻） */
    function effectMatte(im) {
      var d = im.data;
      var s = fxSettings;
      var isBlack = s.model === "black";
      var o = isBlack ? [0, 0, 0] : fxKeyColor.map(function (v) { return FX_Y(v / 255); });
      // 主导通道 m 及其优势度 e
      var m = o[1] > o[0] ? (o[2] > o[1] ? 2 : 1) : (o[2] > o[0] ? 2 : 0);
      var dd = (m + 1) % 3, xx = (m + 2) % 3;
      var e = o[m] - Math.max(o[dd], o[xx]);
      var R = FX_Y(s.blackPoint / 100);
      var j = Math.max(R + 0.001, FX_Y(s.whitePoint / 100));
      var u = Math.max(0.2, Math.min(3, s.density));
      var p = FX_Y(s.despill / 100);
      var y = Math.max(0, Math.min(20, s.colorTolerance == null ? 0 : s.colorTolerance));
      var S = Math.min.apply(null, o), W = Math.max.apply(null, o);
      var T = [0, 1, 2].filter(function (g2) { return W - S > 0.05 && (o[g2] - S) / (W - S) > 0.65; });
      var C2 = [0, 1, 2].filter(function (g2) { return T.indexOf(g2) < 0; });
      for (var g = 0; g < d.length; g += 4) {
        var k = d[g + 3] / 255;
        if (!k) { d[g] = 0; d[g + 1] = 0; d[g + 2] = 0; d[g + 3] = 0; continue; }
        var A = 0, Dv = 0;
        if (isBlack) {
          A = Math.max(d[g], d[g + 1], d[g + 2]) / 255;
        } else {
          for (var v = 0; v < 3; v++) {
            var M = d[g + v] / 255, b2 = o[v];
            var W2 = M < b2 ? (b2 - M) / b2 : (M > b2 ? (M - b2) / (1 - b2) : 0);
            A = Math.max(A, W2);
            var Cv = M < b2 ? (b2 - M - 0.5 / 255) / b2 : (M > b2 ? (M - b2 - 0.5 / 255) / (1 - b2) : 0);
            Dv = Math.max(Dv, Cv);
          }
        }
        if (s.model === "smoke" && e > 0.05) {
          var vex = (d[g + m] - Math.max(d[g + dd], d[g + xx])) / 255;
          A = Math.max(Dv, FX_Y(1 - vex / e));
        }
        var L = y > 0 ? Math.max(Math.abs(d[g] - o[0] * 255), Math.abs(d[g + 1] - o[1] * 255), Math.abs(d[g + 2] - o[2] * 255)) : 0;
        var P = y > 0 ? FX_Y((L - y) / y) : 1;
        var I = Math.pow(FX_Y((A - R) / (j - R)), 1 / u) * k * P;
        if (Math.round(I * 255) === 0 || A === 0) {
          d[g] = 0; d[g + 1] = 0; d[g + 2] = 0; d[g + 3] = 0; continue;
        }
        // 前景色反解：pixel = (pixel - (1-alpha)*bg) / alpha
        for (var v2 = 0; v2 < 3; v2++) {
          d[g + v2] = 255 * FX_Y((d[g + v2] / 255 - (1 - I) * o[v2]) / I);
        }
        // 溢色抑制：主导通道向其余通道最大值收紧
        if (p > 0 && T.length && C2.length) {
          var mv = 0, mM = 255;
          for (var ci = 0; ci < C2.length; ci++) mv = Math.max(mv, d[g + C2[ci]]);
          for (var ti = 0; ti < T.length; ti++) mM = Math.min(mM, d[g + T[ti]]);
          var excess = Math.max(0, mM - mv);
          var wgt = p * (s.background ? 1 - I : 1);
          for (var t2 = 0; t2 < T.length; t2++) d[g + T[t2]] -= excess * wgt;
        }
        d[g + 3] = Math.round(I * 255);
      }
      return im;
    }

    /* ---------- 双背景（黑/白两张图差分） ---------- */

    var dualUploads = UI.el("div", { style: { display: "none" } }, []);
    var dualParams = UI.el("div", { style: { display: "none" } }, []);
    var dualState = { black: null, white: null };
    var dbTol = UI.slider(t("chroma.db.tol"), 0, 100, 70, { onInput: refreshDebounced });
    var dbEdge = UI.slider(t("chroma.db.edge"), 0, 100, 53, { onInput: refreshDebounced });
    var dbErode = UI.slider(t("chroma.db.erode"), 0, 100, 0, { onInput: refreshDebounced });
    var dbPostBtn = UI.btn(t("chroma.db.post"), "btn-outline btn-sm", function () {
      if (!state.result) return;
      FF.Wasm.matteRepair(state.result).then(function (im) {
        state.result = im;
        dualResultBox.innerHTML = "";
        dualResultBox.appendChild(UI.el("div", { class: "pb-title" }, [t("common.after")]));
        dualResultBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(im)));
        FF.Toast.show(t("chroma.db.post.done"), "ok");
      });
    });
    dualParams.appendChild(UI.el("div", { class: "param-grid" }, [dbTol.el, dbEdge.el]));
    dualParams.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px" } }, [dbErode.el, dbPostBtn]));

    function makeDualDz(labelKey, slot) {
      var frame = UI.el("div", { class: "preview-box" }, []);
      function rebuild() {
        frame.innerHTML = '<div class="pb-title">' + t(labelKey) + '</div>';
        if (dualState[slot]) {
          var cv = UI.imageDataToCanvas(dualState[slot]);
          cv.style.maxHeight = "180px";
          frame.appendChild(cv);
        } else {
          frame.appendChild(UI.dropzone({
            accept: "image/*",
            main: t("chroma.db." + slot),
            hint: "",
            onFiles: function (files) {
              UI.fileToImage(files[0]).then(function (r) {
                var im = UI.imageDataFrom(r.img, 2048);
                r.release();
                if (dualState[(slot === "black" ? "white" : "black")] &&
                  (im.width !== dualState[(slot === "black" ? "white" : "black")].width ||
                   im.height !== dualState[(slot === "black" ? "white" : "black")].height)) {
                  UI.modal("Error", UI.el("p", {}, [t("chroma.db.size")]));
                  return;
                }
                dualState[slot] = im;
                rebuild();
                refresh();
              });
            }
          }));
        }
      }
      rebuild();
      return frame;
    }
    var blackBox = makeDualDz("chroma.db.black", "black");
    var whiteBox = makeDualDz("chroma.db.white", "white");
    dualUploads.appendChild(UI.el("div", { class: "hint-text mb8" }, [t("chroma.db.hint")]));
    dualUploads.appendChild(UI.el("div", { class: "preview-wrap cols2" }, [blackBox, whiteBox]));
    dualUploads.appendChild(dualParams);

    var timer = null;
    function refreshDebounced() {
      clearTimeout(timer);
      timer = setTimeout(refresh, 140);
    }

    function applyModeVisibility() { visibleColorRows(); }

    var dualResultBox = UI.el("div", { class: "mt14" }, []);

    function refresh() {
      // 双背景模式：两张图齐后自动差分
      if (modeSel.value === "dualbg") {
        if (!dualState.black || !dualState.white) return;
        FF.Wasm.doubleBg(dualState.black, dualState.white, dbTol.value, dbEdge.value, dbErode.value)
          .then(function (im) {
            state.result = im;
            dualResultBox.innerHTML = "";
            dualResultBox.appendChild(UI.el("div", { class: "pb-title" }, [t("common.after")]));
            dualResultBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(im)));
          })
          .catch(function (e) { UI.modal("Error", UI.el("p", {}, [String(e.message || e)])); });
        return;
      }
      if (!state.orig) return;
      if (!state.orig) return;
      visibleColorRows();
      var mode = Number(modeSel.value);
      if (modeSel.value === "fx") {
        // wt 会原地改写像素 —— 用克隆跑，保持原图干净
        var fxIm = new ImageData(new Uint8ClampedArray(state.orig.data), state.orig.width, state.orig.height);
        state.result = effectMatte(fxIm);
        rightBox.innerHTML = '<div class="pb-title">' + t("common.after") + '</div>';
        rightBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(state.result)));
        return;
      }
      FF.Wasm.chromaKey(state.orig, {
        mode: mode, tol: tol.value, feather: feather.value, suppress: suppress.value,
        erode: erode.value,
        c1: hex2rgb(c1In.value), c2: hex2rgb(c2In.value)
      }).then(function (im) {
        state.result = im;
        rightBox.querySelector(".canvas-frame, canvas") && (rightBox.innerHTML =
          '<div class="pb-title">' + t("common.after") + '</div>');
        rightBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(im)));
      }).catch(function (e) {
        UI.modal("Error", UI.el("p", {}, [String(e.message || e)]));
      });
    }

    function buildPreview() {
      leftBox.innerHTML = '<div class="pb-title">' + t("common.before") + '</div>';
      var cv = UI.imageDataToCanvas(state.orig);
      cv.style.imageRendering = "auto";
      var frame = UI.canvasFrame(cv);
      // 取色器
      cv.addEventListener("click", function (e) {
        var mRaw = modeSel.value;
        if (Number(mRaw) < 3 && mRaw !== "fx") return;
        var r = cv.getBoundingClientRect();
        var x = Math.floor((e.clientX - r.left) / r.width * state.orig.width);
        var y = Math.floor((e.clientY - r.top) / r.height * state.orig.height);
        var o = (y * state.orig.width + x) * 4;
        var d = state.orig.data;
        var rgb = [d[o], d[o + 1], d[o + 2]];
        var hex = "#" + rgb.map(function (v) {
          return v.toString(16).padStart(2, "0");
        }).join("");
        c1In.value = hex;
        if (mRaw === "fx") {
          fxKeyColor = rgb;
          // 与底色预设匹配时高亮对应按钮，否则全部取消高亮
          FX_BGS.forEach(function (g) {
            var gb = fxPresetRow.querySelector("[data-fxbg='" + g.id + "']");
            if (!gb) return;
            var same = g.rgb.every(function (v, i2) { return Math.abs(v - rgb[i2]) <= 8; });
            gb.classList.toggle("btn-primary", same);
            gb.classList.toggle("btn-outline", !same);
          });
        }
        refresh();
      });
      leftBox.appendChild(frame);
      refresh();
    }

    var p2 = steps.panels[1];
    p2.appendChild(UI.el("div", { class: "param-grid" }, [
      modeSel.el, tol.el, feather.el, suppress.el, erode.el, c1Row, c2Row
    ]));
    p2.appendChild(fxPresetRow);
    p2.appendChild(fxParams);
    p2.appendChild(fxHintLine);
    p2.appendChild(dualUploads);
    p2.appendChild(UI.el("div", { class: "mt14" }, [previewBox]));
    p2.appendChild(dualResultBox);
    p2.appendChild(eyedropHint);

    /* ---------------- Step 3: 导出 ---------------- */

    var compareBox = UI.el("div", { class: "mb14" });
    var dlBtn = UI.btn(t("common.download") + " PNG", "btn-primary", function () {
      if (state.result) {
        UI.downloadCanvas(UI.imageDataToCanvas(state.result), "cutout.png");
      }
    }, "download");
    var p3 = steps.panels[2];
    p3.appendChild(compareBox);
    p3.appendChild(UI.el("div", { class: "mt14" }, [dlBtn]));

    // 进入第 3 步时生成对比
    var origSet = steps.set.bind(steps);
    steps.set = function (n) {
      origSet(n);
      if (n === 2 && state.orig && state.result) {
        compareBox.innerHTML = "";
        compareBox.appendChild(UI.compare(
          UI.imageDataToCanvas(state.orig),
          UI.imageDataToCanvas(state.result)
        ));
      }
    };

    steps.set(0);

    return { root: root, onPaste: function (u) { loadFromSrc(u, false); }, onDrop: function (u) { loadFromSrc(u, false); } };
  };
})();
