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

    return { root: root };
  };
})();
