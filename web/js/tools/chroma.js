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
      { v: "dualbg", label: t("chroma.mode.dualbg") }
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
