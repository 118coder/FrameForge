/* FrameForge · 一键处理、精细处理（对齐 V5：缩放/连通域/内描边 一键管线 + 画笔修图） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.pixelplus = function () {
    var sk = UI.pageSkeleton("mod.pixelplus.t", "mod.pixelplus.d", null);
    var root = sk.root, card = sk.card;

    /* ---------------- Tabs ---------------- */

    var tabBar = UI.el("div", { class: "row mb14" }, []);
    var btnOne = UI.btn(t("pp.tab.onekey"), "btn-primary", function () { show(0); });
    var btnFine = UI.btn(t("pp.tab.fine"), "btn-outline", function () { show(1); });
    tabBar.appendChild(btnOne);
    tabBar.appendChild(btnFine);
    var panes = [UI.el("div", {}), UI.el("div", {})];
    function show(n) {
      btnOne.className = "btn " + (n === 0 ? "btn-primary" : "btn-outline");
      btnFine.className = "btn " + (n === 1 ? "btn-primary" : "btn-outline");
      panes[0].style.display = n === 0 ? "" : "none";
      panes[1].style.display = n === 1 ? "" : "none";
    }

    /* ============================================================
     * Pane 1: 一键处理（缩放 → 连通域抠图 → 内描边）
     * ============================================================ */

    var oneState = { orig: null };
    var dz1 = UI.dropzone({
      accept: "image/*",
      main: t("chroma.drop"),
      hint: t("chroma.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          oneState.orig = UI.imageDataFrom(r.img, 2048);
          r.release();
          oneInfo.textContent = t("pixel.loaded") + " " + oneState.orig.width + "×" + oneState.orig.height;
        });
      }
    });
    var oneInfo = UI.el("div", { class: "hint-text mt8" }, []);

    var sizeSel = UI.selectRow(t("pp.size"), [
      { v: "144", label: "144×144（RPG Maker）" },
      { v: "128", label: "128×128" },
      { v: "256", label: "256×256" },
      { v: "0", label: t("pp.size.keep") }
    ], "144", {});
    var chromaSw = UI.switchRow(t("pp.chroma"), true, function () {});
    var outlineSw = UI.switchRow(t("pp.outline"), true, function () {});
    var oneBtn = UI.btn(t("pp.go"), "btn-primary", runPipeline);
    var oneOut = UI.el("div", { class: "mt14" }, []);

    // 硬缩放（nearest neighbor）
    function hardScale(im, size) {
      if (!size) return im;
      var scale = size / Math.max(im.width, im.height);
      var w = Math.max(1, Math.round(im.width * scale));
      var h = Math.max(1, Math.round(im.height * scale));
      var src = UI.imageDataToCanvas(im);
      var c = UI.makeCanvas(w, h);
      var ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    }

    async function runPipeline() {
      if (!oneState.orig) { UI.modal("Error", UI.el("p", {}, [t("pixel.needupload")])); return; }
      oneBtn.disabled = true;
      try {
        var im = hardScale(oneState.orig, Number(sizeSel.value) || 0);
        if (chromaSw.value) {
          im = await FF.Wasm.chromaKey(im, { mode: 5, tol: 80, feather: 5, suppress: 0, c1: [0, 0, 0], c2: [0, 0, 0] });
        }
        if (outlineSw.value) {
          im = await FF.Wasm.outline(im, [26, 22, 18], 1);
        }
        oneOut.innerHTML = "";
        oneOut.appendChild(UI.el("div", { class: "pb-title" }, [t("pp.tab.onekey")]));
        oneOut.appendChild(UI.canvasFrame(UI.imageDataToCanvas(im)));
        var row = UI.el("div", { class: "btn-row mt8" }, [
          UI.btn(t("common.download") + " PNG", "btn-primary", function () {
            UI.downloadCanvas(UI.imageDataToCanvas(im), "onekey_output.png");
          }, "download"),
          UI.btn(t("ai.to.chroma"), "btn-ghost", function () {
            var c = UI.imageDataToCanvas(im);
            sessionStorage.setItem("ff.transfer", c.toDataURL());
            location.hash = "#/chroma";
          })
        ]);
        oneOut.appendChild(row);
        oneOut.appendChild(UI.el("div", { class: "hint-text mt8" }, [t("pp.rpg.link")]));
      } finally {
        oneBtn.disabled = false;
      }
    }

    panes[0].appendChild(dz1);
    panes[0].appendChild(oneInfo);
    panes[0].appendChild(UI.el("div", { class: "param-grid mt14" }, [
      sizeSel.el, UI.el("div", { class: "param-row" }, [chromaSw.el]), UI.el("div", { class: "param-row" }, [outlineSw.el])
    ]));
    panes[0].appendChild(UI.el("div", { class: "mt14" }, [oneBtn]));
    panes[0].appendChild(oneOut);

    /* ============================================================
     * Pane 2: 精细修图（画笔/橡皮/超级橡皮/取色 + Ctrl+Z）
     * ============================================================ */

    var CW = 480, CH = 480;
    var editIm = null; // ImageData
    var canvas = UI.makeCanvas(CW, CH);
    canvas.style.width = "100%";
    canvas.style.maxHeight = "480px";
    canvas.style.imageRendering = "pixelated";
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var editFrame = UI.el("div", { class: "canvas-frame" }, [canvas]);

    var undoStack = null; // 单步撤销快照
    var tool = "brush";
    var brushSize = 4;
    var brushColor = "#b64a2e";
    var painting = false;

    var dz2 = UI.dropzone({
      accept: "image/*",
      main: t("chroma.drop"),
      hint: t("chroma.hint"),
      onFiles: function (files) {
        UI.fileToImage(files[0]).then(function (r) {
          var im = UI.imageDataFrom(r.img, 1024);
          r.release();
          loadEdit(im);
        });
      }
    });

    function loadEdit(im) {
      editIm = im;
      canvas.width = im.width;
      canvas.height = im.height;
      canvas.style.width = "100%";
      ctx.putImageData(im, 0, 0);
    }

    function pushUndo() {
      if (editIm) undoStack = new Uint8ClampedArray(editIm.data);
    }
    function undo() {
      if (!undoStack || !editIm) return;
      editIm.data.set(undoStack);
      ctx.putImageData(editIm, 0, 0);
      undoStack = null;
    }

    function canvasPos(e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: Math.floor((e.clientX - r.left) / r.width * canvas.width),
        y: Math.floor((e.clientY - r.top) / r.height * canvas.height)
      };
    }

    function hex2rgb(hex) {
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function paintAt(p) {
      if (!editIm) return;
      pushUndo();
      var rgb = tool === "eraser" ? [0, 0, 0] : hex2rgb(brushColor);
      var alpha = tool === "eraser" ? 0 : 255;
      var rad = Math.floor(brushSize / 2);
      for (var dy = -rad; dy <= rad; dy++) {
        for (var dx = -rad; dx <= rad; dx++) {
          var x = p.x + dx, y = p.y + dy;
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
          var o = (y * canvas.width + x) * 4;
          editIm.data[o] = rgb[0]; editIm.data[o + 1] = rgb[1]; editIm.data[o + 2] = rgb[2];
          editIm.data[o + 3] = alpha;
        }
      }
      ctx.putImageData(editIm, 0, 0);
    }

    // 超级橡皮：清除点击处同色连通域（含容差）
    function superErase(p) {
      if (!editIm) return;
      pushUndo();
      var w = canvas.width, h = canvas.height;
      var o0 = (p.y * w + p.x) * 4;
      var target = [editIm.data[o0], editIm.data[o0 + 1], editIm.data[o0 + 2], editIm.data[o0 + 3]];
      var tol = 40;
      var near = function (i) {
        var o = i * 4;
        var d = editIm.data[o] - target[0] + editIm.data[o + 1] - target[1] + editIm.data[o + 2] - target[2] + editIm.data[o + 3] - target[3];
        return Math.abs(d) <= tol * 4;
      };
      var stack = [p.y * w + p.x];
      var seen = new Uint8Array(w * h);
      while (stack.length) {
        var idx = stack.pop();
        if (seen[idx]) continue;
        seen[idx] = 1;
        if (!near(idx)) continue;
        editIm.data[idx * 4 + 3] = 0;
        var x = idx % w, y = (idx / w) | 0;
        if (x > 0) stack.push(idx - 1);
        if (x < w - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - w);
        if (y < h - 1) stack.push(idx + w);
      }
      ctx.putImageData(editIm, 0, 0);
    }

    function pickColor(p) {
      if (!editIm) return;
      var o = (p.y * canvas.width + p.x) * 4;
      brushColor = "#" + [editIm.data[o], editIm.data[o + 1], editIm.data[o + 2]]
        .map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
      colorIn.value = brushColor;
      setTool("brush");
    }

    canvas.addEventListener("pointerdown", function (e) {
      var p = canvasPos(e);
      if (tool === "pick") { pickColor(p); return; }
      if (tool === "super") { superErase(p); return; }
      painting = true;
      canvas.setPointerCapture(e.pointerId);
      paintAt(p);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!painting) return;
      paintAt(canvasPos(e));
    });
    canvas.addEventListener("pointerup", function () { painting = false; });

    var toolRow = UI.el("div", { class: "row", style: { gap: "6px" } }, []);
    function setTool(name) {
      tool = name;
      Array.from(toolRow.children).forEach(function (b) {
        b.className = "btn btn-sm " + (b.dataset.tool === tool ? "btn-primary" : "btn-ghost");
      });
    }
    [["brush", "pp.brush"], ["eraser", "pp.eraser"], ["super", "pp.supereraser"], ["pick", "pp.pick"]].forEach(function (pair) {
      var b = UI.btn(t(pair[1]), "btn-ghost btn-sm", function () { setTool(pair[0]); });
      b.dataset.tool = pair[0];
      toolRow.appendChild(b);
    });
    var brushSizeSlider = UI.slider(t("pp.brushsize"), 1, 32, 4, {
      onInput: function (v) { brushSize = v; }
    });
    var colorIn = UI.el("input", { type: "color", value: brushColor });
    colorIn.addEventListener("input", function () { brushColor = colorIn.value; });
    var undoBtn = UI.btn(t("pp.undo"), "btn-ghost btn-sm", undo);
    var exportBtn = UI.btn(t("common.download") + " PNG", "btn-primary", function () {
      if (editIm) UI.downloadCanvas(UI.imageDataToCanvas(editIm), "fine_edit.png");
    }, "download");

    panes[1].appendChild(dz2);
    panes[1].appendChild(editFrame);
    panes[1].appendChild(UI.el("div", { class: "mt14" }, [toolRow]));
    panes[1].appendChild(UI.el("div", { class: "param-grid mt14" }, [
      brushSizeSlider.el,
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pixel.ocolor")]), colorIn])
    ]));
    panes[1].appendChild(UI.el("div", { class: "btn-row mt14" }, [undoBtn, exportBtn]));
    panes[1].appendChild(UI.el("div", { class: "hint-text mt8" }, [t("pp.finehint")]));

    function acceptImage(url) {
      var img = new Image();
      img.onload = function () {
        oneState.orig = UI.imageDataFrom(img, 2048);
        oneInfo.textContent = t("pixel.loaded") + " " + oneState.orig.width + "×" + oneState.orig.height;
        show(0);
      };
      img.src = url;
    }

    document.addEventListener("keydown", function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && panes[1].style.display !== "none") {
        undo();
        e.preventDefault();
      }
    });

    card.appendChild(tabBar);
    card.appendChild(panes[0]);
    card.appendChild(panes[1]);
    show(0);

    return {
      root: root,
      cleanup: function () {
        document.removeEventListener("keydown", onKey);
      },
      onPaste: acceptImage,
      onDrop: acceptImage
    };
  };
})();
