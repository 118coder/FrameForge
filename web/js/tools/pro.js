/* FrameForge · RoninPro 效率工具（对齐 V5：自定义缩放 / 统一尺寸 / 自定义切片 / 单图调整 Pro） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  function hex2rgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function nearestScale(im, scale) {
    var w = Math.max(1, Math.round(im.width * scale));
    var h = Math.max(1, Math.round(im.height * scale));
    var src = UI.imageDataToCanvas(im);
    var c = UI.makeCanvas(w, h);
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }

  FF.Tools.pro = function () {
    var sk = UI.pageSkeleton("mod.pro.t", "mod.pro.d", null);
    var root = sk.root, card = sk.card;

    var tabBar = UI.el("div", { class: "row mb14", style: { gap: "6px", flexWrap: "wrap" } }, []);
    var NAMES = ["pro.tab.scale", "pro.tab.unify", "pro.tab.slice", "pro.tab.adjust",
      "pp.tab.crop", "pp.tab.expshrink", "pp.tab.isoskew", "pp.tab.scatter", "pp.tab.largesplit",
      "pp.tab.dupframes", "pp.tab.seqcompress", "pp.tab.audio", "pp.tab.flow"];
    var panes = NAMES.map(function () { return UI.el("div", { style: { display: "none" } }, []); });
    var paneWrap = UI.el("div", {}, []);
    var btns = NAMES.map(function (k, i) {
      var b = UI.btn(t(k), "btn-outline", function () { show(i); });
      b.style.fontSize = "12px";
      tabBar.appendChild(b);
      paneWrap.appendChild(panes[i]);
      return b;
    });
    function show(n) {
      btns.forEach(function (b, i) { b.className = "btn " + (i === n ? "btn-primary" : "btn-outline"); });
      panes.forEach(function (p, i) { p.style.display = i === n ? "" : "none"; });
    }

    /* RoninPro 扩展工具（proplus.js 提供） */
    if (FF.ProPlus) {
      FF.ProPlus.simpleCrop(panes[4]);
      FF.ProPlus.expandShrink(panes[5]);
      FF.ProPlus.isoSkew(panes[6]);
      FF.ProPlus.scatterSlice(panes[7]);
      FF.ProPlus.largeSplit(panes[8]);
      FF.ProPlus.dupFrames(panes[9]);
      FF.ProPlus.seqCompress(panes[10]);
      FF.ProPlus.audioCompress(panes[11]);
      FF.ProPlus.flowInterp(panes[12]);
    }

    function resultBox(pane, title) {
      var box = UI.el("div", { class: "mt14" }, []);
      pane.appendChild(box);
      return function (canvas) {
        box.innerHTML = "";
        box.appendChild(UI.el("div", { class: "pb-title" }, [title]));
        box.appendChild(UI.canvasFrame(canvas));
        box.appendChild(UI.el("div", { class: "btn-row mt8" }, [
          UI.btn(t("common.download") + " PNG", "btn-primary", function () {
            UI.downloadCanvas(canvas, title.replace(/\s+/g, "_") + ".png");
          }, "download")
        ]));
      };
    }

    /* ========== 自定义缩放 ========== */

    (function () {
      var pane = panes[0];
      var im = null;
      var dz = UI.dropzone({
        accept: "image/*", main: t("chroma.drop"), hint: t("chroma.hint"),
        onFiles: function (files) {
          UI.fileToImage(files[0]).then(function (r2) {
            im = UI.imageDataFrom(r2.img, 4096);
            r2.release();
            info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
          });
        }
      });
      var info = UI.el("div", { class: "hint-text mt8" }, []);
      var scaleSlider = UI.slider(t("pro.scale.factor"), 1, 16, 4, {});
      var go = UI.btn(t("pro.go"), "btn-primary", function () {
        if (!im) return;
        showResult(nearestScale(im, scaleSlider.value));
      });
      var showResult = resultBox(pane, t("pro.tab.scale"));
      pane.appendChild(dz);
      pane.appendChild(info);
      pane.appendChild(scaleSlider.el);
      pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    })();

    /* ========== 统一尺寸（多图） ========== */

    (function () {
      var pane = panes[1];
      var imgs = [];
      var dz = UI.dropzone({
        accept: "image/*", multiple: true,
        main: t("sheet.upload.multi"), hint: t("chroma.hint"),
        onFiles: function (files) {
          Promise.all(Array.from(files).map(function (f) { return UI.fileToImage(f); })).then(function (rs) {
            rs.forEach(function (r2) {
              var c = UI.makeCanvas(r2.img.naturalWidth, r2.img.naturalHeight);
              c.getContext("2d").drawImage(r2.img, 0, 0);
              imgs.push(c);
              r2.release();
            });
            info.textContent = imgs.length + " " + t("video.frames");
          });
        }
      });
      var info = UI.el("div", { class: "hint-text mt8" }, []);
      var mode = UI.selectRow(t("pro.unify.mode"), [
        { v: "max", label: t("pro.unify.max") },
        { v: "custom", label: t("pro.unify.custom") }
      ], "max", { onChange: function () { customW.style.display = mode.value === "custom" ? "" : "none"; } });
      var cw = UI.el("input", { type: "number", value: "256", min: "4", style: { width: "80px" } });
      var ch = UI.el("input", { type: "number", value: "256", min: "4", style: { width: "80px" } });
      var customW = UI.el("div", { class: "row", style: { display: "none" } }, [cw, UI.el("span", { class: "hint-text" }, ["×"]), ch]);
      var bg = UI.el("input", { type: "color", value: "#000000" });
      var fillSw = UI.switchRow(t("pro.unify.fill"), false, function () {});
      var go = UI.btn(t("pro.unify.go"), "btn-primary", function () {
        if (!imgs.length) return;
        var W = mode.value === "max"
          ? Math.max.apply(null, imgs.map(function (c) { return c.width; }))
          : Number(cw.value) || 256;
        var H = mode.value === "max"
          ? Math.max.apply(null, imgs.map(function (c) { return c.height; }))
          : Number(ch.value) || 256;
        var rgb = hex2rgb(bg.value);
        var out = imgs.map(function (c) {
          var o = UI.makeCanvas(W, H);
          var ctx = o.getContext("2d");
          if (fillSw.value) { ctx.fillStyle = bg.value; ctx.fillRect(0, 0, W, H); }
          ctx.imageSmoothingEnabled = false;
          var s = Math.min(W / c.width, H / c.height);
          var dw = Math.round(c.width * s), dh = Math.round(c.height * s);
          ctx.drawImage(c, Math.floor((W - dw) / 2), Math.floor((H - dh) / 2), dw, dh);
          return o;
        });
        // 逐张 toBlob 打包 ZIP
        (async function () {
          var files = [];
          for (var i = 0; i < out.length; i++) {
            var blob = await new Promise(function (r3) { out[i].toBlob(r3, "image/png"); });
            files.push({ name: "unify_" + String(i + 1).padStart(3, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
          }
          UI.download(FF.Zip.make(files), "unified_" + W + "x" + H + ".zip");
        })();
        showResult(out[0]);
      });
      var showResult = resultBox(pane, t("pro.tab.unify"));
      pane.appendChild(dz);
      pane.appendChild(info);
      pane.appendChild(UI.el("div", { class: "param-grid" }, [mode.el,
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pro.unify.size")]), customW]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("video.bg")]), bg]),
        UI.el("div", { class: "param-row" }, [fillSw.el])
      ]));
      pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    })();

    /* ========== 自定义切片 ========== */

    (function () {
      var pane = panes[2];
      var im = null;
      var dz = UI.dropzone({
        accept: "image/*", main: t("chroma.drop"), hint: t("chroma.hint"),
        onFiles: function (files) {
          UI.fileToImage(files[0]).then(function (r2) {
            im = UI.imageDataFrom(r2.img, 4096);
            r2.release();
            info.textContent = t("pixel.loaded") + " " + im.width + "×" + im.height;
          });
        }
      });
      var info = UI.el("div", { class: "hint-text mt8" }, []);
      var cwIn = UI.el("input", { type: "number", value: "64", min: "1", style: { width: "80px" } });
      var chIn = UI.el("input", { type: "number", value: "64", min: "1", style: { width: "80px" } });
      var go = UI.btn(t("pro.slice.go"), "btn-primary", async function () {
        if (!im) return;
        var cw = Number(cwIn.value) || 64, ch = Number(chIn.value) || 64;
        var cols = Math.floor(im.width / cw), rows = Math.floor(im.height / ch);
        if (!cols || !rows) { UI.modal("Error", UI.el("p", {}, [t("pro.slice.err")])); return; }
        var files = [];
        for (var ry = 0; ry < rows; ry++) {
          for (var rx = 0; rx < cols; rx++) {
            var c = UI.makeCanvas(cw, ch);
            c.getContext("2d").drawImage(UI.imageDataToCanvas(im), rx * cw, ry * ch, cw, ch, 0, 0, cw, ch);
            var blob = await new Promise(function (r3) { c.toBlob(r3, "image/png"); });
            files.push({ name: "slice_" + String(ry + 1).padStart(2, "0") + "_" + String(rx + 1).padStart(2, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
          }
        }
        UI.download(FF.Zip.make(files), "slices_" + cols + "x" + rows + ".zip");
      });
      pane.appendChild(dz);
      pane.appendChild(info);
      pane.appendChild(UI.el("div", { class: "param-row mt14" }, [
        UI.el("label", {}, [t("pro.slice.size")]),
        UI.el("div", { class: "row" }, [cwIn, UI.el("span", { class: "hint-text" }, ["×"]), chIn])
      ]));
      pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    })();

    /* ========== 单图调整 Pro（切块 + 逐帧平移/裁边 + 重组合） ========== */

    (function () {
      var pane = panes[3];
      var im = null;
      var frames = []; // {canvas, dx, dy, crop:[l,t,r,b]}
      var dz = UI.dropzone({
        accept: "image/*", main: t("sheet.s1"), hint: t("chroma.hint"),
        onFiles: function (files) {
          UI.fileToImage(files[0]).then(function (r2) {
            im = UI.imageDataFrom(r2.img, 4096);
            r2.release();
            splitNow();
          });
        }
      });
      var colsIn = UI.el("input", { type: "number", value: "4", min: "1", style: { width: "70px" } });
      var rowsIn = UI.el("input", { type: "number", value: "4", min: "1", style: { width: "70px" } });
      var shiftX = UI.el("input", { type: "number", value: "0", style: { width: "70px" }, title: t("pro.adj.shift") });
      var shiftY = UI.el("input", { type: "number", value: "0", style: { width: "70px" }, title: t("pro.adj.shift") });
      var cropIn = UI.el("input", { type: "number", value: "0", min: "0", style: { width: "70px" }, title: t("pro.adj.crop") });
      var outCols = UI.el("input", { type: "number", value: "4", min: "1", style: { width: "70px" } });
      var splitBtn = UI.btn(t("pro.adj.split"), "btn-ghost btn-sm", splitNow);
      var rebuildBtn = UI.btn(t("pro.adj.rebuild"), "btn-primary", rebuild);
      var stripWrap = UI.el("div", { class: "mt14" }, []);
      var info = UI.el("div", { class: "hint-text mt8" }, []);

      function splitNow() {
        if (!im) return;
        var cw = Math.floor(im.width / Number(colsIn.value) || 1);
        var ch = Math.floor(im.height / Number(rowsIn.value) || 1);
        if (cw < 1 || ch < 1) return;
        frames = [];
        var src = UI.imageDataToCanvas(im);
        for (var ry = 0; ry < Number(rowsIn.value); ry++) {
          for (var rx = 0; rx < Number(colsIn.value); rx++) {
            var c = UI.makeCanvas(cw, ch);
            c.getContext("2d").drawImage(src, rx * cw, ry * ch, cw, ch, 0, 0, cw, ch);
            frames.push({ canvas: c, dx: 0, dy: 0, crop: 0 });
          }
        }
        renderStrip();
      }

      function applyAdjust(f, cw, ch) {
        var crop = f.crop || 0;
        var sw = cw - crop * 2, sh = ch - crop * 2;
        if (sw < 1 || sh < 1) return f.canvas;
        var c = UI.makeCanvas(cw, ch);
        var ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(f.canvas, crop, crop, sw, sh, (Number(shiftX.value) || 0) + crop, (Number(shiftY.value) || 0) + crop, sw, sh);
        return c;
      }

      function renderStrip() {
        stripWrap.innerHTML = "";
        var strip = UI.el("div", { class: "filmstrip" }, []);
        frames.forEach(function (f) {
          var th = UI.el("div", { class: "thumb" }, [f.canvas]);
          strip.appendChild(th);
        });
        stripWrap.appendChild(strip);
        info.textContent = frames.length + " " + t("video.frames");
      }

      async function rebuild() {
        if (!frames.length) return;
        var cw = frames[0].canvas.width, ch = frames[0].canvas.height;
        var adjusted = frames.map(function (f) {
          var c = UI.makeCanvas(cw, ch);
          c.getContext("2d").drawImage(applyAdjust(f, cw, ch), 0, 0);
          return c;
        });
        // 重组合
        var oc = Math.min(Number(outCols.value) || adjusted.length, adjusted.length);
        var orows = Math.ceil(adjusted.length / oc);
        var sheet = UI.makeCanvas(oc * cw, orows * ch);
        var ctx = sheet.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        adjusted.forEach(function (c, i) {
          ctx.drawImage(c, (i % oc) * cw, Math.floor(i / oc) * ch);
        });
        showResult(sheet);
        // ZIP
        var files = [];
        for (var i = 0; i < adjusted.length; i++) {
          var blob = await new Promise(function (r3) { adjusted[i].toBlob(r3, "image/png"); });
          files.push({ name: "frame_" + String(i + 1).padStart(4, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
        }
        UI.download(FF.Zip.make(files), "adjusted_frames.zip");
      }

      var showResult = resultBox(pane, t("pro.tab.adjust"));
      pane.appendChild(dz);
      pane.appendChild(UI.el("div", { class: "param-grid mt14" }, [
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pro.adj.grid")]), UI.el("div", { class: "row" }, [colsIn, UI.el("span", { class: "hint-text" }, ["×"]), rowsIn, splitBtn])]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pro.adj.shift")]), UI.el("div", { class: "row" }, [shiftX, shiftY])]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pro.adj.crop")]), cropIn]),
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("sheet.buildcols")]), outCols])
      ]));
      pane.appendChild(UI.el("div", { class: "btn-row mt14" }, [rebuildBtn]));
      pane.appendChild(stripWrap);
      pane.appendChild(info);
    })();

    card.appendChild(tabBar);
    card.appendChild(paneWrap);
    show(0);

    return { root: root };
  };
})();
