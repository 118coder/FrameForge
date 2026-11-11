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

    var tol = UI.slider(t("chroma.tol"), 0, 100, 35, { onInput: refreshDebounced });
    var feather = UI.slider(t("chroma.feather"), 0, 100, 25, { onInput: refreshDebounced });
    var suppress = UI.slider(t("chroma.suppress"), 0, 100, 60, { onInput: refreshDebounced });
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
      if (isFx) { dz.style.display = ""; previewBox.style.display = ""; }
    }

    /* ---------- 半透明特效（彩色光效 / 黑底叠加 / 烟雾薄纱） ---------- */

    var fxParams = UI.el("div", { style: { display: "none" } }, []);
    var fxPresetRow = UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap" } }, []);
    var fxMode = "color";   // color | black | smoke
    var fxTol = UI.slider(t("fx.tol"), 0, 100, 22, { onInput: refreshDebounced });
    var fxBlackPt = UI.slider(t("fx.blackPt"), 0, 100, 8, { onInput: refreshDebounced });
    var fxWhitePt = UI.slider(t("fx.whitePt"), 0, 100, 85, { onInput: refreshDebounced });
    var fxDensity = UI.slider(t("fx.density"), 0, 100, 55, { onInput: refreshDebounced });
    var fxDespill = UI.slider(t("fx.despill"), 0, 100, 40, { onInput: refreshDebounced });
    fxParams.appendChild(UI.el("div", { class: "param-grid" }, [fxTol.el, fxBlackPt.el, fxWhitePt.el, fxDensity.el, fxDespill.el]));
    [
      { id: "color", label: t("fx.color") }, { id: "black", label: t("fx.black") }, { id: "smoke", label: t("fx.smoke") }
    ].forEach(function (p) {
      var b = UI.btn(p.label, "btn-outline btn-sm", function () {
        fxMode = p.id;
        fxPresetRow.querySelectorAll(".btn").forEach(function (x) { x.classList.replace("btn-primary", "btn-outline"); });
        b.classList.replace("btn-outline", "btn-primary");
        if (p.id === "black") { fxBlackPt.set(5); fxDensity.set(75); }
        if (p.id === "smoke") { fxBlackPt.set(2); fxDensity.set(35); }
        if (p.id === "color") { fxBlackPt.set(8); fxDensity.set(55); }
        refreshDebounced();
      });
      fxPresetRow.appendChild(b);
    });

    /** 估计背景色（四角中值） */
    function estimateBg(im) {
      var w = im.width, h = im.height, d = im.data;
      var pts = [];
      var cs = Math.max(2, Math.round(Math.min(w, h) * 0.02));
      [[0, 0], [w - cs, 0], [0, h - cs], [w - cs, h - cs]].forEach(function (p) {
        for (var y = p[1]; y < p[1] + cs; y++) {
          for (var x = p[0]; x < p[0] + cs; x++) {
            var i = (y * w + x) * 4;
            pts.push([d[i], d[i + 1], d[i + 2]]);
          }
        }
      });
      var avg = [0, 0, 0];
      pts.forEach(function (p) { avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2]; });
      return [avg[0] / pts.length, avg[1] / pts.length, avg[2] / pts.length];
    }

    function effectMatte(im) {
      var w = im.width, h = im.height, d = im.data;
      var out = new ImageData(w, h);
      var od = out.data;
      var bg = estimateBg(im);
      var tolF = fxTol.value / 100 * 441;          // 最大欧氏距离
      var blackPt = fxBlackPt.value / 100 * 255;
      var whitePt = fxWhitePt.value / 100 * 255;
      var density = fxDensity.value / 100;
      var despill = fxDespill.value / 100;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var r = d[i], g = d[i + 1], b = d[i + 2];
          var dr = r - bg[0], dg = g - bg[1], db = b - bg[2];
          var dist = Math.sqrt(dr * dr + dg * dg + db * db);
          var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          var alpha;
          if (fxMode === "black") {
            // 黑底叠加：亮度→alpha，颜色补偿（提亮恢复光效色彩）
            alpha = Math.max(0, Math.min(1, (lum - blackPt) / Math.max(1, whitePt - blackPt)));
            if (alpha <= 0) { od[i + 3] = 0; continue; }
            // 补偿：按 alpha 比例恢复被黑底压暗的颜色
            var comp = 255 / Math.max(8, Math.max(r, g, b));
            od[i] = Math.min(255, r * Math.max(1, comp * alpha));
            od[i + 1] = Math.min(255, g * Math.max(1, comp * alpha));
            od[i + 2] = Math.min(255, b * Math.max(1, comp * alpha));
            od[i + 3] = Math.round(alpha * 255);
            continue;
          }
          if (fxMode === "smoke") {
            // 烟雾/薄纱：亮度差→alpha，保留明暗层次
            var bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
            var diff = Math.abs(lum - bgLum);
            alpha = Math.max(0, Math.min(1, (diff - blackPt) / Math.max(1, whitePt - blackPt)));
            var pw2 = Math.max(0.1, 2 - 2 * density);
            od[i] = r; od[i + 1] = g; od[i + 2] = b;
            od[i + 3] = Math.round(Math.pow(alpha, pw2) * 255);
            continue;
          }
          // 彩色光效：色距→alpha（远离底色=不透明），溢色抑制
          var t0 = tolF;                                   // 全透明阈值
          var t1 = Math.max(t0 + 10, whitePt / 100 * 441); // 不透明阈值
          alpha = dist <= t0 ? 0 : Math.min(1, (dist - t0) / (t1 - t0));
          if (alpha <= 0) { od[i + 3] = 0; continue; }
          // 溢色抑制：把接近背景色的分量向中性收
          var maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
          var sat = (maxC - minC) / 255;
          var keepR = r, keepG = g, keepB = b;
          if (despill > 0 && sat < 0.9) {
            // 背景主导通道削弱
            var dominant = bg[0] > bg[1] && bg[0] > bg[2] ? 0 : (bg[1] > bg[2] ? 1 : 2);
            var avg2 = (r + g + b) / 3;
            if (dominant === 0) keepR = r * (1 - despill) + avg2 * despill;
            else if (dominant === 1) keepG = g * (1 - despill) + avg2 * despill;
            else keepB = b * (1 - despill) + avg2 * despill;
          }
          var pw = Math.max(0.1, 2 - 2 * density);         // 浓度大→更不透明
          od[i] = keepR; od[i + 1] = keepG; od[i + 2] = keepB;
          od[i + 3] = Math.round(Math.pow(alpha, pw) * 255);
        }
      }
      return out;
    }

    /* ---------- 双背景（黑/白两张图差分） ---------- */

    var dualUploads = UI.el("div", { style: { display: "none" } }, []);
    var dualParams = UI.el("div", { style: { display: "none" } }, []);
    var dualState = { black: null, white: null };
    var dbTol = UI.slider(t("chroma.db.tol"), 0, 100, 20, { onInput: refreshDebounced });
    var dbEdge = UI.slider(t("chroma.db.edge"), 0, 100, 30, { onInput: refreshDebounced });
    var dbErode = UI.slider(t("chroma.db.erode"), 0, 100, 0, { onInput: refreshDebounced });
    dualParams.appendChild(UI.el("div", { class: "param-grid" }, [dbTol.el, dbEdge.el, dbErode.el]));

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
        state.result = effectMatte(state.orig);
        rightBox.innerHTML = '<div class="pb-title">' + t("common.after") + '</div>';
        rightBox.appendChild(UI.canvasFrame(UI.imageDataToCanvas(state.result)));
        return;
      }
      FF.Wasm.chromaKey(state.orig, {
        mode: mode, tol: tol.value, feather: feather.value, suppress: suppress.value,
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
        if (Number(modeSel.value) < 3) return;
        var r = cv.getBoundingClientRect();
        var x = Math.floor((e.clientX - r.left) / r.width * state.orig.width);
        var y = Math.floor((e.clientY - r.top) / r.height * state.orig.height);
        var o = (y * state.orig.width + x) * 4;
        var d = state.orig.data;
        var hex = "#" + [d[o], d[o + 1], d[o + 2]].map(function (v) {
          return v.toString(16).padStart(2, "0");
        }).join("");
        c1In.value = hex;
        refresh();
      });
      leftBox.appendChild(frame);
      refresh();
    }

    var p2 = steps.panels[1];
    p2.appendChild(UI.el("div", { class: "param-grid" }, [
      modeSel.el, tol.el, feather.el, suppress.el, c1Row, c2Row
    ]));
    p2.appendChild(fxPresetRow);
    p2.appendChild(fxParams);
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
