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
      "pp.tab.dupframes", "pp.tab.seqcompress", "pp.tab.audio", "pp.tab.flow", "pp.tab.pixelcore"];
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
      FF.ProPlus.pixelCore(panes[13]);
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
      // 原站支持从暂存拖入
      dz.addEventListener("dragover", function (e) { e.preventDefault(); });
      dz.addEventListener("drop", function (e) {
        var sd = "";
        try { sd = e.dataTransfer.getData("application/x-frameronin-stash-url") || e.dataTransfer.getData("text/ff-stash") || ""; } catch (err) {}
        if (!sd) return;
        e.preventDefault();
        sd.split("\n").forEach(function (u) {
          u = u.trim();
          if (!/^data:image\//.test(u)) return;
          var img = new Image();
          img.onload = function () {
            var c = UI.makeCanvas(img.naturalWidth, img.naturalHeight);
            c.getContext("2d").drawImage(img, 0, 0);
            imgs.push(c);
            info.textContent = imgs.length + " " + t("video.frames");
          };
          img.src = u;
        });
      });
      var info = UI.el("div", { class: "hint-text mt8" }, []);
      // 原站「统一大小」：以最大宽高为格，网格拼成一张图；对齐决定格内位置（不缩放）
      var colsIn = UI.el("input", { type: "number", value: "4", min: "1", max: "64", style: { width: "80px" } });
      var padHSel = UI.selectRow(t("pro.unify.padH"), [
        { v: "left", label: t("pro.unify.left") }, { v: "center", label: t("pro.unify.center") }, { v: "right", label: t("pro.unify.right") }
      ], "center", {});
      var padVSel = UI.selectRow(t("pro.unify.padV"), [
        { v: "top", label: t("pro.unify.top") }, { v: "center", label: t("pro.unify.center") }, { v: "bottom", label: t("pro.unify.bottom") }
      ], "bottom", {});
      var sizeHint = UI.el("div", { class: "hint-text mt8" }, []);
      var go = UI.btn(t("pro.unify.go"), "btn-primary", function () {
        if (!imgs.length) return;
        var B = Math.max(1, Math.min(64, Number(colsIn.value) || 4));
        var maxW = Math.max.apply(null, imgs.map(function (c) { return c.width; }));
        var maxH = Math.max.apply(null, imgs.map(function (c) { return c.height; }));
        var rows = Math.ceil(imgs.length / B);
        var out = UI.makeCanvas(B * maxW, rows * maxH);
        var ctx = out.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        var ha = padHSel.value === "left" ? "start" : padHSel.value === "right" ? "end" : "center";
        var va = padVSel.value === "top" ? "start" : padVSel.value === "bottom" ? "end" : "center";
        function off(total, size, align) {
          if (align === "start") return 0;
          if (align === "end") return total - size;
          return Math.floor((total - size) / 2);
        }
        imgs.forEach(function (c, i) {
          var row = Math.floor(i / B);
          var x = (i % B) * maxW + off(maxW, c.width, ha);
          var y = row * maxH + off(maxH, c.height, va);
          ctx.drawImage(c, 0, 0, c.width, c.height, x, y, c.width, c.height);
        });
        sizeHint.textContent = t("pro.unify.hint")
          .replace("{w}", maxW).replace("{h}", maxH)
          .replace("{ow}", B * maxW).replace("{oh}", rows * maxH);
        out.toBlob(function (blob) {
          UI.download(blob, "unify_" + imgs.length + "_images.png");
        }, "image/png");
        showResult(out);
      });
      var showResult = resultBox(pane, t("pro.tab.unify"));
      pane.appendChild(dz);
      pane.appendChild(info);
      pane.appendChild(UI.el("div", { class: "param-grid" }, [
        UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("pro.unify.cols")]), colsIn]),
        padHSel.el, padVSel.el
      ]));
      pane.appendChild(sizeHint);
      pane.appendChild(UI.el("div", { class: "mt14" }, [go]));
    })();

    /* ========== 自定义切片（对齐原站：网格 / 智能检测 / L7 接缝） ========== */

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
      var modeSel = UI.selectRow(t("pro.slice.mode"), [
        { v: "grid", label: t("pro.slice.mode.grid") },
        { v: "smart", label: t("pro.slice.mode.smart") },
        { v: "l7", label: t("pro.slice.mode.l7") }
      ], "grid", { onChange: function () {
        gridRow.style.display = modeSel.value === "grid" ? "" : "none";
        l7Row.style.display = modeSel.value === "l7" ? "" : "none";
      } });
      var cwIn = UI.el("input", { type: "number", value: "64", min: "1", style: { width: "80px" } });
      var chIn = UI.el("input", { type: "number", value: "64", min: "1", style: { width: "80px" } });
      var gridRow = UI.el("div", { class: "param-row" }, [
        UI.el("label", {}, [t("pro.slice.size")]),
        UI.el("div", { class: "row" }, [cwIn, UI.el("span", { class: "hint-text" }, ["×"]), chIn])
      ]);
      var colsIn = UI.el("input", { type: "number", value: "4", min: "1", max: "128", style: { width: "80px" } });
      var rowsIn = UI.el("input", { type: "number", value: "4", min: "1", max: "128", style: { width: "80px" } });
      var bandIn = UI.el("input", { type: "number", value: "25", min: "0", max: "100", style: { width: "80px" } });
      var l7Row = UI.el("div", { class: "param-row", style: { display: "none" } }, [
        UI.el("label", {}, [t("pro.slice.l7")]),
        UI.el("div", { class: "row" }, [colsIn, UI.el("span", { class: "hint-text" }, ["×"]), rowsIn,
          UI.el("span", { class: "hint-text" }, [t("pro.slice.band")]), bandIn])
      ]);
      // 智能检测 zo：行/列 alpha 和 → 内容带计数
      function detectBands(im, vertical) {
        var alphaSums = [];
        var outer = vertical ? im.width : im.height;
        var inner = vertical ? im.height : im.width;
        for (var o = 0; o < outer; o++) {
          var sum = 0;
          for (var i = 0; i < inner; i++) {
            var idx = vertical ? ((i * im.width + o) * 4 + 3) : ((o * im.width + i) * 4 + 3);
            sum += im.data[idx];
          }
          alphaSums.push(sum);
        }
        var bands = [], s = -1;
        for (var p = 0; p < outer; p++) {
          var has = alphaSums[p] > 0;
          if (has && s < 0) s = p;
          if ((!has || p === outer - 1) && s >= 0) {
            var e = has ? p + 1 : p;
            if (e > s) bands.push([s, e]);
            s = -1;
          }
        }
        return bands;
      }
      // L7 接缝：名义等分 ±band 带内搜索 alpha 总和最小的切线
      function l7Lines(im, n, vertical, bandPct) {
        var len = vertical ? im.width : im.height;
        var gap = len / n;
        var band = Math.min(64, Math.max(1, Math.floor(gap * bandPct / 100)));
        var inner = vertical ? im.height : im.width;
        var step = Math.max(1, Math.floor(inner / 200));
        function alphaSumAt(pos) {
          var sum = 0;
          if (pos <= 0 || pos >= len) return Infinity;
          for (var i = 0; i < inner; i += step) {
            var idx = vertical ? ((i * im.width + pos) * 4 + 3) : ((pos * im.width + i) * 4 + 3);
            sum += im.data[idx];
          }
          return sum;
        }
        var lines = [0];
        for (var k = 1; k < n; k++) {
          var nominal = Math.floor(k * len / n);
          var lo = Math.max(1, nominal - band), hi = Math.min(len - 1, nominal + band);
          var bestPos = nominal, bestVal = Infinity;
          for (var p2 = lo; p2 <= hi; p2++) {
            var v = alphaSumAt(p2);
            if (v < bestVal || (v === bestVal && Math.abs(p2 - nominal) < Math.abs(bestPos - nominal))) {
              bestVal = v; bestPos = p2;
            }
          }
          lines.push(bestPos);
        }
        lines.push(len);
        return lines;
      }
      function cutAndZip(boundsX, boundsY, namePrefix) {
        var files = [];
        var n = 0;
        for (var ry = 0; ry < boundsY.length - 1; ry++) {
          for (var rx = 0; rx < boundsX.length - 1; rx++) {
            var x = boundsX[rx], y = boundsY[ry];
            var w = boundsX[rx + 1] - x, h = boundsY[ry + 1] - y;
            if (w <= 0 || h <= 0) continue;
            var c = UI.makeCanvas(w, h);
            c.getContext("2d").drawImage(UI.imageDataToCanvas(im), x, y, w, h, 0, 0, w, h);
            files.push({ canvas: c, name: namePrefix + String(++n).padStart(3, "0") + ".png" });
          }
        }
        if (!files.length) { UI.modal("Error", UI.el("p", {}, [t("pro.slice.err")])); return; }
        Promise.all(files.map(function (f) {
          return new Promise(function (res) {
            f.canvas.toBlob(function (blob) { res({ name: f.name, data: blob }); }, "image/png");
          });
        })).then(async function (outs) {
          var zipped = [];
          for (var i = 0; i < outs.length; i++) {
            zipped.push({ name: outs[i].name, data: new Uint8Array(await outs[i].data.arrayBuffer()) });
          }
          UI.download(FF.Zip.make(zipped), "slices_" + (boundsX.length - 1) + "x" + (boundsY.length - 1) + ".zip");
        });
      }
      var go = UI.btn(t("pro.slice.go"), "btn-primary", function () {
        if (!im) return;
        if (modeSel.value === "grid") {
          var cw = Number(cwIn.value) || 64, ch = Number(chIn.value) || 64;
          var cols = Math.floor(im.width / cw), rows = Math.floor(im.height / ch);
          if (!cols || !rows) { UI.modal("Error", UI.el("p", {}, [t("pro.slice.err")])); return; }
          var bx = [], by = [];
          for (var x = 0; x <= cols; x++) bx.push(x * cw);
          for (var y = 0; y <= rows; y++) by.push(y * ch);
          cutAndZip(bx, by, "slice_");
        } else if (modeSel.value === "smart") {
          var cb = detectBands(im, true), rb = detectBands(im, false);
          if (cb.length < 1 || rb.length < 1) { UI.modal("Error", UI.el("p", {}, [t("pro.slice.err")])); return; }
          var bx2 = [0]; cb.forEach(function (b) { bx2.push(b[0], b[1]); });
          var by2 = [0]; rb.forEach(function (b) { by2.push(b[0], b[1]); });
          bx2.push(im.width); by2.push(im.height);
          cutAndZip(bx2, by2, "smart_");
        } else {
          var n = Math.max(1, +colsIn.value | 0), m = Math.max(1, +rowsIn.value | 0);
          var lx = l7Lines(im, n, true, +bandIn.value || 25);
          var ly = l7Lines(im, m, false, +bandIn.value || 25);
          cutAndZip(lx, ly, "frame_");
        }
      });
      pane.appendChild(dz);
      pane.appendChild(info);
      pane.appendChild(UI.el("div", { class: "param-grid mt14" }, [modeSel.el, gridRow, l7Row]));
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
