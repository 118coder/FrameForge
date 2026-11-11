/* FrameForge · GIF 处理（解帧 / 排序 / 合并） */
(function () {
  "use strict";

  var FF = window.FF;
  var UI = FF.UI;
  var t = function (k) { return FF.I18N.t(k); };

  FF.Tools = FF.Tools || {};

  FF.Tools.gif = function (query) {
    query = query || {};
    var sk = UI.pageSkeleton("mod.gif.t", "mod.gif.d", null);
    var root = sk.root, card = sk.card;

    var frames = []; // {w,h,delay,data:Uint8Array}
    var strip = null;

    var dz = UI.dropzone({
      accept: "image/gif,image/*",
      multiple: true,
      main: t("gif.s1"),
      hint: t("chroma.hint"),
      onFiles: handleFiles
    });

    var workArea = UI.el("div", { style: { display: "none" } }, []);
    var stripWrap = UI.el("div", { class: "mt14" });
    var reorderHint = UI.el("div", { class: "hint-text mt8" }, [t("gif.reorder")]);

    var delayIn = UI.el("input", { type: "number", value: "80", min: "20", step: "10", style: { width: "90px" } });
    var bgIn = UI.el("input", { type: "color", value: "#000000" });
    var applyDelayBtn = UI.btn(t("gif.delay") + " ✓", "btn-ghost btn-sm", function () {
      frames.forEach(function (f) { f.delay = Math.max(20, Number(delayIn.value) || 80); });
      if (strip) strip.rebuild();
    });
    var addMoreBtn = UI.btn(t("gif.addmore"), "btn-ghost btn-sm", function () {
      var inp = dz.querySelector("input[type=file]");
      if (inp) inp.click();
    });

    var gifBtn = UI.btn(t("gif.exportgif"), "btn-primary", exportGif, "download");
    var zipBtn = UI.btn(t("gif.exportzip"), "btn-ghost", exportZip, "download");
    var vstackBtn = UI.btn(t("gif.vstack"), "btn-ghost", function () { stitch(true); });
    var hstackBtn = UI.btn(t("gif.hstack"), "btn-ghost", function () { stitch(false); });
    var prog = UI.progress();
    var outPreview = UI.el("div", { class: "mt14" }, []);

    function handleFiles(files) {
      var gifFile = files.find(function (f) { return /\.gif$/i.test(f.name) || f.type === "image/gif"; });
      var job;
      if (gifFile) {
        job = gifFile.arrayBuffer().then(function (buf) {
          return FF.Wasm.gifDecode(buf);
        }).then(function (res) {
          res.frames.forEach(function (f) { if (!f.delay) f.delay = 80; });
          frames = frames.concat(res.frames);
        });
      } else {
        var imgJobs = files.filter(function (f) { return /image\//.test(f.type); })
          .map(function (f) { return UI.fileToImage(f); });
        job = Promise.all(imgJobs).then(function (rs) {
          rs.forEach(function (r) {
            var w = r.img.naturalWidth, h = r.img.naturalHeight;
            var c = UI.makeCanvas(w, h);
            c.getContext("2d").drawImage(r.img, 0, 0);
            var d = c.getContext("2d").getImageData(0, 0, w, h);
            frames.push({ w: w, h: h, delay: Number(delayIn.value) || 80, data: new Uint8Array(d.data.buffer) });
            r.release();
          });
        });
      }
      job.then(function () {
        normalizeSizes();
        renderStrip();
      }).catch(function (e) {
        UI.modal("Error", UI.el("p", {}, [String(e.message || e)]));
      });
    }

    function normalizeSizes() {
      // 全部帧取最大画布居中（GIF 尺寸不一 / 图片混合时）
      if (!frames.length) return;
      var w = Math.max.apply(null, frames.map(function (f) { return f.w; }));
      var h = Math.max.apply(null, frames.map(function (f) { return f.h; }));
      frames = frames.map(function (f) {
        if (f.w === w && f.h === h) return f;
        var im = new ImageData(new Uint8ClampedArray(f.data), f.w, f.h);
        var c1 = UI.imageDataToCanvas(im);
        var c2 = UI.makeCanvas(w, h);
        var ctx = c2.getContext("2d");
        ctx.drawImage(c1, Math.floor((w - f.w) / 2), Math.floor((h - f.h) / 2));
        var d = ctx.getImageData(0, 0, w, h);
        return { w: w, h: h, delay: f.delay, data: new Uint8Array(d.data.buffer) };
      });
    }

    function renderStrip() {
      workArea.style.display = "";
      stripWrap.innerHTML = "";
      var canvases = frames.map(function (f) {
        return UI.imageDataToCanvas(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h));
      });
      strip = UI.filmstrip(canvases, {
        reorderable: true,
        delayEditable: true,
        onReorder: function (from, to) {
          var moved = frames.splice(from, 1)[0];
          frames.splice(to, 0, moved);
        },
        onDelete: function (i) {
          frames.splice(i, 1);
          if (!frames.length) workArea.style.display = "none";
          renderStrip();
        }
      });
      stripWrap.appendChild(strip.el);
      reorderHint.style.display = "";
    }

    function orderedFrames() {
      return frames;
    }

    async function exportGif() {
      var sel = orderedFrames();
      if (!sel.length) return;
      gifBtn.disabled = true;
      prog.show("");
      try {
        var bg = [parseInt(bgIn.value.slice(1, 3), 16), parseInt(bgIn.value.slice(3, 5), 16), parseInt(bgIn.value.slice(5, 7), 16)];
        var delays = sel.map(function (f) { return f.delay || 80; });
        var out = await FF.Wasm.gifEncode(sel, sel[0].w, sel[0].h, {
          bg: bg, delays: delays, defaultDelay: 80, repeat: 1
        });
        var blob = new Blob([out], { type: "image/gif" });
        outPreview.innerHTML = "";
        var img = new Image();
        img.src = URL.createObjectURL(blob);
        img.style.maxHeight = "260px";
        img.style.imageRendering = "pixelated";
        outPreview.appendChild(img);
        UI.download(blob, "merged.gif");
      } finally {
        gifBtn.disabled = false;
        setTimeout(function () { prog.hide(); }, 600);
      }
    }

    async function exportZip() {
      var sel = orderedFrames();
      if (!sel.length) return;
      zipBtn.disabled = true;
      prog.show("");
      try {
        var cv = UI.makeCanvas(sel[0].w, sel[0].h);
        var ctx = cv.getContext("2d");
        var files = [];
        for (var i = 0; i < sel.length; i++) {
          ctx.putImageData(new ImageData(new Uint8ClampedArray(sel[i].data), sel[i].w, sel[i].h), 0, 0);
          var blob = await new Promise(function (r) { cv.toBlob(r, "image/png"); });
          files.push({ name: "frame_" + String(i + 1).padStart(4, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) });
          prog.set((i + 1) / sel.length);
        }
        UI.download(FF.Zip.make(files), "gif_frames.zip");
      } finally {
        zipBtn.disabled = false;
        setTimeout(function () { prog.hide(); }, 600);
      }
    }

    workArea.appendChild(stripWrap);
    workArea.appendChild(reorderHint);
    workArea.appendChild(UI.el("div", { class: "param-grid mt14" }, [
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("gif.delay")]), UI.el("div", { class: "row" }, [delayIn, applyDelayBtn])]),
      UI.el("div", { class: "param-row" }, [UI.el("label", {}, [t("video.bg")]), bgIn])
    ]));
    workArea.appendChild(UI.el("div", { class: "btn-row mt14" }, [gifBtn, zipBtn, vstackBtn, hstackBtn, addMoreBtn]));
    workArea.appendChild(prog.el);
    workArea.appendChild(outPreview);

    // 简易拼接：帧序列上下(vertical=true)/左右拼成一张图
    function stitch(vertical) {
      var sel = orderedFrames();
      if (!sel.length) return;
      var W = sel[0].w, H = sel[0].h;
      var out;
      if (vertical) {
        out = UI.makeCanvas(W, H * sel.length);
        var c = out.getContext("2d");
        sel.forEach(function (f, i) {
          c.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h), 0, i * H);
        });
      } else {
        out = UI.makeCanvas(W * sel.length, H);
        var c2 = out.getContext("2d");
        sel.forEach(function (f, i) {
          c2.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h), i * W, 0);
        });
      }
      UI.downloadCanvas(out, (vertical ? "stitch_v_" : "stitch_h_") + sel.length + "frames.png");
    }

    card.appendChild(dz);
    card.appendChild(workArea);

    /* ============================================================
     * 扩展工具（对齐原站 gif 模块）：多图合成单图 / 批量裁剪 / 简易拼接
     * ============================================================ */

    var tabBar = UI.el("div", { class: "row mt14", style: { gap: "6px", flexWrap: "wrap" } }, []);
    var panes = [UI.el("div", {}), UI.el("div", { style: { display: "none" } }), UI.el("div", { style: { display: "none" } }), UI.el("div", { style: { display: "none" } })];
    var tabBtns = [];
    ["gif.tab.frames", "gif.tab.tosingle", "gif.tab.batchcrop", "gif.tab.stitch"].forEach(function (k, i) {
      var b = UI.btn(t(k), "btn-outline", function () { show(i); });
      b.style.fontSize = "12px";
      tabBtns.push(b);
      tabBar.appendChild(b);
    });
    function show(n) {
      tabBtns.forEach(function (b, i) { b.className = "btn " + (i === n ? "btn-primary" : "btn-outline"); });
      panes.forEach(function (p, i) { p.style.display = i === n ? "" : "none"; });
    }
    show(0);
    card.appendChild(tabBar);
    card.appendChild(panes[1]);
    card.appendChild(panes[2]);
    card.appendChild(panes[3]);
    // pane0 即现有流程（dz + workArea）——移动它们进去
    panes[0].appendChild(dz);
    panes[0].appendChild(workArea);
    card.appendChild(panes[0]);
    // 修正顺序：frame 工具放最上
    card.insertBefore(panes[0], tabBar);
    card.insertBefore(tabBar, panes[1]);

    /* ---------- 多图合成单图（含超级单图拆分 + 裁切） ---------- */

    (function () {
      var pane = panes[1];
      var imgs = [];   // {canvas, w, h}
      var colsIn = UI.el("input", { type: "number", value: "4", min: "1", style: { width: "72px" } });
      var cT = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var cB = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var cL = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var cR = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var splitC = UI.el("input", { type: "number", value: "4", min: "1", style: { width: "64px" } });
      var splitR = UI.el("input", { type: "number", value: "4", min: "1", style: { width: "64px" } });

      var grid = UI.el("div", { class: "filmstrip", style: { minHeight: "60px" } });
      function renderGrid() {
        grid.innerHTML = "";
        imgs.forEach(function (g, i) {
          var th = UI.el("div", { class: "thumb" }, [g.canvas, UI.el("div", { class: "t-idx" }, [String(i + 1)])]);
          th.addEventListener("dblclick", function () { imgs.splice(i, 1); renderGrid(); });
          grid.appendChild(th);
        });
      }
      var dzMulti = UI.dropzone({
        accept: "image/*", multiple: true, main: t("g1.upload"), hint: t("g1.uploadHint"),
        onFiles: function (files) {
          Promise.all(Array.from(files).map(function (f) {
            return UI.fileToImage(f).then(function (r) {
              var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
              c.getContext("2d").drawImage(r.img, 0, 0);
              r.release();
              return c;
            });
          })).then(function (cs) { imgs = imgs.concat(cs); renderGrid(); });
        }
      });
      // 超级单图拆分（透明线切割）
      var superBtn = UI.btn(t("g1.supersplit"), "btn-outline btn-sm", function () {
        var inp = UI.el("input", { type: "file", accept: "image/*", style: { display: "none" } });
        inp.addEventListener("change", function () {
          UI.fileToImage(inp.files[0]).then(function (r) {
            var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
            c.getContext("2d").drawImage(r.img, 0, 0);
            r.release();
            var im = c.getContext("2d").getImageData(0, 0, c.width, c.height);
            var pieces = superSplit(im);
            imgs = imgs.concat(pieces);
            renderGrid();
            FF.Toast.show(t("g1.splitDone").replace("{n}", pieces.length), "ok");
          });
        });
        inp.click();
      });
      function superSplit(im) {
        var w = im.width, h = im.height, d = im.data;
        var A = 8;
        // 行空白检测
        var rowHas = [];
        for (var y = 0; y < h; y++) {
          var has = false;
          for (var x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] > A) { has = true; break; }
          }
          rowHas.push(has);
        }
        var bands = [], s = -1;
        for (var y2 = 0; y2 < h; y2++) {
          if (rowHas[y2] && s < 0) s = y2;
          if ((!rowHas[y2] || y2 === h - 1) && s >= 0) {
            var e = rowHas[y2] ? y2 + 1 : y2;
            if (e > s) bands.push([s, e]);
            s = -1;
          }
        }
        var pieces = [];
        bands.forEach(function (b) {
          // 带内列空白检测
          var colHas = [];
          for (var x = 0; x < w; x++) {
            var has2 = false;
            for (var y = b[0]; y < b[1]; y++) {
              if (d[(y * w + x) * 4 + 3] > A) { has2 = true; break; }
            }
            colHas.push(has2);
          }
          var segs = [], s2 = -1;
          for (var x2 = 0; x2 < w; x2++) {
            if (colHas[x2] && s2 < 0) s2 = x2;
            if ((!colHas[x2] || x2 === w - 1) && s2 >= 0) {
              var e2 = colHas[x2] ? x2 + 1 : x2;
              if (e2 > s2) segs.push([s2, e2]);
              s2 = -1;
            }
          }
          segs.forEach(function (sg) {
            var pw = sg[1] - sg[0], ph = b[1] - b[0];
            var pc = UI.makeCanvas(pw, ph);
            pc.getContext("2d").drawImage(
              UI.imageDataToCanvas(im), sg[0], b[0], pw, ph, 0, 0, pw, ph);
            pieces.push(pc);
          });
        });
        return pieces;
      }
      // 裁切
      function cropped(c) {
        var T = +cT.value | 0, B = +cB.value | 0, L = +cL.value | 0, R = +cR.value | 0;
        if (!T && !B && !L && !R) return c;
        var w = c.width - L - R, h = c.height - T - B;
        if (w < 1 || h < 1) return c;
        var o = UI.makeCanvas(w, h);
        o.getContext("2d").drawImage(c, L, T, w, h, 0, 0, w, h);
        return o;
      }
      var combineBtn = UI.btn(t("g1.combine"), "btn-primary", function () {
        if (!imgs.length) { FF.Toast.show(t("g1.needImgs"), "warn"); return; }
        var N = Math.max(1, +colsIn.value | 0);
        var rows = Math.ceil(imgs.length / N);
        var cw = Math.max.apply(null, imgs.map(function (g) { return cropped(g).width; }));
        var ch = Math.max.apply(null, imgs.map(function (g) { return cropped(g).height; }));
        var out = UI.makeCanvas(N * cw, rows * ch);
        var ctx = out.getContext("2d");
        imgs.forEach(function (g, i) {
          var cc = cropped(g);
          // 水平居中，垂直靠下
          var x = (i % N) * cw + Math.floor((cw - cc.width) / 2);
          var y = Math.floor(i / N) * ch + (ch - cc.height);
          ctx.drawImage(cc, x, y);
        });
        resultBox.innerHTML = "";
        resultBox.appendChild(UI.canvasFrame(out));
        UI.downloadCanvas(out, "combined.png");
      });
      var splitBtn = UI.btn(t("g1.split"), "btn-outline", function () {
        var inp = UI.el("input", { type: "file", accept: "image/*", style: { display: "none" } });
        inp.addEventListener("change", function () {
          UI.fileToImage(inp.files[0]).then(function (r) {
            var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
            c.getContext("2d").drawImage(r.img, 0, 0);
            r.release();
            var C = Math.max(1, +splitC.value | 0), R = Math.max(1, +splitR.value | 0);
            var cw = Math.floor(c.width / C), chh = Math.floor(c.height / R);
            var pieces = [];
            for (var ry = 0; ry < R; ry++) {
              for (var rx = 0; rx < C; rx++) {
                var pc = UI.makeCanvas(cw, chh);
                pc.getContext("2d").drawImage(c, rx * cw, ry * chh, cw, chh, 0, 0, cw, chh);
                pieces.push(pc);
              }
            }
            imgs = imgs.concat(pieces);
            renderGrid();
          });
        });
        inp.click();
      });
      var resultBox = UI.el("div", { class: "mt14" }, []);
      pane.appendChild(UI.el("div", { class: "pb-title" }, [t("g1.inputMode")]));
      pane.appendChild(dzMulti);
      pane.appendChild(grid);
      pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap" } }, [
        superBtn, splitBtn,
        UI.el("span", { class: "hint-text" }, [t("g1.splitRC")]), splitC, splitR
      ]));
      pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap", alignItems: "center" } }, [
        UI.el("span", { class: "hint-text" }, [t("g1.cols")]), colsIn,
        UI.el("span", { class: "hint-text" }, [t("g1.crop")]),
        UI.el("span", { class: "hint-text" }, ["上"]), cT, UI.el("span", { class: "hint-text" }, ["下"]), cB,
        UI.el("span", { class: "hint-text" }, ["左"]), cL, UI.el("span", { class: "hint-text" }, ["右"]), cR
      ]));
      pane.appendChild(UI.el("div", { class: "mt14" }, [combineBtn]));
      pane.appendChild(resultBox);
    })();

    /* ---------- 批量裁剪 ---------- */

    (function () {
      var pane = panes[2];
      var imgs = [];
      var bT = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var bB = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var bL = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var bR = UI.el("input", { type: "number", value: "0", style: { width: "64px" } });
      var grid = UI.el("div", { class: "filmstrip", style: { minHeight: "60px" } });
      var dzB = UI.dropzone({
        accept: "image/*", multiple: true, main: t("g2.upload"), hint: "",
        onFiles: function (files) {
          Promise.all(Array.from(files).map(function (f) {
            return UI.fileToImage(f).then(function (r) {
              var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
              c.getContext("2d").drawImage(r.img, 0, 0);
              r.release();
              return c;
            });
          })).then(function (cs) {
            imgs = imgs.concat(cs);
            grid.innerHTML = "";
            imgs.forEach(function (g, i) {
              grid.appendChild(UI.el("div", { class: "thumb" }, [g, UI.el("div", { class: "t-idx" }, [String(i + 1)])]));
            });
          });
        }
      });
      var run = UI.btn(t("g2.run") + " (ZIP)", "btn-primary", function () {
        if (!imgs.length) return;
        var T = +bT.value | 0, B = +bB.value | 0, L = +bL.value | 0, R = +bR.value | 0;
        var files = [];
        var done = 0;
        prog.show(t("common.processing"));
        imgs.forEach(function (g, i) {
          var w = g.width - L - R, h = g.height - T - B;
          if (w < 1 || h < 1) { done++; return; }
          var o = UI.makeCanvas(w, h);
          o.getContext("2d").drawImage(g, L, T, w, h, 0, 0, w, h);
          o.toBlob(function (blob) {
            var fr = new FileReader();
            fr.onload = function () {
              files.push({ name: "crop_" + (i + 1) + ".png", data: new Uint8Array(fr.result) });
              if (++done === imgs.length) {
                prog.hide();
                UI.download(FF.Zip.make(files), "batch_crop.zip");
              }
            };
            fr.readAsArrayBuffer(blob);
          }, "image/png");
        });
      });
      pane.appendChild(dzB);
      pane.appendChild(grid);
      pane.appendChild(UI.el("div", { class: "row mt8", style: { gap: "6px", flexWrap: "wrap" } }, [
        UI.el("span", { class: "hint-text" }, [t("g2.crop")]),
        UI.el("span", { class: "hint-text" }, ["上"]), bT, UI.el("span", { class: "hint-text" }, ["下"]), bB,
        UI.el("span", { class: "hint-text" }, ["左"]), bL, UI.el("span", { class: "hint-text" }, ["右"]), bR, run
      ]));
    })();

    /* ---------- 简易拼接（上下/左右/融合叠放） ---------- */

    (function () {
      var pane = panes[3];
      var imgs = [];
      var dirSel = UI.selectRow(t("g3.dir"), [
        { v: "v", label: t("g3.v") }, { v: "h", label: t("g3.h") }, { v: "overlay", label: t("g3.overlay") }
      ], "v", {});
      var grid = UI.el("div", { class: "filmstrip", style: { minHeight: "60px" } });
      var dzS = UI.dropzone({
        accept: "image/*", multiple: true, main: t("g3.upload"), hint: "",
        onFiles: function (files) {
          Promise.all(Array.from(files).map(function (f) {
            return UI.fileToImage(f).then(function (r) {
              var c = UI.makeCanvas(r.img.naturalWidth, r.img.naturalHeight);
              c.getContext("2d").drawImage(r.img, 0, 0);
              r.release();
              return c;
            });
          })).then(function (cs) {
            imgs = imgs.concat(cs);
            grid.innerHTML = "";
            imgs.forEach(function (g, i) {
              grid.appendChild(UI.el("div", { class: "thumb" }, [g, UI.el("div", { class: "t-idx" }, [String(i + 1)])]));
            });
          });
        }
      });
      var run = UI.btn(t("g3.run"), "btn-primary", function () {
        if (!imgs.length) return;
        var out;
        if (dirSel.value === "v") {
          var W = Math.max.apply(null, imgs.map(function (c) { return c.width; }));
          var TH = imgs.reduce(function (s, c) { return s + c.height; }, 0);
          out = UI.makeCanvas(W, TH);
          var ctx = out.getContext("2d");
          var y = 0;
          imgs.forEach(function (c) { ctx.drawImage(c, Math.floor((W - c.width) / 2), y); y += c.height; });
        } else if (dirSel.value === "h") {
          var H = Math.max.apply(null, imgs.map(function (c) { return c.height; }));
          var TW = imgs.reduce(function (s, c) { return s + c.width; }, 0);
          out = UI.makeCanvas(TW, H);
          var ctx2 = out.getContext("2d");
          var x = 0;
          imgs.forEach(function (c) { ctx2.drawImage(c, x, Math.floor((H - c.height) / 2)); x += c.width; });
        } else {
          var W2 = Math.max.apply(null, imgs.map(function (c) { return c.width; }));
          var H2 = Math.max.apply(null, imgs.map(function (c) { return c.height; }));
          out = UI.makeCanvas(W2, H2);
          var ctx3 = out.getContext("2d");
          imgs.forEach(function (c) { ctx3.drawImage(c, 0, 0); });
        }
        resultBox.innerHTML = "";
        resultBox.appendChild(UI.canvasFrame(out));
        UI.downloadCanvas(out, "stitched.png");
      });
      var resultBox = UI.el("div", { class: "mt14" }, []);
      pane.appendChild(dzS);
      pane.appendChild(grid);
      pane.appendChild(dirSel.el);
      pane.appendChild(UI.el("div", { class: "mt14" }, [run]));
      pane.appendChild(resultBox);
    })();

    return { root: root };
  };
})();
